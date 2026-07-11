<?php

namespace App\Controllers;

use App\Services\DB;
use App\Services\Mailer; // expects Mailer::send(to, subject, body)

/**
 * LoanController
 *
 * Implements the 6-step loan approval workflow:
 *   Step 1 — Employee submits (applyLoan / store)
 *   Step 2 — System validation (runSystemValidation, called inside submission)
 *   Step 3 — Line Manager approval (managerApprove / managerReject)
 *   Step 4 — HR Manager approval (hrApprove / hrReject / flagCompliance)
 *   Step 5 — Finance Manager approval, if amount > org threshold (financeApprove / financeReject)
 *   Step 6 — Disbursement setup (disburse — finance_manager / payroll_manager only)
 *
 * Appeal flow (post-rejection):
 *   Employee submits appeal (submitAppeal)
 *   HR reviews (reviewAppeal): upheld or overturned → re-enters at Step 4
 *
 * finance_director role → mapped to finance_manager per project spec.
 * 48-hour manager escalation → skipped per project spec.
 */
class LoanController
{
    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /** Statuses that block a new loan application from being submitted */
    private const BLOCKING_STATUSES = ['pending', 'validated', 'manager_approved', 'hr_approved', 'finance_approved', 'approved', 'active'];

    /** Roles that can approve/reject at Step 5 (Finance); finance_director maps here */
    private const FINANCE_ROLES = ['admin', 'finance_manager'];

    /** Roles that can set up disbursement (Step 6) */
    private const DISBURSE_ROLES = ['admin', 'finance_manager', 'payroll_manager'];

    // =========================================================================
    // PRIVATE HELPERS — SELECT / FORMAT
    // =========================================================================

    private function loanSelectColumns(): string
    {
        return "
            l.id                            AS loan_id,
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
            l.system_rejection_reason,

            l.approved_by,      l.approved_at,
            l.rejected_by,      l.rejected_at,

            l.manager_approved_by,  l.manager_approved_at,
            l.manager_rejected_by,  l.manager_rejected_at,
            l.manager_rejection_reason,

            l.hr_approved_by,   l.hr_approved_at,
            l.hr_rejected_by,   l.hr_rejected_at,
            l.hr_rejection_reason,

            l.finance_approved_by,  l.finance_approved_at,
            l.finance_rejected_by,  l.finance_rejected_at,
            l.finance_rejection_reason,

            l.disbursed_by,     l.disbursed_at,     l.disbursement_date,

            l.created_at,       l.updated_at,

            -- Employee info
            emp.firstname               AS employee_firstname,
            emp.middlename              AS employee_middlename,
            emp.surname                 AS employee_surname,
            emp.employee_number,
            emp_u.email                 AS employee_email,

            -- Loan config / type
            cfg.name                    AS loan_type_name,
            cfg.percentage              AS loan_type_interest_rate,
            cfg.fixed_amount            AS loan_type_max_amount,
            cfg.finance_threshold       AS loan_type_finance_threshold,
            cfg.settings                AS loan_type_settings,

            -- Final approver
            appr_u.username             AS approver_username,
            appr_e.firstname            AS approver_firstname,
            appr_e.surname              AS approver_surname,
            appr_u.email                AS approver_email,

            -- Final rejecter
            rejr_u.username             AS rejecter_username,
            rejr_e.firstname            AS rejecter_firstname,
            rejr_e.surname              AS rejecter_surname,
            rejr_u.email                AS rejecter_email
        ";
    }

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
            'id'                => $loan->config_id,
            'name'              => $loan->loan_type_name,
            'interest_rate'     => $loan->loan_type_interest_rate !== null ? (float) $loan->loan_type_interest_rate : null,
            'max_amount'        => $loan->loan_type_max_amount !== null ? (float) $loan->loan_type_max_amount : null,
            'finance_threshold' => $loan->loan_type_finance_threshold !== null ? (float) $loan->loan_type_finance_threshold : null,
            'settings'          => $loan->loan_type_settings ? json_decode($loan->loan_type_settings, true) : null,
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
            $loan->loan_type_max_amount, $loan->loan_type_finance_threshold, $loan->loan_type_settings,
            $loan->approver_username, $loan->approver_firstname, $loan->approver_surname, $loan->approver_email,
            $loan->rejecter_username, $loan->rejecter_firstname, $loan->rejecter_surname, $loan->rejecter_email
        );

        return $loan;
    }

    // =========================================================================
    // PRIVATE HELPERS — ROLE / FILTER
    // =========================================================================

    private function applyRoleBasedFilters(int $orgId): array
    {
        $user     = \App\Middleware\AuthMiddleware::getCurrentUser();
        $employee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

        if (!$user || !$employee) {
            throw new \Exception('User not authenticated');
        }

        $filters = ['organization_id' => $orgId];

        switch ($user['user_type']) {
            case 'admin':
            case 'hr_manager':
            case 'hr_officer':
            case 'finance_manager':
            case 'payroll_manager':
            case 'payroll_officer':
            case 'auditor':
                break;

            case 'department_manager':
                $filters['team_employees'] = $this->getTeamEmployeeIds((int) $employee['id']);
                break;

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
                "SELECT id FROM employees WHERE reports_to = :manager_id AND status = 'active'",
                [':manager_id' => $managerId]
            );
            return array_column((array) $result, 'id');
        } catch (\Exception $e) {
            error_log("Team fetch error: " . $e->getMessage());
            return [];
        }
    }

    private function getLoanWithValidation(int $loanId, int $orgId): array
    {
        $result = DB::raw(
            "SELECT * FROM loans WHERE id = :id AND organization_id = :org_id",
            [':id' => $loanId, ':org_id' => $orgId]
        );

        if (empty($result)) {
            return [
                'success' => false,
                'data'    => responseJson(success: false, data: null, message: "Loan not found", code: 404)
            ];
        }

        return ['success' => true, 'data' => $result[0]];
    }

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

    private function hasActiveLoan(int $employeeId, int $configId, ?int $excludeLoanId = null): bool
    {
        $sql    = "SELECT COUNT(*) as cnt FROM loans
                   WHERE employee_id = :emp_id
                     AND config_id   = :cfg_id
                     AND status IN ('" . implode("','", self::BLOCKING_STATUSES) . "')";
        $params = [':emp_id' => $employeeId, ':cfg_id' => $configId];

        if ($excludeLoanId) {
            $sql              .= " AND id != :exclude_id";
            $params[':exclude_id'] = $excludeLoanId;
        }

        $result = DB::raw($sql, $params);
        return (int) ($result[0]->cnt ?? 0) > 0;
    }

    // =========================================================================
    // PRIVATE HELPERS — NOTIFICATIONS & EMAIL
    // =========================================================================

    /**
     * Insert an in-app notification AND send an email.
     */
    private function notify(
        int $employeeId,
        int $orgId,
        int $loanId,
        string $title,
        string $message,
        string $status
    ): void {
        try {
            // In-app notification
            DB::table('notifications')->insert([
                'employee_id'     => $employeeId,
                'organization_id' => $orgId,
                'title'           => $title,
                'message'         => $message,
                'type'            => 'loan',
                'is_read'         => 0,
                'metadata'        => json_encode(['loan_id' => $loanId, 'status' => $status]),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);

            // Email notification — fetch employee email
            $emp = DB::raw(
                "SELECT u.email, CONCAT(e.firstname,' ',e.surname) AS full_name
                 FROM employees e
                 LEFT JOIN users u ON e.user_id = u.id
                 WHERE e.id = :emp_id LIMIT 1",
                [':emp_id' => $employeeId]
            );

            if (!empty($emp) && !empty($emp[0]->email)) {
                Mailer::send(
                    to: $emp[0]->email,
                    subject: $title,
                    body: "Dear {$emp[0]->full_name},\n\n{$message}\n\nThank you."
                );
            }
        } catch (\Exception $e) {
            error_log("Loan notification error: " . $e->getMessage());
        }
    }

    /**
     * Notify the employee's direct line manager about a pending loan.
     */
    private function notifyLineManager(int $employeeId, int $orgId, int $loanId, float $amount): void
    {
        try {
            $mgr = DB::raw(
                "SELECT m.id AS manager_emp_id, u.email, CONCAT(m.firstname,' ',m.surname) AS full_name,
                        CONCAT(e.firstname,' ',e.surname) AS employee_name
                 FROM employees e
                 INNER JOIN employees m ON e.reports_to = m.id
                 LEFT JOIN users u ON m.user_id = u.id
                 WHERE e.id = :emp_id LIMIT 1",
                [':emp_id' => $employeeId]
            );

            if (!empty($mgr) && !empty($mgr[0]->email)) {
                $subject = "Action Required: Loan Approval for {$mgr[0]->employee_name}";
                $body    = "Dear {$mgr[0]->full_name},\n\n"
                    . "{$mgr[0]->employee_name} has submitted a loan application of " . number_format($amount, 2)
                    . " and requires your approval.\n\n"
                    . "Please log in to the payroll system to review and approve or reject the request.\n\n"
                    . "Thank you.";

                Mailer::send(to: $mgr[0]->email, subject: $subject, body: $body);
            }
        } catch (\Exception $e) {
            error_log("Manager notification error: " . $e->getMessage());
        }
    }

    /**
     * Notify all HR Managers in the org about a loan awaiting HR review.
     */
    private function notifyHrManagers(int $orgId, int $loanId, string $employeeName, float $amount): void
    {
        try {
            $hrs = DB::raw(
                "SELECT u.email, CONCAT(e.firstname,' ',e.surname) AS full_name
                 FROM users u
                 LEFT JOIN employees e ON e.user_id = u.id
                 WHERE u.organization_id = :org_id
                   AND u.user_type = 'hr_manager'",
                [':org_id' => $orgId]
            );

            foreach ($hrs as $hr) {
                if (empty($hr->email)) continue;
                $subject = "Action Required: Loan HR Review for {$employeeName}";
                $body    = "Dear {$hr->full_name},\n\n"
                    . "A loan application of " . number_format($amount, 2) . " from {$employeeName} "
                    . "has been approved by the line manager and now requires your HR review.\n\n"
                    . "Please log in to review the application.\n\nThank you.";
                Mailer::send(to: $hr->email, subject: $subject, body: $body);
            }
        } catch (\Exception $e) {
            error_log("HR manager notification error: " . $e->getMessage());
        }
    }

    /**
     * Notify Finance Managers when a high-value loan needs their sign-off.
     */
    private function notifyFinanceManagers(int $orgId, int $loanId, string $employeeName, float $amount): void
    {
        try {
            $fms = DB::raw(
                "SELECT u.email, CONCAT(e.firstname,' ',e.surname) AS full_name
                 FROM users u
                 LEFT JOIN employees e ON e.user_id = u.id
                 WHERE u.organization_id = :org_id
                   AND u.user_type = 'finance_manager'",
                [':org_id' => $orgId]
            );

            foreach ($fms as $fm) {
                if (empty($fm->email)) continue;
                $subject = "Action Required: Finance Approval for Loan — {$employeeName}";
                $body    = "Dear {$fm->full_name},\n\n"
                    . "A loan of " . number_format($amount, 2) . " for {$employeeName} exceeds the organisation "
                    . "finance threshold and requires your approval.\n\nPlease log in to review.\n\nThank you.";
                Mailer::send(to: $fm->email, subject: $subject, body: $body);
            }
        } catch (\Exception $e) {
            error_log("Finance manager notification error: " . $e->getMessage());
        }
    }

    // =========================================================================
    // PRIVATE HELPERS — SYSTEM VALIDATION (Step 2)
    // =========================================================================

    /**
     * Run all system eligibility checks.
     * Returns ['passed' => true] or ['passed' => false, 'reason' => '...'].
     */
    private function runSystemValidation(object $employee, object $config, float $amount): array
    {
        // 1. Employee must be active
        if (!in_array($employee->status, ['active', 'on_probation'])) {
            return ['passed' => false, 'reason' => "Employee is not active (current status: {$employee->status})"];
        }

        // 2. Minimum employment period — default 6 months, overridable via config settings
        $minMonths = 6;
        if (!empty($config->settings)) {
            $settings  = is_string($config->settings) ? json_decode($config->settings, true) : (array) $config->settings;
            $minMonths = (int) ($settings['min_employment_months'] ?? 6);
        }

        $hireDate   = new \DateTime($employee->hire_date);
        $today      = new \DateTime();
        $monthsWorked = (int) $hireDate->diff($today)->days / 30;

        if ($monthsWorked < $minMonths) {
            return [
                'passed' => false,
                'reason' => "Minimum employment period not met. Required: {$minMonths} months. "
                    . "Completed: " . round($monthsWorked, 1) . " months.",
            ];
        }

        // 3. No existing outstanding loan of the same type
        if ($this->hasActiveLoan((int) $employee->id, (int) $config->id)) {
            return ['passed' => false, 'reason' => "Employee already has an active or pending loan of this type"];
        }

        // 4. Amount within allowed ceiling
        if ($config->fixed_amount && $amount > (float) $config->fixed_amount) {
            return [
                'passed' => false,
                'reason' => "Requested amount ({$amount}) exceeds the maximum allowed: {$config->fixed_amount}",
            ];
        }

        return ['passed' => true];
    }

    // =========================================================================
    // PRIVATE HELPERS — FINANCE THRESHOLD CHECK
    // =========================================================================

    /**
     * Determine whether Finance Manager approval is needed for this loan.
     */
    private function requiresFinanceApproval(float $amount, object $config): bool
    {
        return $config->finance_threshold !== null && $amount > (float) $config->finance_threshold;
    }

    // =========================================================================
    // PRIVATE HELPERS — FETCH EMPLOYEE FULL NAME (for notifications)
    // =========================================================================

    private function getEmployeeName(int $employeeId): string
    {
        $emp = DB::raw(
            "SELECT CONCAT(firstname,' ',surname) AS full_name FROM employees WHERE id = :id LIMIT 1",
            [':id' => $employeeId]
        );
        return $emp[0]->full_name ?? 'Employee';
    }

    // =========================================================================
    // PUBLIC — COLLECTION
    // =========================================================================

    /**
     * GET /organizations/{org_id}/loans
     */
    public function index(int $orgId): mixed
    {
        try {
            if (!$orgId || !is_numeric($orgId)) {
                return responseJson(success: false, message: "Invalid organization ID", code: 400);
            }

            $orgCheck = DB::table('organizations')->where(['id' => $orgId])->get();
            if (empty($orgCheck)) {
                return responseJson(success: false, data: null, message: "Organization not found", code: 404);
            }

            try {
                $filters = $this->applyRoleBasedFilters($orgId);
            } catch (\Exception $e) {
                return responseJson(success: false, data: null, message: "Authentication error", code: 401);
            }

            $page    = max(1, (int) ($_GET['page']     ?? 1));
            $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
            $offset  = ($page - 1) * $perPage;

            $allowedStatuses = [
                'pending','validated','system_rejected',
                'manager_approved','manager_rejected',
                'hr_approved','hr_rejected','compliance_review',
                'finance_approved','finance_rejected',
                'approved','active','rejected','repaid','appealed',
            ];

            $status     = $_GET['status']      ?? null;
            $configId   = $_GET['config_id']   ?? null;
            $employeeId = $_GET['employee_id'] ?? null;
            $month      = $_GET['month']       ?? null;
            $year       = $_GET['year']        ?? null;

            $errors = [];
            if ($status && !in_array($status, $allowedStatuses)) {
                $errors['status'] = "Must be one of: " . implode(', ', $allowedStatuses);
            }
            if ($configId && !is_numeric($configId))   $errors['config_id']   = "Must be numeric";
            if ($employeeId && !is_numeric($employeeId)) $errors['employee_id'] = "Must be numeric";
            if ($month && ((int)$month < 1 || (int)$month > 12)) $errors['month'] = "Must be 1–12";
            if ($year  && ((int)$year  < 1900 || (int)$year  > 2100)) $errors['year']  = "Must be 1900–2100";
            if (!empty($errors)) return responseJson(success: false, data: null, message: "Validation failed", code: 400, errors: $errors);

            $where  = ["l.organization_id = :org_id"];
            $params = [':org_id' => $orgId];

            if (isset($filters['employee_id'])) {
                $where[]               = "l.employee_id = :role_emp_id";
                $params[':role_emp_id'] = $filters['employee_id'];
            }

            if (!empty($filters['team_employees'])) {
                $ids          = $filters['team_employees'];
                $placeholders = implode(',', array_map(fn($i) => ":team_$i", array_keys($ids)));
                $where[]      = "l.employee_id IN ($placeholders)";
                foreach ($ids as $i => $empId) $params[":team_$i"] = $empId;
            }

            if ($status)     { $where[] = "l.status = :f_status";    $params[':f_status']  = $status; }
            if ($configId)   { $where[] = "l.config_id = :f_cfg";    $params[':f_cfg']     = (int) $configId; }
            if ($employeeId && !isset($filters['employee_id'])) {
                $where[] = "l.employee_id = :f_emp"; $params[':f_emp'] = (int) $employeeId;
            }
            if ($month) { $where[] = "MONTH(l.start_date) = :f_month"; $params[':f_month'] = (int) $month; }
            if ($year)  { $where[] = "YEAR(l.start_date) = :f_year";   $params[':f_year']  = (int) $year;  }

            $whereClause = "WHERE " . implode(" AND ", $where);

            $total = DB::raw("SELECT COUNT(*) as total FROM loans l {$this->loanJoins()} $whereClause", $params)[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(success: false, data: null, message: "No loans found", code: 404);
            }

            $stats = DB::raw(
                "SELECT COUNT(*) AS total_loans,
                    SUM(CASE WHEN l.status IN ('pending','validated','manager_approved','hr_approved','finance_approved') THEN 1 ELSE 0 END) AS in_progress_count,
                    SUM(CASE WHEN l.status IN ('approved','active')  THEN 1 ELSE 0 END) AS approved_count,
                    SUM(CASE WHEN l.status IN ('manager_rejected','hr_rejected','finance_rejected','system_rejected','rejected') THEN 1 ELSE 0 END) AS rejected_count,
                    SUM(CASE WHEN l.status = 'repaid'  THEN 1 ELSE 0 END) AS repaid_count,
                    COALESCE(SUM(l.amount), 0)            AS total_loaned,
                    COALESCE(SUM(l.total_repaid), 0)      AS total_repaid,
                    COALESCE(SUM(l.balance_remaining), 0) AS total_outstanding
                 FROM loans l {$this->loanJoins()} $whereClause",
                $params
            )[0] ?? null;

            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $loans = DB::raw(
                "SELECT {$this->loanSelectColumns()} FROM loans l {$this->loanJoins()}
                 $whereClause ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset",
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
                            'in_progress' => (int) ($stats->in_progress_count ?? 0),
                            'approved'    => (int) ($stats->approved_count    ?? 0),
                            'rejected'    => (int) ($stats->rejected_count    ?? 0),
                            'repaid'      => (int) ($stats->repaid_count      ?? 0),
                        ],
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Loan index error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to fetch loans", code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — SINGLE RECORD
    // =========================================================================

    /**
     * GET /organizations/{org_id}/loans/{loan_id}
     */
    public function show(int $orgId, int $loanId): mixed
    {
        try {
            $result = DB::raw(
                "SELECT {$this->loanSelectColumns()} FROM loans l {$this->loanJoins()}
                 WHERE l.id = :loan_id AND l.organization_id = :org_id",
                [':loan_id' => $loanId, ':org_id' => $orgId]
            );

            if (empty($result)) {
                return responseJson(success: false, data: null, message: "Loan not found", code: 404);
            }

            return responseJson(success: true, data: $this->formatLoan($result[0]), message: "Loan fetched successfully");
        } catch (\Exception $e) {
            return responseJson(success: false, data: null, message: "Failed to fetch loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — SUBMISSION (Steps 1 & 2)
    // =========================================================================

    /**
     * POST /organizations/{org_id}/employees/{emp_id}/loans
     * Employee self-service submission. Runs system validation immediately.
     */
    public function applyLoan(int $orgId, int $empId): mixed
    {
        try {
            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            if (!$currentUser || !$currentEmployee) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $isPrivileged = in_array($currentUser['user_type'], ['admin', 'hr_manager', 'hr_officer', 'payroll_manager']);
            if (!$isPrivileged && (int) $currentEmployee['id'] !== $empId) {
                return responseJson(success: false, data: null, message: "You can only apply for a loan for yourself", code: 403);
            }

            $employeeRows = DB::table('employees')
                ->where(['id' => $empId, 'organization_id' => $orgId])
                ->get();

            if (empty($employeeRows)) {
                return responseJson(success: false, data: null, message: "Employee not found in this organization", code: 404);
            }
            $employee = $employeeRows[0];

            $data = json_decode(file_get_contents('php://input'), true);

            foreach (['config_id', 'amount', 'start_date'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(success: false, data: null, message: "Field '$f' is required", code: 400);
                }
            }

            $config = $this->getLoanConfig((int) $data['config_id'], $orgId);
            if (!$config) {
                return responseJson(success: false, data: null, message: "Loan type not found or not active for this organisation", code: 404);
            }

            $amount = (float) $data['amount'];

            if ($amount <= 0) {
                return responseJson(success: false, data: null, message: "Loan amount must be greater than zero", code: 400);
            }

            // --- Step 2: System Validation ---
            $validation = $this->runSystemValidation($employee, $config, $amount);

            $interestRate     = $data['interest_rate']     ?? $config->percentage;
            $monthlyDeduction = $data['monthly_deduction'] ?? null;

            if (!$validation['passed']) {
                // Auto-reject immediately and notify employee
                DB::table('loans')->insert([
                    'organization_id'         => $orgId,
                    'employee_id'             => $empId,
                    'config_id'               => (int) $data['config_id'],
                    'amount'                  => $amount,
                    'interest_rate'           => $interestRate !== null ? (float) $interestRate : null,
                    'monthly_deduction'       => $monthlyDeduction !== null ? (float) $monthlyDeduction : null,
                    'balance_remaining'       => $amount,
                    'total_repaid'            => 0.00,
                    'start_date'              => $data['start_date'],
                    'end_date'                => $data['end_date'] ?? null,
                    'purpose'                 => $data['purpose'] ?? null,
                    'status'                  => 'system_rejected',
                    'system_rejection_reason' => $validation['reason'],
                ]);

                $loanId = DB::lastInsertId();

                $this->notify(
                    $empId, $orgId, $loanId,
                    'Loan Application Rejected',
                    "Your loan application was automatically rejected: {$validation['reason']}",
                    'system_rejected'
                );

                return responseJson(
                    success: false,
                    data: ['loan_id' => $loanId, 'status' => 'system_rejected', 'reason' => $validation['reason']],
                    message: "Loan application rejected: " . $validation['reason'],
                    code: 422
                );
            }

            // Validation passed — create loan and move to 'validated' / notify manager
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
                'status'           => 'validated',
            ]);

            $loanId = DB::lastInsertId();

            // Notify employee their application is in review
            $employeeName = trim(($employee->firstname ?? '') . ' ' . ($employee->middlename ? $employee->middlename . ' ' : '') . ($employee->surname ?? ''));
            $this->notify(
                $empId, $orgId, $loanId,
                'Loan Application Submitted',
                "Your loan application has been submitted successfully and is now awaiting your line manager's review.",
                'validated'
            );

            // Step 3: Notify line manager
            $this->notifyLineManager($empId, $orgId, $loanId, $amount);

            return responseJson(
                success: true,
                data: [
                    'loan_id'   => $loanId,
                    'employee'  => ['id' => $empId, 'full_name' => $employeeName],
                    'loan_type' => ['id' => $config->id, 'name' => $config->name],
                    'amount'    => $amount,
                    'status'    => 'validated',
                    'next_step' => 'Awaiting line manager review',
                ],
                message: "Loan application submitted. Your line manager has been notified.",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Apply loan error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to submit loan: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/loans
     * HR / Admin creates a loan on behalf of an employee.
     * Same validation flow applies — bypasses self-service guard.
     */
    public function store(int $orgId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            foreach (['employee_id', 'config_id', 'amount', 'start_date'] as $f) {
                if (empty($data[$f])) {
                    return responseJson(success: false, data: null, message: "Field '$f' is required", code: 400);
                }
            }

            $employeeRows = DB::table('employees')
                ->where(['id' => $data['employee_id'], 'organization_id' => $orgId])
                ->get();

            if (empty($employeeRows)) {
                return responseJson(success: false, data: null, message: "Employee not found in this organization", code: 404);
            }
            $employee = $employeeRows[0];

            $config = $this->getLoanConfig((int) $data['config_id'], $orgId);
            if (!$config) {
                return responseJson(success: false, data: null, message: "Loan type not found or not active", code: 404);
            }

            $amount = (float) $data['amount'];
            if ($amount <= 0) {
                return responseJson(success: false, data: null, message: "Loan amount must be greater than zero", code: 400);
            }

            $validation = $this->runSystemValidation($employee, $config, $amount);

            $interestRate     = $data['interest_rate']     ?? $config->percentage;
            $monthlyDeduction = $data['monthly_deduction'] ?? null;

            if (!$validation['passed']) {
                DB::table('loans')->insert([
                    'organization_id'         => $orgId,
                    'employee_id'             => (int) $data['employee_id'],
                    'config_id'               => (int) $data['config_id'],
                    'amount'                  => $amount,
                    'interest_rate'           => $interestRate !== null ? (float) $interestRate : null,
                    'monthly_deduction'       => $monthlyDeduction !== null ? (float) $monthlyDeduction : null,
                    'balance_remaining'       => $amount,
                    'total_repaid'            => 0.00,
                    'start_date'              => $data['start_date'],
                    'end_date'                => $data['end_date'] ?? null,
                    'purpose'                 => $data['purpose'] ?? null,
                    'status'                  => 'system_rejected',
                    'system_rejection_reason' => $validation['reason'],
                ]);
                $loanId = DB::lastInsertId();

                $this->notify((int) $data['employee_id'], $orgId, $loanId, 'Loan Application Rejected',
                    "Your loan application was rejected: {$validation['reason']}", 'system_rejected');

                return responseJson(
                    success: false,
                    data: ['loan_id' => $loanId, 'status' => 'system_rejected', 'reason' => $validation['reason']],
                    message: "Loan rejected by system validation: " . $validation['reason'],
                    code: 422
                );
            }

            DB::table('loans')->insert([
                'organization_id'  => $orgId,
                'employee_id'      => (int) $data['employee_id'],
                'config_id'        => (int) $data['config_id'],
                'amount'           => $amount,
                'interest_rate'    => $interestRate !== null ? (float) $interestRate : null,
                'monthly_deduction'=> $monthlyDeduction !== null ? (float) $monthlyDeduction : null,
                'balance_remaining'=> $amount,
                'total_repaid'     => 0.00,
                'start_date'       => $data['start_date'],
                'end_date'         => $data['end_date'] ?? null,
                'purpose'          => $data['purpose'] ?? null,
                'status'           => 'validated',
            ]);
            $loanId = DB::lastInsertId();

            $this->notify((int) $data['employee_id'], $orgId, $loanId, 'Loan Application Created',
                "A loan application has been created on your behalf and is awaiting line manager review.", 'validated');

            $this->notifyLineManager((int) $data['employee_id'], $orgId, $loanId, $amount);

            $created = DB::raw(
                "SELECT {$this->loanSelectColumns()} FROM loans l {$this->loanJoins()} WHERE l.id = :id",
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
            return responseJson(success: false, data: null, message: "Failed to create loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — STEP 3: LINE MANAGER APPROVAL
    // =========================================================================

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/manager-approve
     * Roles: department_manager (own team), hr_manager, admin
     */
    public function managerApprove(int $orgId, int $loanId): mixed
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

            if ($loan->status !== 'validated') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not awaiting manager approval.",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'               => 'manager_approved',
                'manager_approved_by'  => $currentUser['id'],
                'manager_approved_at'  => $now,
            ], 'id', $loanId);

            $employeeName = $this->getEmployeeName((int) $loan->employee_id);

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Approved by Your Manager',
                "Your loan application has been approved by your line manager and has been forwarded to HR for review.",
                'manager_approved'
            );

            // Step 4: Notify HR managers
            $config = $this->getLoanConfig((int) $loan->config_id, $orgId);
            $this->notifyHrManagers($orgId, $loanId, $employeeName, (float) $loan->amount);

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'manager_approved', 'approved_at' => $now],
                message: "Loan approved by manager. HR has been notified."
            );
        } catch (\Exception $e) {
            error_log("Manager approve error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to approve loan: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/manager-reject
     * Roles: department_manager (own team), hr_manager, admin
     */
    public function managerReject(int $orgId, int $loanId): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = trim($data['rejection_reason'] ?? '');

            if (empty($rejectionReason)) {
                return responseJson(success: false, data: null, message: "rejection_reason is required", code: 400);
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if ($loan->status !== 'validated') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not awaiting manager approval (current status: {$loan->status})",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'                   => 'manager_rejected',
                'manager_rejected_by'      => $currentUser['id'],
                'manager_rejected_at'      => $now,
                'manager_rejection_reason' => $rejectionReason,
            ], 'id', $loanId);

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Rejected by Your Manager',
                "Your loan application has been rejected by your line manager. Reason: {$rejectionReason}. "
                . "You may submit an appeal if you disagree with this decision.",
                'manager_rejected'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'manager_rejected', 'rejected_at' => $now, 'reason' => $rejectionReason],
                message: "Loan rejected by manager. Employee has been notified."
            );
        } catch (\Exception $e) {
            error_log("Manager reject error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to reject loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — STEP 4: HR APPROVAL
    // =========================================================================

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/hr-approve
     * Roles: hr_manager, admin
     */
    public function hrApprove(int $orgId, int $loanId): mixed
    {
        try {
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if ($loan->status !== 'manager_approved') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not awaiting HR approval (current status: {$loan->status})",
                    code: 400
                );
            }

            $now    = date('Y-m-d H:i:s');
            $config = $this->getLoanConfig((int) $loan->config_id, $orgId);
            $amount = (float) $loan->amount;

            $needsFinance = $config && $this->requiresFinanceApproval($amount, $config);

            DB::table('loans')->update([
                'status'          => $needsFinance ? 'hr_approved' : 'finance_approved',
                'hr_approved_by'  => $currentUser['id'],
                'hr_approved_at'  => $now,
            ], 'id', $loanId);

            $employeeName = $this->getEmployeeName((int) $loan->employee_id);

            if ($needsFinance) {
                $this->notify(
                    (int) $loan->employee_id, $orgId, $loanId,
                    'Loan Approved by HR',
                    "Your loan application has been approved by HR and is now awaiting Finance Manager approval.",
                    'hr_approved'
                );
                $this->notifyFinanceManagers($orgId, $loanId, $employeeName, $amount);

                return responseJson(
                    success: true,
                    data: ['loan_id' => $loanId, 'status' => 'hr_approved', 'approved_at' => $now, 'next_step' => 'Finance Manager review'],
                    message: "Loan approved by HR. Finance Manager has been notified (amount exceeds threshold)."
                );
            }

            // Skip Finance — loan is now fully approved, awaiting disbursement
            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Fully Approved',
                "Your loan application has been fully approved and is now being set up for disbursement.",
                'finance_approved'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'finance_approved', 'approved_at' => $now, 'next_step' => 'Disbursement setup'],
                message: "Loan approved by HR (Finance step skipped — amount below threshold). Ready for disbursement."
            );
        } catch (\Exception $e) {
            error_log("HR approve error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to approve loan: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/hr-reject
     * Roles: hr_manager, admin
     */
    public function hrReject(int $orgId, int $loanId): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = trim($data['rejection_reason'] ?? '');

            if (empty($rejectionReason)) {
                return responseJson(success: false, data: null, message: "rejection_reason is required", code: 400);
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if ($loan->status !== 'manager_approved') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not awaiting HR approval (current status: {$loan->status})",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'              => 'hr_rejected',
                'hr_rejected_by'      => $currentUser['id'],
                'hr_rejected_at'      => $now,
                'hr_rejection_reason' => $rejectionReason,
            ], 'id', $loanId);

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Rejected by HR',
                "Your loan application has been rejected by HR. Reason: {$rejectionReason}. "
                . "You may submit an appeal if you disagree with this decision.",
                'hr_rejected'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'hr_rejected', 'rejected_at' => $now, 'reason' => $rejectionReason],
                message: "Loan rejected by HR. Employee has been notified."
            );
        } catch (\Exception $e) {
            error_log("HR reject error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to reject loan: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/hr-flag-compliance
     * Flag a loan for compliance review rather than outright rejection.
     * Roles: hr_manager, admin
     */
    public function hrFlagCompliance(int $orgId, int $loanId): mixed
    {
        try {
            $data   = json_decode(file_get_contents('php://input'), true);
            $reason = trim($data['reason'] ?? '');

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if ($loan->status !== 'manager_approved') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not awaiting HR approval (current status: {$loan->status})",
                    code: 400
                );
            }

            DB::table('loans')->update([
                'status'          => 'compliance_review',
                'hr_rejected_by'  => $currentUser['id'],   // reuse field to track who flagged
                'hr_rejected_at'  => date('Y-m-d H:i:s'),
                'hr_rejection_reason' => $reason ?: 'Flagged for compliance review',
            ], 'id', $loanId);

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Under Compliance Review',
                "Your loan application has been flagged for a compliance review. "
                . "You will be notified once the review is complete." . ($reason ? " Note: {$reason}" : ""),
                'compliance_review'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'compliance_review'],
                message: "Loan flagged for compliance review. Employee has been notified."
            );
        } catch (\Exception $e) {
            error_log("Compliance flag error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to flag loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — STEP 5: FINANCE APPROVAL
    // =========================================================================

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/finance-approve
     * Roles: finance_manager, admin  (finance_director → finance_manager)
     */
    public function financeApprove(int $orgId, int $loanId): mixed
    {
        try {
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if ($loan->status !== 'hr_approved') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not awaiting Finance approval (current status: {$loan->status})",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'              => 'finance_approved',
                'finance_approved_by' => $currentUser['id'],
                'finance_approved_at' => $now,
            ], 'id', $loanId);

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Fully Approved',
                "Your loan application has been approved by Finance and is now being set up for disbursement. "
                . "You will receive further details shortly.",
                'finance_approved'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'finance_approved', 'approved_at' => $now, 'next_step' => 'Disbursement setup'],
                message: "Loan approved by Finance. Ready for disbursement."
            );
        } catch (\Exception $e) {
            error_log("Finance approve error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to approve loan: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/finance-reject
     * Roles: finance_manager, admin
     */
    public function financeReject(int $orgId, int $loanId): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = trim($data['rejection_reason'] ?? '');

            if (empty($rejectionReason)) {
                return responseJson(success: false, data: null, message: "rejection_reason is required", code: 400);
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if ($loan->status !== 'hr_approved') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not awaiting Finance approval (current status: {$loan->status})",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'                      => 'finance_rejected',
                'finance_rejected_by'         => $currentUser['id'],
                'finance_rejected_at'         => $now,
                'finance_rejection_reason'    => $rejectionReason,
            ], 'id', $loanId);

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Rejected by Finance',
                "Your loan application has been rejected by the Finance Manager. Reason: {$rejectionReason}. "
                . "You may submit an appeal if you disagree.",
                'finance_rejected'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'finance_rejected', 'rejected_at' => $now, 'reason' => $rejectionReason],
                message: "Loan rejected by Finance. Employee has been notified."
            );
        } catch (\Exception $e) {
            error_log("Finance reject error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to reject loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — STEP 6: DISBURSEMENT
    // =========================================================================

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/disburse
     * Sets up the repayment schedule and marks the loan as active.
     * Only callable AFTER all required approvals are in place.
     * Roles: finance_manager, payroll_manager, admin
     */
    public function disburse(int $orgId, int $loanId): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $disbursementDate = $data['disbursement_date'] ?? null;

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            // Only disburse-capable roles
            if (!in_array($currentUser['user_type'], self::DISBURSE_ROLES)) {
                return responseJson(
                    success: false, data: null,
                    message: "Only Finance Managers and Payroll Managers can set up disbursement",
                    code: 403
                );
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            // Loan must be in 'finance_approved' status — all approvals complete
            if ($loan->status !== 'finance_approved') {
                return responseJson(
                    success: false, data: null,
                    message: "Loan is not ready for disbursement. All approval steps must be completed first (current status: {$loan->status})",
                    code: 400
                );
            }

            // Monthly deduction is required before disbursement
            if (empty($data['monthly_deduction']) && empty($loan->monthly_deduction)) {
                return responseJson(
                    success: false, data: null,
                    message: "monthly_deduction is required to set up the repayment schedule",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            $updateData = [
                'status'            => 'approved',   // 'approved' = live / active
                'disbursed_by'      => $currentUser['id'],
                'disbursed_at'      => $now,
                'disbursement_date' => $disbursementDate ?? date('Y-m-d'),
                'approved_by'       => $currentUser['id'],  // populate legacy column
                'approved_at'       => $now,
            ];

            if (!empty($data['monthly_deduction'])) {
                $updateData['monthly_deduction'] = (float) $data['monthly_deduction'];
            }
            if (!empty($data['end_date'])) {
                $updateData['end_date'] = $data['end_date'];
            }

            DB::table('loans')->update($updateData, 'id', $loanId);

            $monthlyDeduction = $data['monthly_deduction'] ?? $loan->monthly_deduction;

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Disbursement Confirmed',
                "Your loan of " . number_format((float) $loan->amount, 2)
                . " has been confirmed for disbursement on " . ($disbursementDate ?? date('Y-m-d')) . ". "
                . "Monthly repayment deduction: " . number_format((float) $monthlyDeduction, 2) . ".",
                'approved'
            );

            return responseJson(
                success: true,
                data: [
                    'loan_id'           => $loanId,
                    'status'            => 'approved',
                    'disbursed_at'      => $now,
                    'disbursement_date' => $disbursementDate ?? date('Y-m-d'),
                    'monthly_deduction' => (float) $monthlyDeduction,
                    'amount'            => (float) $loan->amount,
                ],
                message: "Loan disbursement set up successfully. Employee has been notified."
            );
        } catch (\Exception $e) {
            error_log("Disburse error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to disburse loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — APPEAL FLOW
    // =========================================================================

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/appeal
     * Employee submits an appeal after any rejection.
     */
    public function submitAppeal(int $orgId, int $loanId): mixed
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

            // Only the loan owner can appeal
            if ((int) $loan->employee_id !== (int) $currentEmployee['id']) {
                return responseJson(success: false, data: null, message: "You can only appeal your own loans", code: 403);
            }

            // Must be in a rejected state
            $appealableStatuses = ['manager_rejected', 'hr_rejected', 'finance_rejected', 'system_rejected', 'rejected'];
            if (!in_array($loan->status, $appealableStatuses)) {
                return responseJson(
                    success: false, data: null,
                    message: "Appeals can only be submitted for rejected loans (current status: {$loan->status})",
                    code: 400
                );
            }

            $data         = json_decode(file_get_contents('php://input'), true);
            $appealReason = trim($data['appeal_reason'] ?? '');

            if (empty($appealReason)) {
                return responseJson(success: false, data: null, message: "appeal_reason is required", code: 400);
            }

            // Block duplicate pending appeals
            $existingAppeal = DB::raw(
                "SELECT id FROM loan_appeals WHERE loan_id = :loan_id AND status = 'pending' LIMIT 1",
                [':loan_id' => $loanId]
            );
            if (!empty($existingAppeal)) {
                return responseJson(success: false, data: null, message: "An appeal is already pending for this loan", code: 409);
            }

            DB::table('loan_appeals')->insert([
                'loan_id'          => $loanId,
                'organization_id'  => $orgId,
                'employee_id'      => (int) $currentEmployee['id'],
                'appeal_reason'    => $appealReason,
                'supporting_docs'  => $data['supporting_docs'] ?? null,
                'status'           => 'pending',
                'created_at'       => date('Y-m-d H:i:s'),
            ]);

            // Update loan status to 'appealed'
            DB::table('loans')->update(['status' => 'appealed'], 'id', $loanId);

            // Notify HR managers about the appeal
            $employeeName = $this->getEmployeeName((int) $currentEmployee['id']);
            $hrs = DB::raw(
                "SELECT u.email, CONCAT(e.firstname,' ',e.surname) AS full_name
                 FROM users u LEFT JOIN employees e ON e.user_id = u.id
                 WHERE u.organization_id = :org_id AND u.user_type = 'hr_manager'",
                [':org_id' => $orgId]
            );
            foreach ($hrs as $hr) {
                if (empty($hr->email)) continue;
                Mailer::send(
                    to: $hr->email,
                    subject: "Loan Appeal Submitted by {$employeeName}",
                    body: "Dear {$hr->full_name},\n\n{$employeeName} has submitted an appeal for their rejected loan application.\n\nAppeal reason: {$appealReason}\n\nPlease log in to review the appeal.\n\nThank you."
                );
            }

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'appealed'],
                message: "Appeal submitted successfully. HR has been notified.",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Submit appeal error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to submit appeal: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/appeal/review
     * HR reviews the appeal: upholds or overturns.
     * Roles: hr_manager, admin
     */
    public function reviewAppeal(int $orgId, int $loanId): mixed
    {
        try {
            $data     = json_decode(file_get_contents('php://input'), true);
            $decision = $data['decision'] ?? null;  // 'upheld' or 'overturned'
            $reason   = trim($data['reason'] ?? '');

            if (!in_array($decision, ['upheld', 'overturned'])) {
                return responseJson(success: false, data: null, message: "decision must be 'upheld' or 'overturned'", code: 400);
            }
            if (empty($reason)) {
                return responseJson(success: false, data: null, message: "reason is required", code: 400);
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if ($loan->status !== 'appealed') {
                return responseJson(success: false, data: null, message: "Loan is not in appeal status", code: 400);
            }

            $appeal = DB::raw(
                "SELECT * FROM loan_appeals WHERE loan_id = :loan_id AND status = 'pending' LIMIT 1",
                [':loan_id' => $loanId]
            );
            if (empty($appeal)) {
                return responseJson(success: false, data: null, message: "No pending appeal found for this loan", code: 404);
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loan_appeals')->update([
                'status'              => $decision,
                'reviewed_by'         => $currentUser['id'],
                'reviewed_at'         => $now,
                'hr_decision'         => $decision,
                'hr_decision_reason'  => $reason,
            ], 'id', $appeal[0]->id);

            if ($decision === 'overturned') {
                // Re-enter at Step 4 (HR review)
                DB::table('loans')->update([
                    'status'                   => 'manager_approved',   // re-enter HR queue
                    'manager_rejection_reason' => null,
                    'hr_rejected_by'           => null,
                    'hr_rejected_at'           => null,
                    'hr_rejection_reason'      => null,
                ], 'id', $loanId);

                $this->notify(
                    (int) $loan->employee_id, $orgId, $loanId,
                    'Loan Appeal Overturned — Re-evaluation in Progress',
                    "Your loan appeal has been reviewed. HR has overturned the previous rejection and your application will be re-evaluated.",
                    'manager_approved'
                );

                $this->notifyHrManagers($orgId, $loanId, $this->getEmployeeName((int) $loan->employee_id), (float) $loan->amount);

                $message = "Appeal overturned. Loan has been re-entered into the HR review queue.";
            } else {
                // Rejection upheld
                DB::table('loans')->update(['status' => 'rejected'], 'id', $loanId);

                $this->notify(
                    (int) $loan->employee_id, $orgId, $loanId,
                    'Loan Appeal Decision — Rejection Upheld',
                    "Your loan appeal has been reviewed. Unfortunately, the rejection decision has been upheld. Reason: {$reason}.",
                    'rejected'
                );

                $message = "Appeal reviewed. Rejection upheld. Employee has been notified.";
            }

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'appeal_decision' => $decision, 'reviewed_at' => $now],
                message: $message
            );
        } catch (\Exception $e) {
            error_log("Review appeal error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to review appeal: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — LEGACY APPROVE / REJECT (admin fast-track)
    // =========================================================================

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/approve
     * Admin-only fast-track: bypasses the multi-step flow.
     * Moves any non-terminal loan directly to 'approved'.
     * Roles: admin only
     */
    public function approve(int $orgId, int $loanId): mixed
    {
        try {
            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            if ($currentUser['user_type'] !== 'admin') {
                return responseJson(
                    success: false, data: null,
                    message: "Direct approval is restricted to admins. Use the step-by-step workflow.",
                    code: 403
                );
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            $terminalStatuses = ['approved', 'active', 'repaid', 'rejected'];
            if (in_array($loan->status, $terminalStatuses)) {
                return responseJson(
                    success: false, data: null,
                    message: "Loan cannot be approved in its current state: {$loan->status}",
                    code: 400
                );
            }

            $now = date('Y-m-d H:i:s');

            DB::table('loans')->update([
                'status'      => 'approved',
                'approved_by' => $currentUser['id'],
                'approved_at' => $now,
            ], 'id', $loanId);

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Approved',
                "Your loan application has been approved.",
                'approved'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'approved', 'approved_by' => $currentUser['id'], 'approved_at' => $now],
                message: "Loan approved."
            );
        } catch (\Exception $e) {
            error_log("Loan approval error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to approve loan: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/reject
     * Admin-only fast-track rejection.
     * Roles: admin only
     */
    public function reject(int $orgId, int $loanId): mixed
    {
        try {
            $data            = json_decode(file_get_contents('php://input'), true);
            $rejectionReason = $data['rejection_reason'] ?? null;

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();
            if (!$currentUser) {
                return responseJson(success: false, data: null, message: "Authentication required", code: 401);
            }

            if ($currentUser['user_type'] !== 'admin') {
                return responseJson(
                    success: false, data: null,
                    message: "Direct rejection is restricted to admins. Use the step-by-step workflow.",
                    code: 403
                );
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            $terminalStatuses = ['approved', 'active', 'repaid', 'rejected'];
            if (in_array($loan->status, $terminalStatuses)) {
                return responseJson(
                    success: false, data: null,
                    message: "Loan cannot be rejected in its current state: {$loan->status}",
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

            $this->notify(
                (int) $loan->employee_id, $orgId, $loanId,
                'Loan Rejected',
                "Your loan application has been rejected" . ($rejectionReason ? ": {$rejectionReason}" : "."),
                'rejected'
            );

            return responseJson(
                success: true,
                data: ['loan_id' => $loanId, 'status' => 'rejected', 'rejected_at' => $now, 'reason' => $rejectionReason],
                message: "Loan rejected."
            );
        } catch (\Exception $e) {
            error_log("Loan rejection error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to reject loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — UPDATE / DELETE
    // =========================================================================

    /**
     * PUT/PATCH /organizations/{org_id}/loans/{loan_id}
     * Only loans in 'pending' or 'validated' may be edited.
     */
    public function update(int $orgId, int $loanId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if (!in_array($loan->status, ['pending', 'validated'])) {
                return responseJson(
                    success: false, data: null,
                    message: "Only pending or validated loans can be updated (current status: {$loan->status})",
                    code: 400
                );
            }

            $updateData = [];

            if (isset($data['amount'])) {
                $amount = (float) $data['amount'];
                if ($amount <= 0) {
                    return responseJson(success: false, data: null, message: "Amount must be greater than zero", code: 400);
                }
                $config = $this->getLoanConfig((int) $loan->config_id, $orgId);
                if ($config && $config->fixed_amount && $amount > (float) $config->fixed_amount) {
                    return responseJson(
                        success: false, data: null,
                        message: "Amount exceeds the maximum allowed: {$config->fixed_amount}", code: 400
                    );
                }
                $updateData['amount']            = $amount;
                $updateData['balance_remaining'] = $amount;
            }

            foreach (['monthly_deduction', 'interest_rate'] as $f) {
                if (isset($data[$f])) $updateData[$f] = $data[$f] !== '' ? (float) $data[$f] : null;
            }
            foreach (['start_date', 'end_date', 'purpose'] as $f) {
                if (isset($data[$f])) $updateData[$f] = $data[$f] ?: null;
            }

            if (empty($updateData)) {
                return responseJson(success: false, data: null, message: "No fields to update", code: 400);
            }

            DB::table('loans')->update($updateData, 'id', $loanId);

            return responseJson(success: true, data: null, message: "Loan updated successfully");
        } catch (\Exception $e) {
            return responseJson(success: false, data: null, message: "Failed to update loan: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * DELETE /organizations/{org_id}/loans/{loan_id}
     * Hard-delete — pending / validated only.
     */
    public function destroy(int $orgId, int $loanId): mixed
    {
        try {
            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if (!in_array($loan->status, ['pending', 'validated'])) {
                return responseJson(
                    success: false, data: null,
                    message: "Only pending or validated loans can be deleted",
                    code: 400
                );
            }

            DB::table('loans')->delete('id', $loanId);

            return responseJson(success: true, data: null, message: "Loan application deleted successfully");
        } catch (\Exception $e) {
            return responseJson(success: false, data: null, message: "Failed to delete loan: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — REPAYMENTS
    // =========================================================================

    /**
     * POST /organizations/{org_id}/loans/{loan_id}/repayments
     * Roles: admin, payroll_manager, payroll_officer, finance_manager
     */
    public function recordRepayment(int $orgId, int $loanId): mixed
    {
        try {
            $data = json_decode(file_get_contents('php://input'), true);

            if (empty($data['amount']) || empty($data['repayment_date'])) {
                return responseJson(success: false, data: null, message: "Fields 'amount' and 'repayment_date' are required", code: 400);
            }

            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            if (!in_array($loan->status, ['approved', 'active'])) {
                return responseJson(
                    success: false, data: null,
                    message: "Repayments can only be recorded against approved/active loans (current status: {$loan->status})",
                    code: 400
                );
            }

            $repaymentAmount = (float) $data['amount'];
            $currentBalance  = (float) $loan->balance_remaining;

            if ($repaymentAmount <= 0) {
                return responseJson(success: false, data: null, message: "Repayment amount must be greater than zero", code: 400);
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
                return responseJson(success: false, data: null, message: "method must be one of: manual, payroll_deduction", code: 400);
            }

            $currentUser = \App\Middleware\AuthMiddleware::getCurrentUser();

            $newBalance  = round($currentBalance - $repaymentAmount, 2);
            $newRepaid   = round((float) $loan->total_repaid + $repaymentAmount, 2);
            $isFullyPaid = $newBalance <= 0.00;

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

            $loanUpdate = [
                'balance_remaining' => $newBalance,
                'total_repaid'      => $newRepaid,
            ];
            if ($isFullyPaid) $loanUpdate['status'] = 'repaid';

            DB::table('loans')->update($loanUpdate, 'id', $loanId);

            if ($isFullyPaid) {
                $this->notify(
                    (int) $loan->employee_id, $orgId, $loanId,
                    'Loan Fully Repaid',
                    "Congratulations! Your loan has been fully repaid.",
                    'repaid'
                );
            }

            return responseJson(
                success: true,
                data: [
                    'loan_id'           => $loanId,
                    'repayment_amount'  => $repaymentAmount,
                    'balance_remaining' => $newBalance,
                    'total_repaid'      => $newRepaid,
                    'loan_status'       => $isFullyPaid ? 'repaid' : 'approved',
                    'fully_repaid'      => $isFullyPaid,
                ],
                message: $isFullyPaid
                    ? "Repayment recorded. Loan fully repaid!"
                    : "Repayment of {$repaymentAmount} recorded. Remaining balance: {$newBalance}",
                code: 201
            );
        } catch (\Exception $e) {
            error_log("Loan repayment error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to record repayment: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * GET /organizations/{org_id}/loans/{loan_id}/repayments
     */
    public function repaymentHistory(int $orgId, int $loanId): mixed
    {
        try {
            $validation = $this->getLoanWithValidation($loanId, $orgId);
            if (!$validation['success']) return $validation['data'];
            $loan = $validation['data'];

            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            $isPrivileged = in_array($currentUser['user_type'], [
                'admin', 'hr_manager', 'finance_manager', 'payroll_manager', 'payroll_officer', 'auditor',
            ]);

            if (!$isPrivileged && (int) $currentEmployee['id'] !== (int) $loan->employee_id) {
                return responseJson(success: false, data: null, message: "You can only view repayments for your own loans", code: 403);
            }

            $repayments = DB::raw(
                "SELECT
                    lr.id, lr.loan_id, lr.amount, lr.balance_after,
                    lr.repayment_date, lr.method, lr.notes, lr.payrun_id, lr.created_at,
                    u.username AS recorded_by_username,
                    COALESCE(CONCAT(rec_e.firstname,' ',rec_e.surname), u.username) AS recorded_by_name
                 FROM loan_repayments lr
                 LEFT JOIN users u ON lr.recorded_by = u.id
                 LEFT JOIN employees rec_e ON rec_e.user_id = u.id
                 WHERE lr.loan_id = :loan_id AND lr.organization_id = :org_id
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
            return responseJson(success: false, data: null, message: "Failed to fetch repayment history: " . $e->getMessage(), code: 500);
        }
    }

    // =========================================================================
    // PUBLIC — EMPLOYEE LOANS & LOAN TYPES
    // =========================================================================

    /**
     * GET /organizations/{org_id}/employees/{emp_id}/loans
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
                return responseJson(success: false, data: null, message: "Employee not found in this organization", code: 404);
            }

            $currentUser     = \App\Middleware\AuthMiddleware::getCurrentUser();
            $currentEmployee = \App\Middleware\AuthMiddleware::getCurrentEmployee();

            $canSeeAll = in_array($currentUser['user_type'], ['admin', 'hr_manager', 'finance_manager', 'payroll_manager', 'auditor']);

            if (!$canSeeAll) {
                if (in_array($currentUser['user_type'], ['hr_officer', 'payroll_officer', 'department_manager'])) {
                    $teamIds = $this->getTeamEmployeeIds((int) $currentEmployee['id']);
                    if (!in_array($empId, $teamIds)) {
                        return responseJson(success: false, data: null, message: "Access denied to this employee's loans", code: 403);
                    }
                } elseif ((int) $currentEmployee['id'] !== $empId) {
                    return responseJson(success: false, data: null, message: "You can only view your own loans", code: 403);
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
                "SELECT COUNT(*) as total FROM loans l {$this->loanJoins()} $whereClause", $params
            )[0]->total ?? 0;

            if ((int) $total === 0) {
                return responseJson(success: true, data: [], message: "No loans found", code: 200,
                    metadata: ['pagination' => ['total' => 0], 'employee_info' => [
                        'employee_id'   => $empId,
                        'employee_name' => trim(($employeeCheck[0]->firstname ?? '') . ' ' . ($employeeCheck[0]->surname ?? '')),
                    ]]);
            }

            $summary = DB::raw(
                "SELECT COUNT(*) AS total_loans,
                    COALESCE(SUM(amount), 0) AS total_loaned,
                    COALESCE(SUM(total_repaid), 0) AS total_repaid,
                    COALESCE(SUM(balance_remaining), 0) AS total_outstanding
                 FROM loans WHERE employee_id = :emp_id AND organization_id = :org_id",
                [':emp_id' => $empId, ':org_id' => $orgId]
            )[0] ?? null;

            $dataParams = array_merge($params, [':limit' => $perPage, ':offset' => $offset]);
            $loans = DB::raw(
                "SELECT {$this->loanSelectColumns()} FROM loans l {$this->loanJoins()}
                 $whereClause ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset",
                $dataParams
            );

            return responseJson(
                success: true,
                data: array_values(array_map(fn($loan) => $this->formatLoan($loan), $loans)),
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
                        'total_loans'       => (int) ($summary->total_loans ?? 0),
                        'total_loaned'      => (float) ($summary->total_loaned ?? 0),
                        'total_repaid'      => (float) ($summary->total_repaid ?? 0),
                        'total_outstanding' => (float) ($summary->total_outstanding ?? 0),
                    ],
                    'employee_info' => [
                        'employee_id'   => (int) $empId,
                        'employee_name' => trim(($employeeCheck[0]->firstname ?? '') . ' ' . ($employeeCheck[0]->surname ?? '')),
                        'email'         => $employeeCheck[0]->email ?? null,
                    ],
                ]
            );
        } catch (\Exception $e) {
            error_log("Employee loans error: " . $e->getMessage());
            return responseJson(success: false, data: null, message: "Failed to fetch employee loans: " . $e->getMessage(), code: 500);
        }
    }

    /**
     * GET /organizations/{org_id}/loan-types
     */
    public function getLoanTypes(int $orgId): mixed
    {
        try {
            $loanTypes = DB::raw(
                "SELECT id, name, percentage AS interest_rate, fixed_amount AS max_amount,
                        finance_threshold, settings, is_active, created_at
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
            return responseJson(success: false, data: null, message: "Failed to fetch loan types: " . $e->getMessage(), code: 500);
        }
    }
}