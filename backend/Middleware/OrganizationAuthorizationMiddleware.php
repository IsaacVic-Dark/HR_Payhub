<?php
// app/Middleware/OrganizationAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class OrganizationAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user = AuthMiddleware::getCurrentUser();
        // $orgId = isset($request['params']['org_id']) ? $request['params']['org_id'] : null;
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required and organization ID must be provided',
                code: 401
            );
        }

        // Super admins cannot access organization data (privacy)
        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organization data is restricted',
                code: 403
            );
        }

        // Verify user belongs to the requested organization
        if ($user['organization_id'] != $orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Access denied to this organization',
                code: 403
            );
        }

        // Apply role-based access control
        $allowedRoles = ['admin', 'hr_manager', 'payroll_manager', 'finance_manager', 'auditor'];
        
        if (!in_array($user['user_type'], $allowedRoles)) {
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