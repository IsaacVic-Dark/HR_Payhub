<?php

namespace App\Middleware;

use App\Services\PermissionService;

class DepartmentAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user = AuthMiddleware::getCurrentUser();

        if (!$user) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? '';

        $isListEmployees = (bool) preg_match('#/departments/\d+/employees$#', $uri);
        $permission = $isListEmployees
            ? 'departments.view_employees'
            : ($method === 'GET' ? 'departments.view' : 'departments.manage');

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: $permission === 'departments.manage'
                    ? 'You do not have permission to modify departments'
                    : 'You do not have permission to access department data',
                code: 403
            );
        }

        // scope === 'own' (department_manager) is checked in DepartmentController
        // itself (it needs to confirm the specific department_id is the one
        // this manager heads) — see the accompanying controller diff.

        return $next($request);
    }
}