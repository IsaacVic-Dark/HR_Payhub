<?php
// app/Middleware/DepartmentAuthorizationMiddleware.php

namespace App\Middleware;

class DepartmentAuthorizationMiddleware
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
        $uri    = $_SERVER['REQUEST_URI']    ?? '';

        // Determine specific actions from URI
        $isAssignHead    = preg_match('#/departments/\d+/assign-head$#', $uri);
        $isListEmployees = preg_match('#/departments/\d+/employees$#',   $uri);

        switch ($user['user_type']) {

            // Full access — create, read, update, deactivate, assign head
            case 'admin':
            case 'hr_manager':
                break;

            // Read-only access + list employees in any department
            case 'payroll_manager':
            case 'payroll_officer':
            case 'finance_manager':
            case 'accountant':
            case 'auditor':
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You do not have permission to modify departments',
                        code: 403
                    );
                }
                break;

            // Can only view their own department and its employees (enforced in controller)
            case 'department_manager':
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You do not have permission to modify departments',
                        code: 403
                    );
                }
                break;

            // Employees have no access
            case 'employee':
                return responseJson(
                    success: false,
                    data: null,
                    message: 'You do not have permission to access department data',
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