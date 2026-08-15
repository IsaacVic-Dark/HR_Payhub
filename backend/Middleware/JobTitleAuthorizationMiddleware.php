<?php

namespace App\Middleware;

class JobTitleAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required',
                code: 401
            );
        }

        // Super admins cannot access organisation data
        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organisation data is restricted',
                code: 403
            );
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? '';

        switch ($user['user_type']) {

            // Full access — create, read, update, delete job titles
            case 'admin':
            case 'hr_manager':
                break;

            // Read-only access
            case 'payroll_manager':
            case 'payroll_officer':
            case 'finance_manager':
            case 'accountant':
            case 'auditor':
            case 'department_manager':
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You do not have permission to modify job titles',
                        code: 403
                    );
                }
                break;

            // Employees have no access
            case 'employee':
                return responseJson(
                    success: false,
                    data: null,
                    message: 'You do not have permission to access job title data',
                    code: 403
                );

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
}