<?php
// app/Middleware/LeaveAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class LeaveAuthorizationMiddleware
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

        // Apply role-based access control
        switch ($user['user_type']) {
            case 'admin':
            case 'hr_manager':
            case 'hr_officer':
                // These roles can access all leaves in their organization
                break;

            case 'department_manager':
                // Managers can access their team's leaves and leaves pending their approval
                if (!$this->canManagerAccess($employee['id'], $request)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this leave resource',
                        code: 403
                    );
                }
                break;

            case 'employee':
                // Employees can only access their own leaves
                if (!$this->canEmployeeAccess($employee['id'], $request)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You can only access your own leaves',
                        code: 403
                    );
                }
                break;

            default:
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Unknown user role',
                    code: 403
                );
        }

        return $next($request);
    }

    private function canManagerAccess($managerId, $request)
    {
        // For approval/rejection endpoints, check if leave is from their team
        if (isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $leaveId = $request['params']['id'];

            // Check if this is an approval/rejection action
            $uri = $_SERVER['REQUEST_URI'] ?? '';
            if (strpos($uri, '/approve') !== false || strpos($uri, '/reject') !== false) {
                return $this->isLeaveInManagerTeam($leaveId, $managerId);
            }

            // For viewing, also allow if leave is from their team
            return $this->isLeaveInManagerTeam($leaveId, $managerId);
        }

        // For listing, allow (filtering will be done in controller)
        return true;
    }

    private function canEmployeeAccess($employeeId, $request)
    {
        // Employees cannot approve/reject leaves
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        if (strpos($uri, '/approve') !== false || strpos($uri, '/reject') !== false) {
            return false;
        }

        // For viewing specific leave
        if (isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $leaveId = $request['params']['id'];
            return $this->isEmployeeLeave($leaveId, $employeeId);
        }

        // For listing, allow (filtering will be done in controller)
        return true;
    }

    private function isLeaveInManagerTeam($leaveId, $managerId)
    {
        try {
            $query = "
                SELECT COUNT(*) as count 
                FROM leaves l
                INNER JOIN employees e ON l.employee_id = e.id
                WHERE l.id = :leave_id 
                AND e.reports_to = :manager_id
                AND e.status = 'active'
            ";

            $result = DB::raw($query, [
                ':leave_id' => $leaveId,
                ':manager_id' => $managerId
            ]);

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Manager access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isEmployeeLeave($leaveId, $employeeId)
    {
        try {
            $query = "
                SELECT COUNT(*) as count 
                FROM leaves 
                WHERE id = :leave_id 
                AND employee_id = :employee_id
            ";

            $result = DB::raw($query, [
                ':leave_id' => $leaveId,
                ':employee_id' => $employeeId
            ]);

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Employee access check error: ' . $e->getMessage());
            return false;
        }
    }
}
