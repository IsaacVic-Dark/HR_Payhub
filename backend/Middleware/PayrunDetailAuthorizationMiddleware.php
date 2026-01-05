<?php
// app/Middleware/PayrunDetailAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class PayrunDetailAuthorizationMiddleware
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
                // These roles can access all payrun details
                break;

            case 'finance_manager':
            case 'accountant':
                // Finance roles can view payrun details
                break;

            case 'department_manager':
            case 'employee':
                // These roles have limited access - only view
                $method = $_SERVER['REQUEST_METHOD'] ?? '';
                
                // Only allow GET requests
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You do not have permission to modify payrun details',
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
}

