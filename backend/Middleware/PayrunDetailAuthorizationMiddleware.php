<?php

namespace App\Middleware;

use App\Services\PermissionService;

class PayrunDetailAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $method     = $_SERVER['REQUEST_METHOD'] ?? '';
        $permission = 'payrun_details.view';

        // The original only ever allowed GET for department_manager/employee,
        // and full read+write for everyone else who reaches this middleware.
        // There's no separate "manage payrun details" permission in the
        // catalog (nothing in routes.php actually writes through this
        // endpoint independently of PayrunController), so: any non-GET
        // request requires the broader payruns.process permission.
        if ($method !== 'GET') {
            $permission = 'payruns.process';
        }

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: $permission === 'payruns.process'
                    ? 'You do not have permission to modify payrun details'
                    : 'You do not have permission to view payrun details',
                code: 403
            );
        }

        // scope ('own' for department_manager/employee) is applied by
        // PayrunController's own queries, same as before.

        return $next($request);
    }
}