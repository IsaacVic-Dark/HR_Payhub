<?php

namespace App\Controllers;

use App\Services\DB;
use App\Middleware\AuthMiddleware;

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
     * Approving here only marks the request approved — it is NOT yet flagged
     * salary_included; that happens when a payrun actually consumes it
     * (see markIncludedInPayroll), keeping this module decoupled from payroll.
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

            return responseJson(success: true, data: $updated[0] ?? null, message: "Overtime approved", code: 200);
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

    private function findPending($orgId, $id)
    {
        $rows = DB::raw(
            "SELECT * FROM overtime_approvals WHERE id = :id AND organization_id = :org_id AND status = 'pending' LIMIT 1",
            [':id' => $id, ':org_id' => $orgId]
        );
        return $rows[0] ?? null;
    }
}