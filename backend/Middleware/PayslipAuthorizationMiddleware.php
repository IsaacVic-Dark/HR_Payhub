<?php
// app/Middleware/PayslipAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class PayslipAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false, data: null,
                message: 'Authentication required', code: 401
            );
        }

        // Super admins get read-only, cross-tenant supervision — no mutations
        if ($user['user_type'] === 'super_admin') {
            if (!$this->isSafeReadMethod()) {
                return responseJson(
                    success: false, data: null,
                    message: 'Super admins have read-only access to payslip data',
                    code: 403
                );
            }
            // Allow read through — no further scope checks needed for super_admin
            return $next($request);
        }

        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        // ── Route-level permission matrix ─────────────────────────────────────
        switch ($user['user_type']) {

            case 'admin':
                // Full access: read, create (generate), send, bulk-send, pdf-path, stats
                break;

            case 'payroll_manager':
                // Full access within org: same as admin for payslips
                break;

            case 'hr_manager':
                // Read dept payslips, no generate/delete, no bulk ops
                if ($this->isGenerateRoute($uri) && $method === 'POST') {
                    return $this->deny('HR managers cannot generate payslips');
                }
                if ($this->isBulkSendRoute($uri)) {
                    return $this->deny('HR managers cannot bulk-send payslips');
                }
                break;

            case 'hr_officer':
                // Read assigned-dept payslips, send (to distribute), no generate
                if ($this->isGenerateRoute($uri) && $method === 'POST') {
                    return $this->deny('HR officers cannot generate payslips');
                }
                if ($this->isStatisticsRoute($uri)) {
                    return $this->deny('HR officers cannot access payslip statistics');
                }
                // Scope check for single payslip access
                if ($this->isSinglePayslipRoute($uri) && $method === 'GET') {
                    if (!$this->canOfficerAccessPayslip($employee['id'], $request)) {
                        return $this->deny('Access denied to this payslip');
                    }
                }
                break;

            case 'payroll_officer':
                // Read assigned-dept payslips, generate, send — no bulk-send, no delete
                if ($this->isBulkSendRoute($uri)) {
                    return $this->deny('Payroll officers cannot bulk-send payslips');
                }
                if ($this->isStatisticsRoute($uri)) {
                    return $this->deny('Payroll officers cannot access payslip statistics');
                }
                if ($this->isSinglePayslipRoute($uri) && $method === 'GET') {
                    if (!$this->canOfficerAccessPayslip($employee['id'], $request)) {
                        return $this->deny('Access denied to this payslip');
                    }
                }
                break;

            case 'finance_manager':
                // Read all in org + approve (statistics). No create/generate/send.
                if ($this->isGenerateRoute($uri) && $method === 'POST') {
                    return $this->deny('Finance managers cannot generate payslips');
                }
                if ($this->isSendRoute($uri) && $method === 'POST') {
                    return $this->deny('Finance managers cannot send payslips');
                }
                if ($this->isBulkSendRoute($uri)) {
                    return $this->deny('Finance managers cannot bulk-send payslips');
                }
                if ($this->isPdfPathRoute($uri) && $method === 'PATCH') {
                    return $this->deny('Finance managers cannot update PDF paths');
                }
                break;

            case 'auditor':
                // Read-only for all payslips in org
                if (!$this->isSafeReadMethod()) {
                    return $this->deny('Auditors have read-only access to payslips');
                }
                break;

            case 'department_manager':
                // Read own + dept payslips; dept-level approve (acknowledge); no generate/send/delete
                if ($this->isGenerateRoute($uri) && $method === 'POST') {
                    return $this->deny('Department managers cannot generate payslips');
                }
                if ($this->isSendRoute($uri) || $this->isBulkSendRoute($uri)) {
                    return $this->deny('Department managers cannot send payslips');
                }
                if ($this->isPdfPathRoute($uri) && $method === 'PATCH') {
                    return $this->deny('Department managers cannot update PDF paths');
                }
                if ($this->isStatisticsRoute($uri)) {
                    return $this->deny('Department managers cannot access org-wide payslip statistics');
                }
                // Scope check: can only see own + team payslips
                if ($this->isSinglePayslipRoute($uri) && $method === 'GET') {
                    if (!$this->canManagerAccessPayslip($employee['id'], $request)) {
                        return $this->deny('Access denied to this payslip');
                    }
                }
                break;

            case 'employee':
                // Own payslips only. Can read + acknowledge. No mutations.
                if ($this->isGenerateRoute($uri) && $method === 'POST') {
                    return $this->deny('Employees cannot generate payslips');
                }
                if ($this->isSendRoute($uri) || $this->isBulkSendRoute($uri)) {
                    return $this->deny('Employees cannot send payslips');
                }
                if ($this->isPdfPathRoute($uri) && $method === 'PATCH') {
                    return $this->deny('Employees cannot update PDF paths');
                }
                if ($this->isStatisticsRoute($uri)) {
                    return $this->deny('Employees cannot access payslip statistics');
                }
                // Scope check: employees can only access their own payslips
                if ($this->isSinglePayslipRoute($uri)) {
                    if (!$this->canEmployeeAccessPayslip($employee['id'], $request)) {
                        return $this->deny('You can only access your own payslips');
                    }
                }
                break;

            default:
                return $this->deny('Unknown user role');
        }

        return $next($request);
    }

    // =========================================================================
    // Route pattern helpers
    // =========================================================================

    private function isSafeReadMethod(): bool
    {
        return in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS']);
    }

    private function isSinglePayslipRoute(string $uri): bool
    {
        // Matches /payslips/{id} or /payslips/{id}/... (not /payslips/generate or /payslips/bulk-send)
        return (bool) preg_match('#/payslips/(\d+)#', $uri);
    }

    private function isGenerateRoute(string $uri): bool
    {
        return strpos($uri, '/payslips/generate') !== false;
    }

    private function isSendRoute(string $uri): bool
    {
        return strpos($uri, '/send') !== false && !strpos($uri, '/bulk-send');
    }

    private function isBulkSendRoute(string $uri): bool
    {
        return strpos($uri, '/bulk-send') !== false;
    }

    private function isPdfPathRoute(string $uri): bool
    {
        return strpos($uri, '/pdf-path') !== false;
    }

    private function isStatisticsRoute(string $uri): bool
    {
        return strpos($uri, '/statistics') !== false;
    }

    // =========================================================================
    // Scope check helpers
    // =========================================================================

    /**
     * Employee can only access their own payslips.
     */
    private function canEmployeeAccessPayslip(int $employeeId, $request): bool
    {
        if (!isset($request['params']['id']) || !is_numeric($request['params']['id'])) {
            return false;
        }

        return $this->isOwnPayslip((int) $request['params']['id'], $employeeId);
    }

    /**
     * Department manager can access own payslips + team payslips (reports_to).
     */
    private function canManagerAccessPayslip(int $managerId, $request): bool
    {
        if (!isset($request['params']['id']) || !is_numeric($request['params']['id'])) {
            return true; // listing — filtered in controller
        }

        $payslipId = (int) $request['params']['id'];

        // Own payslip is always accessible
        if ($this->isOwnPayslip($payslipId, $managerId)) {
            return true;
        }

        return $this->isPayslipInManagerTeam($payslipId, $managerId);
    }

    /**
     * HR/Payroll officers can access payslips of employees in their department.
     */
    private function canOfficerAccessPayslip(int $officerEmployeeId, $request): bool
    {
        if (!isset($request['params']['id']) || !is_numeric($request['params']['id'])) {
            return true; // listing — filtered in controller
        }

        $payslipId = (int) $request['params']['id'];

        if ($this->isOwnPayslip($payslipId, $officerEmployeeId)) {
            return true;
        }

        return $this->isPayslipInOfficerDept($payslipId, $officerEmployeeId);
    }

    // =========================================================================
    // DB checks
    // =========================================================================

    private function isOwnPayslip(int $payslipId, int $employeeId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count FROM payslips
                 WHERE id = :payslip_id AND employee_id = :employee_id",
                [':payslip_id' => $payslipId, ':employee_id' => $employeeId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log("Own payslip check error: " . $e->getMessage());
            return false;
        }
    }

    private function isPayslipInManagerTeam(int $payslipId, int $managerId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count
                 FROM payslips ps
                 INNER JOIN employees e ON ps.employee_id = e.id
                 WHERE ps.id = :payslip_id
                   AND e.reports_to = :manager_id
                   AND e.status = 'active'",
                [':payslip_id' => $payslipId, ':manager_id' => $managerId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log("Manager payslip check error: " . $e->getMessage());
            return false;
        }
    }

    private function isPayslipInOfficerDept(int $payslipId, int $officerEmployeeId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count
                 FROM payslips ps
                 INNER JOIN employees emp_target ON ps.employee_id = emp_target.id
                 INNER JOIN employees emp_officer ON emp_officer.id = :officer_id
                 WHERE ps.id = :payslip_id
                   AND emp_target.department_id = emp_officer.department_id
                   AND emp_target.status = 'active'",
                [':payslip_id' => $payslipId, ':officer_id' => $officerEmployeeId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log("Officer dept check error: " . $e->getMessage());
            return false;
        }
    }

    // =========================================================================
    // Helper
    // =========================================================================

    private function deny(string $message): mixed
    {
        return responseJson(
            success: false, data: null,
            message: $message, code: 403
        );
    }
}