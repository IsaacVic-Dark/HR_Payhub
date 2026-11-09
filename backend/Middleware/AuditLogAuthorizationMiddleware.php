<?php
// app/Middleware/AuditLogAuthorizationMiddleware.php

namespace App\Middleware;

class AuditLogAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required',
                code: 401
            );
        }

        // Audit logs are visible to organization admins only.
        // (super_admin is intentionally excluded: no access to organization data.)
        if ($user['user_type'] !== 'admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'You do not have permission to access audit logs',
                code: 403
            );
        }

        return $next($request);
    }
}
