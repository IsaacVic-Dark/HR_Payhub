<?php
// app/Middleware/OrganizationAuthorizationMiddleware.php
//
// This middleware's own allowedRoles list was the same for every HTTP
// method, but the ACTUAL per-method restriction already lives one layer up,
// in routes.php's own inline AuthMiddleware role arrays:
//   GET    /organizations/{id}         -> no extra role restriction
//   PUT    /organizations/{id}         -> ['admin', 'hr_manager', 'finance_manager']
//   DELETE /organizations/{id}         -> ['admin']
// Those inline arrays are untouched (still legacy user_type checks via
// AuthMiddleware's $roles param) — so the permission grants below are
// calibrated to match them exactly: organizations.view is held by the
// original 5-role read list, organizations.update by admin+hr_manager+
// finance_manager (matching the PUT route's array), organizations.delete
// by admin only (matching the DELETE route's array). If routes.php's inline
// arrays are ever removed in favor of this middleware alone, double check
// they still agree.

namespace App\Middleware;

use App\Services\PermissionService;

class OrganizationAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required and organization ID must be provided',
                code: 401
            );
        }

        // The old "super_admin blocked from org data" + "user belongs to
        // this org" checks are now both handled once, centrally, by
        // AuthMiddleware::checkOrganizationAccess() before this middleware
        // ever runs — no need to repeat either here.

        $method     = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $permission = match ($method) {
            'PUT', 'PATCH' => 'organizations.update',
            'DELETE'       => 'organizations.delete',
            default        => 'organizations.view',
        };

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: 'Insufficient permissions to access organization details',
                code: 403
            );
        }

        return $next($request);
    }
}