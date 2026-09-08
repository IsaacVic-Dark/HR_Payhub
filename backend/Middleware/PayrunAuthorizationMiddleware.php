<?php

namespace App\Middleware;

use App\Services\PermissionService;

class PayrunAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? '';

        $isFinalize = preg_match('#/payrun/\d+/finalize$#', $uri);
        $isReviewOrProcess = preg_match('#/payrun/\d+/(review|process)$#', $uri);

        if ($isFinalize) {
            $permission = 'payruns.finalize';
        } elseif ($isReviewOrProcess || $method !== 'GET') {
            $permission = 'payruns.process';
        } else {
            $permission = 'payruns.view';
        }

        if (!PermissionService::can($user['id'], $permission)) {
            $messages = [
                'payruns.finalize' => 'Only admins, payroll managers, or finance managers can finalize payruns',
                'payruns.process'  => 'You do not have permission to modify payruns',
                'payruns.view'     => 'You do not have permission to view payruns',
            ];
            return responseJson(success: false, data: null, message: $messages[$permission], code: 403);
        }

        return $next($request);
    }
}