<?php
// app/Middleware/LoanAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

/**
 * LoanAuthorizationMiddleware
 *
 * Role permission matrix (referencing modern payroll SaaS conventions):
 *
 * super_admin       — SaaS platform admin; NO access to any organisation's loan data.
 * admin             — Org-level admin; full access including fast-track approve/reject.
 * hr_manager        — Full org visibility; Step 3 (manager) + Step 4 (HR) approvals; appeal reviews.
 * hr_officer        — Team visibility only; read-only on loans; cannot approve/reject.
 * finance_manager   — Full org visibility; Step 5 (Finance) approval; disbursement setup.
 *                     NOTE: finance_director is not a DB role — it maps to finance_manager.
 * payroll_manager   — Full org visibility; disbursement setup; record repayments; cannot approve loans.
 * payroll_officer   — Full org visibility (read); record repayments only; cannot approve/reject.
 * auditor           — Full org visibility; read-only across all loan data; no mutations.
 * department_manager — Team visibility; Step 3 (manager approve/reject) for direct reports only.
 * employee          — Own loans only; submit applications; submit appeals; cannot approve/reject.
 */
class LoanAuthorizationMiddleware
{
    // Endpoints that write approval decisions (only approver roles may call these)
    private const APPROVE_REJECT_PATTERNS = [
        '/manager-approve', '/manager-reject',
        '/hr-approve',      '/hr-reject',      '/hr-flag-compliance',
        '/finance-approve', '/finance-reject',
        '/approve',         '/reject',          '/appeal/review',
    ];

    // Endpoints only finance_manager / payroll_manager / admin may call
    private const DISBURSE_PATTERN = '/disburse';

    // Endpoints only payroll_officer+ may call
    private const REPAYMENT_WRITE_PATTERN = '/repayments';

    // Appeal submission endpoint
    private const APPEAL_SUBMIT_PATTERN = '/appeal';

    public function handle($request, $next)
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required',
                code: 401
            );
        }

        // super_admin has zero access to org loan data
        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organisation data is restricted for platform administrators',
                code: 403
            );
        }

        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        switch ($user['user_type']) {

            // -----------------------------------------------------------------
            // admin — full access including fast-track /approve and /reject
            // -----------------------------------------------------------------
            case 'admin':
                break;

            // -----------------------------------------------------------------
            // hr_manager — full org visibility + Step 3 manager actions
            //              + Step 4 HR actions + appeal reviews
            //              (acts as line manager when no dept manager exists)
            // -----------------------------------------------------------------
            case 'hr_manager':
                // Blocked only from disbursement — that belongs to finance/payroll
                if ($this->matchesPattern($uri, self::DISBURSE_PATTERN) && $method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'HR Managers cannot set up disbursements',
                        code: 403
                    );
                }
                break;

            // -----------------------------------------------------------------
            // finance_manager — full org visibility + Step 5 Finance approval
            //                   + disbursement setup + repayment recording
            //                   (finance_director maps here — not a separate DB role)
            // -----------------------------------------------------------------
            case 'finance_manager':
                // finance_manager may NOT do manager or HR step approvals
                if ($this->matchesAnyPattern($uri, ['/manager-approve', '/manager-reject', '/hr-approve', '/hr-reject', '/hr-flag-compliance', '/appeal/review'])) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Finance Managers cannot perform manager or HR approval actions',
                        code: 403
                    );
                }
                break;

            // -----------------------------------------------------------------
            // payroll_manager — full org visibility + disbursement setup
            //                   + repayment recording; cannot approve loans
            // -----------------------------------------------------------------
            case 'payroll_manager':
                if ($this->isApproveOrRejectEndpoint($uri)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Payroll Managers cannot approve or reject loan applications',
                        code: 403
                    );
                }
                break;

            // -----------------------------------------------------------------
            // payroll_officer — read-only on loans + record repayments
            //                   cannot approve, reject, or disburse
            // -----------------------------------------------------------------
            case 'payroll_officer':
                // Allow repayment recording (POST /repayments)
                if ($this->matchesPattern($uri, self::REPAYMENT_WRITE_PATTERN) && $method === 'POST') {
                    break;
                }
                // Block all other write operations
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Payroll Officers can only record repayments and read loan data',
                        code: 403
                    );
                }
                break;

            // -----------------------------------------------------------------
            // auditor — read-only across all loan data; no mutations whatsoever
            // -----------------------------------------------------------------
            case 'auditor':
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Auditors have read-only access to loan data',
                        code: 403
                    );
                }
                break;

            // -----------------------------------------------------------------
            // hr_officer — team-scoped read-only; cannot approve/reject/mutate
            // -----------------------------------------------------------------
            case 'hr_officer':
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'HR Officers have read-only access to loan data',
                        code: 403
                    );
                }
                // For specific loan access, verify it belongs to their team
                if (isset($request['params']['loan_id']) && is_numeric($request['params']['loan_id'])) {
                    if (!$this->isLoanInManagerTeam((int) $request['params']['loan_id'], (int) $employee['id'])) {
                        return responseJson(
                            success: false,
                            data: null,
                            message: 'Access denied to this loan resource',
                            code: 403
                        );
                    }
                }
                break;

            // -----------------------------------------------------------------
            // department_manager — team-scoped visibility
            //                      + Step 3 manager approve/reject for direct reports
            // -----------------------------------------------------------------
            case 'department_manager':
                if (!$this->canDeptManagerAccess($employee['id'], $request, $uri, $method)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this loan resource',
                        code: 403
                    );
                }
                break;

            // -----------------------------------------------------------------
            // employee — own loans only + submit applications + submit appeals
            // -----------------------------------------------------------------
            case 'employee':
                if (!$this->canEmployeeAccess($employee['id'], $request, $uri, $method)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You can only access your own loans',
                        code: 403
                    );
                }
                break;

            default:
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Unknown user role',
                    code: 403
                );
        }

        return $next($request);
    }

    // =========================================================================
    // PATTERN HELPERS
    // =========================================================================

    private function matchesPattern(string $uri, string $pattern): bool
    {
        return strpos($uri, $pattern) !== false;
    }

    private function matchesAnyPattern(string $uri, array $patterns): bool
    {
        foreach ($patterns as $pattern) {
            if ($this->matchesPattern($uri, $pattern)) return true;
        }
        return false;
    }

    /**
     * Returns true if the URI hits any approval/rejection endpoint.
     * Used to block roles that must not approve or reject loans.
     */
    private function isApproveOrRejectEndpoint(string $uri): bool
    {
        return $this->matchesAnyPattern($uri, self::APPROVE_REJECT_PATTERNS);
    }

    // =========================================================================
    // DEPARTMENT MANAGER ACCESS LOGIC
    // =========================================================================

    /**
     * Department managers can:
     *   - Read any loan belonging to their direct reports
     *   - Approve or reject at the manager step (Step 3) for their direct reports
     *   - Cannot disburse, cannot do HR/Finance steps, cannot record repayments
     */
    private function canDeptManagerAccess($managerId, $request, string $uri, string $method): bool
    {
        // Explicitly block non-Step-3 approval actions
        $blockedActions = [
            '/hr-approve', '/hr-reject', '/hr-flag-compliance',
            '/finance-approve', '/finance-reject',
            '/approve', '/reject',           // legacy fast-track (admin only)
            '/appeal/review',
            '/disburse',
            '/repayments',                   // no repayment recording
        ];

        if ($this->matchesAnyPattern($uri, $blockedActions) && $method !== 'GET') {
            return false;
        }

        // When accessing a specific loan, confirm it belongs to their team
        if (isset($request['params']['loan_id']) && is_numeric($request['params']['loan_id'])) {
            return $this->isLoanInManagerTeam(
                (int) $request['params']['loan_id'],
                (int) $managerId
            );
        }

        // For listing, allow (controller applies team scope)
        return true;
    }

    // =========================================================================
    // EMPLOYEE ACCESS LOGIC
    // =========================================================================

    /**
     * Employees can:
     *   - Read their own loans (GET)
     *   - Submit a loan application (POST to /employees/{id}/loans)
     *   - Submit an appeal (POST to /loans/{id}/appeal)
     *   - Cannot approve, reject, disburse, or record repayments
     */
    private function canEmployeeAccess($employeeId, $request, string $uri, string $method): bool
    {
        // Employees may never approve, reject, disburse, or review appeals
        $blockedActions = array_merge(
            self::APPROVE_REJECT_PATTERNS,
            [self::DISBURSE_PATTERN, self::REPAYMENT_WRITE_PATTERN]
        );

        // Exception: appeal *submission* (/appeal without /review) is allowed
        $isAppealSubmit = $this->matchesPattern($uri, self::APPEAL_SUBMIT_PATTERN)
            && !$this->matchesPattern($uri, '/appeal/review')
            && $method === 'POST';

        if (!$isAppealSubmit && $method !== 'GET') {
            // Allow POST to /employees/{id}/loans (the application route)
            $isLoanApplication = preg_match('#/employees/\d+/loans$#', $uri) && $method === 'POST';
            if (!$isLoanApplication) {
                return false;
            }
        }

        // When accessing a specific loan, confirm it belongs to them
        if (isset($request['params']['loan_id']) && is_numeric($request['params']['loan_id'])) {
            return $this->isEmployeeLoan(
                (int) $request['params']['loan_id'],
                (int) $employeeId
            );
        }

        return true;
    }

    // =========================================================================
    // DB HELPERS
    // =========================================================================

    private function isLoanInManagerTeam(int $loanId, int $managerId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) AS count
                 FROM loans l
                 INNER JOIN employees e ON l.employee_id = e.id
                 WHERE l.id = :loan_id
                   AND e.reports_to = :manager_id
                   AND e.status = 'active'",
                [':loan_id' => $loanId, ':manager_id' => $managerId]
            );

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Manager loan access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isEmployeeLoan(int $loanId, int $employeeId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) AS count
                 FROM loans
                 WHERE id = :loan_id AND employee_id = :employee_id",
                [':loan_id' => $loanId, ':employee_id' => $employeeId]
            );

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Employee loan access check error: ' . $e->getMessage());
            return false;
        }
    }
}