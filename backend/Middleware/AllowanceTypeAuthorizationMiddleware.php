<?php

namespace App\Middleware;

use App\Services\PermissionService;

/**
 * AllowanceTypeAuthorizationMiddleware
 *
 * Guards api/v1/organizations/{org_id}/allowance-types* — org-level config,
 * so there's no row-level scoping here, just "can you read" vs "can you write".
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

        $method     = $_SERVER['REQUEST_METHOD'] ?? '';
        $permission = $method === 'GET' ? 'allowance_types.view' : 'allowance_types.manage';

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: $permission === 'allowance_types.manage'
                    ? 'Only admins or payroll managers can manage allowance types'
                    : 'You do not have permission to view allowance types',
                code: 403
            );
        }

        return $next($request);
    }
}