<?php

namespace App\Middleware;

use App\Services\PermissionService;

class JobTitleAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user = AuthMiddleware::getCurrentUser();

        if (!$user) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $method     = $_SERVER['REQUEST_METHOD'] ?? '';
        $permission = $method === 'GET' ? 'job_titles.view' : 'job_titles.manage';

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: $permission === 'job_titles.manage'
                    ? 'You do not have permission to modify job titles'
                    : 'You do not have permission to access job title data',
                code: 403
            );
        }

        return $next($request);
    }
}