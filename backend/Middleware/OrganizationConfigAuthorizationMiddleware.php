<?php

namespace App\Middleware;

use App\Services\DB;

class OrganizationConfigAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required',
                code: 401
            );
        }

        // Super admins cannot access organization data
        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organization data is restricted',
                code: 403
            );
        }

        // Check if user belongs to the organization
        if (!$this->userBelongsToOrganization($user['id'], $orgId)) {
            return responseJson(
                success: false,
                data: null,
                message: 'You do not have access to this organization',
                code: 403
            );
        }

        // Apply role-based access control based on the request method
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        if (!$this->hasPermission($user['user_type'], $method, $uri)) {
            return responseJson(
                success: false,
                data: null,
                message: 'You do not have permission to perform this action',
                code: 403
            );
        }

        return $next($request);
    }

    private function userBelongsToOrganization($userId, $orgId)
    {
        try {
            $query = "
                SELECT COUNT(*) as count 
                FROM users 
                WHERE id = :user_id 
                AND organization_id = :org_id
            ";

            $result = DB::raw($query, [
                ':user_id' => $userId,
                ':org_id' => $orgId
            ]);

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Organization check error: ' . $e->getMessage());
            return false;
        }
    }

    private function hasPermission($userType, $method, $uri)
    {
        // Define permissions based on user type
        $permissions = [
            'admin' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            'payroll_manager' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            'finance_manager' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            'auditor' => ['GET'],
            'hr_manager' => ['GET'],
            'hr_officer' => ['GET'],
            'payroll_officer' => ['GET'],
            'department_manager' => [],
            'employee' => []
        ];

        // Special approval permissions
        $approvalRoles = ['admin', 'payroll_manager', 'finance_manager'];
        
        // Check if this is an approval/rejection endpoint
        if (strpos($uri, '/approve') !== false || strpos($uri, '/reject') !== false) {
            return in_array($userType, $approvalRoles);
        }

        // Check if this is a pending approvals endpoint
        if (strpos($uri, '/pending') !== false) {
            return in_array($userType, $approvalRoles);
        }

        // Check general permissions
        if (!isset($permissions[$userType])) {
            return false;
        }

        return in_array($method, $permissions[$userType]);
    }
}