<?php

namespace App\Middleware;

use App\Services\PermissionService;

class OrganizationConfigAuthorizationMiddleware
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

        // Org-membership check removed here — AuthMiddleware::checkOrganizationAccess()
        // already verified $user['organization_id'] == $orgId for this request.

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
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri    = $_SERVER['REQUEST_URI']    ?? '';

        if (strpos($uri, '/approve') !== false || strpos($uri, '/reject') !== false || strpos($uri, '/pending') !== false) {
            return 'organization_configs.approve';
        }

        return $method === 'GET' ? 'organization_configs.view' : 'organization_configs.manage';
    }
}