<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\PayrunProcessingService;

require_once __DIR__ . '/../helpers/tax.php';

/**
 * EmployeeAllowanceController
 *
 * Manages employee_allowance: per-employee grants of an allowance_type, with
 * a DRAFT → PENDING_APPROVAL → APPROVED/REJECTED (→ SUSPENDED/EXPIRED/CANCELLED)
 * workflow, plus the explicit attach/detach-to-payrun actions that feed
 * PayrunProcessingService (see getAttachedAllowancesTotal() there).
 *
 * Structured the same way as PayrunController/PayrunDetailController:
 * try/catch per method, responseJson() everywhere, DB::raw()/DB::table().
 */
class EmployeeAllowanceController
{
    /**
     * List employee allowances.
     * GET /api/v1/organizations/{org_id}/employee-allowances?employee_id=&status=&allowance_type_id=&page=&per_page=
     *
     * Row-level scoping: department_manager only sees their department's
     * employees; employee only sees their own records. Everyone else sees
     * the full organisation (already gated by the middleware for write ops).
     */
    public function index($org_id = null)
    {
        try {
            if (!$org_id || !is_numeric($org_id)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 404,
                    errors: ['org_id' => 'Organization ID is required and must be a valid number']
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            $page    = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 20;
            $offset  = ($page - 1) * $perPage;

            $where  = ['ea.organization_id = :org_id'];
            $params = [':org_id' => $org_id];

            if (!empty($_GET['employee_id']) && is_numeric($_GET['employee_id'])) {
                $where[] = 'ea.employee_id = :employee_id';
                $params[':employee_id'] = $_GET['employee_id'];
            }

            if (!empty($_GET['allowance_type_id']) && is_numeric($_GET['allowance_type_id'])) {
                $where[] = 'ea.allowance_type_id = :allowance_type_id';
                $params[':allowance_type_id'] = $_GET['allowance_type_id'];
            }

            $validStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'CANCELLED'];
            if (!empty($_GET['status']) && in_array($_GET['status'], $validStatuses, true)) {
                $where[] = 'ea.status = :status';
                $params[':status'] = $_GET['status'];
            }

            // Row-level scoping for restricted roles
            if ($currentUser && $currentUser['user_type'] === 'employee') {
                $selfEmployee = DB::raw(
                    "SELECT id FROM employees WHERE user_id = :user_id AND organization_id = :org_id",
                    [':user_id' => $currentUser['id'], ':org_id' => $org_id]
                );
                $where[] = 'ea.employee_id = :self_employee_id';
                $params[':self_employee_id'] = $selfEmployee[0]->id ?? 0;
            } elseif ($currentUser && $currentUser['user_type'] === 'department_manager') {
                $where[] = 'e.department_id = (
                    SELECT department_id FROM employees WHERE user_id = :manager_user_id AND organization_id = :org_id LIMIT 1
                )';
                $params[':manager_user_id'] = $currentUser['id'];
            }

            $whereClause = implode(' AND ', $where);

            $countRows = DB::raw(
                "SELECT COUNT(*) as total
                   FROM employee_allowance ea
                   INNER JOIN employees e ON e.id = ea.employee_id
                  WHERE {$whereClause}",
                $params
            );
            $total = (int) ($countRows[0]->total ?? 0);

            $params[':limit']  = $perPage;
            $params[':offset'] = $offset;

            $rows = DB::raw(
                "SELECT
                    ea.*,
                    at.name               AS allowance_name,
                    at.code               AS allowance_code,
                    at.category,
                    at.calculation_method,
                    at.amount             AS type_default_amount,
                    at.percentage         AS type_default_percentage,
                    at.taxable_income,
                    at.taxable_limit,
                    CONCAT(e.firstname, ' ', COALESCE(e.middlename, ''), ' ', e.surname) AS employee_name,
                    e.employee_number
                 FROM employee_allowance ea
                 INNER JOIN employees e        ON e.id  = ea.employee_id
                 INNER JOIN allowance_types at ON at.id = ea.allowance_type_id
                 WHERE {$whereClause}
                 ORDER BY ea.created_at DESC
                 LIMIT :limit OFFSET :offset",
                $params
            );

            return responseJson(
                success: true,
                data: $rows,
                message: "Fetched employee allowances successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => $total,
                        'total_pages'  => (int) ceil($total / $perPage),
                        'has_next'     => $page < ceil($total / $perPage),
                        'has_prev'     => $page > 1,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::index error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to fetch employee allowances", code: 500);
        }
    }

    /**
     * GET /api/v1/organizations/{org_id}/employee-allowances/{id}
     */
    public function show($org_id, $id)
    {
        try {
            $row = $this->findOrFail($org_id, $id);
            if (!$row) {
                return responseJson(success: false, data: null, message: "Employee allowance not found", code: 404);
            }

            return responseJson(success: true, data: $row, message: "Fetched employee allowance successfully");
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::show error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to fetch employee allowance", code: 500);
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances
     * Body: { employee_id, allowance_type_id, amount?, percentage?, start_date,
     *         end_date?, eligibility_reason?, supporting_document_id?, submit? }
     *
     * Created as DRAFT by default. Pass "submit": true to move straight to
     * PENDING_APPROVAL in the same call (sets requested_by/requested_at).
     */
    public function store($org_id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            $required = ['employee_id', 'allowance_type_id', 'start_date'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    return responseJson(success: false, data: null, message: "Field '$field' is required", code: 400);
                }
            }

            $employee = DB::raw(
                "SELECT id FROM employees WHERE id = :id AND organization_id = :org_id",
                [':id' => $data['employee_id'], ':org_id' => $org_id]
            );
            if (empty($employee)) {
                return responseJson(success: false, data: null, message: "Invalid employee_id for this organisation", code: 400);
            }

            $type = DB::raw(
                "SELECT * FROM allowance_types WHERE id = :id AND organization_id = :org_id",
                [':id' => $data['allowance_type_id'], ':org_id' => $org_id]
            );
            if (empty($type)) {
                return responseJson(success: false, data: null, message: "Invalid allowance_type_id for this organisation", code: 400);
            }
            $type = $type[0];

            if ($type->status !== 'ACTIVE') {
                return responseJson(success: false, data: null, message: "This allowance type is not currently active", code: 409);
            }

            // Amount/percentage overrides are optional (fall back to the type's
            // default at processing time), but if given they must be valid.
            if (isset($data['percentage']) && ($data['percentage'] < 0 || $data['percentage'] > 100)) {
                return responseJson(success: false, data: null, message: "percentage must be between 0 and 100", code: 400);
            }

            if (!empty($data['end_date']) && $data['end_date'] < $data['start_date']) {
                return responseJson(success: false, data: null, message: "end_date cannot be before start_date", code: 400);
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            $submitNow   = !empty($data['submit']);

            $insertData = [
                'organization_id'    => $org_id,
                'employee_id'        => $data['employee_id'],
                'allowance_type_id'  => $data['allowance_type_id'],
                'amount'             => $data['amount']     ?? null,
                'percentage'         => $data['percentage'] ?? null,
                'start_date'         => $data['start_date'],
                'end_date'           => $data['end_date']   ?? null,
                'eligibility_reason' => $data['eligibility_reason'] ?? null,
                'supporting_document_id' => $data['supporting_document_id'] ?? null,
                'status'             => $submitNow ? 'PENDING_APPROVAL' : 'DRAFT',
                'requested_by'       => $submitNow ? ($currentUser['id'] ?? null) : null,
                'requested_at'       => $submitNow ? date('Y-m-d H:i:s') : null,
            ];

            DB::table('employee_allowance')->insert($insertData);
            $id = DB::lastInsertId();

            return responseJson(
                success: true,
                data: $this->findOrFail($org_id, $id),
                message: $submitNow ? "Allowance request submitted for approval" : "Allowance saved as draft",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::store error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create employee allowance",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    /**
     * PUT/PATCH /api/v1/organizations/{org_id}/employee-allowances/{id}
     * Only editable while DRAFT or REJECTED (a rejected request can be
     * corrected and resubmitted). APPROVED grants must go through
     * suspend/cancel + a new request rather than being edited in place, so
     * there's never ambiguity about what an already-approved payrun attach
     * was calculated against.
     */
    public function update($org_id, $id)
    {
        try {
            $rows = DB::raw(
                "SELECT * FROM employee_allowance WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );
            if (empty($rows)) {
                return responseJson(success: false, data: null, message: "Employee allowance not found", code: 404);
            }
            $current = $rows[0];

            if (!in_array($current->status, ['DRAFT', 'REJECTED'], true)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only DRAFT or REJECTED allowances can be edited (current status: {$current->status})",
                    code: 409
                );
            }

            $data = json_decode(file_get_contents('php://input'), true) ?? [];

            if (isset($data['percentage']) && ($data['percentage'] < 0 || $data['percentage'] > 100)) {
                return responseJson(success: false, data: null, message: "percentage must be between 0 and 100", code: 400);
            }

            $startDate = $data['start_date'] ?? $current->start_date;
            $endDate   = array_key_exists('end_date', $data) ? $data['end_date'] : $current->end_date;
            if (!empty($endDate) && $endDate < $startDate) {
                return responseJson(success: false, data: null, message: "end_date cannot be before start_date", code: 400);
            }

            $updateData = [
                'amount'                 => array_key_exists('amount', $data) ? $data['amount'] : $current->amount,
                'percentage'             => array_key_exists('percentage', $data) ? $data['percentage'] : $current->percentage,
                'start_date'             => $startDate,
                'end_date'               => $endDate,
                'eligibility_reason'     => array_key_exists('eligibility_reason', $data) ? $data['eligibility_reason'] : $current->eligibility_reason,
                'supporting_document_id' => array_key_exists('supporting_document_id', $data) ? $data['supporting_document_id'] : $current->supporting_document_id,
            ];

            // Editing a REJECTED request resets it back to DRAFT — it needs a
            // fresh submit() to re-enter the approval queue.
            if ($current->status === 'REJECTED') {
                $updateData['status']           = 'DRAFT';
                $updateData['rejected_by']      = null;
                $updateData['rejected_at']      = null;
                $updateData['rejection_reason'] = null;
            }

            DB::table('employee_allowance')->update($updateData, 'id', $id);

            return responseJson(success: true, data: $this->findOrFail($org_id, $id), message: "Employee allowance updated successfully");
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::update error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to update employee allowance", code: 500);
        }
    }

    /**
     * DELETE /api/v1/organizations/{org_id}/employee-allowances/{id}
     * Only a never-submitted DRAFT can be hard-deleted; anything that has
     * entered the workflow should be cancelled instead, to keep the audit
     * trail (who approved/rejected what) intact.
     */
    public function destroy($org_id, $id)
    {
        try {
            $rows = DB::raw(
                "SELECT status FROM employee_allowance WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );
            if (empty($rows)) {
                return responseJson(success: false, data: null, message: "Employee allowance not found", code: 404);
            }

            if ($rows[0]->status !== 'DRAFT') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only DRAFT allowances can be deleted — cancel this one instead (current status: {$rows[0]->status})",
                    code: 409
                );
            }

            DB::table('employee_allowance')->delete('id', $id);

            return responseJson(success: true, data: null, message: "Employee allowance deleted successfully");
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::destroy error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to delete employee allowance", code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // Workflow actions
    // -------------------------------------------------------------------------

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances/{id}/submit
     * DRAFT -> PENDING_APPROVAL
     */
    public function submit($org_id, $id)
    {
        return $this->transition(
            $org_id,
            $id,
            fromStatuses: ['DRAFT'],
            toStatus: 'PENDING_APPROVAL',
            extraFields: fn($user) => [
                'requested_by' => $user['id'] ?? null,
                'requested_at' => date('Y-m-d H:i:s'),
            ],
            successMessage: "Allowance submitted for approval"
        );
    }

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances/{id}/approve
     * PENDING_APPROVAL -> APPROVED
     */
    public function approve($org_id, $id)
    {
        return $this->transition(
            $org_id,
            $id,
            fromStatuses: ['PENDING_APPROVAL'],
            toStatus: 'APPROVED',
            extraFields: fn($user) => [
                'approved_by' => $user['id'] ?? null,
                'approved_at' => date('Y-m-d H:i:s'),
            ],
            successMessage: "Allowance approved"
        );
    }

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances/{id}/reject
     * Body: { rejection_reason } — required
     * PENDING_APPROVAL -> REJECTED
     */
    public function reject($org_id, $id)
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        if (empty($data['rejection_reason'])) {
            return responseJson(success: false, data: null, message: "rejection_reason is required", code: 400);
        }

        return $this->transition(
            $org_id,
            $id,
            fromStatuses: ['PENDING_APPROVAL'],
            toStatus: 'REJECTED',
            extraFields: fn($user) => [
                'rejected_by'      => $user['id'] ?? null,
                'rejected_at'      => date('Y-m-d H:i:s'),
                'rejection_reason' => $data['rejection_reason'],
            ],
            successMessage: "Allowance rejected"
        );
    }

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances/{id}/suspend
     * APPROVED -> SUSPENDED (temporarily excluded from payroll without
     * losing the approval history — re-approve is not required to resume,
     * see resume-equivalent: PATCH status back via a fresh approve is NOT
     * exposed; suspending is meant to be reversed by cancelling and creating
     * a new request, keeping the audit trail unambiguous).
     */
    public function suspend($org_id, $id)
    {
        return $this->transition(
            $org_id,
            $id,
            fromStatuses: ['APPROVED'],
            toStatus: 'SUSPENDED',
            extraFields: fn($user) => [],
            successMessage: "Allowance suspended"
        );
    }

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances/{id}/cancel
     * Any pre-terminal status -> CANCELLED. Does NOT retroactively remove the
     * allowance from payruns it was already attached to and processed against
     * — detach it from any still-editable (draft/reviewed) payrun first via
     * detach-payrun if it needs to be pulled out of an in-flight run.
     */
    public function cancel($org_id, $id)
    {
        return $this->transition(
            $org_id,
            $id,
            fromStatuses: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUSPENDED'],
            toStatus: 'CANCELLED',
            extraFields: fn($user) => [],
            successMessage: "Allowance cancelled"
        );
    }

    /**
     * Shared status-transition helper — validates current status, applies
     * the new status plus any workflow-specific fields, and returns the
     * refreshed row.
     */
    private function transition($org_id, $id, array $fromStatuses, string $toStatus, callable $extraFields, string $successMessage)
    {
        try {
            $rows = DB::raw(
                "SELECT status FROM employee_allowance WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );
            if (empty($rows)) {
                return responseJson(success: false, data: null, message: "Employee allowance not found", code: 404);
            }

            if (!in_array($rows[0]->status, $fromStatuses, true)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot move an allowance from status '{$rows[0]->status}' to '{$toStatus}'",
                    code: 409
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            $updateData  = array_merge(['status' => $toStatus], $extraFields($currentUser));

            DB::table('employee_allowance')->update($updateData, 'id', $id);

            return responseJson(success: true, data: $this->findOrFail($org_id, $id), message: $successMessage);
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::transition({$toStatus}) error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to update allowance status", code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // Payrun attach / detach — explicit, reimbursement-style
    // -------------------------------------------------------------------------

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances/{id}/attach-payrun
     * Body: { payrun_id }
     *
     * Inserts an 'attached' row into employee_allowance_payrun_lines, then
     * immediately recomputes that employee's payrun_details via
     * PayrunProcessingService::processSingleEmployee() so the change is
     * reflected without waiting for a full payrun reprocess — same pattern
     * ReimbursementController::attachToPayrun() uses.
     */
    public function attachToPayrun($org_id, $id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            if (empty($data['payrun_id']) || !is_numeric($data['payrun_id'])) {
                return responseJson(success: false, data: null, message: "payrun_id is required", code: 400);
            }

            $allowanceRows = DB::raw(
                "SELECT * FROM employee_allowance WHERE id = :id AND organization_id = :org_id",
                [':id' => $id, ':org_id' => $org_id]
            );
            if (empty($allowanceRows)) {
                return responseJson(success: false, data: null, message: "Employee allowance not found", code: 404);
            }
            $allowance = $allowanceRows[0];

            if ($allowance->status !== 'APPROVED') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only an APPROVED allowance can be attached to a payrun (current status: {$allowance->status})",
                    code: 409
                );
            }

            $payrunRows = DB::raw(
                "SELECT * FROM payruns WHERE id = :id AND organization_id = :org_id",
                [':id' => $data['payrun_id'], ':org_id' => $org_id]
            );
            if (empty($payrunRows)) {
                return responseJson(success: false, data: null, message: "Payrun not found for this organisation", code: 404);
            }
            $payrun = $payrunRows[0];

            if ($payrun->status === 'finalized') {
                return responseJson(success: false, data: null, message: "Cannot attach an allowance to a finalized payrun", code: 409);
            }

            // Sanity check: the allowance's active window should actually
            // overlap the payrun's pay period, otherwise attaching it is
            // almost certainly a mistake.
            $overlaps = $allowance->start_date <= $payrun->pay_period_end
                && (empty($allowance->end_date) || $allowance->end_date >= $payrun->pay_period_start);
            if (!$overlaps) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "This allowance's active window ({$allowance->start_date} to " . ($allowance->end_date ?? 'ongoing') . ") does not overlap the payrun's pay period",
                    code: 409
                );
            }

            $existingLine = DB::raw(
                "SELECT id, status FROM employee_allowance_payrun_lines
                  WHERE employee_allowance_id = :ea_id AND payrun_id = :payrun_id",
                [':ea_id' => $id, ':payrun_id' => $data['payrun_id']]
            );

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            if (!empty($existingLine)) {
                if ($existingLine[0]->status === 'attached') {
                    return responseJson(success: false, data: null, message: "This allowance is already attached to this payrun", code: 409);
                }
                // Previously detached — re-attach the same line rather than
                // insert a duplicate (unique_allowance_per_payrun would reject it anyway).
                DB::table('employee_allowance_payrun_lines')->update(
                    [
                        'status'      => 'attached',
                        'attached_by' => $currentUser['id'] ?? null,
                        'attached_at' => date('Y-m-d H:i:s'),
                        'detached_by' => null,
                        'detached_at' => null,
                    ],
                    'id',
                    $existingLine[0]->id
                );
            } else {
                DB::table('employee_allowance_payrun_lines')->insert([
                    'organization_id'       => $org_id,
                    'employee_allowance_id' => $id,
                    'payrun_id'             => $data['payrun_id'],
                    'employee_id'           => $allowance->employee_id,
                    'status'                => 'attached',
                    'attached_by'           => $currentUser['id'] ?? null,
                    'attached_at'           => date('Y-m-d H:i:s'),
                ]);
            }

            // Recompute this employee's payrun_details immediately.
            $service = new PayrunProcessingService();
            $result  = $service->processSingleEmployee(
                (int) $org_id,
                (int) $data['payrun_id'],
                (int) $allowance->employee_id,
                (int) ($currentUser['id'] ?? 0)
            );

            return responseJson(
                success: true,
                data: ['recomputed' => $result],
                message: "Allowance attached to payrun and payrun details recomputed"
            );
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::attachToPayrun error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to attach allowance to payrun",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    /**
     * POST /api/v1/organizations/{org_id}/employee-allowances/{id}/detach-payrun
     * Body: { payrun_id }
     */
    public function detachFromPayrun($org_id, $id)
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true) ?? [];
            if (empty($data['payrun_id']) || !is_numeric($data['payrun_id'])) {
                return responseJson(success: false, data: null, message: "payrun_id is required", code: 400);
            }

            $line = DB::raw(
                "SELECT eapl.*, p.status as payrun_status, p.organization_id
                   FROM employee_allowance_payrun_lines eapl
                   INNER JOIN payruns p ON p.id = eapl.payrun_id
                  WHERE eapl.employee_allowance_id = :ea_id
                    AND eapl.payrun_id = :payrun_id
                    AND eapl.status = 'attached'",
                [':ea_id' => $id, ':payrun_id' => $data['payrun_id']]
            );

            if (empty($line)) {
                return responseJson(success: false, data: null, message: "No active attachment found for this allowance/payrun pair", code: 404);
            }
            $line = $line[0];

            if ((int) $line->organization_id !== (int) $org_id) {
                return responseJson(success: false, data: null, message: "Payrun does not belong to this organisation", code: 404);
            }

            if ($line->payrun_status === 'finalized') {
                return responseJson(success: false, data: null, message: "Cannot detach an allowance from a finalized payrun", code: 409);
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            DB::table('employee_allowance_payrun_lines')->update(
                [
                    'status'      => 'detached',
                    'detached_by' => $currentUser['id'] ?? null,
                    'detached_at' => date('Y-m-d H:i:s'),
                ],
                'id',
                $line->id
            );

            $service = new PayrunProcessingService();
            $result  = $service->processSingleEmployee(
                (int) $org_id,
                (int) $data['payrun_id'],
                (int) $line->employee_id,
                (int) ($currentUser['id'] ?? 0)
            );

            return responseJson(
                success: true,
                data: ['recomputed' => $result],
                message: "Allowance detached from payrun and payrun details recomputed"
            );
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::detachFromPayrun error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to detach allowance from payrun", code: 500);
        }
    }

    /**
     * GET /api/v1/organizations/{org_id}/employee-allowances/payrun/{payrun_id}
     * List every allowance currently attached to a given payrun — useful for
     * a "review before finalize" screen.
     */
    public function indexForPayrun($org_id, $payrun_id)
    {
        try {
            $payrun = DB::raw(
                "SELECT id FROM payruns WHERE id = :id AND organization_id = :org_id",
                [':id' => $payrun_id, ':org_id' => $org_id]
            );
            if (empty($payrun)) {
                return responseJson(success: false, data: null, message: "Payrun not found for this organisation", code: 404);
            }

            $rows = DB::raw(
                "SELECT
                    eapl.id AS attach_line_id,
                    eapl.attached_at,
                    ea.id AS employee_allowance_id,
                    ea.employee_id,
                    ea.amount,
                    ea.percentage,
                    at.name AS allowance_name,
                    at.calculation_method,
                    at.taxable_income,
                    at.taxable_limit,
                    CONCAT(e.firstname, ' ', COALESCE(e.middlename, ''), ' ', e.surname) AS employee_name
                 FROM employee_allowance_payrun_lines eapl
                 INNER JOIN employee_allowance ea ON ea.id = eapl.employee_allowance_id
                 INNER JOIN allowance_types at    ON at.id = ea.allowance_type_id
                 INNER JOIN employees e           ON e.id  = ea.employee_id
                 WHERE eapl.payrun_id = :payrun_id AND eapl.status = 'attached'
                 ORDER BY employee_name",
                [':payrun_id' => $payrun_id]
            );

            return responseJson(success: true, data: $rows, message: "Fetched allowances attached to payrun");
        } catch (\Exception $e) {
            error_log("EmployeeAllowanceController::indexForPayrun error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to fetch attached allowances", code: 500);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function findOrFail($org_id, $id)
    {
        $rows = DB::raw(
            "SELECT
                ea.*,
                at.name AS allowance_name,
                at.code AS allowance_code,
                at.category,
                at.calculation_method,
                at.taxable_income,
                at.taxable_limit
             FROM employee_allowance ea
             INNER JOIN allowance_types at ON at.id = ea.allowance_type_id
             WHERE ea.id = :id AND ea.organization_id = :org_id",
            [':id' => $id, ':org_id' => $org_id]
        );

        return $rows[0] ?? null;
    }
}