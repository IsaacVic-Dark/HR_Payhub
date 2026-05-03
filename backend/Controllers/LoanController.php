<?php

namespace App\Controllers;

use App\Services\DB;

class LoanController
{
    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    // -------------------------------------------------------------------------
    // Reusable SELECT columns for all loan queries
    // Joins: employees, users, config, approver, rejecter
    // -------------------------------------------------------------------------
    private function loanSelectColumns(): string
    {
        return "
            l.id                        AS loan_id,
            l.organization_id,
            l.employee_id,
            l.config_id,
            l.amount,
            l.interest_rate,
            l.monthly_deduction,
            l.balance_remaining,
            l.total_repaid,
            l.start_date,
            l.end_date,
            l.purpose,
            l.status,
            l.rejection_reason,
            l.approved_by,
            l.rejected_by,
            l.approved_at,
            l.rejected_at,
            l.created_at,
            l.updated_at,

            -- Employee info (raw — nested by formatLoan())
            emp.firstname               AS employee_firstname,
            emp.middlename              AS employee_middlename,
            emp.surname                 AS employee_surname,
            emp.employee_number,
            emp_u.email                 AS employee_email,

            -- Loan config / type info
            cfg.name                    AS loan_type_name,
            cfg.percentage              AS loan_type_interest_rate,
            cfg.fixed_amount            AS loan_type_max_amount,
            cfg.settings                AS loan_type_settings,

            -- Approver info (raw — nested by formatLoan())
            appr_u.username             AS approver_username,
            appr_e.firstname            AS approver_firstname,
            appr_e.surname              AS approver_surname,
            appr_u.email                AS approver_email,

            -- Rejecter info (raw — nested by formatLoan())
            rejr_u.username             AS rejecter_username,
            rejr_e.firstname            AS rejecter_firstname,
            rejr_e.surname              AS rejecter_surname,
            rejr_u.email                AS rejecter_email
        ";
    }

    // -------------------------------------------------------------------------
    // Reusable JOINs for all loan queries
    // -------------------------------------------------------------------------
    private function loanJoins(): string
    {
        return "
            INNER JOIN employees emp
                ON l.employee_id = emp.id
            LEFT JOIN users emp_u
                ON emp.user_id = emp_u.id
            INNER JOIN organization_configs cfg
                ON l.config_id = cfg.id
            LEFT JOIN users appr_u
                ON l.approved_by = appr_u.id
            LEFT JOIN employees appr_e
                ON appr_e.user_id = appr_u.id
            LEFT JOIN users rejr_u
                ON l.rejected_by = rejr_u.id
            LEFT JOIN employees rejr_e
                ON rejr_e.user_id = rejr_u.id
        ";
    }

    // -------------------------------------------------------------------------
    // Reshape flat row into nested loan object (mirrors formatLeave)
    // -------------------------------------------------------------------------
    private function formatLoan(object $loan): object
    {
        $loan->employee = [
            'id'              => $loan->employee_id,
            'full_name'       => trim(
                ($loan->employee_firstname ?? '') . ' ' .
                ($loan->employee_middlename ? $loan->employee_middlename . ' ' : '') .
                ($loan->employee_surname ?? '')
            ),
            'employee_number' => $loan->employee_number,
            'email'           => $loan->employee_email,
        ];

        $loan->loan_type = [
            'id'            => $loan->config_id,
            'name'          => $loan->loan_type_name,
            'interest_rate' => $loan->loan_type_interest_rate !== null
                ? (float) $loan->loan_type_interest_rate
                : null,
            'max_amount'    => $loan->loan_type_max_amount !== null
                ? (float) $loan->loan_type_max_amount
                : null,
            'settings'      => $loan->loan_type_settings
                ? json_decode($loan->loan_type_settings, true)
                : null,
        ];

        $loan->approver = $loan->approved_by ? [
            'id'        => $loan->approved_by,
            'full_name' => trim(($loan->approver_firstname ?? '') . ' ' . ($loan->approver_surname ?? '')),
            'email'     => $loan->approver_email,
        ] : null;

        $loan->rejecter = $loan->rejected_by ? [
            'id'        => $loan->rejected_by,
            'full_name' => trim(($loan->rejecter_firstname ?? '') . ' ' . ($loan->rejecter_surname ?? '')),
            'email'     => $loan->rejecter_email,
        ] : null;

        // Cast numeric fields
        $loan->amount            = (float) $loan->amount;
        $loan->interest_rate     = $loan->interest_rate !== null ? (float) $loan->interest_rate : null;
        $loan->monthly_deduction = $loan->monthly_deduction !== null ? (float) $loan->monthly_deduction : null;
        $loan->balance_remaining = $loan->balance_remaining !== null ? (float) $loan->balance_remaining : null;
        $loan->total_repaid      = (float) $loan->total_repaid;

        // Remove flat fields
        unset(
            $loan->employee_firstname, $loan->employee_middlename, $loan->employee_surname,
            $loan->employee_number, $loan->employee_email,
            $loan->loan_type_name, $loan->loan_type_interest_rate,
            $loan->loan_type_max_amount, $loan->loan_type_settings,
            $loan->approver_username, $loan->approver_firstname,
            $loan->approver_surname, $loan->approver_email,
            $loan->rejecter_username, $loan->rejecter_firstname,
            $loan->rejecter_surname, $loan->rejecter_email
        );

        return $loan;
    }

    // -------------------------------------------------------------------------
    // Role-based filter helper (mirrors LeaveController::applyRoleBasedFilters)
    // -------------------------------------------------------------------------
    private function applyRoleBasedFilters(int $orgId): array
    {
        $user     = \App\Middleware\AuthMiddleware::getCurrentUser();
        $employee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

        if (!$user || !$employee) {
            throw new \Exception('User not authenticated');
        }

        $filters = ['organization_id' => $orgId];

        switch ($user['user_type']) {
            // Full org visibility
            case 'admin':
            case 'hr_manager':
            case 'finance_manager':
            case 'payroll_manager':
            case 'payroll_officer':
            case 'auditor':
                break;

            // Department/team visibility
            case 'hr_officer':
            case 'department_manager':
                $filters['team_employees'] = $this->getTeamEmployeeIds((int) $employee['id']);
                break;

            // Own loans only
            case 'employee':
                $filters['employee_id'] = (int) $employee['id'];
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

    // -------------------------------------------------------------------------
    // Validate loan exists and belongs to org
    // -------------------------------------------------------------------------
    private function getLoanWithValidation(int $loanId, int $orgId): array
    {
        $result = DB::raw(
            "SELECT * FROM loans WHERE id = :id AND organization_id = :org_id",
            [':id' => $loanId, ':org_id' => $orgId]
        );

        if (empty($result)) {
            return [
                'success' => false,
                'data'    => responseJson(
                    success: false,
                    data: null,
                    message: "Loan not found",
                    code: 404
                )
            ];
        }

        return ['success' => true, 'data' => $result[0]];
    }

    // -------------------------------------------------------------------------
    // Resolve loan config — must belong to org and be config_type = 'loan'
    // -------------------------------------------------------------------------
    private function getLoanConfig(int $configId, int $orgId): ?object
    {
        $result = DB::raw(
            "SELECT * FROM organization_configs
             WHERE id = :id
               AND organization_id = :org_id
               AND config_type = 'loan'
               AND is_active = 1
               AND status = 'approved'
             LIMIT 1",
            [':id' => $configId, ':org_id' => $orgId]
        );

        return $result[0] ?? null;
    }

    // -------------------------------------------------------------------------
    // Check if employee already has an active loan of the same type
    // -------------------------------------------------------------------------
    private function hasActiveLoan(int $employeeId, int $configId, ?int $excludeLoanId = null): bool
    {
        $sql    = "SELECT COUNT(*) as cnt FROM loans
                   WHERE employee_id = :emp_id
                     AND config_id   = :cfg_id
                     AND status IN ('pending', 'approved')";
        $params = [':emp_id' => $employeeId, ':cfg_id' => $configId];

        if ($excludeLoanId) {
            $sql              .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeLoanId;
        }

        $result = DB::raw($sql, $params);
        return (int) ($result[0]->cnt ?? 0) > 0;
    }

    // -------------------------------------------------------------------------
    // Notify employee about loan status changes
    // -------------------------------------------------------------------------
    private function createLoanNotification(
        int $employeeId,
        int $orgId,
        int $loanId,
        string $status,
        ?string $reason = null
    ): void {
        try {
            $messages = [
                'pending'  => "Your loan application has been submitted and is pending approval",
                'approved' => "Your loan application has been approved",
                'rejected' => "Your loan application was rejected" . ($reason ? ": {$reason}" : ""),
                'repaid'   => "Your loan has been fully repaid",
            ];

            DB::table('notifications')->insert([
                'employee_id'     => $employeeId,
                'organization_id' => $orgId,
                'title'           => 'Loan ' . ucfirst($status),
                'message'         => $messages[$status] ?? "Loan status updated to {$status}",
                'type'            => 'loan',
                'is_read'         => 0,
                'metadata'        => json_encode(['loan_id' => $loanId, 'status' => $status]),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Exception $e) {
            error_log("Loan notification error: " . $e->getMessage());
        }
    }

    // =========================================================================
    // PUBLIC METHODS
    // =========================================================================

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/loans
     * List all loans for an org with pagination, filters, and stats.
     * Visibility is scoped by role (mirrors LeaveController::index).
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
                    success: false, data: null,
                    message: "Authentication error", code: 401,
                    errors: ['authentication' => $e->getMessage()]
                );
            }

            // Pagination
            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
            $offset  = ($page - 1) * $perPage;

            // Optional query filters
            $status     = $_GET['status']      ?? null;
            $configId   = $_GET['config_id']   ?? null;
            $employeeId = $_GET['employee_id'] ?? null;
            $month      = $_GET['month']       ?? null;
            $year       = $_GET['year']        ?? null;

            // Validate
            $errors = [];
            if ($status && !in_array($status, ['pending', 'approved', 'rejected', 'repaid'])) {
                $errors['status'] = "Must be one of: pending, approved, rejected, repaid";
            }
            if ($configId && !is_numeric($configId)) {
                $errors['config_id'] = "Must be a valid number";
            }
            if ($employeeId && !is_numeric($employeeId)) {
                $errors['employee_id'] = "Must be a valid number";
            }
            if ($month && ((int) $month < 1 || (int) $month > 12)) {
                $errors['month'] = "Must be between 1 and 12";
            }
            if ($year && ((int) $year < 1900 || (int) $year > 2100)) {
                $errors['year'] = "Must be between 1900 and 2100";
            }
            if (!empty($errors)) {
                return responseJson(
                    success: false, data: null,
                    message: "Validation failed", code: 400, errors: $errors
                );
            }

            // Build WHERE
            $where  = ["l.organization_id = :org_id"];
            $params = [':org_id' => $orgId];

            // Role scope
            if (isset($filters['employee_id'])) {
                $where[]              = "l.employee_id = :role_emp_id";
                $params[':role_emp_id'] = $filters['employee_id'];
            }

            if (!empty($filters['team_employees'])) {
                $ids          = $filters['team_employees'];
                $placeholders = implode(',', array_map(fn($i) => ":team_$i", array_keys($ids)));
                $where[]      = "l.employee_id IN ($placeholders)";
                foreach ($ids as $i => $empId) {
                    $params[":team_$i"] = $empId;
                }
            }

            // Query filters
            if ($status) {
                $where[]           = "l.status = :f_status";
                $params[':f_status'] = $status;
            }
            if ($configId) {
                $where[]              = "l.config_id = :f_cfg";
                $params[':f_cfg']     = (int) $configId;
            }
            if ($employeeId && !isset($filters['employee_id'])) {
                // Only honour explicit employee filter if role can see others
                $where[]              = "l.employee_id = :f_emp";
                $params[':f_emp']     = (int) $employeeId;
            }
            if ($month) {
                $where[]              = "MONTH(l.start_date) = :f_month";
                $params[':f_month']   = (int) $month;
            }
            if ($year) {
                $where[]              = "YEAR(l.start_date) = :f_year";
                $params[':f_year']    = (int) $year;
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            // Count
            $total = DB::raw(
                "SELECT COUNT(*) as total FROM loans l
                 {$this->loanJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: false, data: null,
                    message: "No loans found matching the specified criteria",
                    code: 404
                );
            }

            // Stats
            $stats = DB::raw(
                "SELECT
                    COUNT(*)                                                        AS total_loans,
                    SUM(CASE WHEN l.status = 'pending'  THEN 1 ELSE 0 END)         AS pending_count,
                    SUM(CASE WHEN l.status = 'approved' THEN 1 ELSE 0 END)         AS approved_count,
                    SUM(CASE WHEN l.status = 'rejected' THEN 1 ELSE 0 END)         AS rejected_count,
                    SUM(CASE WHEN l.status = 'repaid'   THEN 1 ELSE 0 END)         AS repaid_count,
                    COALESCE(SUM(l.amount), 0)                                      AS total_loaned,
                    COALESCE(SUM(l.total_repaid), 0)                                AS total_repaid,
                    COALESCE(SUM(l.balance_remaining), 0)                           AS total_outstanding
                 FROM loans l
                 {$this->loanJoins()} $whereClause",
                $params
            )[0] ?? null;

            // Type breakdown (per loan config)
            $typeBreakdown = DB::raw(
                "SELECT cfg.name AS loan_type_name, COUNT(*) AS count,
                    COALESCE(SUM(l.amount), 0)            AS total_amount,
                    COALESCE(SUM(l.balance_remaining), 0) AS total_outstanding
                 FROM loans l
                 {$this->loanJoins()}
                 $whereClause
                 GROUP BY cfg.id, cfg.name
                 ORDER BY count DESC",
                $params
            );

            // Paginated data
            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $loans = DB::raw(
                "SELECT {$this->loanSelectColumns()}
                 FROM loans l
                 {$this->loanJoins()}
                 $whereClause
                 ORDER BY l.created_at DESC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            $loans = array_map(fn($loan) => $this->formatLoan($loan), $loans);

            return responseJson(
                success: true,
                data: array_values($loans),
                message: "Loans fetched successfully",
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
                        'total_loans'       => (int) ($stats->total_loans      ?? 0),
                        'total_loaned'      => (float) ($stats->total_loaned   ?? 0),
                        'total_repaid'      => (float) ($stats->total_repaid   ?? 0),
                        'total_outstanding' => (float) ($stats->total_outstanding ?? 0),
                        'by_status' => [
                            'pending'  => (int) ($stats->pending_count  ?? 0),
                            'approved' => (int) ($stats->approved_count ?? 0),
                            'rejected' => (int) ($stats->rejected_count ?? 0),
                            'repaid'   => (int) ($stats->repaid_count   ?? 0),
                        ],
                        'by_type' => $typeBreakdown,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Loan index error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch loans", code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/loans/{loan_id}
     * Single loan — role scope enforced by middleware.
     */
    public function show(int $orgId, int $loanId): mixed
    {
        try {
            $result = DB::raw(
                "SELECT {$this->loanSelectColumns()}
                 FROM loans l
                 {$this->loanJoins()}
                 WHERE l.id = :loan_id AND l.organization_id = :org_id",
                [':loan_id' => $loanId, ':org_id' => $orgId]
            );

            if (empty($result)) {
                return responseJson(success: false, data: null, message: "Loan not found", code: 404);
            }

            return responseJson(
                success: true,
                data: $this->formatLoan($result[0]),
                message: "Loan fetched successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch loan: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/loans
     * HR / Admin submits a loan application on behalf of an employee.
     * For employee self-service, use applyLoan().
     */
    public function store(int $orgId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            foreach (['employee_id', 'config_id', 'amount', 'start_date'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(
                        success: false, data: null,
                        message: "Field '$f' is required", code: 400
                    );
                }
            }

            // Verify employee belongs to org
            $employee = DB::table('employees')
                ->where(['id' => $data['employee_id'], 'organization_id' => $orgId])
                ->get();

            if (empty($employee)) {
                return responseJson(
                    success: false, data: null,
                    message: "Employee not found in this organization", code: 404
                );
            }

            // Validate loan config
            $config = $this->getLoanConfig((int) $data['config_id'], $orgId);
            if (!$config) {
                return responseJson(
                    success: false, data: null,
                    message: "Loan type not found, inactive, or not approved for this organization",
                    code: 404
                );
            }

            $amount = (float) $data['amount'];

            if ($amount <= 0) {
                return responseJson(
                    success: false, data: null,
                    message: "Loan amount must be greater than zero", code: 400
                );
            }

            // Max amount check
            if ($config->fixed_amount && $amount > (float) $config->fixed_amount) {
                return responseJson(
                    success: false, data: null,
                    message: "Amount exceeds the maximum allowed for this loan type: {$config->fixed_amount}",
                    code: 400
                );
            }

            // Block duplicate active loan of same type
            if ($this->hasActiveLoan((int) $data['employee_id'], (int) $data['config_id'])) {
                return responseJson(
                    success: false, data: null,
                    message: "This employee already has a pending or active loan of this type",
                    code: 409
                );
            }

            $interestRate      = $data['interest_rate']      ?? $config->percentage;
            $monthlyDeduction  = $data['monthly_deduction']  ?? null;

            $insertData = [
                'organization_id'  => $orgId,
                'employee_id'      => (int) $data['employee_id'],
                'config_id'        => (int) $data['config_id'],
                'amount'           => $amount,
                'interest_rate'    => $interestRate !== null ? (float) $interestRate : null,
                'monthly_deduction'=> $monthlyDeduction !== null ? (float) $monthlyDeduction : null,
                'balance_remaining'=> $amount,      // starts at full loan amount
                'total_repaid'     => 0.00,
                'start_date'       => $data['start_date'],
                'end_date'         => $data['end_date'] ?? null,
                'purpose'          => $data['purpose'] ?? null,
                'status'           => 'pending',
            ];

            DB::table('loans')->insert($insertData);
            $loanId = DB::lastInsertId();

            $this->createLoanNotification(
                (int) $data['employee_id'], $orgId, $loanId, 'pending'
            );

            $created = DB::raw(
                "SELECT {$this->loanSelectColumns()} FROM loans l
                 {$this->loanJoins()} WHERE l.id = :id",
                [':id' => $loanId]
            );

            return responseJson(
                success: true,
                data: $this->formatLoan($created[0]),
                message: "Loan application created successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Loan store error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to create loan: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/employees/{emp_id}/loans
     * Employee self-service loan application.
     */
    public function applyLoan(int $orgId, int $empId): mixed
    {
        try {
            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            // Employees can only apply for themselves; managers/admins can apply for their reports
            $isPrivileged = in_array($currentUser['user_type'], ['admin', 'hr_manager', 'hr_officer', 'payroll_manager']);
            if (!$isPrivileged && (int) $currentEmployee['id'] !== $empId) {
                return responseJson(
                    success: false, data: null,
                    message: "You can only apply for a loan for yourself", code: 403
                );
            }

            $employee = DB::table('employees')
                ->where(['id' => $empId, 'organization_id' => $orgId])
                ->get();

            if (empty($employee)) {
                return responseJson(
                    success: false, data: null,
                    message: "Employee not found in this organization", code: 404
                );
            }
            $employee = $employee[0];

            $data = json_decode(file_get_contents('php://input'), true);

            foreach (['config_id', 'amount', 'start_date'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(
                        success: false, data: null,
                        message: "Field '$f' is required", code: 400
                    );
                }
            }

            $config = $this->getLoanConfig((int) $data['config_id'], $orgId);
            if (!$config) {
                return responseJson(
                    success: false, data: null,
                    message: "Loan type not found, inactive, or not approved for this organization",
                    code: 404
                );
            }

            $amount = (float) $data['amount'];

            if ($amount <= 0) {
                return responseJson(
                    success: false, data: null,
                    message: "Loan amount must be greater than zero", code: 400
                );
            }

            if ($config->fixed_amount && $amount > (float) $config->fixed_amount) {
                return responseJson(
                    success: false, data: null,
                    message: "Amount exceeds the maximum allowed for this loan type: {$config->fixed_amount}",
                    code: 400
                );
            }

            if ($this->hasActiveLoan($empId, (int) $data['config_id'])) {
                return responseJson(
                    success: false, data: null,
                    message: "You already have a pending or active loan of this type",
                    code: 409
                );
            }

            $interestRate     = $data['interest_rate']     ?? $config->percentage;
            $monthlyDeduction = $data['monthly_deduction'] ?? null;

            DB::table('loans')->insert([
                'organization_id'  => $orgId,
                'employee_id'      => $empId,
                'config_id'        => (int) $data['config_id'],
                'amount'           => $amount,
                'interest_rate'    => $interestRate !== null ? (float) $interestRate : null,
                'monthly_deduction'=> $monthlyDeduction !== null ? (float) $monthlyDeduction : null,
                'balance_remaining'=> $amount,
                'total_repaid'     => 0.00,
                'start_date'       => $data['start_date'],
                'end_date'         => $data['end_date'] ?? null,
                'purpose'          => $data['purpose']  ?? null,
                'status'           => 'pending',
            ]);

            $loanId = DB::lastInsertId();

            $this->createLoanNotification($empId, $orgId, $loanId, 'pending');

            $employeeName = trim(
                ($employee->firstname ?? '') . ' ' .
                ($employee->middlename ? $employee->middlename . ' ' : '') .
                ($employee->surname ?? '')
            );

            return responseJson(
                success: true,
                data: [
                    'loan_id'          => $loanId,
                    'employee'         => ['id' => $empId, 'full_name' => $employeeName],
                    'loan_type'        => ['id' => $config->id, 'name' => $config->name],
                    'amount'           => $amount,
                    'interest_rate'    => $interestRate !== null ? (float) $interestRate : null,
                    'monthly_deduction'=> $monthlyDeduction !== null ? (float) $monthlyDeduction : null,
                    'balance_remaining'=> $amount,
                    'start_date'       => $data['start_date'],
                    'end_date'         => $data['end_date'] ?? null,
                    'purpose'          => $data['purpose']  ?? null,
                    'status'           => 'pending',
                ],
                message: "Loan application submitted successfully",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Apply loan error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to apply for loan: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * PUT/PATCH /organizations/{org_id}/loans/{loan_id}
     * Update a pending loan (amount, dates, purpose, monthly_deduction).
     * Only pending loans can be edited.
     */
    public function update(int $orgId, int $loanId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];

            $loan = $validation['data'];

            if ($loan->status !== 'pending') {
                return responseJson(
                    success: false, data: null,
                    message: "Only pending loans can be updated (current status: {$loan->status})",
                    code: 400
                );
            }

            $updateData = [];

            if (isset($data['amount'])) {
                $amount = (float) $data['amount'];
                if ($amount <= 0) {
                    return responseJson(
                        success: false, data: null,
                        message: "Amount must be greater than zero", code: 400
                    );
                }
                // Re-check max if config still has a cap
                $config = $this->getLoanConfig((int) $loan->config_id, $orgId);
                if ($config && $config->fixed_amount && $amount > (float) $config->fixed_amount) {
                    return responseJson(
                        success: false, data: null,
                        message: "Amount exceeds the maximum allowed for this loan type: {$config->fixed_amount}",
                        code: 400
                    );
                }
                $updateData['amount']            = $amount;
                $updateData['balance_remaining'] = $amount; // reset since not yet approved
            }

            foreach (['monthly_deduction', 'interest_rate'] as $f) {
                if (isset($data[$f])) {
                    $updateData[$f] = $data[$f] !== '' ? (float) $data[$f] : null;
                }
            }

            foreach (['start_date', 'end_date', 'purpose'] as $f) {
                if (isset($data[$f])) {
                    $updateData[$f] = $data[$f] ?: null;
                }
            }

            if (empty($updateData)) {
                return responseJson(success: false, data: null, message: "No fields to update", code: 400);
            }

            DB::table('loans')->update($updateData, 'id', $loanId);

            return responseJson(success: true, data: null, message: "Loan updated successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to update loan: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * DELETE /organizations/{org_id}/loans/{loan_id}
     * Hard-delete — only allowed on pending loans.
     */
    public function destroy(int $orgId, int $loanId): mixed
    {
        try {
            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];

            $loan = $validation['data'];

            if ($loan->status !== 'pending') {
                return responseJson(
                    success: false, data: null,
                    message: "Only pending loans can be deleted",
                    code: 400
                );
            }

            DB::table('loans')->delete('id', $loanId);

            return responseJson(success: true, data: null, message: "Loan application deleted successfully");
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to delete loan: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/approve
     * Roles: admin, hr_manager, finance_manager, payroll_manager
     */
    public function approve(int $orgId, int $loanId): mixed
    {
        try {
            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];

            $loan = $validation['data'];

            if ($loan->status !== 'pending') {
                return responseJson(
                    success: false, data: null,
                    message: "Only pending loans can be approved (current status: {$loan->status})",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'      => 'approved',
                'approved_by' => $currentUser['id'],
                'approved_at' => $now,
                'rejected_by' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ], 'id', $loanId);

            $this->createLoanNotification(
                (int) $loan->employee_id, $orgId, $loanId, 'approved'
            );

            return responseJson(
                success: true,
                data: [
                    'loan_id'     => $loanId,
                    'status'      => 'approved',
                    'approved_by' => $currentUser['id'],
                    'approved_at' => $now,
                ],
                message: "Loan approved successfully"
            );
        } catch (\Exception $e) {
            error_log("Loan approval error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to approve loan: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/reject
     * Roles: admin, hr_manager, finance_manager, payroll_manager
     */
    public function reject(int $orgId, int $loanId): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = $data['rejection_reason'] ?? null;

            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];

            $loan = $validation['data'];

            if ($loan->status !== 'pending') {
                return responseJson(
                    success: false, data: null,
                    message: "Only pending loans can be rejected (current status: {$loan->status})",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'           => 'rejected',
                'rejected_by'      => $currentUser['id'],
                'rejected_at'      => $now,
                'rejection_reason' => $rejectionReason,
            ], 'id', $loanId);

            $this->createLoanNotification(
                (int) $loan->employee_id, $orgId, $loanId, 'rejected', $rejectionReason
            );

            return responseJson(
                success: true,
                data: [
                    'loan_id'          => $loanId,
                    'status'           => 'rejected',
                    'rejected_by'      => $currentUser['id'],
                    'rejected_at'      => $now,
                    'rejection_reason' => $rejectionReason,
                ],
                message: "Loan rejected successfully"
            );
        } catch (\Exception $e) {
            error_log("Loan rejection error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to reject loan: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/repayments
     * Record a manual repayment or payroll deduction instalment.
     * Roles: admin, payroll_manager, payroll_officer, finance_manager
     *
     * Body: { "amount": 5000, "repayment_date": "2025-06-01",
     *         "method": "manual|payroll_deduction", "notes": "...",
     *         "payrun_id": 12 }
     */
    public function recordRepayment(int $orgId, int $loanId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['amount']) || empty($data['repayment_date'])) {
                return responseJson(
                    success: false, data: null,
                    message: "Fields 'amount' and 'repayment_date' are required", code: 400
                );
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];

            $loan = $validation['data'];

            if ($loan->status !== 'approved') {
                return responseJson(
                    success: false, data: null,
                    message: "Repayments can only be recorded against approved loans (current status: {$loan->status})",
                    code: 400
                );
            }

            $repaymentAmount = (float) $data['amount'];
            $currentBalance  = (float) $loan->balance_remaining;

            if ($repaymentAmount <= 0) {
                return responseJson(
                    success: false, data: null,
                    message: "Repayment amount must be greater than zero", code: 400
                );
            }

            if ($repaymentAmount > $currentBalance) {
                return responseJson(
                    success: false, data: null,
                    message: "Repayment amount ({$repaymentAmount}) exceeds the remaining balance ({$currentBalance})",
                    code: 400,
                    errors: ['balance_remaining' => $currentBalance]
                );
            }

            $method = $data['method'] ?? 'manual';
            if (!in_array($method, ['manual', 'payroll_deduction'])) {
                return responseJson(
                    success: false, data: null,
                    message: "method must be one of: manual, payroll_deduction", code: 400
                );
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            $newBalance  = round($currentBalance - $repaymentAmount, 2);
            $newRepaid   = round((float) $loan->total_repaid + $repaymentAmount, 2);
            $isFullyPaid = $newBalance <= 0.00;

            // Record the repayment
            DB::table('loan_repayments')->insert([
                'loan_id'         => $loanId,
                'organization_id' => $orgId,
                'employee_id'     => (int) $loan->employee_id,
                'payrun_id'       => $data['payrun_id'] ?? null,
                'amount'          => $repaymentAmount,
                'balance_after'   => $newBalance,
                'repayment_date'  => $data['repayment_date'],
                'method'          => $method,
                'notes'           => $data['notes'] ?? null,
                'recorded_by'     => $currentUser['id'] ?? null,
            ]);

            // Update loan balance and total_repaid; mark repaid if fully cleared
            $loanUpdate = [
                'balance_remaining' => $newBalance,
                'total_repaid'      => $newRepaid,
            ];

            if ($isFullyPaid) {
                $loanUpdate['status'] = 'repaid';
            }

            DB::table('loans')->update($loanUpdate, 'id', $loanId);

            if ($isFullyPaid) {
                $this->createLoanNotification(
                    (int) $loan->employee_id, $orgId, $loanId, 'repaid'
                );
            }

            return responseJson(
                success: true,
                data: [
                    'loan_id'          => $loanId,
                    'repayment_amount' => $repaymentAmount,
                    'balance_remaining'=> $newBalance,
                    'total_repaid'     => $newRepaid,
                    'loan_status'      => $isFullyPaid ? 'repaid' : 'approved',
                    'fully_repaid'     => $isFullyPaid,
                ],
                message: $isFullyPaid
                    ? "Repayment recorded. Loan fully repaid!"
                    : "Repayment of {$repaymentAmount} recorded. Remaining balance: {$newBalance}",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Loan repayment error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to record repayment: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/loans/{loan_id}/repayments
     * Repayment history for a single loan.
     * Roles: admin, hr_manager, finance_manager, payroll_manager, payroll_officer
     *        + the employee who owns the loan
     */
    public function repaymentHistory(int $orgId, int $loanId): mixed
    {
        try {
            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];

            $loan = $validation['data'];

            // Employees may only view their own loan repayments
            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            $isPrivileged = in_array($currentUser['user_type'], [
                'admin', 'hr_manager', 'finance_manager',
                'payroll_manager', 'payroll_officer', 'auditor',
            ]);

            if (!$isPrivileged && (int) $currentEmployee['id'] !== (int) $loan->employee_id) {
                return responseJson(
                    success: false, data: null,
                    message: "You can only view repayments for your own loans", code: 403
                );
            }

            $repayments = DB::raw(
                "SELECT
                    lr.id,
                    lr.loan_id,
                    lr.amount,
                    lr.balance_after,
                    lr.repayment_date,
                    lr.method,
                    lr.notes,
                    lr.payrun_id,
                    lr.created_at,
                    u.username  AS recorded_by_username,
                    COALESCE(CONCAT(rec_e.firstname, ' ', rec_e.surname), u.username) AS recorded_by_name
                 FROM loan_repayments lr
                 LEFT JOIN users u       ON lr.recorded_by = u.id
                 LEFT JOIN employees rec_e ON rec_e.user_id = u.id
                 WHERE lr.loan_id         = :loan_id
                   AND lr.organization_id = :org_id
                 ORDER BY lr.repayment_date ASC, lr.created_at ASC",
                [':loan_id' => $loanId, ':org_id' => $orgId]
            );

            return responseJson(
                success: true,
                data: $repayments,
                message: "Repayment history fetched successfully",
                metadata: [
                    'count'             => count($repayments),
                    'loan_amount'       => (float) $loan->amount,
                    'total_repaid'      => (float) $loan->total_repaid,
                    'balance_remaining' => (float) $loan->balance_remaining,
                    'loan_status'       => $loan->status,
                ]
            );
        } catch (\Exception $e) {
            error_log("Repayment history error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch repayment history: " . $e->getMessage(), code: 500
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/employees/{emp_id}/loans
     * All loans for one employee across all time — with summary.
     */
    public function employeeLoans(int $orgId, int $empId): mixed
    {
        try {
            $employeeCheck = DB::raw(
                "SELECT e.*, u.email FROM employees e
                 LEFT JOIN users u ON e.user_id = u.id
                 WHERE e.id = :emp_id AND e.organization_id = :org_id",
                [':emp_id' => $empId, ':org_id' => $orgId]
            );

            if (empty($employeeCheck)) {
                return responseJson(
                    success: false, data: null,
                    message: "Employee not found in this organization", code: 404
                );
            }

            // Scope check: employees may only view their own; managers view their team
            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            $canSeeAll = in_array($currentUser['user_type'], [
                'admin', 'hr_manager', 'finance_manager',
                'payroll_manager', 'auditor',
            ]);

            if (!$canSeeAll) {
                if (in_array($currentUser['user_type'], ['hr_officer', 'payroll_officer', 'department_manager'])) {
                    $teamIds = $this->getTeamEmployeeIds((int) $currentEmployee['id']);
                    if (!in_array($empId, $teamIds)) {
                        return responseJson(
                            success: false, data: null,
                            message: "Access denied to this employee's loans", code: 403
                        );
                    }
                } elseif ((int) $currentEmployee['id'] !== $empId) {
                    return responseJson(
                        success: false, data: null,
                        message: "You can only view your own loans", code: 403
                    );
                }
            }

            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 12)));
            $offset  = ($page - 1) * $perPage;

            $where  = ["l.employee_id = :emp_id", "l.organization_id = :org_id"];
            $params = [':emp_id' => $empId, ':org_id' => $orgId];

            if (isset($_GET['status'])) {
                $where[]           = "l.status = :f_status";
                $params[':f_status'] = $_GET['status'];
            }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw(
                "SELECT COUNT(*) as total FROM loans l
                 {$this->loanJoins()} $whereClause",
                $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(
                    success: true, data: [], message: "No loans found", code: 200,
                    metadata: [
                        'pagination'    => ['total' => 0],
                        'employee_info' => [
                            'employee_id'   => $empId,
                            'employee_name' => trim(
                                ($employeeCheck[0]->firstname ?? '') . ' ' .
                                ($employeeCheck[0]->surname ?? '')
                            ),
                        ],
                    ]
                );
            }

            // Summary stats for this employee
            $summary = DB::raw(
                "SELECT
                    COUNT(*)                                              AS total_loans,
                    COALESCE(SUM(amount), 0)                             AS total_loaned,
                    COALESCE(SUM(total_repaid), 0)                       AS total_repaid,
                    COALESCE(SUM(balance_remaining), 0)                  AS total_outstanding,
                    SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
                    SUM(CASE WHEN status = 'repaid'   THEN 1 ELSE 0 END) AS repaid_count
                 FROM loans
                 WHERE employee_id = :emp_id AND organization_id = :org_id",
                [':emp_id' => $empId, ':org_id' => $orgId]
            )[0] ?? null;

            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $loans = DB::raw(
                "SELECT {$this->loanSelectColumns()}
                 FROM loans l
                 {$this->loanJoins()}
                 $whereClause
                 ORDER BY l.created_at DESC
                 LIMIT :limit OFFSET :offset",
                $dataParams
            );

            $loans = array_map(fn($loan) => $this->formatLoan($loan), $loans);

            return responseJson(
                success: true,
                data: array_values($loans),
                message: "Employee loans fetched successfully",
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
                    'summary' => [
                        'total_loans'       => (int) ($summary->total_loans       ?? 0),
                        'total_loaned'      => (float) ($summary->total_loaned    ?? 0),
                        'total_repaid'      => (float) ($summary->total_repaid    ?? 0),
                        'total_outstanding' => (float) ($summary->total_outstanding ?? 0),
                        'by_status' => [
                            'pending'  => (int) ($summary->pending_count  ?? 0),
                            'approved' => (int) ($summary->approved_count ?? 0),
                            'rejected' => (int) ($summary->rejected_count ?? 0),
                            'repaid'   => (int) ($summary->repaid_count   ?? 0),
                        ],
                    ],
                    'employee_info' => [
                        'employee_id'   => (int) $empId,
                        'employee_name' => trim(
                            ($employeeCheck[0]->firstname ?? '') . ' ' .
                            ($employeeCheck[0]->surname ?? '')
                        ),
                        'email'         => $employeeCheck[0]->email ?? null,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Employee loans error: " . $e->getMessage());
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch employee loans: " . $e->getMessage(), code: 500,
                errors: ['exception' => $e->getMessage()]
            );
        }
    }

    // -------------------------------------------------------------------------

    /**
     * GET /organizations/{org_id}/loan-types
     * List all active, approved loan configs for an org.
     */
    public function getLoanTypes(int $orgId): mixed
    {
        try {
            $loanTypes = DB::raw(
                "SELECT id, name, percentage AS interest_rate, fixed_amount AS max_amount,
                        settings, is_active, created_at
                 FROM organization_configs
                 WHERE organization_id = :org_id
                   AND config_type = 'loan'
                   AND is_active = 1
                   AND status = 'approved'
                 ORDER BY name ASC",
                [':org_id' => $orgId]
            );

            return responseJson(
                success: true,
                data: $loanTypes,
                message: "Loan types fetched successfully",
                metadata: ['count' => count($loanTypes)]
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false, data: null,
                message: "Failed to fetch loan types: " . $e->getMessage(), code: 500
            );
        }
    }
}