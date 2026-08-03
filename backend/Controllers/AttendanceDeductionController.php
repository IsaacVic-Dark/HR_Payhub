<?php

namespace App\Controllers;

use App\Services\DB;

/**
 * attendance_deductions is a READ-MOSTLY table: rows are created and kept in
 * sync automatically by AttendanceService::calculateAttendanceDeduction()
 * every time attendance is recomputed. This controller intentionally does
 * NOT expose store/destroy — HR never hand-creates or hard-deletes a
 * deduction row. The only human actions on the table are:
 *
 *   - waive()   pending  -> waived    (cash policies only, before payroll pulls it in)
 *   - reverse() applied  -> reversed  (after-the-fact correction, e.g. an
 *                                      attendance edit invalidated a row that
 *                                      already touched leave_balances or a payrun)
 *
 * Both are audit-logged on the row itself via waived_by / waived_reason
 * (reused for reversal notes too, since the schema doesn't carry a separate
 * reversed_by/reversed_reason pair).
 */
class AttendanceDeductionController
{
    // -------------------------------------------------------------------------
    // Reusable SELECT columns / JOINs
    // -------------------------------------------------------------------------

    private function deductionSelectColumns(): string
    {
        return "
        ad.id                  AS deduction_id,
        ad.organization_id,
        ad.employee_id,
        ad.attendance_day_id,
        ad.deduction_date,
        ad.late_minutes,
        ad.early_leave_minutes,
        ad.billable_minutes,
        ad.policy_applied,
        ad.cash_amount,
        ad.leave_type_id,
        ad.leave_days_deducted,
        ad.rate_snapshot,
        ad.status,
        ad.payrun_detail_id,
        ad.waived_by,
        ad.waived_reason,
        ad.created_by,
        ad.created_at,
        ad.updated_at,

        -- Employee (nested by formatDeduction())
        emp.employee_number      AS employee_number,
        emp_users.email          AS employee_email,
        CONCAT(
            emp.firstname, ' ',
            COALESCE(emp.middlename, ''), ' ',
            emp.surname
        ) AS employee_full_name,

        -- Leave type (only populated when policy_applied = leave_balance)
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,

        -- Attendance day snapshot
        aad.attendance_date  AS day_attendance_date,
        aad.check_in_time    AS day_check_in_time,
        aad.check_out_time   AS day_check_out_time,
        aad.status           AS day_status,

        -- Waived/reversed-by user (nested)
        waiver_emp.firstname AS waiver_firstname,
        waiver_emp.surname   AS waiver_surname,

        -- Created-by user (nested)
        creator_emp.firstname AS creator_firstname,
        creator_emp.surname   AS creator_surname
    ";
    }

    private function deductionJoins(): string
    {
        return "
            INNER JOIN employees emp
                ON ad.employee_id = emp.id
            INNER JOIN users emp_users
                ON emp.user_id = emp_users.id
            LEFT JOIN leave_types lt
                ON ad.leave_type_id = lt.id
            LEFT JOIN employee_attendance_days aad
                ON ad.attendance_day_id = aad.id
            LEFT JOIN users waiver_users
                ON ad.waived_by = waiver_users.id
            LEFT JOIN employees waiver_emp
                ON waiver_emp.user_id = waiver_users.id
            LEFT JOIN users creator_users
                ON ad.created_by = creator_users.id
            LEFT JOIN employees creator_emp
                ON creator_emp.user_id = creator_users.id
        ";
    }

    private function formatDeduction(object $row): object
    {
        $row->employee = [
            'id'            => (int) $row->employee_id,
            'employee_number' => $row->employee_number,
            'full_name'     => trim(preg_replace('/\s+/', ' ', $row->employee_full_name)),
            'email'         => $row->employee_email,
        ];

        $row->leave_type = $row->leave_type_id ? [
            'id'   => (int) $row->leave_type_id,
            'name' => $row->leave_type_name,
            'code' => $row->leave_type_code,
        ] : null;

        $row->attendance_day = [
            'id'              => (int) $row->attendance_day_id,
            'attendance_date' => $row->day_attendance_date,
            'check_in_time'   => $row->day_check_in_time,
            'check_out_time'  => $row->day_check_out_time,
            'status'          => $row->day_status,
        ];

        $row->waived_by_user = $row->waived_by ? [
            'id'        => (int) $row->waived_by,
            'full_name' => trim(($row->waiver_firstname ?? '') . ' ' . ($row->waiver_surname ?? '')),
        ] : null;

        $row->created_by_user = $row->created_by ? [
            'id'        => (int) $row->created_by,
            'full_name' => trim(($row->creator_firstname ?? '') . ' ' . ($row->creator_surname ?? '')),
        ] : null;

        $row->rate_snapshot = $row->rate_snapshot ? json_decode($row->rate_snapshot, true) : null;
        $row->cash_amount = (float) $row->cash_amount;
        $row->leave_days_deducted = (float) $row->leave_days_deducted;

        unset(
            $row->employee_number,
            $row->employee_email,
            $row->employee_full_name,
            $row->leave_type_name,
            $row->leave_type_code,
            $row->day_attendance_date,
            $row->day_check_in_time,
            $row->day_check_out_time,
            $row->day_status,
            $row->waiver_firstname,
            $row->waiver_surname,
            $row->creator_firstname,
            $row->creator_surname
        );

        return $row;
    }

    // -------------------------------------------------------------------------
    // Role-based visibility — same shape as LeaveController::applyRoleBasedFilters()
    // -------------------------------------------------------------------------
    private function applyRoleBasedFilters(int $orgId): array
    {
        $user     = \App\Middleware\AuthMiddleware::getCurrentUser();
        $employee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

        if (!$user || !$employee) {
            throw new \Exception('User not authenticated');
        }

        $filters = ['organization' => $orgId];

        switch ($user['user_type']) {
            case 'admin':
            case 'hr_manager':
            case 'hr_officer':
            case 'payroll_manager':
            case 'payroll_officer':
            case 'finance_manager':
            case 'auditor':
            case 'compliance_officer':
                // Full org visibility
                break;

            case 'department_manager':
            case 'manager':
                $filters['team_employees'] = $this->getTeamEmployeeIds($employee['id']);
                break;

            case 'employee':
                $filters['employee_id'] = $employee['id'];
                break;

            default:
                throw new \Exception('Unknown user role');
        }

        return $filters;
    }

    private function getTeamEmployeeIds(int $managerId): array
    {
        try {
            $result = DB::raw(
                "SELECT id FROM employees WHERE reports_to = :manager_id AND status = 'active'",
                [':manager_id' => $managerId]
            );
            return array_map(fn($r) => (int) $r->id, $result);
        } catch (\Exception $e) {
            error_log('getTeamEmployeeIds error: ' . $e->getMessage());
            return [];
        }
    }

    private function getDeductionWithValidation(int $id, int $orgId): array
    {
        $result = DB::raw(
            "SELECT ad.* FROM attendance_deductions ad
             WHERE ad.id = :id AND ad.organization_id = :org_id AND ad.is_active = 1",
            [':id' => $id, ':org_id' => $orgId]
        );

        if (empty($result)) {
            return [
                'success' => false,
                'data'    => responseJson(
                    success: false,
                    data: null,
                    message: "Attendance deduction not found",
                    code: 404
                ),
            ];
        }

        return ['success' => true, 'data' => $result[0]];
    }

    // =========================================================================
    // PUBLIC METHODS
    // =========================================================================

    /**
     * GET /organizations/{org_id}/attendance-deductions
     * Query params: employee_id?, status?, policy_applied?, date_from?, date_to?, name?
     */
    public function index(int $orgId): mixed
    {
        try {
            if (!$orgId || !is_numeric($orgId)) {
                return responseJson(
                    success: false,
                    message: "Invalid or missing organization ID",
                    code: 400,
                    errors: ['org_id' => 'Organization ID must be a valid number']
                );
            }

            $orgCheck = DB::table('organizations')->where(['id' => $orgId])->get();
            if (empty($orgCheck)) {
                return responseJson(success: false, data: null, message: "Organization not found", code: 404);
            }

            try {
                $filters = $this->applyRoleBasedFilters($orgId);
            } catch (\Exception $e) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Authentication error",
                    code: 401,
                    errors: ['authentication' => $e->getMessage()]
                );
            }

            // Pagination
            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
            $offset  = ($page - 1) * $perPage;

            // Filters
            $employeeId    = $_GET['employee_id']    ?? null;
            $status        = $_GET['status']         ?? null;
            $policyApplied = $_GET['policy_applied'] ?? null;
            $dateFrom      = $_GET['date_from']      ?? null;
            $dateTo        = $_GET['date_to']        ?? null;
            $name          = $_GET['name']           ?? null;

            $errors = [];
            if ($employeeId && !is_numeric($employeeId)) {
                $errors['employee_id'] = "Must be a valid number";
            }
            if ($status && !in_array($status, ['pending', 'applied', 'waived', 'reversed'])) {
                $errors['status'] = "Must be one of: pending, applied, waived, reversed";
            }
            if ($policyApplied && !in_array($policyApplied, ['none', 'per_minute', 'daily_rate', 'leave_balance'])) {
                $errors['policy_applied'] = "Must be one of: none, per_minute, daily_rate, leave_balance";
            }
            if ($dateFrom && !strtotime($dateFrom)) {
                $errors['date_from'] = "Must be a valid date";
            }
            if ($dateTo && !strtotime($dateTo)) {
                $errors['date_to'] = "Must be a valid date";
            }
            if (!empty($errors)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Validation failed",
                    code: 400,
                    errors: $errors
                );
            }

            // Build WHERE
            $where  = ["ad.organization_id = :org_id", "ad.is_active = 1"];
            $params = [':org_id' => $orgId];

            if (isset($filters['employee_id'])) {
                $where[] = "ad.employee_id = :role_emp_id";
                $params[':role_emp_id'] = $filters['employee_id'];
            }

            if (isset($filters['team_employees'])) {
                if (empty($filters['team_employees'])) {
                    // Manager with no active reports — nothing to show
                    return responseJson(
                        success: true,
                        data: [],
                        message: "No attendance deductions found matching the specified criteria",
                        code: 200,
                        metadata: [
                            'pagination' => [
                                'current_page' => $page, 'per_page' => $perPage, 'total' => 0,
                                'total_pages' => 0, 'has_next' => false, 'has_prev' => false,
                            ],
                        ]
                    );
                }
                $placeholders = implode(',', array_map(fn($i) => ":team_$i", array_keys($filters['team_employees'])));
                $where[] = "ad.employee_id IN ($placeholders)";
                foreach ($filters['team_employees'] as $i => $empId) {
                    $params[":team_$i"] = $empId;
                }
            }

            if ($employeeId) {
                $where[] = "ad.employee_id = :f_emp_id";
                $params[':f_emp_id'] = (int) $employeeId;
            }
            if ($status) {
                $where[] = "ad.status = :f_status";
                $params[':f_status'] = $status;
            }
            if ($policyApplied) {
                $where[] = "ad.policy_applied = :f_policy";
                $params[':f_policy'] = $policyApplied;
            }
            if ($dateFrom) {
                $where[] = "ad.deduction_date >= :f_date_from";
                $params[':f_date_from'] = date('Y-m-d', strtotime($dateFrom));
            }
            if ($dateTo) {
                $where[] = "ad.deduction_date <= :f_date_to";
                $params[':f_date_to'] = date('Y-m-d', strtotime($dateTo));
            }
            if ($name) {
                $where[] = "CONCAT(emp.firstname,' ',COALESCE(emp.middlename,''),' ',emp.surname) LIKE :f_name";
                $params[':f_name'] = '%' . $name . '%';
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM attendance_deductions ad
                 {$this->deductionJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: true,
                    data: [],
                    message: "No attendance deductions found matching the specified criteria",
                    code: 200,
                    metadata: [
                        'pagination' => [
                            'current_page' => $page, 'per_page' => $perPage, 'total' => 0,
                            'total_pages' => 0, 'has_next' => false, 'has_prev' => false,
                        ],
                        'statistics' => [
                            'total_records'            => 0,
                            'total_cash_pending'       => 0,
                            'total_leave_days_deducted' => 0,
                            'by_status'   => ['pending' => 0, 'applied' => 0, 'waived' => 0, 'reversed' => 0],
                            'by_policy'   => ['none' => 0, 'per_minute' => 0, 'daily_rate' => 0, 'leave_balance' => 0],
                        ],
                    ]
                );
            }

            $statsQuery = "
                SELECT
                    COUNT(*) as total_records,
                    SUM(CASE WHEN ad.status = 'pending'  THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN ad.status = 'applied'  THEN 1 ELSE 0 END) as applied_count,
                    SUM(CASE WHEN ad.status = 'waived'   THEN 1 ELSE 0 END) as waived_count,
                    SUM(CASE WHEN ad.status = 'reversed' THEN 1 ELSE 0 END) as reversed_count,
                    SUM(CASE WHEN ad.policy_applied = 'none'          THEN 1 ELSE 0 END) as policy_none_count,
                    SUM(CASE WHEN ad.policy_applied = 'per_minute'    THEN 1 ELSE 0 END) as policy_per_minute_count,
                    SUM(CASE WHEN ad.policy_applied = 'daily_rate'    THEN 1 ELSE 0 END) as policy_daily_rate_count,
                    SUM(CASE WHEN ad.policy_applied = 'leave_balance' THEN 1 ELSE 0 END) as policy_leave_balance_count,
                    SUM(CASE WHEN ad.status = 'pending' THEN ad.cash_amount ELSE 0 END) as total_cash_pending,
                    SUM(COALESCE(ad.leave_days_deducted, 0)) as total_leave_days_deducted
                FROM attendance_deductions ad
                {$this->deductionJoins()} $whereClause
            ";
            $stats = DB::raw($statsQuery, $params)[0] ?? null;

            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);

            $deductions = DB::raw(
                "SELECT {$this->deductionSelectColumns()}
                 FROM attendance_deductions ad
                 {$this->deductionJoins()}
                 $whereClause
                 ORDER BY ad.deduction_date DESC, ad.created_at DESC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            $deductions = array_map(fn($d) => $this->formatDeduction($d), $deductions);

            return responseJson(
                success: true,
                data: array_values($deductions),
                message: "Attendance deductions fetched successfully",
                code: 200,
                metadata: [
                    'pagination' => [
                        'current_page' => $page,
                        'per_page'     => $perPage,
                        'total'        => (int) $total,
                        'total_pages'  => (int) ceil($total / $perPage),
                        'has_next'     => $page < ceil($total / $perPage),
                        'has_prev'     => $page > 1,
                    ],
                    'statistics' => [
                        'total_records'             => (int) ($stats->total_records ?? 0),
                        'total_cash_pending'        => (float) ($stats->total_cash_pending ?? 0),
                        'total_leave_days_deducted' => (float) ($stats->total_leave_days_deducted ?? 0),
                        'by_status' => [
                            'pending'  => (int) ($stats->pending_count  ?? 0),
                            'applied'  => (int) ($stats->applied_count  ?? 0),
                            'waived'   => (int) ($stats->waived_count   ?? 0),
                            'reversed' => (int) ($stats->reversed_count ?? 0),
                        ],
                        'by_policy' => [
                            'none'          => (int) ($stats->policy_none_count          ?? 0),
                            'per_minute'    => (int) ($stats->policy_per_minute_count    ?? 0),
                            'daily_rate'    => (int) ($stats->policy_daily_rate_count    ?? 0),
                            'leave_balance' => (int) ($stats->policy_leave_balance_count ?? 0),
                        ],
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Attendance deduction index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch attendance deductions",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/attendance-deductions/{id}
     */
    public function show(int $orgId, int $id): mixed
    {
        try {
            $result = DB::raw(
                "SELECT {$this->deductionSelectColumns()}
                 FROM attendance_deductions ad
                 {$this->deductionJoins()}
                 WHERE ad.id = :id AND ad.organization_id = :org_id AND ad.is_active = 1",
                [':id' => $id, ':org_id' => $orgId]
            );

            if (empty($result)) {
                return responseJson(success: false, data: null, message: "Attendance deduction not found", code: 404);
            }

            return responseJson(
                success: true,
                data: $this->formatDeduction($result[0]),
                message: "Attendance deduction fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch attendance deduction: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/attendance-deductions/{id}/waive
     * Body: { waived_reason (required) }
     * Only a still-'pending' cash row (per_minute/daily_rate, not yet pulled
     * into a payrun) can be waived. leave_balance rows resolve to
     * applied/waived immediately inside calculateAttendanceDeduction() and
     * never sit 'pending', so this route naturally only ever touches cash.
     */
    public function waive(int $orgId, int $id): mixed
    {
        try {
            $data         = json_decode(file_get_contents('php://input'), true);
            $waivedReason = trim($data['waived_reason'] ?? '');

            if ($waivedReason === '') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Field 'waived_reason' is required",
                    code: 400
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
            }

            $deduction = $this->getDeductionWithValidation($id, $orgId);
            if (!$deduction['success']) return $deduction['data'];
            $row = $deduction['data'];

            if ($row->status !== 'pending') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only a pending deduction can be waived (current status: {$row->status})",
                    code: 400
                );
            }

            DB::table('attendance_deductions')->update([
                'status'        => 'waived',
                'waived_by'     => $currentUser['id'],
                'waived_reason' => $waivedReason,
                'updated_at'    => date('Y-m-d H:i:s'),
            ], 'id', $id);

            return responseJson(
                success: true,
                data: [
                    'deduction_id'  => (int) $id,
                    'status'        => 'waived',
                    'waived_by'     => $currentUser['id'],
                    'waived_reason' => $waivedReason,
                ],
                message: "Attendance deduction waived successfully"
            );
        } catch (\Exception $e) {
            error_log("Attendance deduction waive error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to waive attendance deduction: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/attendance-deductions/{id}/reverse
     * Body: { reversal_reason (required) }
     *
     * Only an 'applied' row can be reversed — i.e. one that already took
     * real effect (leave debited, or cash pulled into a payrun):
     *   - leave_balance: credits leave_days_deducted back onto leave_balances.used_days.
     *   - per_minute/daily_rate already pulled into a payrun (payrun_detail_id set):
     *     blocked here — the cash already sits inside a payrun_deductions line,
     *     which must be corrected through a payroll adjustment, not silently
     *     un-flagged on this row while the payrun still reflects it.
     */
    public function reverse(int $orgId, int $id): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $reversalReason  = trim($data['reversal_reason'] ?? '');

            if ($reversalReason === '') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Field 'reversal_reason' is required",
                    code: 400
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
            }

            $deduction = $this->getDeductionWithValidation($id, $orgId);
            if (!$deduction['success']) return $deduction['data'];
            $row = $deduction['data'];

            if ($row->status !== 'applied') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only an applied deduction can be reversed (current status: {$row->status})",
                    code: 400
                );
            }

            if (in_array($row->policy_applied, ['per_minute', 'daily_rate']) && $row->payrun_detail_id) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "This deduction is already included in payrun_detail #{$row->payrun_detail_id}. " .
                             "Reverse it through a payroll adjustment instead of directly here.",
                    code: 409
                );
            }

            DB::transaction(function () use ($row, $id, $currentUser, $reversalReason) {
                if ($row->policy_applied === 'leave_balance' && (float) $row->leave_days_deducted > 0) {
                    $currentYear = (int) date('Y', strtotime($row->deduction_date));
                    DB::raw(
                        "UPDATE leave_balances
                            SET used_days = GREATEST(0, used_days - :days), updated_at = NOW()
                          WHERE employee_id = :emp AND leave_type_id = :type AND leave_year = :year",
                        [
                            ':days' => $row->leave_days_deducted,
                            ':emp'  => $row->employee_id,
                            ':type' => $row->leave_type_id,
                            ':year' => $currentYear,
                        ]
                    );
                }

                DB::table('attendance_deductions')->update([
                    'status'        => 'reversed',
                    'waived_by'     => $currentUser['id'],
                    'waived_reason' => $reversalReason,
                    'updated_at'    => date('Y-m-d H:i:s'),
                ], 'id', $id);
            });

            return responseJson(
                success: true,
                data: [
                    'deduction_id'    => (int) $id,
                    'status'          => 'reversed',
                    'reversed_by'     => $currentUser['id'],
                    'reversal_reason' => $reversalReason,
                ],
                message: "Attendance deduction reversed successfully"
            );
        } catch (\Exception $e) {
            error_log("Attendance deduction reverse error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to reverse attendance deduction: " . $e->getMessage(),
                code: 500
            );
        }
    }
}