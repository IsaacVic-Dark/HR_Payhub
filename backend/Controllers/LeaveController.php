<?php

namespace App\Controllers;

use App\Services\DB;

class LeaveController
{
    // -------------------------------------------------------------------------
    // Reusable SELECT columns for all leave queries
    // Joins: leave_types, approver, reliever
    // -------------------------------------------------------------------------
    private function leaveSelectColumns(): string
    {
        return "
            leaves.id               AS leave_id,
            leaves.start_date,
            leaves.end_date,
            leaves.duration_days,
            leaves.is_half_day,
            leaves.half_day_period,
            leaves.status,
            leaves.reason,
            leaves.rejection_reason,
            leaves.document_path,
            leaves.approved_at,
            leaves.rejected_at,
            leaves.created_at,
            leaves.updated_at,

            -- Leave type details
            lt.name        AS leave_type_name,
            lt.code        AS leave_type_code,
            lt.is_paid     AS leave_type_is_paid,
            lt.requires_approval AS leave_type_requires_approval,

            -- Employee details
            emp_users.email        AS employee_email,
            CONCAT(
                emp_users.first_name, ' ',
                COALESCE(emp_users.middle_name, ''), ' ',
                emp_users.surname
            ) AS employee_full_name,

            -- Approver details
            approver_users.email       AS approver_email,
            CONCAT(
                approver_users.first_name, ' ',
                COALESCE(approver_users.middle_name, ''), ' ',
                approver_users.surname
            ) AS approver_full_name,

            -- Reliever details
            reliever_users.email       AS reliever_email,
            CONCAT(
                reliever_users.first_name, ' ',
                COALESCE(reliever_users.middle_name, ''), ' ',
                reliever_users.surname
            ) AS reliever_full_name
        ";
    }

    // -------------------------------------------------------------------------
    // Reusable JOINs for all leave queries
    // -------------------------------------------------------------------------
    private function leaveJoins(): string
    {
        return "
            INNER JOIN leave_types lt
                ON leaves.leave_type_id = lt.id
            INNER JOIN employees emp
                ON leaves.employee_id = emp.id
            INNER JOIN users emp_users
                ON emp.user_id = emp_users.id
            LEFT JOIN employees approver_emp
                ON leaves.approver_id = approver_emp.id
            LEFT JOIN users approver_users
                ON approver_emp.user_id = approver_users.id
            LEFT JOIN employees reliever_emp
                ON leaves.reliever_id = reliever_emp.id
            LEFT JOIN users reliever_users
                ON reliever_emp.user_id = reliever_users.id
        ";
    }

    // -------------------------------------------------------------------------
    // Calculate duration in days respecting weekends and half-day rules
    // -------------------------------------------------------------------------
    private function calculateDuration(
        string $startDate,
        string $endDate,
        bool $excludeWeekends,
        bool $isHalfDay
    ): float {
        if ($isHalfDay) {
            return 0.5;
        }

        $start = new \DateTime($startDate);
        $end   = new \DateTime($endDate);
        $end->modify('+1 day'); // inclusive end

        if (!$excludeWeekends) {
            return (float) $start->diff($end)->days;
        }

        $days = 0;
        $current = clone $start;
        while ($current < $end) {
            $dow = (int) $current->format('N'); // 1=Mon … 7=Sun
            if ($dow < 6) {
                $days++;
            }
            $current->modify('+1 day');
        }

        return (float) $days;
    }

    // -------------------------------------------------------------------------
    // Load org-level leave configs (exclude_weekends, etc.)
    // -------------------------------------------------------------------------
    private function getLeaveOrgConfig(int $orgId): array
    {
        $rows = DB::raw(
            "SELECT name, value_text, fixed_amount
             FROM organization_configs
             WHERE organization_id = :org_id
               AND config_type = 'leave'
               AND is_active = 1",
            [':org_id' => $orgId]
        );

        $cfg = [];
        foreach ($rows as $row) {
            $cfg[$row->name] = $row->value_text ?? $row->fixed_amount;
        }

        return [
            'exclude_weekends'     => ($cfg['Exclude Weekends']     ?? 'true') === 'true',
            'allow_half_day'       => ($cfg['Allow Half-Day Leave'] ?? 'true') === 'true',
            'allow_negative'       => ($cfg['Allow Negative Balance'] ?? 'false') === 'true',
            'past_limit_days'      => (int) ($cfg['Past Application Limit (Days)']    ?? 7),
            'future_limit_days'    => (int) ($cfg['Future Application Limit (Days)']  ?? 90),
            'notify_manager'       => ($cfg['Notify Manager on Request']              ?? 'true') === 'true',
            'notify_employee'      => ($cfg['Notify Employee on Approval/Rejection']  ?? 'true') === 'true',
        ];
    }

    // -------------------------------------------------------------------------
    // Resolve leave_type_id from a code string (e.g. "ANNUAL") for an org
    // -------------------------------------------------------------------------
    private function resolveLeaveTypeId(int $orgId, string $code): ?int
    {
        $result = DB::raw(
            "SELECT id FROM leave_types
             WHERE organization_id = :org_id
               AND code = :code
               AND is_active = 1
             LIMIT 1",
            [':org_id' => $orgId, ':code' => strtoupper($code)]
        );

        return $result[0]->id ?? null;
    }

    // -------------------------------------------------------------------------
    // Validate leave exists and belongs to org — used by approve/reject/etc.
    // Now uses leaves.organization_id directly (no sub-select needed)
    // -------------------------------------------------------------------------
    private function getLeaveWithValidation(int $leaveId, int $orgId): array
    {
        $result = DB::raw(
            "SELECT leaves.*
             FROM leaves
             WHERE leaves.id = :leave_id
               AND leaves.organization_id = :org_id",
            [':leave_id' => $leaveId, ':org_id' => $orgId]
        );

        if (empty($result)) {
            return [
                'success' => false,
                'data'    => responseJson(
                    success: false,
                    data: null,
                    message: "Leave not found",
                    code: 404
                )
            ];
        }

        return ['success' => true, 'data' => $result[0]];
    }

    // -------------------------------------------------------------------------
    // Check overlapping approved/pending leaves for an employee
    // -------------------------------------------------------------------------
    private function checkOverlappingLeaves(
        int $employeeId,
        string $startDate,
        string $endDate,
        ?int $excludeLeaveId = null
    ): array {
        try {
            $sql = "
                SELECT
                    leaves.id,
                    lt.name AS leave_type_name,
                    leaves.start_date,
                    leaves.end_date,
                    leaves.status
                FROM leaves
                INNER JOIN leave_types lt ON leaves.leave_type_id = lt.id
                WHERE leaves.employee_id = :employee_id
                  AND leaves.status IN ('pending', 'approved')
                  AND (
                      (leaves.start_date BETWEEN :start1 AND :end1)
                   OR (leaves.end_date   BETWEEN :start2 AND :end2)
                   OR (leaves.start_date <= :start3 AND leaves.end_date >= :end3)
                  )
            ";

            $params = [
                ':employee_id' => $employeeId,
                ':start1' => $startDate,
                ':end1' => $endDate,
                ':start2' => $startDate,
                ':end2' => $endDate,
                ':start3' => $startDate,
                ':end3' => $endDate,
            ];

            if ($excludeLeaveId) {
                $sql .= " AND leaves.id != :exclude_id";
                $params[':exclude_id'] = $excludeLeaveId;
            }

            $conflicts = DB::raw($sql, $params);

            if (!empty($conflicts)) {
                $c = $conflicts[0];
                return [
                    'valid'    => false,
                    'message'  => "Overlapping {$c->status} leave ({$c->leave_type_name}) from {$c->start_date} to {$c->end_date}",
                    'conflict' => [
                        'leave_id'        => $c->id,
                        'leave_type_name' => $c->leave_type_name,
                        'start_date'      => $c->start_date,
                        'end_date'        => $c->end_date,
                        'status'          => $c->status,
                    ]
                ];
            }

            return ['valid' => true];
        } catch (\Exception $e) {
            error_log("Overlap check error: " . $e->getMessage());
            return ['valid' => false, 'message' => "Failed to validate leave dates"];
        }
    }

    // -------------------------------------------------------------------------
    // Check employee leave balance
    // -------------------------------------------------------------------------
    private function checkLeaveBalance(
        int $employeeId,
        int $leaveTypeId,
        float $requestedDays,
        bool $allowNegative
    ): array {
        $currentYear = (int) date('Y');

        $balance = DB::raw(
            "SELECT
                entitled_days,
                accrued_days,
                used_days,
                pending_days,
                carried_over,
                (entitled_days + accrued_days + carried_over - used_days - pending_days) AS available_days
             FROM leave_balances
             WHERE employee_id  = :emp_id
               AND leave_type_id = :type_id
               AND leave_year    = :year
             LIMIT 1",
            [':emp_id' => $employeeId, ':type_id' => $leaveTypeId, ':year' => $currentYear]
        );

        if (empty($balance)) {
            return [
                'valid'     => false,
                'message'   => "No leave balance found for this leave type in {$currentYear}",
                'available' => 0
            ];
        }

        $available = (float) $balance[0]->available_days;

        if (!$allowNegative && $requestedDays > $available) {
            return [
                'valid'     => false,
                'message'   => "Insufficient balance. Requested: {$requestedDays} days, Available: {$available} days",
                'available' => $available
            ];
        }

        return ['valid' => true, 'available' => $available];
    }

    // -------------------------------------------------------------------------
    // Debit pending_days on submission; move to used_days on approval
    // -------------------------------------------------------------------------
    private function debitPendingBalance(int $employeeId, int $leaveTypeId, float $days): void
    {
        DB::raw(
            "UPDATE leave_balances
             SET pending_days = pending_days + :days
             WHERE employee_id  = :emp_id
               AND leave_type_id = :type_id
               AND leave_year    = :year",
            [
                ':days' => $days,
                ':emp_id' => $employeeId,
                ':type_id' => $leaveTypeId,
                ':year' => (int) date('Y')
            ]
        );
    }

    private function confirmUsedBalance(int $employeeId, int $leaveTypeId, float $days): void
    {
        DB::raw(
            "UPDATE leave_balances
             SET pending_days = GREATEST(pending_days - :days, 0),
                 used_days    = used_days + :days2
             WHERE employee_id  = :emp_id
               AND leave_type_id = :type_id
               AND leave_year    = :year",
            [
                ':days' => $days,
                ':days2' => $days,
                ':emp_id' => $employeeId,
                ':type_id' => $leaveTypeId,
                ':year' => (int) date('Y')
            ]
        );
    }

    private function releasePendingBalance(int $employeeId, int $leaveTypeId, float $days): void
    {
        DB::raw(
            "UPDATE leave_balances
             SET pending_days = GREATEST(pending_days - :days, 0)
             WHERE employee_id  = :emp_id
               AND leave_type_id = :type_id
               AND leave_year    = :year",
            [
                ':days' => $days,
                ':emp_id' => $employeeId,
                ':type_id' => $leaveTypeId,
                ':year' => (int) date('Y')
            ]
        );
    }

    // -------------------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------------------
    private function createLeaveNotification(
        int $employeeId,
        int $orgId,
        int $leaveId,
        string $status,
        string $employeeName,
        ?string $reason = null
    ): void {
        try {
            $messages = [
                'pending'  => "{$employeeName} submitted a leave request requiring your approval",
                'approved' => "Your leave request has been approved",
                'rejected' => "Your leave request was rejected" . ($reason ? ": {$reason}" : ""),
                'cancelled' => "Leave request cancelled",
            ];

            DB::table('notifications')->insert([
                'employee_id'     => $employeeId,
                'organization_id' => $orgId,
                'title'           => 'Leave ' . ucfirst($status),
                'message'         => $messages[$status] ?? "Leave status updated",
                'type'            => 'leave',
                'is_read'         => 0,
                'metadata'        => json_encode(['leave_id' => $leaveId, 'status' => $status]),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Notification error: " . $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Auto-expire: only affects pending leaves past end_date
    // Approved leaves that have ended stay approved (already taken)
    // -------------------------------------------------------------------------
    private function autoExpireLeaves(): void
    {
        try {
            // Release pending balance for leaves that are expiring
            $expiring = DB::raw(
                "SELECT id, employee_id, leave_type_id, duration_days
                 FROM leaves
                 WHERE end_date < CURDATE()
                   AND status = 'pending'"
            );

            foreach ($expiring as $l) {
                $this->releasePendingBalance(
                    (int) $l->employee_id,
                    (int) $l->leave_type_id,
                    (float) ($l->duration_days ?? 0)
                );
            }

            DB::raw(
                "UPDATE leaves
                 SET status = 'expired', updated_at = NOW()
                 WHERE end_date < CURDATE()
                   AND status = 'pending'"
            );
        } catch (\Exception $e) {
            error_log("Auto-expire error: " . $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Role-based filter helper
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
                "SELECT id FROM employees
                 WHERE reports_to = :manager_id AND status = 'active'",
                [':manager_id' => $managerId]
            );
            return array_column((array) $result, 'id');
        } catch (\Exception $e) {
            error_log("Team fetch error: " . $e->getMessage());
            return [];
        }
    }

    private function canUserApproveLeave(int $currentEmployeeId, object $leaveData, string $userType): array
    {
        if (in_array($userType, ['admin', 'hr_manager', 'hr_officer'])) {
            return ['allowed' => true, 'reason' => ''];
        }

        if ($leaveData->employee_id == $currentEmployeeId) {
            return ['allowed' => false, 'reason' => 'You cannot approve your own leave'];
        }

        if (in_array($userType, ['department_manager', 'manager'])) {
            if (!$this->isEmployeeInTeam((int) $leaveData->employee_id, $currentEmployeeId)) {
                return ['allowed' => false, 'reason' => 'You can only approve leaves from your team members'];
            }
            return ['allowed' => true, 'reason' => ''];
        }

        return ['allowed' => false, 'reason' => 'You do not have permission to approve leaves'];
    }

    private function isEmployeeInTeam(int $employeeId, int $managerId): bool
    {
        $result = DB::raw(
            "SELECT COUNT(*) as count FROM employees
             WHERE id = :emp_id AND reports_to = :mgr_id AND status = 'active'",
            [':emp_id' => $employeeId, ':mgr_id' => $managerId]
        );
        return ($result[0]->count ?? 0) > 0;
    }

    // =========================================================================
    // PUBLIC METHODS
    // =========================================================================

    /**
     * GET /organizations/{org_id}/leaves
     * List all leaves for an org with pagination, filters, and stats
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

            $this->autoExpireLeaves();

            // Pagination
            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
            $offset  = ($page - 1) * $perPage;

            // Filters
            $status      = $_GET['status']       ?? null;
            $leaveTypeId = $_GET['leave_type_id'] ?? null; // now an ID, not an ENUM string
            $approverId  = $_GET['approver_id']   ?? null;
            $relieverId  = $_GET['reliever_id']   ?? null;
            $month       = $_GET['month']         ?? null;
            $year        = $_GET['year']          ?? null;
            $name        = $_GET['name']          ?? null;

            // Validate
            $errors = [];
            if ($status && !in_array($status, ['pending', 'approved', 'rejected', 'cancelled', 'expired'])) {
                $errors['status'] = "Must be one of: pending, approved, rejected, cancelled, expired";
            }
            if ($leaveTypeId && !is_numeric($leaveTypeId)) {
                $errors['leave_type_id'] = "Must be a numeric ID";
            }
            if ($approverId && !is_numeric($approverId)) {
                $errors['approver_id'] = "Must be a valid number";
            }
            if ($relieverId && !is_numeric($relieverId)) {
                $errors['reliever_id'] = "Must be a valid number";
            }
            if ($month && ((int) $month < 1 || (int) $month > 12)) {
                $errors['month'] = "Must be between 1 and 12";
            }
            if ($year && ((int) $year < 1900 || (int) $year > 2100)) {
                $errors['year'] = "Must be between 1900 and 2100";
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
            $where  = ["leaves.organization_id = :org_id"];
            $params = [':org_id' => $orgId];

            if (isset($filters['employee_id'])) {
                $where[] = "leaves.employee_id = :role_emp_id";
                $params[':role_emp_id'] = $filters['employee_id'];
            }

            if (!empty($filters['team_employees'])) {
                $placeholders = implode(',', array_map(fn($i) => ":team_$i", array_keys($filters['team_employees'])));
                $where[] = "leaves.employee_id IN ($placeholders)";
                foreach ($filters['team_employees'] as $i => $empId) {
                    $params[":team_$i"] = $empId;
                }
            }

            if ($status) {
                $where[] = "leaves.status = :f_status";
                $params[':f_status']       = $status;
            }
            if ($leaveTypeId) {
                $where[] = "leaves.leave_type_id = :f_lt_id";
                $params[':f_lt_id']        = (int) $leaveTypeId;
            }
            if ($approverId) {
                $where[] = "leaves.approver_id = :f_app_id";
                $params[':f_app_id']       = (int) $approverId;
            }
            if ($relieverId) {
                $where[] = "leaves.reliever_id = :f_rel_id";
                $params[':f_rel_id']       = (int) $relieverId;
            }
            if ($month) {
                $where[] = "MONTH(leaves.start_date) = :f_month";
                $params[':f_month']    = (int) $month;
            }
            if ($year) {
                $where[] = "YEAR(leaves.start_date) = :f_year";
                $params[':f_year']     = (int) $year;
            }
            if ($name) {
                $where[] = "CONCAT(emp_users.first_name,' ',COALESCE(emp_users.middle_name,''),' ',emp_users.surname) LIKE :f_name";
                $params[':f_name'] = '%' . $name . '%';
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            // Count
            $total = DB::raw(
                "SELECT COUNT(*) as total FROM leaves
                 {$this->leaveJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No leaves found matching the specified criteria",
                    code: 404
                );
            }

            // Stats — dynamic by leave type
            $statsQuery = "
                SELECT
                    COUNT(*) as total_leaves,
                    SUM(CASE WHEN leaves.status = 'pending'   THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN leaves.status = 'approved'  THEN 1 ELSE 0 END) as approved_count,
                    SUM(CASE WHEN leaves.status = 'rejected'  THEN 1 ELSE 0 END) as rejected_count,
                    SUM(CASE WHEN leaves.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                    SUM(CASE WHEN leaves.status = 'expired'   THEN 1 ELSE 0 END) as expired_count,
                    SUM(COALESCE(leaves.duration_days, 0))                        as total_days_taken
                FROM leaves
                {$this->leaveJoins()} $whereClause
            ";
            $stats = DB::raw($statsQuery, $params)[0] ?? null;

            // Per-type breakdown (dynamic — works for any leave type)
            $typeBreakdown = DB::raw(
                "SELECT lt.name AS leave_type_name, lt.code, COUNT(*) as count,
            SUM(COALESCE(leaves.duration_days,0)) as total_days
     FROM leaves
     {$this->leaveJoins()}
     $whereClause
     GROUP BY lt.id, lt.name, lt.code",
                $params
            );

            // Paginated data
            $dataParams = array_merge($params, [
                ':limit'  => $perPage,
                ':offset' => $offset,
            ]);

            $leaves = DB::raw(
                "SELECT {$this->leaveSelectColumns()}
                 FROM leaves
                 {$this->leaveJoins()}
                 $whereClause
                 ORDER BY leaves.created_at DESC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            return responseJson(
                success: true,
                data: $leaves,
                message: "Leaves fetched successfully",
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
                        'total_leaves'    => (int) ($stats->total_leaves    ?? 0),
                        'total_days_taken' => (float) ($stats->total_days_taken ?? 0),
                        'by_status'       => [
                            'pending'   => (int) ($stats->pending_count   ?? 0),
                            'approved'  => (int) ($stats->approved_count  ?? 0),
                            'rejected'  => (int) ($stats->rejected_count  ?? 0),
                            'cancelled' => (int) ($stats->cancelled_count ?? 0),
                            'expired'   => (int) ($stats->expired_count   ?? 0),
                        ],
                        'by_type' => $typeBreakdown,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Leave index error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch leaves",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/leaves/{leave_id}
     */
    public function show(int $orgId, int $leaveId): mixed
    {
        try {
            $result = DB::raw(
                "SELECT {$this->leaveSelectColumns()}
                 FROM leaves
                 {$this->leaveJoins()}
                 WHERE leaves.id = :leave_id
                   AND leaves.organization_id = :org_id",
                [':leave_id' => $leaveId, ':org_id' => $orgId]
            );

            if (empty($result)) {
                return responseJson(success: false, data: null, message: "Leave not found", code: 404);
            }

            return responseJson(success: true, data: $result[0], message: "Leave fetched successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/leaves
     * Admin/HR creates a leave on behalf of an employee
     */
    public function store(int $orgId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            foreach (['leave_type_id', 'employee_id', 'start_date', 'end_date'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Field '$f' is required",
                        code: 400
                    );
                }
            }

            if (strtotime($data['start_date']) > strtotime($data['end_date'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Start date must be before end date",
                    code: 400
                );
            }

            // Verify employee belongs to org
            $employee = DB::table('employees')
                ->where(['id' => $data['employee_id'], 'organization_id' => $orgId])
                ->get();

            if (empty($employee)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee not found in this organization",
                    code: 404
                );
            }

            // Verify leave type belongs to org and is active
            $leaveType = DB::table('leave_types')
                ->where(['id' => $data['leave_type_id'], 'organization_id' => $orgId, 'is_active' => 1])
                ->get();

            if (empty($leaveType)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave type not found or inactive",
                    code: 404
                );
            }

            $orgCfg  = $this->getLeaveOrgConfig($orgId);
            $isHalfDay = !empty($data['is_half_day']);
            $duration  = $this->calculateDuration(
                $data['start_date'],
                $data['end_date'],
                $orgCfg['exclude_weekends'],
                $isHalfDay
            );

            $overlap = $this->checkOverlappingLeaves(
                (int) $data['employee_id'],
                $data['start_date'],
                $data['end_date']
            );
            if (!$overlap['valid']) {
                return responseJson(
                    success: false,
                    data: $overlap['conflict'] ?? null,
                    message: $overlap['message'],
                    code: 409
                );
            }

            $insertData = [
                'organization_id' => $orgId,
                'employee_id'     => $data['employee_id'],
                'leave_type_id'   => $data['leave_type_id'],
                'start_date'      => $data['start_date'],
                'end_date'        => $data['end_date'],
                'duration_days'   => $duration,
                'is_half_day'     => $isHalfDay ? 1 : 0,
                'half_day_period' => $isHalfDay ? ($data['half_day_period'] ?? null) : null,
                'status'          => 'pending',
                'reason'          => $data['reason']      ?? null,
                'document_path'   => $data['document_path'] ?? null,
                'approver_id'     => $data['approver_id'] ?? null,
                'reliever_id'     => $data['reliever_id'] ?? null,
            ];

            DB::table('leaves')->insert($insertData);
            $leaveId = DB::lastInsertId();

            $this->debitPendingBalance(
                (int) $data['employee_id'],
                (int) $data['leave_type_id'],
                $duration
            );

            return responseJson(
                success: true,
                data: ['id' => $leaveId],
                message: "Leave created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * PUT /organizations/{org_id}/leaves/{leave_id}
     * Update a pending leave (dates, type, reliever, reason)
     */
    public function update(int $orgId, int $leaveId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            $existing = DB::table('leaves')->where(['id' => $leaveId, 'organization_id' => $orgId])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Leave not found", code: 404);
            }

            $leave = $existing[0];

            if (in_array($leave->status, ['approved', 'rejected', 'expired', 'cancelled'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot update a leave with status: {$leave->status}",
                    code: 400
                );
            }

            $updateData = [];
            $allowedFields = ['reason', 'approver_id', 'reliever_id', 'document_path'];
            foreach ($allowedFields as $f) {
                if (isset($data[$f])) {
                    $updateData[$f] = $data[$f];
                }
            }

            // If leave_type_id is changing, validate the new type
            if (isset($data['leave_type_id']) && $data['leave_type_id'] != $leave->leave_type_id) {
                $leaveType = DB::table('leave_types')
                    ->where(['id' => $data['leave_type_id'], 'organization_id' => $orgId, 'is_active' => 1])
                    ->get();

                if (empty($leaveType)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Leave type not found or inactive",
                        code: 404
                    );
                }
                $updateData['leave_type_id'] = $data['leave_type_id'];
            }

            // Recalculate duration if dates or type change
            $newStart  = $data['start_date'] ?? $leave->start_date;
            $newEnd    = $data['end_date']   ?? $leave->end_date;
            $isHalfDay = isset($data['is_half_day']) ? (bool) $data['is_half_day'] : (bool) $leave->is_half_day;

            if (strtotime($newStart) > strtotime($newEnd)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Start date must be before end date",
                    code: 400
                );
            }

            if (isset($data['start_date'])) $updateData['start_date'] = $newStart;
            if (isset($data['end_date']))   $updateData['end_date']   = $newEnd;
            if (isset($data['is_half_day'])) {
                $updateData['is_half_day']     = $isHalfDay ? 1 : 0;
                $updateData['half_day_period'] = $isHalfDay ? ($data['half_day_period'] ?? null) : null;
            }

            if (isset($data['start_date']) || isset($data['end_date']) || isset($data['is_half_day'])) {
                $overlap = $this->checkOverlappingLeaves(
                    (int) $leave->employee_id,
                    $newStart,
                    $newEnd,
                    $leaveId
                );
                if (!$overlap['valid']) {
                    return responseJson(
                        success: false,
                        data: $overlap['conflict'] ?? null,
                        message: $overlap['message'],
                        code: 409
                    );
                }

                $orgCfg   = $this->getLeaveOrgConfig($orgId);
                $newDays  = $this->calculateDuration($newStart, $newEnd, $orgCfg['exclude_weekends'], $isHalfDay);
                $oldDays  = (float) ($leave->duration_days ?? 0);
                $diff     = $newDays - $oldDays;

                $updateData['duration_days'] = $newDays;

                // Adjust pending balance for the difference
                if ($diff > 0) {
                    $this->debitPendingBalance(
                        (int) $leave->employee_id,
                        (int) ($updateData['leave_type_id'] ?? $leave->leave_type_id),
                        $diff
                    );
                } elseif ($diff < 0) {
                    $this->releasePendingBalance(
                        (int) $leave->employee_id,
                        (int) ($updateData['leave_type_id'] ?? $leave->leave_type_id),
                        abs($diff)
                    );
                }
            }

            if (empty($updateData)) {
                return responseJson(success: false, data: null, message: "No fields to update", code: 400);
            }

            DB::table('leaves')->update($updateData, 'id', $leaveId);

            return responseJson(success: true, data: null, message: "Leave updated successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * DELETE /organizations/{org_id}/leaves/{leave_id}
     * Only pending leaves can be deleted
     */
    public function destroy(int $orgId, int $leaveId): mixed
    {
        try {
            $existing = DB::table('leaves')->where(['id' => $leaveId, 'organization_id' => $orgId])->get();
            if (empty($existing)) {
                return responseJson(success: false, data: null, message: "Leave not found", code: 404);
            }

            $leave = $existing[0];

            if ($leave->status !== 'pending') {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only pending leaves can be deleted",
                    code: 400
                );
            }

            $this->releasePendingBalance(
                (int) $leave->employee_id,
                (int) $leave->leave_type_id,
                (float) ($leave->duration_days ?? 0)
            );

            DB::table('leaves')->delete('id', $leaveId);

            return responseJson(success: true, data: null, message: "Leave deleted successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/leaves/{leave_id}/approve
     */
    public function approve(int $orgId, int $leaveId): mixed
    {
        try {
            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
            }

            $leave = $this->getLeaveWithValidation($leaveId, $orgId);
            if (!$leave['success']) return $leave['data'];

            $leaveData = $leave['data'];

            if (in_array($leaveData->status, ['approved', 'rejected', 'expired', 'cancelled'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave has already been {$leaveData->status}",
                    code: 400
                );
            }

            $canApprove = $this->canUserApproveLeave(
                (int) $currentEmployee['id'],
                $leaveData,
                $currentUser['user_type']
            );
            if (!$canApprove['allowed']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: $canApprove['reason'],
                    code: 403
                );
            }

            DB::table('leaves')->update([
                'status'      => 'approved',
                'approver_id' => $currentEmployee['id'],
                'approved_at' => date('Y-m-d H:i:s'),
                'updated_at'  => date('Y-m-d H:i:s'),
            ], 'id', $leaveId);

            // Confirm balance: pending → used
            $this->confirmUsedBalance(
                (int) $leaveData->employee_id,
                (int) $leaveData->leave_type_id,
                (float) ($leaveData->duration_days ?? 0)
            );

            $orgCfg = $this->getLeaveOrgConfig($orgId);
            if ($orgCfg['notify_employee']) {
                $this->createLeaveNotification(
                    (int) $leaveData->employee_id,
                    $orgId,
                    $leaveId,
                    'approved',
                    $currentUser['first_name'] . ' ' . $currentUser['surname']
                );
            }

            return responseJson(
                success: true,
                data: [
                    'leave_id'      => $leaveId,
                    'status'        => 'approved',
                    'approver_id'   => $currentEmployee['id'],
                    'approver_name' => $currentUser['first_name'] . ' ' . $currentUser['surname'],
                    'approved_at'   => date('Y-m-d H:i:s'),
                ],
                message: "Leave approved successfully"
            );
        } catch (\Exception $e) {
            error_log("Leave approval error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to approve leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/leaves/{leave_id}/reject
     */
    public function reject(int $orgId, int $leaveId): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = $data['rejection_reason'] ?? null;

            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
            }

            $leave = $this->getLeaveWithValidation($leaveId, $orgId);
            if (!$leave['success']) return $leave['data'];

            $leaveData = $leave['data'];

            if (in_array($leaveData->status, ['approved', 'rejected', 'expired', 'cancelled'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave has already been {$leaveData->status}",
                    code: 400
                );
            }

            $canApprove = $this->canUserApproveLeave(
                (int) $currentEmployee['id'],
                $leaveData,
                $currentUser['user_type']
            );
            if (!$canApprove['allowed']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: $canApprove['reason'],
                    code: 403
                );
            }

            DB::table('leaves')->update([
                'status'           => 'rejected',
                'approver_id'      => $currentEmployee['id'],
                'rejection_reason' => $rejectionReason,
                'rejected_at'      => date('Y-m-d H:i:s'),
                'updated_at'       => date('Y-m-d H:i:s'),
            ], 'id', $leaveId);

            // Release balance: pending → freed
            $this->releasePendingBalance(
                (int) $leaveData->employee_id,
                (int) $leaveData->leave_type_id,
                (float) ($leaveData->duration_days ?? 0)
            );

            $orgCfg = $this->getLeaveOrgConfig($orgId);
            if ($orgCfg['notify_employee']) {
                $this->createLeaveNotification(
                    (int) $leaveData->employee_id,
                    $orgId,
                    $leaveId,
                    'rejected',
                    $currentUser['first_name'] . ' ' . $currentUser['surname'],
                    $rejectionReason
                );
            }

            return responseJson(
                success: true,
                data: [
                    'leave_id'         => $leaveId,
                    'status'           => 'rejected',
                    'approver_id'      => $currentEmployee['id'],
                    'rejection_reason' => $rejectionReason,
                    'rejected_at'      => date('Y-m-d H:i:s'),
                ],
                message: "Leave rejected successfully"
            );
        } catch (\Exception $e) {
            error_log("Leave rejection error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to reject leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/leaves/{leave_id}/cancel
     * Employee cancels their own pending leave
     */
    public function cancel(int $orgId, int $leaveId): mixed
    {
        try {
            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
            }

            $leave = $this->getLeaveWithValidation($leaveId, $orgId);
            if (!$leave['success']) return $leave['data'];

            $leaveData = $leave['data'];

            // Employees can only cancel their own leaves
            $isAdmin = in_array($currentUser['user_type'], ['admin', 'hr_manager', 'hr_officer']);
            if (!$isAdmin && $leaveData->employee_id != $currentEmployee['id']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "You can only cancel your own leave",
                    code: 403
                );
            }

            if (!in_array($leaveData->status, ['pending'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Only pending leaves can be cancelled",
                    code: 400
                );
            }

            DB::table('leaves')->update([
                'status'     => 'cancelled',
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id', $leaveId);

            $this->releasePendingBalance(
                (int) $leaveData->employee_id,
                (int) $leaveData->leave_type_id,
                (float) ($leaveData->duration_days ?? 0)
            );

            return responseJson(success: true, data: null, message: "Leave cancelled successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to cancel leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/employees/{emp_id}/leaves/apply
     * Employee self-service leave application
     */
    public function applyLeave(int $orgId, int $empId): mixed
    {
        try {
            $employee = DB::table('employees')->where(['id' => $empId, 'organization_id' => $orgId])->get();
            if (empty($employee)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Employee not found in this organization',
                    code: 404
                );
            }
            $employee = $employee[0];

            $user = DB::table('users')->where(['id' => $employee->user_id])->get();
            $user = $user[0] ?? null;

            $data = json_decode(file_get_contents('php://input'), true);

            // Prevent applying for someone else
            if (isset($data['employee_id']) && $data['employee_id'] != $empId) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'You can only apply for leave for yourself',
                    code: 403
                );
            }

            // Required fields — accept leave_type_id OR leave_type_code
            foreach (['start_date', 'end_date'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Field '$f' is required",
                        code: 400
                    );
                }
            }

            if (empty($data['leave_type_id']) && empty($data['leave_type_code'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Either leave_type_id or leave_type_code is required",
                    code: 400
                );
            }

            // Resolve leave type
            $leaveTypeId = null;
            if (!empty($data['leave_type_id'])) {
                $leaveTypeId = (int) $data['leave_type_id'];
            } else {
                $leaveTypeId = $this->resolveLeaveTypeId($orgId, $data['leave_type_code']);
                if (!$leaveTypeId) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Leave type code '{$data['leave_type_code']}' not found",
                        code: 404
                    );
                }
            }

            // Load leave type
            $leaveType = DB::table('leave_types')
                ->where(['id' => $leaveTypeId, 'organization_id' => $orgId, 'is_active' => 1])
                ->get();

            if (empty($leaveType)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave type not found or inactive",
                    code: 404
                );
            }
            $leaveType = $leaveType[0];

            // Gender eligibility
            if ($leaveType->applicable_gender !== 'all') {
                // Requires gender on employee/user record — skip if not stored
            }

            // Load org config
            $orgCfg    = $this->getLeaveOrgConfig($orgId);
            $isHalfDay = !empty($data['is_half_day']);

            if ($isHalfDay && !$orgCfg['allow_half_day']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Half-day leave is not enabled for this organization",
                    code: 400
                );
            }

            // Validate dates
            $startTs = strtotime($data['start_date']);
            $endTs   = strtotime($data['end_date']);
            $todayTs = strtotime(date('Y-m-d'));

            if (!$startTs || !$endTs) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Invalid date format. Use YYYY-MM-DD",
                    code: 400
                );
            }

            if ($startTs > $endTs) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Start date must be before or equal to end date",
                    code: 400
                );
            }

            // Past application limit
            $pastLimit = $orgCfg['past_limit_days'];
            if ($startTs < $todayTs - ($pastLimit * 86400)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot apply for leave more than {$pastLimit} days in the past",
                    code: 400
                );
            }

            // Future application limit
            $futureLimit = $orgCfg['future_limit_days'];
            if ($startTs > $todayTs + ($futureLimit * 86400)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot apply for leave more than {$futureLimit} days in advance",
                    code: 400
                );
            }

            // Min notice days
            if ((int) $leaveType->min_notice_days > 0) {
                $minNoticeTs = $todayTs + ((int) $leaveType->min_notice_days * 86400);
                if ($startTs < $minNoticeTs) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "This leave type requires at least {$leaveType->min_notice_days} days notice",
                        code: 400
                    );
                }
            }

            // Duration
            $duration = $this->calculateDuration(
                $data['start_date'],
                $data['end_date'],
                $orgCfg['exclude_weekends'],
                $isHalfDay
            );

            // Max consecutive days
            if ($leaveType->max_consecutive_days && $duration > $leaveType->max_consecutive_days) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Maximum consecutive days for this leave type is {$leaveType->max_consecutive_days}",
                    code: 400
                );
            }

            // Balance check
            $balanceCheck = $this->checkLeaveBalance(
                $empId,
                $leaveTypeId,
                $duration,
                $orgCfg['allow_negative']
            );
            if (!$balanceCheck['valid']) {
                return responseJson(
                    success: false,
                    data: null,
                    message: $balanceCheck['message'],
                    code: 400,
                    errors: ['available_days' => $balanceCheck['available'] ?? 0]
                );
            }

            // Overlap check
            $overlap = $this->checkOverlappingLeaves($empId, $data['start_date'], $data['end_date']);
            if (!$overlap['valid']) {
                return responseJson(
                    success: false,
                    data: $overlap['conflict'] ?? null,
                    message: $overlap['message'],
                    code: 409
                );
            }

            // Reliever validation
            if (!empty($data['reliever_id'])) {
                if ($data['reliever_id'] == $empId) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "You cannot assign yourself as your own reliever",
                        code: 400
                    );
                }
                $reliever = DB::table('employees')
                    ->where(['id' => $data['reliever_id'], 'organization_id' => $orgId])
                    ->get();
                if (empty($reliever)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Reliever not found in this organization",
                        code: 404
                    );
                }
            }

            // Determine approver from reports_to
            $approverId = $employee->reports_to ?? null;

            // Auto-approve if leave type does not require approval
            $status = ((int) $leaveType->requires_approval === 0) ? 'approved' : 'pending';

            $insertData = [
                'organization_id' => $orgId,
                'employee_id'     => $empId,
                'leave_type_id'   => $leaveTypeId,
                'start_date'      => $data['start_date'],
                'end_date'        => $data['end_date'],
                'duration_days'   => $duration,
                'is_half_day'     => $isHalfDay ? 1 : 0,
                'half_day_period' => $isHalfDay ? ($data['half_day_period'] ?? null) : null,
                'status'          => $status,
                'reason'          => $data['reason']       ?? null,
                'document_path'   => $data['document_path'] ?? null,
                'approver_id'     => $approverId,
                'reliever_id'     => $data['reliever_id'] ?? null,
            ];

            if ($status === 'approved') {
                $insertData['approved_at'] = date('Y-m-d H:i:s');
            }

            DB::table('leaves')->insert($insertData);
            $leaveId = DB::lastInsertId();

            // Balance debit
            if ($status === 'approved') {
                $this->confirmUsedBalance($empId, $leaveTypeId, $duration);
            } else {
                $this->debitPendingBalance($empId, $leaveTypeId, $duration);
            }

            // Notify manager
            if ($status === 'pending' && $approverId && $orgCfg['notify_manager'] && $user) {
                $this->createLeaveNotification(
                    $approverId,
                    $orgId,
                    $leaveId,
                    'pending',
                    $user->first_name . ' ' . $user->surname
                );
            }

            return responseJson(
                success: true,
                data: [
                    'leave_id'         => $leaveId,
                    'employee_id'      => $empId,
                    'leave_type_id'    => $leaveTypeId,
                    'leave_type_name'  => $leaveType->name,
                    'leave_type_code'  => $leaveType->code,
                    'start_date'       => $data['start_date'],
                    'end_date'         => $data['end_date'],
                    'duration_days'    => $duration,
                    'is_half_day'      => $isHalfDay,
                    'half_day_period'  => $isHalfDay ? ($data['half_day_period'] ?? null) : null,
                    'status'           => $status,
                    'approver_id'      => $approverId,
                    'reliever_id'      => $data['reliever_id'] ?? null,
                    'balance_remaining' => round(($balanceCheck['available'] ?? 0) - $duration, 1),
                ],
                message: $status === 'approved'
                    ? "Leave application submitted and auto-approved"
                    : "Leave application submitted successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Apply leave error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to apply for leave: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/employees/{emp_id}/leaves
     * Employee's own leave history with stats
     */
    public function myLeaves(int $orgId, int $empId): mixed
    {
        try {
            if (!$orgId || !is_numeric($orgId)) {
                return responseJson(success: false, message: "Invalid organization ID", code: 400);
            }

            $orgCheck = DB::table('organizations')->where(['id' => $orgId])->get();
            if (empty($orgCheck)) {
                return responseJson(success: false, data: null, message: "Organization not found", code: 404);
            }

            $employeeCheck = DB::raw(
                "SELECT e.*, u.organization_id, u.first_name, u.middle_name, u.surname, u.email
                 FROM employees e
                 INNER JOIN users u ON e.user_id = u.id
                 WHERE e.id = :emp_id AND u.organization_id = :org_id",
                [':emp_id' => $empId, ':org_id' => $orgId]
            );

            if (empty($employeeCheck)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee not found in this organization",
                    code: 404
                );
            }

            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            $canAccessAll = in_array(
                $currentUser['user_type'],
                ['admin', 'hr_manager', 'hr_officer', 'department_manager', 'manager']
            );

            if (!$canAccessAll && $currentEmployee['id'] != $empId) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "You can only view your own leaves",
                    code: 403
                );
            }

            $this->autoExpireLeaves();

            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
            $offset  = ($page - 1) * $perPage;

            $status      = $_GET['status']        ?? null;
            $leaveTypeId = $_GET['leave_type_id'] ?? null;
            $month       = $_GET['month']         ?? null;
            $year        = $_GET['year']          ?? null;
            $dateFrom    = $_GET['date_from']     ?? null;
            $dateTo      = $_GET['date_to']       ?? null;

            // Validate
            $errors = [];
            if ($status && !in_array($status, ['pending', 'approved', 'rejected', 'cancelled', 'expired'])) {
                $errors['status'] = "Must be one of: pending, approved, rejected, cancelled, expired";
            }
            if ($month && ((int) $month < 1 || (int) $month > 12)) {
                $errors['month'] = "Must be between 1 and 12";
            }
            if ($year && ((int) $year < 1900 || (int) $year > 2100)) {
                $errors['year'] = "Must be between 1900 and 2100";
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

            $where  = ["leaves.employee_id = :emp_id", "leaves.organization_id = :org_id"];
            $params = [':emp_id' => $empId, ':org_id' => $orgId];

            if ($status) {
                $where[] = "leaves.status = :f_status";
                $params[':f_status']   = $status;
            }
            if ($leaveTypeId) {
                $where[] = "leaves.leave_type_id = :f_lt_id";
                $params[':f_lt_id']    = (int) $leaveTypeId;
            }
            if ($month) {
                $where[] = "MONTH(leaves.start_date) = :f_month";
                $params[':f_month'] = (int) $month;
            }
            if ($year) {
                $where[] = "YEAR(leaves.start_date) = :f_year";
                $params[':f_year']  = (int) $year;
            }
            if ($dateFrom) {
                $where[] = "leaves.start_date >= :date_from";
                $params[':date_from']  = $dateFrom;
            }
            if ($dateTo) {
                $where[] = "leaves.end_date <= :date_to";
                $params[':date_to']    = $dateTo;
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM leaves
                 {$this->leaveJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: true,
                    data: [],
                    message: "No leaves found",
                    code: 200,
                    metadata: [
                        'pagination'   => [
                            'current_page' => $page,
                            'per_page' => $perPage,
                            'total' => 0,
                            'total_pages' => 0,
                            'has_next' => false,
                            'has_prev' => false
                        ],
                        'statistics'   => ['total_leaves' => 0, 'by_status' => [], 'by_type' => []],
                        'employee_info' => [
                            'employee_id'   => $empId,
                            'employee_name' => ($employeeCheck[0]->first_name ?? '') . ' ' . ($employeeCheck[0]->surname ?? ''),
                        ],
                    ]
                );
            }

            // Stats
            $stats = DB::raw(
                "SELECT
                    COUNT(*) as total_leaves,
                    SUM(CASE WHEN leaves.status = 'pending'   THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN leaves.status = 'approved'  THEN 1 ELSE 0 END) as approved_count,
                    SUM(CASE WHEN leaves.status = 'rejected'  THEN 1 ELSE 0 END) as rejected_count,
                    SUM(CASE WHEN leaves.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                    SUM(CASE WHEN leaves.status = 'expired'   THEN 1 ELSE 0 END) as expired_count,
                    SUM(CASE WHEN YEAR(leaves.start_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as current_year_count,
                    AVG(COALESCE(leaves.duration_days, 0)) as avg_duration_days,
                    SUM(COALESCE(leaves.duration_days, 0)) as total_days_taken
                 FROM leaves
                 {$this->leaveJoins()} $whereClause",
                $params
            )[0] ?? null;

            // Per-type breakdown (dynamic)
            $typeBreakdown = DB::raw(
                "SELECT lt.name AS leave_type_name, lt.code, COUNT(*) as count,
            SUM(COALESCE(leaves.duration_days, 0)) as total_days
     FROM leaves
     {$this->leaveJoins()}
     $whereClause
     GROUP BY lt.id, lt.name, lt.code
     ORDER BY count DESC",
                $params
            );

            $mostCommonType = $typeBreakdown[0]->leave_type_name ?? null;

            // Leave balances for this employee
            $currentYear = (int) date('Y');
            $balances = DB::raw(
                "SELECT
                    lt.name AS leave_type_name,
                    lt.code,
                    lb.entitled_days,
                    lb.accrued_days,
                    lb.used_days,
                    lb.pending_days,
                    lb.carried_over,
                    (lb.entitled_days + lb.accrued_days + lb.carried_over - lb.used_days - lb.pending_days) AS available_days
                 FROM leave_balances lb
                 INNER JOIN leave_types lt ON lb.leave_type_id = lt.id
                 WHERE lb.employee_id = :emp_id
                   AND lb.leave_year  = :year
                 ORDER BY lt.name",
                [':emp_id' => $empId, ':year' => $currentYear]
            );

            // Paginated data
            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $leaves = DB::raw(
                "SELECT {$this->leaveSelectColumns()}
                 FROM leaves
                 {$this->leaveJoins()}
                 $whereClause
                 ORDER BY leaves.created_at DESC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            return responseJson(
                success: true,
                data: $leaves,
                message: "Employee leaves fetched successfully",
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
                        'total_leaves'      => (int) ($stats->total_leaves      ?? 0),
                        'total_days_taken'  => (float) ($stats->total_days_taken ?? 0),
                        'current_year_count' => (int) ($stats->current_year_count ?? 0),
                        'avg_duration_days' => round((float) ($stats->avg_duration_days ?? 0), 1),
                        'most_common_type'  => $mostCommonType,
                        'by_status' => [
                            'pending'   => (int) ($stats->pending_count   ?? 0),
                            'approved'  => (int) ($stats->approved_count  ?? 0),
                            'rejected'  => (int) ($stats->rejected_count  ?? 0),
                            'cancelled' => (int) ($stats->cancelled_count ?? 0),
                            'expired'   => (int) ($stats->expired_count   ?? 0),
                        ],
                        'by_type'  => $typeBreakdown,
                        'balances' => $balances,
                    ],
                    'employee_info' => [
                        'employee_id'     => (int) $empId,
                        'employee_name'   => ($employeeCheck[0]->first_name ?? '') . ' ' . ($employeeCheck[0]->surname ?? ''),
                        'employee_email'  => $employeeCheck[0]->email        ?? 'Not specified',
                        'job_title'       => $employeeCheck[0]->job_title    ?? 'Not specified',
                        'employment_type' => $employeeCheck[0]->employment_type ?? 'Not specified',
                        'status'          => $employeeCheck[0]->status       ?? 'Not specified',
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("My leaves error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch employee leaves",
                code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    /**
     * PUT /organizations/{org_id}/leaves/{leave_id}/assign-reliever
     */
    public function assignReliever(int $orgId, int $leaveId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['reliever_id'])) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "reliever_id is required",
                    code: 400
                );
            }

            $leave = $this->getLeaveWithValidation($leaveId, $orgId);
            if (!$leave['success']) return $leave['data'];

            $leaveData = $leave['data'];

            if ($data['reliever_id'] == $leaveData->employee_id) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Employee cannot be their own reliever",
                    code: 400
                );
            }

            $reliever = DB::table('employees')
                ->where(['id' => $data['reliever_id'], 'organization_id' => $orgId])
                ->get();

            if (empty($reliever)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Reliever not found in this organization",
                    code: 404
                );
            }

            DB::table('leaves')->update(['reliever_id' => $data['reliever_id']], 'id', $leaveId);

            return responseJson(success: true, data: null, message: "Reliever assigned successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to assign reliever: " . $e->getMessage(),
                code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/leave-types
     * List all active leave types for an org
     */
    public function getLeaveTypes(int $orgId): mixed
    {
        try {
            $leaveTypes = DB::raw(
                "SELECT
                    id, name, code, description,
                    days_per_year, is_paid, is_accrued,
                    accrual_rate, accrual_frequency,
                    allow_carry_over, max_carry_over_days,
                    allow_half_day, allow_negative_balance,
                    min_notice_days, max_consecutive_days,
                    requires_document, document_threshold_days,
                    requires_approval, approval_workflow,
                    applicable_gender, probation_eligible,
                    is_system_default, is_active,
                    created_at, updated_at
                 FROM leave_types
                 WHERE organization_id = :org_id
                 ORDER BY is_system_default DESC, name ASC",
                [':org_id' => $orgId]
            );

            return responseJson(
                success: true,
                data: $leaveTypes,
                message: "Leave types fetched successfully",
                metadata: ['count' => count($leaveTypes)]
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: "Failed to fetch leave types: " . $e->getMessage(),
                code: 500
            );
        }
    }
    /**
     * POST /organizations/{org_id}/leave-types
     * Create a new leave type for the org
     */
    public function storeLeaveType(int $orgId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Required fields
            foreach (['name', 'code'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "Field '$f' is required",
                        code: 400
                    );
                }
            }

            // Normalize code to uppercase
            $code = strtoupper(trim($data['code']));

            // Check uniqueness of code within this org
            $existing = DB::raw(
                "SELECT id FROM leave_types
             WHERE organization_id = :org_id AND code = :code
             LIMIT 1",
                [':org_id' => $orgId, ':code' => $code]
            );

            if (!empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "A leave type with code '$code' already exists in this organization",
                    code: 409
                );
            }

            // Validate enums
            $validFrequencies = ['daily', 'weekly', 'monthly'];
            $accrualFrequency = $data['accrual_frequency'] ?? 'monthly';
            if (!in_array($accrualFrequency, $validFrequencies)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "accrual_frequency must be one of: daily, weekly, monthly",
                    code: 400
                );
            }

            $validGenders = ['all', 'male', 'female'];
            $applicableGender = $data['applicable_gender'] ?? 'all';
            if (!in_array($applicableGender, $validGenders)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "applicable_gender must be one of: all, male, female",
                    code: 400
                );
            }

            DB::table('leave_types')->insert([
                'organization_id'        => $orgId,
                'name'                   => trim($data['name']),
                'code'                   => $code,
                'description'            => $data['description']              ?? null,
                'days_per_year'          => isset($data['days_per_year'])      ? (float) $data['days_per_year']      : null,
                'is_paid'                => isset($data['is_paid'])            ? (int) (bool) $data['is_paid']       : 1,
                'is_accrued'             => isset($data['is_accrued'])         ? (int) (bool) $data['is_accrued']    : 0,
                'accrual_rate'           => isset($data['accrual_rate'])       ? (float) $data['accrual_rate']       : null,
                'accrual_frequency'      => $accrualFrequency,
                'allow_carry_over'       => isset($data['allow_carry_over'])   ? (int) (bool) $data['allow_carry_over'] : 0,
                'max_carry_over_days'    => isset($data['max_carry_over_days']) ? (float) $data['max_carry_over_days'] : 0,
                'allow_half_day'         => isset($data['allow_half_day'])     ? (int) (bool) $data['allow_half_day']  : 1,
                'allow_negative_balance' => isset($data['allow_negative_balance']) ? (int) (bool) $data['allow_negative_balance'] : 0,
                'min_notice_days'        => isset($data['min_notice_days'])    ? (int) $data['min_notice_days']      : 0,
                'max_consecutive_days'   => isset($data['max_consecutive_days']) ? (int) $data['max_consecutive_days'] : null,
                'requires_document'      => isset($data['requires_document'])  ? (int) (bool) $data['requires_document'] : 0,
                'document_threshold_days' => isset($data['document_threshold_days']) ? (int) $data['document_threshold_days'] : null,
                'requires_approval'      => isset($data['requires_approval'])  ? (int) (bool) $data['requires_approval']  : 1,
                'approval_workflow'      => isset($data['approval_workflow'])  ? json_encode($data['approval_workflow'])   : null,
                'applicable_gender'      => $applicableGender,
                'probation_eligible'     => isset($data['probation_eligible']) ? (int) (bool) $data['probation_eligible']  : 0,
                'is_system_default'      => 0, // user-created types are never system defaults
                'is_active'              => 1,
            ]);

            $newId = DB::lastInsertId();

            return responseJson(
                success: true,
                data: ['id' => $newId],
                message: "Leave type created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Store leave type error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to create leave type: " . $e->getMessage(),
                code: 500
            );
        }
    }

// -------------------------------------------------------------------------

    /**
     * PUT/PATCH /organizations/{org_id}/leave-types/{type_id}
     * Update an existing leave type
     */
    public function updateLeaveType(int $orgId, int $typeId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            // Verify it exists and belongs to this org
            $existing = DB::table('leave_types')
                ->where(['id' => $typeId, 'organization_id' => $orgId])
                ->get();

            if (empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave type not found",
                    code: 404
                );
            }

            $leaveType = $existing[0];

            // Prevent editing system defaults (optional guard)
            if ($leaveType->is_system_default) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "System default leave types cannot be modified",
                    code: 403
                );
            }

            $updateData = [];

            // Code — if changing, re-check uniqueness
            if (isset($data['code'])) {
                $newCode = strtoupper(trim($data['code']));
                if ($newCode !== $leaveType->code) {
                    $conflict = DB::raw(
                        "SELECT id FROM leave_types
                     WHERE organization_id = :org_id AND code = :code AND id != :id
                     LIMIT 1",
                        [':org_id' => $orgId, ':code' => $newCode, ':id' => $typeId]
                    );
                    if (!empty($conflict)) {
                        return responseJson(
                            success: false,
                            data: null,
                            message: "A leave type with code '$newCode' already exists in this organization",
                            code: 409
                        );
                    }
                }
                $updateData['code'] = $newCode;
            }

            // Validate enums if provided
            if (isset($data['accrual_frequency'])) {
                if (!in_array($data['accrual_frequency'], ['daily', 'weekly', 'monthly'])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "accrual_frequency must be one of: daily, weekly, monthly",
                        code: 400
                    );
                }
                $updateData['accrual_frequency'] = $data['accrual_frequency'];
            }

            if (isset($data['applicable_gender'])) {
                if (!in_array($data['applicable_gender'], ['all', 'male', 'female'])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: "applicable_gender must be one of: all, male, female",
                        code: 400
                    );
                }
                $updateData['applicable_gender'] = $data['applicable_gender'];
            }

            // Scalar fields — only update what was sent
            $stringFields = ['name', 'description'];
            foreach ($stringFields as $f) {
                if (isset($data[$f])) $updateData[$f] = $data[$f] ?: null;
            }

            $floatFields = ['days_per_year', 'accrual_rate', 'max_carry_over_days'];
            foreach ($floatFields as $f) {
                if (isset($data[$f])) $updateData[$f] = $data[$f] !== '' ? (float) $data[$f] : null;
            }

            $intFields = ['min_notice_days', 'max_consecutive_days', 'document_threshold_days'];
            foreach ($intFields as $f) {
                if (isset($data[$f])) $updateData[$f] = $data[$f] !== '' ? (int) $data[$f] : null;
            }

            $boolFields = [
                'is_paid',
                'is_accrued',
                'allow_carry_over',
                'allow_half_day',
                'allow_negative_balance',
                'requires_document',
                'requires_approval',
                'probation_eligible',
                'is_active',
            ];
            foreach ($boolFields as $f) {
                if (isset($data[$f])) $updateData[$f] = (int) (bool) $data[$f];
            }

            if (isset($data['approval_workflow'])) {
                $updateData['approval_workflow'] = $data['approval_workflow']
                    ? json_encode($data['approval_workflow'])
                    : null;
            }

            if (empty($updateData)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "No fields to update",
                    code: 400
                );
            }

            DB::table('leave_types')->update($updateData, 'id', $typeId);

            return responseJson(
                success: true,
                data: null,
                message: "Leave type updated successfully"
            );
        } catch (\Exception $e) {
            error_log("Update leave type error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to update leave type: " . $e->getMessage(),
                code: 500
            );
        }
    }

// -------------------------------------------------------------------------

    /**
     * DELETE /organizations/{org_id}/leave-types/{type_id}
     * Soft-delete (deactivate) a leave type — hard delete is blocked by FK constraints
     */
    public function destroyLeaveType(int $orgId, int $typeId): mixed
    {
        try {
            $existing = DB::table('leave_types')
                ->where(['id' => $typeId, 'organization_id' => $orgId])
                ->get();

            if (empty($existing)) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Leave type not found",
                    code: 404
                );
            }

            $leaveType = $existing[0];

            if ($leaveType->is_system_default) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "System default leave types cannot be deleted",
                    code: 403
                );
            }

            // Block if there are pending or approved leaves using this type
            $activeLeaves = DB::raw(
                "SELECT COUNT(*) as count FROM leaves
             WHERE leave_type_id = :type_id
               AND status IN ('pending', 'approved')",
                [':type_id' => $typeId]
            );

            if (($activeLeaves[0]->count ?? 0) > 0) {
                return responseJson(
                    success: false,
                    data: null,
                    message: "Cannot delete a leave type that has active pending or approved leaves",
                    code: 409
                );
            }

            // Soft delete — set is_active = 0
            DB::table('leave_types')->update(['is_active' => 0], 'id', $typeId);

            return responseJson(
                success: true,
                data: null,
                message: "Leave type deactivated successfully"
            );
        } catch (\Exception $e) {
            error_log("Destroy leave type error: " . $e->getMessage());
            return responseJson(
                success: false,
                data: null,
                message: "Failed to delete leave type: " . $e->getMessage(),
                code: 500
            );
        }
    }
}
