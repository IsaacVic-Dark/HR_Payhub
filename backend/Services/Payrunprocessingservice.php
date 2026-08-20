<?php

namespace App\Services;

require_once __DIR__ . '/../helpers/tax.php';

/**
 * PayrunProcessingService
 *
 * Processes all employees for a given payrun in a single operation.
 *
 * Workflow:
 *  1. Load organisation tax config from organization_configs
 *  2. Fetch all active employees in the organisation
 *  3. For each employee:
 *     a. Gather basic salary, overtime, bonuses, commissions
 *     b. Pull in-period per diems, reimbursements and allowances explicitly
 *        attached to this payrun (allowances via the allowance_types /
 *        employee_allowance / employee_allowance_payrun_lines module) → add to gross
 *     c. Pull in-period voluntary deductions (loans, advances, Sacco) → extra deductions
 *     d. Calculate gross pay, NSSF, SHIF, Housing Levy, PAYE, net pay
 *     e. Upsert payrun_details row
 *     f. Insert payrun_deductions rows per config item
 *  4. Update payrun totals (total_gross_pay, total_deductions, total_net_pay, employee_count)
 *  5. Write audit log
 */
class PayrunProcessingService
{
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Process an entire payrun.
     *
     * @param  int   $orgId      Organisation ID
     * @param  int   $payrunId   Payrun ID (must be in 'draft' or 'reviewed' status)
     * @param  int   $userId     ID of the user triggering the process
     * @return array  Summary: employee_count, total_gross, total_deductions, total_net, errors[]
     */
    public function process(int $orgId, int $payrunId, int $userId): array
    {
        // 1. Load payrun header
        $payrun = $this->getPayrun($payrunId, $orgId);

        if (!$payrun) {
            throw new \RuntimeException("Payrun #$payrunId not found for organisation #$orgId");
        }

        if ($payrun->status === 'finalized') {
            throw new \RuntimeException("Payrun #$payrunId is already finalised and cannot be reprocessed");
        }

        // 2. Load statutory rates from organization_configs
        $taxConfig = loadTaxConfig($orgId);

        // 3. Load all voluntary/org deduction configs (loans, advances, Sacco, benefit, per_diem)
        $deductionConfigs = $this->getDeductionConfigs($orgId);

        // 4. Load all active employees
        $employees = $this->getActiveEmployees($orgId);

        if (empty($employees)) {
            throw new \RuntimeException("No active employees found for organisation #$orgId");
        }

        $summary = [
            'employee_count'   => 0,
            'total_gross'      => 0.0,
            'total_deductions' => 0.0,
            'total_net'        => 0.0,
            'errors'           => [],
        ];

        // 5. Process each employee
        foreach ($employees as $employee) {
            try {
                $result = $this->processEmployee(
                    $employee,
                    $payrun,
                    $taxConfig,
                    $deductionConfigs,
                    $orgId
                );

                $summary['employee_count']++;
                $summary['total_gross']      += $result['gross_pay'];
                $summary['total_deductions'] += $result['total_deductions'];
                $summary['total_net']        += $result['net_pay'];
            } catch (\Exception $e) {
                $summary['errors'][] = [
                    'employee_id'     => $employee->id,
                    'employee_number' => $employee->employee_number,
                    'error'           => $e->getMessage(),
                ];
                error_log("Payrun #$payrunId – employee #{$employee->id} error: " . $e->getMessage());
            }
        }

        // 6. Update payrun header totals
        DB::table('payruns')->update(
            [
                'employee_count'   => $summary['employee_count'],
                'total_gross_pay'  => round($summary['total_gross'], 2),
                'total_deductions' => round($summary['total_deductions'], 2),
                'total_net_pay'    => round($summary['total_net'], 2),
                'status'           => 'reviewed',
                'reviewed_by'      => $userId,
                'reviewed_at'      => date('Y-m-d H:i:s'),
            ],
            'id',
            $payrunId
        );

        // 7. Audit log
        $this->audit($orgId, $userId, 'payruns', $payrunId, 'update', [
            'action'  => 'process_payrun',
            'summary' => $summary,
        ]);

        return $summary;
    }

    /**
     * Recompute a single employee's payrun_details row (and roll the change up
     * into the payrun's header totals) without touching payrun status.
     *
     * Used by ReimbursementController::attachToPayrun() and
     * EmployeeAllowanceController::attachToPayrun()/detachFromPayrun() so a
     * reimbursement or allowance attached to (or removed from) a payrun
     * that's already been processed still lands in that employee's
     * gross_pay/net_pay immediately, instead of silently sitting unapplied
     * until someone re-runs the whole payrun.
     *
     * @param  int  $orgId       Organisation ID
     * @param  int  $payrunId    Payrun ID (must not be finalized)
     * @param  int  $employeeId  Employee to recompute
     * @param  int  $userId      ID of the user triggering the recompute (audit trail)
     * @return array  The employee's recalculated figures (same shape as calculateNetPay())
     */
    public function processSingleEmployee(int $orgId, int $payrunId, int $employeeId, int $userId): array
    {
        $payrun = $this->getPayrun($payrunId, $orgId);
        if (!$payrun) {
            throw new \RuntimeException("Payrun #$payrunId not found for organisation #$orgId");
        }
        if ($payrun->status === 'finalized') {
            throw new \RuntimeException("Payrun #$payrunId is already finalised and cannot be reprocessed");
        }

        $employee = $this->getSingleEmployee($orgId, $employeeId);
        if (!$employee) {
            throw new \RuntimeException("Employee #$employeeId not found or not active for organisation #$orgId");
        }

        $taxConfig        = loadTaxConfig($orgId);
        $deductionConfigs = $this->getDeductionConfigs($orgId);

        $result = $this->processEmployee($employee, $payrun, $taxConfig, $deductionConfigs, $orgId);

        $this->recalculatePayrunTotals($payrunId);

        $this->audit($orgId, $userId, 'payrun_details', $payrunId, 'update', [
            'action'      => 'recompute_single_employee',
            'employee_id' => $employeeId,
            'result'      => $result,
        ]);

        return $result;
    }

    /**
     * Re-sum payrun_details back onto the payrun header (total_gross_pay,
     * total_deductions, total_net_pay, employee_count) without changing status.
     */
    private function recalculatePayrunTotals(int $payrunId): void
    {
        $sums = DB::raw(
            "SELECT
                COALESCE(SUM(gross_pay), 0)        AS total_gross,
                COALESCE(SUM(total_deductions), 0) AS total_deductions,
                COALESCE(SUM(net_pay), 0)          AS total_net,
                COUNT(*)                           AS employee_count
             FROM payrun_details
             WHERE payrun_id = :payrun_id",
            [':payrun_id' => $payrunId]
        );

        $row = $sums[0] ?? null;
        if (!$row) return;

        DB::table('payruns')->update(
            [
                'employee_count'   => (int) $row->employee_count,
                'total_gross_pay'  => round((float) $row->total_gross, 2),
                'total_deductions' => round((float) $row->total_deductions, 2),
                'total_net_pay'    => round((float) $row->total_net, 2),
            ],
            'id',
            $payrunId
        );
    }

    /**
     * Seed baseline Kenyan statutory 'tax' configs for an organisation that
     * has none yet. Used by the new-org bootstrap flow so a first payrun can
     * be processed immediately without a manual config-setup step.
     *
     * Idempotent: relies on the `unique_config` (organization_id, config_type,
     * name) key, so re-running this for an org that already has some (but not
     * all) of these rows will only insert the missing ones.
     *
     * IMPORTANT: these are simple flat-rate placeholders, not the real
     * banded/tiered NSSF or PAYE tax bracket schedules. They exist so a brand
     * new org isn't blocked from running its first payrun — a payroll admin
     * should review and correct them in Organization Settings afterwards.
     *
     * @return int number of config rows actually inserted
     */
    public function seedDefaultStatutoryConfig(int $orgId, ?int $userId = null): int
    {
        $existing = DB::raw(
            "SELECT name FROM organization_configs
              WHERE organization_id = :org AND config_type = 'tax'",
            [':org' => $orgId]
        );
        $existingNames = array_map(fn($r) => $r->name, $existing);

        // name => [percentage, fixed_amount]
        $defaults = [
            'NSSF Rate'         => [6.00, null],
            'SHIF Rate'         => [2.75, null],
            'Housing Levy Rate' => [1.50, null],
            'Personal Relief'   => [null, 2400.00],
        ];

        $inserted = 0;
        foreach ($defaults as $name => [$percentage, $fixedAmount]) {
            if (in_array($name, $existingNames, true)) {
                continue;
            }

            DB::table('organization_configs')->insert([
                'organization_id' => $orgId,
                'config_type'     => 'tax',
                'name'            => $name,
                'percentage'      => $percentage,
                'fixed_amount'    => $fixedAmount,
                'status'          => 'approved',
                'created_by'      => $userId,
                'approved_by'     => $userId,
                'approved_at'     => date('Y-m-d H:i:s'),
                'is_active'       => 1,
            ]);
            $inserted++;
        }

        return $inserted;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function getPayrun(int $payrunId, int $orgId): ?object
    {
        $rows = DB::raw(
            "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id",
            [':id' => $payrunId, ':org_id' => $orgId]
        );

        return $rows[0] ?? null;
    }

    private function getActiveEmployees(int $orgId): array
    {
        // NOTE: employee_number, hire_date, base_salary, name and email fields
        // all live on `employees` itself (job_title/department are FK ids —
        // job_title_id/department_id — not free-text columns), and user_id is
        // optional (see employees.has_user), so this must be a LEFT JOIN on
        // users, not an INNER JOIN, or employees without a login account are
        // silently dropped from every payrun.
        return DB::raw(
            "SELECT 
                e.id,
                e.employee_number,
                e.base_salary,
                e.hire_date,
                e.job_title_id,
                e.department_id,
                e.bank_account_number,
                e.tax_id,
                e.employment_type,
                e.firstname AS first_name,
                e.middlename AS middle_name,
                e.surname,
                COALESCE(e.workemail, e.personalemail) AS email,
                ep.national_id,
                ep.kra_pin,
                ep.nssf_number,
                ep.shif_number
             FROM employees e
             LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
             WHERE e.organization_id = :org_id
               AND e.status IN ('active', 'on_probation')",
            [':org_id' => $orgId]
        );
    }

    /**
     * Same shape as getActiveEmployees() but scoped to a single employee, for
     * processSingleEmployee(). Deliberately does NOT restrict to
     * status IN ('active','on_probation') the way the bulk query does, since a
     * reimbursement can legitimately be attached to a payrun for an employee
     * whose status changed after the payrun was first processed — the caller
     * (attachToPayrun) already validated the reimbursement/employee pairing.
     */
    private function getSingleEmployee(int $orgId, int $employeeId): ?object
    {
        $rows = DB::raw(
            "SELECT 
                e.id,
                e.employee_number,
                e.base_salary,
                e.hire_date,
                e.job_title_id,
                e.department_id,
                e.bank_account_number,
                e.tax_id,
                e.employment_type,
                e.firstname AS first_name,
                e.middlename AS middle_name,
                e.surname,
                COALESCE(e.workemail, e.personalemail) AS email,
                ep.national_id,
                ep.kra_pin,
                ep.nssf_number,
                ep.shif_number
             FROM employees e
             LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
             WHERE e.organization_id = :org_id
               AND e.id = :employee_id",
            [':org_id' => $orgId, ':employee_id' => $employeeId]
        );

        return $rows[0] ?? null;
    }

    /**
     * Get all approved, active deduction/benefit configs for the organisation
     * (excludes 'tax' configs — those are handled by loadTaxConfig)
     */
    private function getDeductionConfigs(int $orgId): array
    {
        $rows = DB::raw(
            "SELECT * FROM organization_configs
              WHERE organization_id = :org_id
                AND config_type IN ('deduction','loan','advance','benefit','per_diem','refund')
                AND is_active = 1
                AND status = 'approved'",
            [':org_id' => $orgId]
        );

        $indexed = [];
        foreach ($rows as $row) {
            $indexed[$row->id] = $row;
        }

        return $indexed;
    }

    /**
     * Process a single employee: calculate all earnings and deductions,
     * write payrun_details and payrun_deductions rows.
     */
    private function processEmployee(
        object $employee,
        object $payrun,
        array  $taxConfig,
        array  $deductionConfigs,
        int    $orgId
    ): array {
        $periodStart = $payrun->pay_period_start;
        $periodEnd   = $payrun->pay_period_end;
        $employeeId  = $employee->id;

        // Fetched early (not just at upsert time) so getAttendanceDeductionsTotal()
        // can safely re-include rows already tied to *this* draft/reviewed payrun
        // when it's reprocessed, without picking up rows tied to any other payrun.
        $existingDetail   = DB::raw(
            "SELECT id FROM payrun_details WHERE payrun_id = :pr AND employee_id = :emp",
            [':pr' => $payrun->id, ':emp' => $employeeId]
        );
        $existingDetailId = !empty($existingDetail) ? (int) $existingDetail[0]->id : null;

        // --- Earnings ---
        $basicSalary     = (float) $employee->base_salary;
        $overtimeAmount  = $this->getOvertimeAmount($employeeId, $periodStart, $periodEnd);
        $bonusAmount     = $this->getBenefitAmount($employeeId, $periodStart, $periodEnd, 'bonus', $orgId);
        $commissionAmount = 0.0; // extend here if you track commissions separately

        // Per diems still add to gross directly (unrelated to the allowance module).
        $perDiemAmount   = $this->getApprovedPerDiemsTotal($employeeId, $periodStart, $periodEnd);

        // Reimbursements explicitly attached to THIS payrun (see
        // ReimbursementController::attachToPayrun()). Net pay is the total
        // amount payable to the employee including reimbursements, so both
        // buckets join gross pay; only the taxable bucket also raises the
        // PAYE base (handled inside calculateNetPay()).
        $reimbursements        = $this->getScheduledReimbursementsTotal($employeeId, $payrun->id);
        $taxableReimbursement  = $reimbursements['taxable'];
        $nontaxableReimbursement = $reimbursements['nontaxable'];

        // Gross pay BEFORE allowances — used as the base for any
        // PERCENTAGE_OF_GROSS allowance, so that base doesn't include the
        // allowances being computed from it.
        $grossBeforeAllowances = $basicSalary + $overtimeAmount + $bonusAmount + $commissionAmount
            + $perDiemAmount + $taxableReimbursement + $nontaxableReimbursement;

        // Allowances explicitly attached to THIS payrun (see
        // EmployeeAllowanceController::attachToPayrun()), same explicit-attach
        // model as reimbursements above.
        $allowances               = $this->getAttachedAllowancesTotal($employeeId, $payrun->id, $basicSalary, $grossBeforeAllowances);
        $taxableAllowance         = $allowances['taxable'];
        $nontaxableAllowance      = $allowances['nontaxable'];

        $grossPay = $grossBeforeAllowances + $taxableAllowance + $nontaxableAllowance;

        // --- Voluntary/org deductions ---
        $loanDeductions       = $this->getLoanInstalment($employeeId, $periodStart, $periodEnd, $deductionConfigs);
        $advanceDeductions    = $this->getAdvanceDeduction($employeeId, $periodStart, $periodEnd, $deductionConfigs);
        $attendanceDeductions = $this->getAttendanceDeductionsTotal($employeeId, $periodStart, $periodEnd, $existingDetailId, $orgId);
        $extraDeductions      = $loanDeductions['total'] + $advanceDeductions['total'] + $attendanceDeductions['total'];

        // --- Statutory calculations ---
        $calc = calculateNetPay($basicSalary, $grossPay, $taxConfig, $extraDeductions, $taxableReimbursement, $taxableAllowance);

        // --- Upsert payrun_details ---
        $detailData = [
            'payrun_id'        => $payrun->id,
            'employee_id'      => $employeeId,
            'basic_salary'     => $calc['basic_salary'],
            'overtime_amount'  => round($overtimeAmount, 2),
            'bonus_amount'     => round($bonusAmount + $perDiemAmount, 2),
            'commission_amount' => round($commissionAmount, 2),
            'taxable_reimbursement'    => round($taxableReimbursement, 2),
            'nontaxable_reimbursement' => round($nontaxableReimbursement, 2),
            'reimbursement_metadata'   => !empty($reimbursements['metadata']) ? json_encode($reimbursements['metadata']) : null,
            'taxable_allowance'        => round($taxableAllowance, 2),
            'nontaxable_allowance'     => round($nontaxableAllowance, 2),
            'allowance_metadata'       => !empty($allowances['metadata']) ? json_encode($allowances['metadata']) : null,
            'gross_pay'        => $calc['gross_pay'],
            'total_deductions' => $calc['total_deductions'],
            'net_pay'          => $calc['net_pay'],
        ];

        if ($existingDetailId) {
            $detailId = $existingDetailId;
            DB::table('payrun_details')->update($detailData, 'id', $detailId);

            // Remove old deduction lines so we can re-insert cleanly
            DB::raw(
                "DELETE FROM payrun_deductions WHERE payrun_detail_id = :id",
                [':id' => $detailId]
            );
        } else {
            DB::table('payrun_details')->insert($detailData);
            $detailId = DB::lastInsertId();
        }

        // --- Insert payrun_deductions rows ---
        $this->insertStatutoryDeductions($detailId, $calc, $orgId);
        $this->insertVoluntaryDeductions($detailId, $loanDeductions['items']);
        $this->insertVoluntaryDeductions($detailId, $advanceDeductions['items']);
        $this->insertAttendanceDeductions($detailId, $attendanceDeductions);

        return $calc;
    }

    // -------------------------------------------------------------------------
    // Earnings helpers
    // -------------------------------------------------------------------------

    /**
     * Sum reimbursements that have been attached to this payrun (via
     * ReimbursementController::attachToPayrun(), which sets payrun_id and
     * flips status to 'scheduled') for this employee, split by is_taxable.
     *
     * The `reimbursements` table — not payrun_details — is the source of
     * truth here, the same way loans/advances/benefits are re-queried from
     * their own tables on every process() run. That keeps this idempotent:
     * reprocessing a payrun always reflects exactly what's currently
     * scheduled against it, nothing more, nothing stale.
     *
     * Returns ['taxable' => float, 'nontaxable' => float, 'metadata' => array]
     * where metadata is a flat list of {reimbursement_id, reimbursement_number,
     * amount, taxable} for the audit-trail JSON column.
     */
    private function getScheduledReimbursementsTotal(int $employeeId, int $payrunId): array
    {
        $rows = DB::raw(
            "SELECT id, reimbursement_number, amount_approved, is_taxable
             FROM reimbursements
             WHERE employee_id = :employee_id
               AND payrun_id = :payrun_id
               AND status = 'scheduled'",
            [':employee_id' => $employeeId, ':payrun_id' => $payrunId]
        );

        $taxable    = 0.0;
        $nontaxable = 0.0;
        $metadata   = [];

        foreach ($rows as $row) {
            $amount = (float) $row->amount_approved;
            if (!empty($row->is_taxable)) {
                $taxable += $amount;
            } else {
                $nontaxable += $amount;
            }
            $metadata[] = [
                'reimbursement_id'     => (int) $row->id,
                'reimbursement_number' => $row->reimbursement_number,
                'amount'               => round($amount, 2),
                'taxable'              => (bool) $row->is_taxable,
            ];
        }

        return [
            'taxable'    => round($taxable, 2),
            'nontaxable' => round($nontaxable, 2),
            'metadata'   => $metadata,
        ];
    }

    /**
     * Overtime: extend this to read from a timesheets or overtime_records table.
     * For now returns 0 unless you already have an overtime table.
     */
    private function getOvertimeAmount(int $employeeId, string $start, string $end): float
    {
        // TODO: replace with actual overtime query when timesheet module is ready
        // Example:
        // SELECT SUM(amount) FROM overtime_records
        // WHERE employee_id = :emp AND record_date BETWEEN :start AND :end AND status = 'approved'
        return 0.0;
    }

    /**
     * Sum allowances that have been explicitly attached to this payrun (via
     * EmployeeAllowanceController::attachToPayrun(), which inserts an
     * 'attached' row into employee_allowance_payrun_lines) for this employee,
     * split into taxable / non-taxable per each allowance_type's
     * taxable_income + taxable_limit exemption rule.
     *
     * The amount itself is NOT read from the attach line (that table only
     * records eligibility for this payrun) — it's resolved fresh here from
     * employee_allowance + allowance_types + the employee's current
     * basic_salary/gross-so-far, the same idempotent re-derive-from-source
     * pattern used by loans/advances/reimbursements elsewhere in this file.
     * That way reprocessing a draft payrun always reflects the allowance's
     * current approved amount, not a frozen snapshot.
     *
     * Only FIXED_AMOUNT, PERCENTAGE_OF_BASIC and PERCENTAGE_OF_GROSS are
     * evaluated. PER_DAY / PER_UNIT / FORMULA / ACTUAL_EXPENSE rows are
     * skipped with a logged warning — the API layer should already prevent
     * allowance_types using those methods from being created (phase 2).
     *
     * Returns ['taxable' => float, 'nontaxable' => float, 'metadata' => array]
     * where metadata is a flat list of {employee_allowance_id, allowance_type,
     * amount, taxable, nontaxable} for the audit-trail JSON column.
     */
    private function getAttachedAllowancesTotal(
        int   $employeeId,
        int   $payrunId,
        float $basicSalary,
        float $grossBeforeAllowances
    ): array {
        $rows = DB::raw(
            "SELECT
                ea.id                    AS employee_allowance_id,
                ea.amount                AS ea_amount,
                ea.percentage            AS ea_percentage,
                at.name                  AS allowance_name,
                at.calculation_method,
                at.amount                AS type_amount,
                at.percentage            AS type_percentage,
                at.taxable_income,
                at.taxable_limit
             FROM employee_allowance_payrun_lines eapl
             INNER JOIN employee_allowance ea ON ea.id = eapl.employee_allowance_id
             INNER JOIN allowance_types    at ON at.id = ea.allowance_type_id
             WHERE eapl.payrun_id    = :payrun_id
               AND eapl.employee_id  = :employee_id
               AND eapl.status       = 'attached'
               AND ea.status         = 'APPROVED'",
            [':payrun_id' => $payrunId, ':employee_id' => $employeeId]
        );

        $taxable    = 0.0;
        $nontaxable = 0.0;
        $metadata   = [];

        foreach ($rows as $row) {
            $amount = $this->resolveAllowanceAmount($row, $basicSalary, $grossBeforeAllowances);
            if ($amount <= 0) {
                continue;
            }

            $split = splitAllowanceTaxability(
                $amount,
                (bool) $row->taxable_income,
                $row->taxable_limit !== null ? (float) $row->taxable_limit : null
            );

            $taxable    += $split['taxable'];
            $nontaxable += $split['nontaxable'];

            $metadata[] = [
                'employee_allowance_id' => (int) $row->employee_allowance_id,
                'allowance_type'        => $row->allowance_name,
                'amount'                => round($amount, 2),
                'taxable'               => round($split['taxable'], 2),
                'nontaxable'            => round($split['nontaxable'], 2),
            ];
        }

        return [
            'taxable'    => round($taxable, 2),
            'nontaxable' => round($nontaxable, 2),
            'metadata'   => $metadata,
        ];
    }

    /**
     * Resolve a single attached allowance's amount for this pay period.
     * employee_allowance's own amount/percentage override the allowance_type
     * default when set (NULL on the employee row = "use the type default").
     *
     * PERCENTAGE_OF_GROSS is computed against $grossBeforeAllowances (basic +
     * overtime + bonus + commission + per diems + reimbursements) so it is
     * never circular with the allowance total being built here.
     */
    private function resolveAllowanceAmount(object $row, float $basicSalary, float $grossBeforeAllowances): float
    {
        switch ($row->calculation_method) {
            case 'FIXED_AMOUNT':
                $amount = $row->ea_amount !== null ? (float) $row->ea_amount : (float) $row->type_amount;
                break;

            case 'PERCENTAGE_OF_BASIC':
                $pct    = $row->ea_percentage !== null ? (float) $row->ea_percentage : (float) $row->type_percentage;
                $amount = $basicSalary * ($pct / 100);
                break;

            case 'PERCENTAGE_OF_GROSS':
                $pct    = $row->ea_percentage !== null ? (float) $row->ea_percentage : (float) $row->type_percentage;
                $amount = $grossBeforeAllowances * ($pct / 100);
                break;

            default:
                // PER_DAY / PER_UNIT / FORMULA / ACTUAL_EXPENSE — not evaluated yet.
                error_log("Allowance #{$row->employee_allowance_id} ({$row->allowance_name}) uses unsupported calculation_method '{$row->calculation_method}' — skipped.");
                $amount = 0.0;
        }

        return max(0.0, round($amount, 2));
    }

    /**
     * Approved per diems for the pay period.
     */
    private function getApprovedPerDiemsTotal(int $employeeId, string $start, string $end): float
    {
        $rows = DB::raw(
            "SELECT COALESCE(SUM(amount), 0) as total
               FROM per_diems
              WHERE employee_id = :emp
                AND trip_date BETWEEN :start AND :end
                AND status = 'approved'",
            [':emp' => $employeeId, ':start' => $start, ':end' => $end]
        );

        return (float) ($rows[0]->total ?? 0);
    }

    /**
     * Bonus amounts stored as benefits with config_type-specific naming.
     * Adjust the 'name' filter to match your actual config naming.
     */
    private function getBenefitAmount(
        int    $employeeId,
        string $start,
        string $end,
        string $configName,
        int    $orgId
    ): float {
        $rows = DB::raw(
            "SELECT COALESCE(SUM(b.amount), 0) as total
               FROM benefits b
               INNER JOIN organization_configs oc ON b.config_id = oc.id
              WHERE b.employee_id = :emp
                AND b.date_granted BETWEEN :start AND :end
                AND oc.organization_id = :org
                AND LOWER(oc.name) LIKE :name",
            [
                ':emp'   => $employeeId,
                ':start' => $start,
                ':end'   => $end,
                ':org'   => $orgId,
                ':name'  => '%' . strtolower($configName) . '%',
            ]
        );

        return (float) ($rows[0]->total ?? 0);
    }

    // -------------------------------------------------------------------------
    // Deduction helpers
    // -------------------------------------------------------------------------

    /**
     * Loan repayment instalments due within the pay period.
     * Returns ['total' => float, 'items' => [['config_id'=>, 'amount'=>], ...]]
     */
    private function getLoanInstalment(
        int   $employeeId,
        string $start,
        string $end,
        array  $configs
    ): array {
        $rows = DB::raw(
            "SELECT l.config_id,
                    oc.fixed_amount as instalment,
                    oc.percentage   as instalment_pct,
                    e.base_salary
               FROM loans l
               INNER JOIN organization_configs oc ON l.config_id = oc.id
               INNER JOIN employees e ON e.id = l.employee_id
              WHERE l.employee_id = :emp
                AND l.status = 'approved'
                AND l.start_date <= :end
                AND (l.end_date IS NULL OR l.end_date >= :start)",
            [':emp' => $employeeId, ':start' => $start, ':end' => $end]
        );

        $items = [];
        $total = 0.0;

        foreach ($rows as $row) {
            $amount = $row->instalment !== null
                ? (float) $row->instalment
                : (float) $row->base_salary * ((float) $row->instalment_pct / 100);
            $items[] = ['config_id' => $row->config_id, 'amount' => round($amount, 2)];
            $total   += $amount;
        }

        return ['total' => $total, 'items' => $items];
    }

    /**
     * Advance repayment deductions within the pay period.
     */
    private function getAdvanceDeduction(
        int    $employeeId,
        string $start,
        string $end,
        array  $configs
    ): array {
        $rows = DB::raw(
            "SELECT a.config_id,
                    oc.fixed_amount as deduct_amount
               FROM advances a
               INNER JOIN organization_configs oc ON a.config_id = oc.id
              WHERE a.employee_id = :emp
                AND a.status = 'approved'
                AND a.request_date <= :end",
            [':emp' => $employeeId, ':end' => $end]
        );

        $items = [];
        $total = 0.0;

        foreach ($rows as $row) {
            $amount  = (float) ($row->deduct_amount ?? 0);
            $items[] = ['config_id' => $row->config_id, 'amount' => round($amount, 2)];
            $total   += $amount;
        }

        return ['total' => $total, 'items' => $items];
    }

    /**
     * Cash lateness/early-leave deductions (per_minute or daily_rate policy)
     * computed in real time by AttendanceService::calculateAttendanceDeduction()
     * for each attendance day, still sitting 'pending'.
     *
     * $existingDetailId lets a reprocess of an already-drafted payrun safely
     * re-include rows that were already marked 'applied' against *this*
     * payrun_detail on a prior run of the same payrun, without touching rows
     * belonging to any other payrun (NULL-safe: when $existingDetailId is
     * null, the `payrun_detail_id = :existing_id` branch simply matches
     * nothing, which is the correct behaviour for a brand-new detail).
     *
     * All attendance_deductions rows resolve to one bucket config
     * ('Lateness & Early-Leave Deduction', config_type='deduction') so they
     * show up as a single line item, same as loans/advances.
     */
    private function getAttendanceDeductionsTotal(
        int    $employeeId,
        string $start,
        string $end,
        ?int   $existingDetailId,
        int    $orgId
    ): array {
        $rows = DB::raw(
            "SELECT id, cash_amount
               FROM attendance_deductions
              WHERE employee_id = :emp
                AND deduction_date BETWEEN :start AND :end
                AND policy_applied IN ('per_minute', 'daily_rate')
                AND (
                     status = 'pending'
                     OR (status = 'applied' AND payrun_detail_id = :existing_id)
                )",
            [
                ':emp'         => $employeeId,
                ':start'       => $start,
                ':end'         => $end,
                ':existing_id' => $existingDetailId,
            ]
        );

        $total = 0.0;
        $ids   = [];
        foreach ($rows as $row) {
            $total += (float) $row->cash_amount;
            $ids[]  = (int) $row->id;
        }

        if ($total <= 0 || empty($ids)) {
            return ['total' => 0.0, 'items' => [], 'ids' => []];
        }

        $config = DB::raw(
            "SELECT id FROM organization_configs
              WHERE organization_id = :org
                AND config_type = 'deduction'
                AND name = 'Lateness & Early-Leave Deduction'
                AND is_active = 1
              LIMIT 1",
            [':org' => $orgId]
        );

        if (empty($config)) {
            // Misconfigured org — don't lose the amount silently from total_deductions,
            // but there's nowhere to write a payrun_deductions line for it.
            error_log("Org #{$orgId}: 'Lateness & Early-Leave Deduction' config missing — attendance deductions excluded from this payrun.");
            return ['total' => 0.0, 'items' => [], 'ids' => []];
        }

        return [
            'total' => $total,
            'items' => [['config_id' => $config[0]->id, 'amount' => round($total, 2)]],
            'ids'   => $ids,
        ];
    }

    /**
     * Write the 5 statutory deduction rows (NSSF, SHIF, Housing Levy, PAYE, Personal Relief offset)
     * by matching them to organization_configs of type 'tax'.
     */
    private function insertStatutoryDeductions(int $detailId, array $calc, int $orgId): void
    {
        // Map calculation keys → expected config names in organization_configs
        $statutory = [
            'NSSF Rate'         => $calc['nssf'],
            'SHIF Rate'         => $calc['shif'],
            'Housing Levy Rate' => $calc['housing_levy'],
            'Personal Relief'   => $calc['personal_relief'],  // recorded as relief given
            // PAYE is a derived figure; store it against a 'PAYE' config if present
        ];

        foreach ($statutory as $configName => $amount) {
            if ($amount <= 0) continue;

            $config = DB::raw(
                "SELECT id FROM organization_configs
                  WHERE organization_id = :org
                    AND config_type = 'tax'
                    AND name = :name
                    AND is_active = 1
                  LIMIT 1",
                [':org' => $orgId, ':name' => $configName]
            );

            if (!empty($config)) {
                DB::table('payrun_deductions')->insert([
                    'payrun_detail_id' => $detailId,
                    'config_id'        => $config[0]->id,
                    'amount'           => round($amount, 2),
                ]);
            }
        }

        // PAYE — store if 'PAYE' config exists, else just rely on payrun_details.total_deductions
        $payeConfig = DB::raw(
            "SELECT id FROM organization_configs
              WHERE organization_id = :org AND config_type = 'tax' AND name = 'PAYE' AND is_active = 1 LIMIT 1",
            [':org' => $orgId]
        );

        if (!empty($payeConfig) && $calc['paye'] > 0) {
            DB::table('payrun_deductions')->insert([
                'payrun_detail_id' => $detailId,
                'config_id'        => $payeConfig[0]->id,
                'amount'           => round($calc['paye'], 2),
            ]);
        }
    }

    /**
     * Write voluntary deduction rows (loans, advances, etc.).
     */
    private function insertVoluntaryDeductions(int $detailId, array $items): void
    {
        foreach ($items as $item) {
            if ($item['amount'] <= 0) continue;
            DB::table('payrun_deductions')->insert([
                'payrun_detail_id' => $detailId,
                'config_id'        => $item['config_id'],
                'amount'           => $item['amount'],
            ]);
        }
    }

    /**
     * Write the attendance-deduction payrun_deductions line (from
     * getAttendanceDeductionsTotal()'s pre-resolved items) and lock the
     * source attendance_deductions rows to this payrun_detail so they won't
     * be picked up again by another payrun and won't be silently rewritten
     * by a future attendance recompute.
     */
    private function insertAttendanceDeductions(int $detailId, array $attendanceDeductions): void
    {
        if (empty($attendanceDeductions['ids'])) {
            return;
        }

        $this->insertVoluntaryDeductions($detailId, $attendanceDeductions['items']);

        $params = [':detail_id' => $detailId];
        $placeholders = [];
        foreach ($attendanceDeductions['ids'] as $i => $id) {
            $key = ":id{$i}";
            $placeholders[] = $key;
            $params[$key] = $id;
        }

        DB::raw(
            "UPDATE attendance_deductions
                SET status = 'applied', payrun_detail_id = :detail_id, updated_at = NOW()
              WHERE id IN (" . implode(',', $placeholders) . ")",
            $params
        );
    }

    // -------------------------------------------------------------------------
    // Audit log
    // -------------------------------------------------------------------------

    private function audit(
        int    $orgId,
        int    $userId,
        string $entity,
        int    $entityId,
        string $action,
        array  $details
    ): void {
        try {
            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id'         => $userId,
                'entity_type'     => $entity,
                'entity_id'       => $entityId,
                'action'          => $action,
                'details'         => json_encode($details),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Audit log failed: " . $e->getMessage());
        }
    }
}