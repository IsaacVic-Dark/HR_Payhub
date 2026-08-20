<?php

namespace App\Middleware;

use App\Services\DB;

/**
 * AllowanceTypeAuthorizationMiddleware
 *
 * Guards api/v1/organizations/{org_id}/allowance-types* — the org-level
 * allowance catalogue (Housing, Transport, etc). Modeled on
 * OrganizationConfigAuthorizationMiddleware: this is configuration, not a
 * per-employee workflow, so access is simpler than EmployeeAllowanceAuthorizationMiddleware.
 *
 *   - Read (GET):            broad — anyone authenticated in the org can see
 *                             what allowance types exist.
 *   - Write (POST/PUT/PATCH/DELETE): admin, payroll_manager only.
 */
class AllowanceTypeAuthorizationMiddleware
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

        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organisation data is restricted',
                code: 403
            );
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? '';

        $writeRoles = ['admin', 'payroll_manager'];

        if ($method !== 'GET' && !in_array($user['user_type'], $writeRoles, true)) {
            return responseJson(
                success: false,
                data: null,
                message: 'Only admins or payroll managers can manage allowance types',
                code: 403
            );
        }

        return $next($request);
    }
}