<?php
// app/Middleware/PayrollAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class PayrollAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

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

        // Apply role-based access control
        switch ($user['user_type']) {
            case 'admin':
            case 'payroll_manager':
            case 'payroll_officer':
            case 'finance_manager':
                // These roles can access all payrolls in their organization
                break;

            case 'employee':
                // Employees can only access their own payrolls
                if (!$this->canEmployeeAccess($employee['id'], $request)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You can only access your own payrolls',
                        code: 403
                    );
                }
                break;

            default:
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Insufficient permissions to access payrolls',
                    code: 403
                );
        }

        return $next($request);
    }

    private function canEmployeeAccess($employeeId, $request)
    {
        // Employees cannot approve or mark payrolls as paid
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        if (strpos($uri, '/approve') !== false || strpos($uri, '/pay') !== false) {
            return false;
        }

        // For viewing specific payroll
        if (isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $payrollId = $request['params']['id'];
            return $this->isEmployeePayroll($payrollId, $employeeId);
        }

        // For listing, allow (filtering will be done in controller)
        return true;
    }

    private function isEmployeePayroll($payrollId, $employeeId)
    {
        try {
            $query = "
                SELECT COUNT(*) as count 
                FROM payrolls 
                WHERE id = :payroll_id 
                AND employee_id = :employee_id
            ";

            $result = DB::raw($query, [
                ':payroll_id' => $payrollId,
                ':employee_id' => $employeeId
            ]);

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Employee payroll access check error: ' . $e->getMessage());
            return false;
        }
    }
}

