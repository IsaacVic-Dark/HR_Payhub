<?php
// app/Middleware/LoanAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class LoanAuthorizationMiddleware
{
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

        // Super admins cannot access organization data
        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organization data is restricted',
                code: 403
            );
        }

        switch ($user['user_type']) {
            // Full org visibility + approve/reject
            case 'admin':
            case 'hr_manager':
            case 'finance_manager':
            case 'payroll_manager':
            case 'payroll_officer':
            case 'auditor':
                break;

            // Department/team visibility; cannot approve/reject
            case 'hr_officer':
            case 'department_manager':
                if (!$this->canManagerAccess($employee['id'], $request)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this loan resource',
                        code: 403
                    );
                }
                break;

            // Own loans only; cannot approve/reject
            case 'employee':
                if (!$this->canEmployeeAccess($employee['id'], $request)) {
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

    // -------------------------------------------------------------------------

    private function canManagerAccess($managerId, $request): bool
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        // Managers cannot approve or reject loans
        if (strpos($uri, '/approve') !== false || strpos($uri, '/reject') !== false) {
            return false;
        }

        // When accessing a specific loan, confirm it belongs to their team
        if (isset($request['params']['loan_id']) && is_numeric($request['params']['loan_id'])) {
            return $this->isLoanInManagerTeam((int) $request['params']['loan_id'], (int) $managerId);
        }

        // For listing, allow (controller applies team scope)
        return true;
    }

    // -------------------------------------------------------------------------

    private function canEmployeeAccess($employeeId, $request): bool
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        // Employees cannot approve or reject loans
        if (strpos($uri, '/approve') !== false || strpos($uri, '/reject') !== false) {
            return false;
        }

        // When accessing a specific loan, confirm it belongs to them
        if (isset($request['params']['loan_id']) && is_numeric($request['params']['loan_id'])) {
            return $this->isEmployeeLoan((int) $request['params']['loan_id'], (int) $employeeId);
        }

        // For listing, allow (controller applies employee_id scope)
        return true;
    }

    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------

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