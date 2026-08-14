<?php

namespace App\Controllers;

use App\Services\DB;
use App\Middleware\AuthMiddleware;

require_once __DIR__ . '/../helpers/tax.php';

class OvertimeApprovalController
{
    /**
     * GET /api/v1/organizations/{org_id}/overtime-approvals
     * Defaults to pending; pass ?status=approved|rejected to see history.
     */
    public function index($orgId)
    {
        try {
            $status = $_GET['status'] ?? 'pending';

            $rows = DB::raw(
                "SELECT oa.*, e.employee_number, e.firstname, e.middlename, e.surname,
                        ad.attendance_date, ad.check_in_time, ad.check_out_time, ad.scheduled_minutes
                 FROM overtime_approvals oa
                 JOIN employees e ON oa.employee_id = e.id
                 JOIN employee_attendance_days ad ON oa.attendance_day_id = ad.id
                 WHERE oa.organization_id = :org_id AND oa.status = :status AND oa.is_active = 1
                 ORDER BY ad.attendance_date DESC",
                [':org_id' => $orgId, ':status' => $status]
            );

            return responseJson(success: true, data: $rows, message: "Fetched " . count($rows) . " overtime request(s)", code: 200);
        } catch (\Exception $e) {
            error_log("Overtime approval index error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to fetch overtime approvals: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/overtime-approvals/{id}/approve
     * Body (optional): { "overtime_rate": 1.5, "approval_notes": "..." }
     *
     * Approving marks the request approved. What happens next depends on which
     * payrun period the attendance date falls into:
     *   - No matching payrun / matching payrun is DRAFT → pushed straight into
     *     that draft's payrun_details (original behaviour).
     *   - Matching payrun is REVIEWED or FINALIZED → the period is locked, so
     *     we do NOT silently push it anywhere. We flag it as
     *     "requires_resolution" and the payroll officer must call
     *     POST .../overtime-approvals/{id}/resolve to choose off_cycle or
     *     carry_forward (see resolve()).
     */
    public function approve($orgId, $id)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();

            $data = validate([
                'overtime_rate'   => 'numeric',
                'approval_notes'  => 'string',
            ]);

            $existing = $this->findPending($orgId, $id);
            if (!$existing) {
                return responseJson(success: false, message: "Pending overtime request not found", code: 404);
            }

            $overtimeAmount = null;
            if (!empty($data['overtime_rate'])) {
                // overtime_rate expressed as an hourly rate multiplier's currency value
                // supplied by payroll config; amount = (minutes/60) * rate.
                $overtimeAmount = round(($existing->overtime_minutes / 60) * $data['overtime_rate'], 2);
            }

            DB::raw(
                "UPDATE overtime_approvals
                 SET status = 'approved', approved_by = :approved_by, approved_at = NOW(),
                     overtime_rate = COALESCE(:rate, overtime_rate),
                     overtime_amount = COALESCE(:amount, overtime_amount),
                     approval_notes = :notes, updated_at = NOW()
                 WHERE id = :id",
                [
                    ':approved_by' => $user['id'],
                    ':rate'        => $data['overtime_rate'] ?? null,
                    ':amount'      => $overtimeAmount,
                    ':notes'       => $data['approval_notes'] ?? null,
                    ':id'          => $id,
                ]
            );

            $updated = DB::raw("SELECT * FROM overtime_approvals WHERE id = :id", [':id' => $id]);
            $approvedRow = $updated[0] ?? null;

            if (!$approvedRow || empty($approvedRow->overtime_amount)) {
                return responseJson(
                    success: true,
                    data: $approvedRow,
                    message: "Overtime approved",
                    code: 200
                );
            }

            // ---- Which payrun period does this attendance date belong to? ----
            // NOTE: more than one payrun can cover the same dates (e.g. a regular
            // payrun plus an off-cycle/adjustment payrun), so we fetch all of them
            // rather than assuming there's a single match.
            $attendanceDate = $this->getAttendanceDate($id);
            $periodPayruns  = $attendanceDate ? $this->findPayrunsForPeriod($orgId, $attendanceDate) : [];

            // A locked payrun always wins, regardless of what other draft/off-cycle
            // payruns also happen to cover the same dates.
            $periodPayrun = null;
            foreach ($periodPayruns as $p) {
                if (in_array($p->status, ['reviewed', 'finalized'])) {
                    $periodPayrun = $p;
                    break;
                }
            }

            if ($periodPayrun) {
                // Period is locked. Do NOT auto-push. Flag for officer resolution.
                DB::raw(
                    "UPDATE overtime_approvals
                     SET finalized_period_payrun_id = :payrun_id, resolution = NULL, updated_at = NOW()
                     WHERE id = :id",
                    [':payrun_id' => $periodPayrun->id, ':id' => $id]
                );

                $this->createAuditLog($orgId, $user['id'], 'overtime_approvals', $id, 'locked_period_detected', [
                    'attendance_date'     => $attendanceDate,
                    'matched_payrun_id'   => $periodPayrun->id,
                    'matched_payrun_name' => $periodPayrun->payrun_name,
                    'matched_status'      => $periodPayrun->status,
                ]);

                $resolutionOptions = $periodPayrun->status === 'finalized'
                    ? ['off_cycle', 'carry_forward']
                    : ['carry_forward']; // reviewed-but-not-finalized: off-cycle isn't needed, reopen is the alternative

                $updated = DB::raw("SELECT * FROM overtime_approvals WHERE id = :id", [':id' => $id]);

                return responseJson(
                    success: true,
                    data: array_merge((array) ($updated[0] ?? $approvedRow), [
                        'requires_resolution' => true,
                        'matched_payrun'      => [
                            'id'     => $periodPayrun->id,
                            'name'   => $periodPayrun->payrun_name,
                            'status' => $periodPayrun->status,
                        ],
                        'resolution_options'  => $resolutionOptions,
                    ]),
                    message: "Overtime approved, but its pay period ({$periodPayrun->payrun_name}) is already " .
                        "{$periodPayrun->status}. Choose how to pay it via POST .../overtime-approvals/{$id}/resolve.",
                    code: 200
                );
            }

            // Period is open (draft) or has no payrun yet — safe to push straight in.
            $draftPayrun = null;
            foreach ($periodPayruns as $p) {
                if ($p->status === 'draft') {
                    $draftPayrun = $p;
                    break;
                }
            }
            $preferredPayrunId = $draftPayrun->id ?? null;
            $payrollPushed = $this->pushToDraftPayrun($orgId, $approvedRow, $preferredPayrunId);

            return responseJson(
                success: true,
                data: $approvedRow,
                message: "Overtime approved" . ($payrollPushed ? " and added to draft payrun" : ""),
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Overtime approve error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to approve overtime: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/overtime-approvals/{id}/reject
     * Body: { "rejection_reason": "..." } — required
     */
    public function reject($orgId, $id)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();

            $data = validate(['rejection_reason' => 'required,string']);

            $existing = $this->findPending($orgId, $id);
            if (!$existing) {
                return responseJson(success: false, message: "Pending overtime request not found", code: 404);
            }

            DB::raw(
                "UPDATE overtime_approvals
                 SET status = 'rejected', rejected_by = :rejected_by, rejected_at = NOW(),
                     rejection_reason = :reason, updated_at = NOW()
                 WHERE id = :id",
                [':rejected_by' => $user['id'], ':reason' => $data['rejection_reason'], ':id' => $id]
            );

            $updated = DB::raw("SELECT * FROM overtime_approvals WHERE id = :id", [':id' => $id]);

            return responseJson(success: true, data: $updated[0] ?? null, message: "Overtime rejected", code: 200);
        } catch (\Exception $e) {
            error_log("Overtime reject error: " . $e->getMessage());
            return responseJson(success: false, message: "Failed to reject overtime: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/overtime-approvals/{id}/resolve
     * Body: { "resolution": "off_cycle" | "carry_forward" }
     *
     * Called after approve() has flagged an overtime item as
     * requires_resolution (its attendance date falls inside a payrun that's
     * already reviewed or finalized). The payroll officer picks how it gets
     * paid:
     *   - off_cycle:      only valid when the matched payrun is FINALIZED.
     *                      Creates/reuses a "<Month Year> Adjustment NN" draft
     *                      payrun for just the incremental (delta) tax + net pay
     *                      (req #3).
     *   - carry_forward:  valid from REVIEWED or FINALIZED. Folds the raw
     *                      overtime amount into the next regular draft payrun's
     *                      payrun_details, or queues it if that draft doesn't
     *                      exist yet — it will be picked up automatically the
     *                      next time PayrunController::finalizePayrun() creates
     *                      that draft (req #4).
     */
    public function resolve($orgId, $id)
    {
        try {
            $user = AuthMiddleware::getCurrentUser();
            if (!$user) {
                return responseJson(success: false, message: "Authentication required", code: 401);
            }

            $data = validate(['resolution' => 'required,string']);
            $resolution = $data['resolution'];

            if (!in_array($resolution, ['off_cycle', 'carry_forward'])) {
                return responseJson(
                    success: false,
                    message: "resolution must be 'off_cycle' or 'carry_forward'",
                    code: 400
                );
            }

            $rows = DB::raw(
                "SELECT * FROM overtime_approvals
                 WHERE id = :id AND organization_id = :org_id AND status = 'approved'
                   AND salary_included = 0 AND finalized_period_payrun_id IS NOT NULL
                 LIMIT 1",
                [':id' => $id, ':org_id' => $orgId]
            );

            if (empty($rows)) {
                return responseJson(
                    success: false,
                    message: "No pending-resolution overtime item found for this ID " .
                        "(it may already be resolved, or its period isn't locked).",
                    code: 404
                );
            }

            $overtime = $rows[0];

            $matchedPayrunRows = DB::raw(
                "SELECT * FROM payruns WHERE id = :id",
                [':id' => $overtime->finalized_period_payrun_id]
            );
            if (empty($matchedPayrunRows)) {
                return responseJson(success: false, message: "Matched payrun period no longer exists", code: 404);
            }
            $matchedPayrun = $matchedPayrunRows[0];

            if ($resolution === 'off_cycle' && $matchedPayrun->status !== 'finalized') {
                return responseJson(
                    success: false,
                    message: "off_cycle is only available once the original payrun is finalized. " .
                        "This one is still 'reviewed' — reopen it, or choose carry_forward instead.",
                    code: 400
                );
            }

            if ($resolution === 'off_cycle') {
                $result = $this->createOffCycleAdjustment($orgId, (int) $user['id'], $matchedPayrun, $overtime);
            } else {
                $result = $this->applyCarryForward($orgId, (int) $user['id'], $matchedPayrun, $overtime);
            }

            return responseJson(
                success: true,
                data: $result,
                message: $result['message'],
                code: 200
            );
        } catch (\Exception $e) {
            error_log("Overtime resolve error: " . $e->getMessage());
            error_log($e->getTraceAsString());
            return responseJson(success: false, message: "Failed to resolve overtime: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * Called by PayrunController (payroll generation) — NOT exposed as a route
     * here, listed for structural completeness per the "support payroll
     * recalculation later" requirement. Marks approved, not-yet-included
     * overtime as consumed by a specific payrun.
     */
    public function markIncludedInPayroll($orgId, array $overtimeApprovalIds)
    {
        if (empty($overtimeApprovalIds)) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($overtimeApprovalIds), '?'));
        $sql = "UPDATE overtime_approvals SET salary_included = 1, updated_at = NOW()
                WHERE organization_id = ? AND status = 'approved' AND salary_included = 0
                  AND id IN ($placeholders)";

        return DB::raw($sql, array_merge([$orgId], $overtimeApprovalIds));
    }

    /**
     * Adds an approved overtime amount straight into a DRAFT payrun's
     * payrun_details row for the employee, then flags the overtime_approvals
     * row as consumed so it isn't pulled in twice.
     *
     * @param int|null $preferredPayrunId Draft payrun matching the attendance
     *                                    period, if one was found. Falls back
     *                                    to the earliest open draft otherwise
     *                                    (original behaviour, kept for the
     *                                    case where no payrun covers the date
     *                                    yet).
     */
    private function pushToDraftPayrun($orgId, $overtimeApproval, $preferredPayrunId = null)
    {
        if ($preferredPayrunId) {
            $payrunId = $preferredPayrunId;
        } else {
            $draft = DB::raw(
                "SELECT id FROM payruns
                 WHERE organization_id = :org_id AND status = 'draft'
                 ORDER BY pay_period_start ASC LIMIT 1",
                [':org_id' => $orgId]
            );

            if (empty($draft)) {
                // No draft payrun open yet — leave it approved but unconsumed;
                // it'll be picked up next time markIncludedInPayroll-style logic runs.
                return false;
            }

            $payrunId = $draft[0]->id;
        }

        $detail = DB::raw(
            "SELECT id FROM payrun_details WHERE payrun_id = :payrun_id AND employee_id = :employee_id LIMIT 1",
            [':payrun_id' => $payrunId, ':employee_id' => $overtimeApproval->employee_id]
        );

        if (empty($detail)) {
            // Per current design this shouldn't happen (finalize() always
            // carries the full employee list into the next draft), but guard anyway.
            error_log("pushToDraftPayrun: no payrun_details row for employee {$overtimeApproval->employee_id} in draft payrun {$payrunId}");
            return false;
        }

        DB::raw(
            "UPDATE payrun_details
             SET overtime_amount = overtime_amount + :amount1,
                 gross_pay = gross_pay + :amount2,
                 updated_at = NOW()
             WHERE id = :id",
            [
                ':amount1' => $overtimeApproval->overtime_amount,
                ':amount2' => $overtimeApproval->overtime_amount,
                ':id'      => $detail[0]->id,
            ]
        );

        $this->markIncludedInPayroll($orgId, [$overtimeApproval->id]);

        return true;
    }

    /**
     * Req #3 — off-cycle / adjustment payroll.
     *
     * Recomputes tax treating (original basic_salary + overtime_amount) as the
     * new taxable base — exactly mirroring how calculateNetPay() would have
     * taxed it had it been included in the original run — then takes the
     * DELTA against the already-paid original figures. Only that delta is
     * inserted into the off-cycle run, so the off-cycle run's own totals are
     * exactly what still needs to be disbursed.
     *
     * Worked example (matches the brief):
     *   original: basic 100,000 → net 70,441.64
     *   overtime: 6,000 → recompute with basic treated as 106,000 → net 74,211.14
     *   delta net to pay out via the off-cycle run: 74,211.14 - 70,441.64 = 3,769.50
     */
    private function createOffCycleAdjustment($orgId, int $userId, $originalPayrun, $overtime)
    {
        $origDetailRows = DB::raw(
            "SELECT * FROM payrun_details WHERE payrun_id = :payrun_id AND employee_id = :employee_id LIMIT 1",
            [':payrun_id' => $originalPayrun->id, ':employee_id' => $overtime->employee_id]
        );

        if (empty($origDetailRows)) {
            throw new \RuntimeException(
                "No payrun_details found for employee {$overtime->employee_id} in finalized payrun {$originalPayrun->id}"
            );
        }
        $orig = $origDetailRows[0];

        $config = loadTaxConfig((int) $orgId);

        $overtimeAmount   = (float) $overtime->overtime_amount;
        $newBasisForTax   = (float) $orig->basic_salary + $overtimeAmount;
        $otherVariablePay = (float) $orig->bonus_amount + (float) $orig->commission_amount;
        $newGrossPay      = $newBasisForTax + $otherVariablePay;

        $recomputed = calculateNetPay($newBasisForTax, $newGrossPay, $config);

        $deltaNssf         = round($recomputed['nssf']              - (float) $orig->nssf,               2);
        $deltaShif         = round($recomputed['shif']              - (float) $orig->shif,                2);
        $deltaHousingLevy  = round($recomputed['housing_levy']      - (float) $orig->housing_levy,        2);
        $deltaTaxable      = round($recomputed['taxable_income']    - (float) $orig->taxable_income,      2);
        $deltaTaxBefore    = round($recomputed['tax_before_relief'] - (float) $orig->tax_before_relief,   2);
        $deltaPaye         = round($recomputed['paye']              - (float) $orig->paye,                2);
        $deltaTotalDeduct  = round($deltaNssf + $deltaShif + $deltaHousingLevy + $deltaPaye, 2);
        $deltaNetPay       = round($overtimeAmount - $deltaTotalDeduct, 2);

        $now = date('Y-m-d H:i:s');

        $transactionResult = DB::transaction(function () use (
            $orgId, $userId, $originalPayrun, $overtime, $overtimeAmount,
            $deltaNssf, $deltaShif, $deltaHousingLevy, $deltaTaxable, $deltaTaxBefore,
            $deltaPaye, $deltaTotalDeduct, $deltaNetPay, $now
        ) {
            // Reuse an open (draft) adjustment run for this original payrun if one
            // exists, so several late-overtime employees can be batched into the
            // same "March 2026 Adjustment 01" run.
            $openAdjustment = DB::raw(
                "SELECT id FROM payruns
                 WHERE organization_id = :org_id AND parent_payrun_id = :parent_id
                   AND payrun_type = 'off_cycle' AND status = 'draft' AND deleted_at IS NULL
                 ORDER BY id DESC LIMIT 1",
                [':org_id' => $orgId, ':parent_id' => $originalPayrun->id]
            );

            if (!empty($openAdjustment)) {
                $offCyclePayrunId = $openAdjustment[0]->id;
            } else {
                $seqCount = DB::raw(
                    "SELECT COUNT(*) as cnt FROM payruns
                     WHERE organization_id = :org_id AND parent_payrun_id = :parent_id AND payrun_type = 'off_cycle'",
                    [':org_id' => $orgId, ':parent_id' => $originalPayrun->id]
                );
                $seq = (int) ($seqCount[0]->cnt ?? 0) + 1;
                $adjustmentName = date('F Y', strtotime($originalPayrun->pay_period_start)) .
                    ' Adjustment ' . str_pad((string) $seq, 2, '0', STR_PAD_LEFT);

                DB::table('payruns')->insert([
                    'organization_id'  => $orgId,
                    'payrun_name'      => $adjustmentName,
                    'pay_period_start' => $originalPayrun->pay_period_start,
                    'pay_period_end'   => $originalPayrun->pay_period_end,
                    'pay_frequency'    => $originalPayrun->pay_frequency,
                    'status'           => 'draft',
                    'payrun_type'      => 'off_cycle',
                    'parent_payrun_id' => $originalPayrun->id,
                    'total_gross_pay'  => 0.00,
                    'total_deductions' => 0.00,
                    'total_net_pay'    => 0.00,
                    'employee_count'   => 0,
                    'created_by'       => $userId,
                    'created_at'       => $now,
                ]);

                $offCyclePayrunId = DB::lastInsertId();

                $this->createAuditLog($orgId, $userId, 'payruns', $offCyclePayrunId, 'auto_create', [
                    'source'             => 'off_cycle_adjustment',
                    'parent_payrun_id'   => $originalPayrun->id,
                    'parent_payrun_name' => $originalPayrun->payrun_name,
                ]);
            }

            // One payrun_details row per employee (unique_payrun_employee) — if this
            // employee already has a delta row in this adjustment run (another late
            // overtime item), accumulate into it instead of failing on the unique key.
            $existingDetail = DB::raw(
                "SELECT id FROM payrun_details WHERE payrun_id = :payrun_id AND employee_id = :employee_id LIMIT 1",
                [':payrun_id' => $offCyclePayrunId, ':employee_id' => $overtime->employee_id]
            );

            if (!empty($existingDetail)) {
                $detailId = $existingDetail[0]->id;
                DB::raw(
                    "UPDATE payrun_details
                     SET overtime_amount   = overtime_amount   + :ot,
                         nssf              = nssf              + :nssf,
                         shif              = shif              + :shif,
                         housing_levy      = housing_levy      + :housing,
                         taxable_income    = taxable_income    + :taxable,
                         tax_before_relief = tax_before_relief + :taxbefore,
                         paye              = paye              + :paye,
                         gross_pay         = gross_pay         + :ot,
                         total_deductions  = total_deductions  + :totaldeduct,
                         net_pay           = net_pay           + :netpay,
                         updated_at        = NOW()
                     WHERE id = :id",
                    [
                        ':ot' => $overtimeAmount, ':nssf' => $deltaNssf, ':shif' => $deltaShif,
                        ':housing' => $deltaHousingLevy, ':taxable' => $deltaTaxable,
                        ':taxbefore' => $deltaTaxBefore, ':paye' => $deltaPaye,
                        ':totaldeduct' => $deltaTotalDeduct, ':netpay' => $deltaNetPay,
                        ':id' => $detailId,
                    ]
                );
            } else {
                DB::table('payrun_details')->insert([
                    'payrun_id'          => $offCyclePayrunId,
                    'organization_id'    => $orgId,
                    'employee_id'        => $overtime->employee_id,
                    'basic_salary'       => 0.00, // this row represents ONLY the overtime delta, not a basic salary
                    'overtime_amount'    => round($overtimeAmount, 2),
                    'bonus_amount'       => 0.00,
                    'commission_amount'  => 0.00,
                    'nssf'               => $deltaNssf,
                    'shif'               => $deltaShif,
                    'housing_levy'       => $deltaHousingLevy,
                    'taxable_income'     => $deltaTaxable,
                    'tax_before_relief'  => $deltaTaxBefore,
                    'personal_relief'    => 0.00, // relief already fully consumed by the original run
                    'paye'               => $deltaPaye,
                    'gross_pay'          => round($overtimeAmount, 2),
                    'total_deductions'   => $deltaTotalDeduct,
                    'net_pay'            => $deltaNetPay,
                ]);
                $detailId = DB::lastInsertId();
            }

            // Recompute the off-cycle payrun's totals from all its detail rows
            $totals = DB::raw(
                "SELECT COUNT(*) as cnt, COALESCE(SUM(gross_pay),0) as gross,
                        COALESCE(SUM(total_deductions),0) as deductions, COALESCE(SUM(net_pay),0) as net
                 FROM payrun_details WHERE payrun_id = :payrun_id",
                [':payrun_id' => $offCyclePayrunId]
            );
            $t = $totals[0];

            DB::table('payruns')->update(
                [
                    'employee_count'   => (int) $t->cnt,
                    'total_gross_pay'  => round((float) $t->gross, 2),
                    'total_deductions' => round((float) $t->deductions, 2),
                    'total_net_pay'    => round((float) $t->net, 2),
                ],
                'id',
                $offCyclePayrunId
            );

            // Generate a payslip for this delta so it's visible/traceable independently
            $payslipExists = DB::raw(
                "SELECT id FROM payslips WHERE payrun_id = :payrun_id AND employee_id = :employee_id LIMIT 1",
                [':payrun_id' => $offCyclePayrunId, ':employee_id' => $overtime->employee_id]
            );
            if (empty($payslipExists)) {
                $period = new \DateTime($originalPayrun->pay_period_start);
                DB::table('payslips')->insert([
                    'organization_id'  => $orgId,
                    'payrun_id'        => $offCyclePayrunId,
                    'payrun_detail_id' => $detailId,
                    'employee_id'      => $overtime->employee_id,
                    'payslip_number'   => sprintf(
                        'PAYSLIP-ADJ-%s-%s-EMP%d',
                        $period->format('Y'),
                        $period->format('m'),
                        $overtime->employee_id
                    ),
                    'status'       => 'generated',
                    'generated_at' => $now,
                    'metadata'     => json_encode([
                        'type'                 => 'off_cycle_adjustment',
                        'original_payrun_id'   => $originalPayrun->id,
                        'original_payrun_name' => $originalPayrun->payrun_name,
                        'overtime_approval_id' => $overtime->id,
                    ]),
                ]);
            }

            // Mark the overtime item resolved
            DB::raw(
                "UPDATE overtime_approvals
                 SET resolution = 'off_cycle', resolved_payrun_id = :resolved_id,
                     resolved_by = :resolved_by, resolved_at = NOW(),
                     salary_included = 1, updated_at = NOW()
                 WHERE id = :id",
                [':resolved_id' => $offCyclePayrunId, ':resolved_by' => $userId, ':id' => $overtime->id]
            );

            return (int) $offCyclePayrunId;
        });

        $offCyclePayrunId = $transactionResult;

        $this->createAuditLog($orgId, $userId, 'payruns', $offCyclePayrunId, 'off_cycle_adjustment_linked', [
            'overtime_approval_id' => $overtime->id,
            'employee_id'          => $overtime->employee_id,
            'original_payrun_id'   => $originalPayrun->id,
            'overtime_amount'      => $overtimeAmount,
            'delta_net_pay'        => $deltaNetPay,
        ]);

        return [
            'off_cycle_payrun_id'    => $offCyclePayrunId,
            'original_payrun_id'     => $originalPayrun->id,
            'overtime_amount'        => round($overtimeAmount, 2),
            'delta_total_deductions' => $deltaTotalDeduct,
            'delta_net_pay'          => $deltaNetPay,
            'status'                 => 'draft',
            'message'                => "Off-cycle adjustment created. Amount to disburse for this overtime item: " .
                number_format($deltaNetPay, 2) . ". Review and finalize the off-cycle payrun independently to pay it out.",
        ];
    }

    /**
     * Req #4 — carry the overtime into the next regular payrun.
     * If that draft already exists, apply immediately (raw add, no retax —
     * consistent with pushToDraftPayrun(); processPayrun() will true up the
     * tax figures before it's reviewed). If it doesn't exist yet, queue it —
     * PayrunController::finalizePayrun() automatically folds any queued
     * carry-forward overtime into the next draft the moment it's created.
     */
    private function applyCarryForward($orgId, int $userId, $matchedPayrun, $overtime)
    {
        $now = date('Y-m-d H:i:s');

        $nextDraft = DB::raw(
            "SELECT id, payrun_name FROM payruns
             WHERE organization_id = :org_id AND payrun_type = 'regular' AND status = 'draft'
               AND pay_period_start > :period_end AND deleted_at IS NULL
             ORDER BY pay_period_start ASC LIMIT 1",
            [':org_id' => $orgId, ':period_end' => $matchedPayrun->pay_period_end]
        );

        if (empty($nextDraft)) {
            // No next draft yet — queue it. Will be auto-applied when
            // finalizePayrun() creates the next regular payrun.
            DB::raw(
                "UPDATE overtime_approvals
                 SET resolution = 'carry_forward', resolved_payrun_id = NULL,
                     resolved_by = :resolved_by, resolved_at = NOW(), updated_at = NOW()
                 WHERE id = :id",
                [':resolved_by' => $userId, ':id' => $overtime->id]
            );

            $this->createAuditLog($orgId, $userId, 'overtime_approvals', $overtime->id, 'carry_forward_queued', [
                'employee_id'        => $overtime->employee_id,
                'original_payrun_id' => $matchedPayrun->id,
                'overtime_amount'    => (float) $overtime->overtime_amount,
            ]);

            return [
                'resolution'      => 'carry_forward',
                'status'          => 'pending',
                'employee_id'     => $overtime->employee_id,
                'overtime_amount' => (float) $overtime->overtime_amount,
                'message'         => "No draft payrun exists yet for the next period. This overtime is queued as " .
                    "carry-forward and will be added automatically as soon as the next regular payrun is created.",
            ];
        }

        $targetPayrunId = $nextDraft[0]->id;

        $detail = DB::raw(
            "SELECT id FROM payrun_details WHERE payrun_id = :payrun_id AND employee_id = :employee_id LIMIT 1",
            [':payrun_id' => $targetPayrunId, ':employee_id' => $overtime->employee_id]
        );

        if (empty($detail)) {
            throw new \RuntimeException(
                "No payrun_details row for employee {$overtime->employee_id} in next draft payrun {$targetPayrunId}"
            );
        }

        DB::raw(
            "UPDATE payrun_details
             SET overtime_amount = overtime_amount + :amount1,
                 gross_pay = gross_pay + :amount2,
                 updated_at = NOW()
             WHERE id = :id",
            [
                ':amount1' => (float) $overtime->overtime_amount,
                ':amount2' => (float) $overtime->overtime_amount,
                ':id'      => $detail[0]->id,
            ]
        );

        DB::raw(
            "UPDATE overtime_approvals
             SET resolution = 'carry_forward', resolved_payrun_id = :resolved_id,
                 resolved_by = :resolved_by, resolved_at = NOW(), salary_included = 1, updated_at = NOW()
             WHERE id = :id",
            [':resolved_id' => $targetPayrunId, ':resolved_by' => $userId, ':id' => $overtime->id]
        );

        $this->createAuditLog($orgId, $userId, 'payruns', $targetPayrunId, 'carry_forward_applied', [
            'overtime_approval_id' => $overtime->id,
            'employee_id'          => $overtime->employee_id,
            'original_payrun_id'   => $matchedPayrun->id,
            'overtime_amount'      => (float) $overtime->overtime_amount,
        ]);

        return [
            'resolution'          => 'carry_forward',
            'status'              => 'applied',
            'target_payrun_id'    => $targetPayrunId,
            'target_payrun_name'  => $nextDraft[0]->payrun_name,
            'overtime_amount'     => (float) $overtime->overtime_amount,
            'message'             => "Overtime carried forward into '{$nextDraft[0]->payrun_name}'. " .
                "Run processPayrun on that draft to true up the tax figures before reviewing it.",
        ];
    }

    /**
     * Find all payruns (any status) whose pay period covers the given date,
     * for this organisation. Off-cycle/adjustment payruns commonly overlap a
     * regular payrun's dates, so this can legitimately return more than one
     * row — callers must not assume a single match.
     */
    private function findPayrunsForPeriod($orgId, string $date)
    {
        return DB::raw(
            "SELECT * FROM payruns
             WHERE organization_id = :org_id AND deleted_at IS NULL
               AND :att_date BETWEEN pay_period_start AND pay_period_end
             ORDER BY pay_period_start DESC",
            [':org_id' => $orgId, ':att_date' => $date]
        );
    }

    /**
     * Attendance date for a given overtime_approvals row (joins through
     * employee_attendance_days, since overtime_approvals itself only stores
     * attendance_day_id).
     */
    private function getAttendanceDate($overtimeApprovalId)
    {
        $rows = DB::raw(
            "SELECT ad.attendance_date
             FROM overtime_approvals oa
             JOIN employee_attendance_days ad ON oa.attendance_day_id = ad.id
             WHERE oa.id = :id LIMIT 1",
            [':id' => $overtimeApprovalId]
        );

        return $rows[0]->attendance_date ?? null;
    }

    private function findPending($orgId, $id)
    {
        $rows = DB::raw(
            "SELECT * FROM overtime_approvals WHERE id = :id AND organization_id = :org_id AND status = 'pending' LIMIT 1",
            [':id' => $id, ':org_id' => $orgId]
        );
        return $rows[0] ?? null;
    }

    private function createAuditLog($orgId, $userId, $entityType, $entityId, $action, $details = null)
    {
        try {
            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id'         => $userId,
                'entity_type'     => $entityType,
                'entity_id'       => $entityId,
                'action'          => $action,
                'details'         => $details ? json_encode($details) : null,
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Failed to create audit log: " . $e->getMessage());
        }
    }
}