<?php

namespace App\Middleware;

use App\Services\PermissionService;

/**
 * EmployeeAllowanceAuthorizationMiddleware
 *
 * Row-level scoping (own/department) is left to
 * EmployeeAllowanceController::index(), which already filters by
 * employee_id / department_id — see the accompanying controller diff.
 */
class EmployeeAllowanceAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $permission = $this->resolvePermission();

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: 'You do not have permission to perform this action',
                code: 403
            );
        }

        return $next($request);
    }

    private function resolvePermission(): string
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        $uri    = $_SERVER['REQUEST_URI']    ?? '';

        $map = [
            '#/employee-allowances/\d+/approve$#'        => 'employee_allowances.approve',
            '#/employee-allowances/\d+/reject$#'         => 'employee_allowances.approve',
            '#/employee-allowances/\d+/suspend$#'        => 'employee_allowances.suspend',
            '#/employee-allowances/\d+/cancel$#'         => 'employee_allowances.cancel',
            '#/employee-allowances/\d+/submit$#'         => 'employee_allowances.submit',
            '#/employee-allowances/\d+/attach-payrun$#'  => 'employee_allowances.attach_payrun',
            '#/employee-allowances/\d+/detach-payrun$#'  => 'employee_allowances.attach_payrun',
        ];

        foreach ($map as $pattern => $permission) {
            if (preg_match($pattern, $uri)) {
                return $permission;
            }
        }

        return match ($method) {
            'GET'          => 'employee_allowances.view',
            'POST'         => 'employee_allowances.create',
            'PUT', 'PATCH' => 'employee_allowances.update',
            default        => 'employee_allowances.view',
        };
    }
}