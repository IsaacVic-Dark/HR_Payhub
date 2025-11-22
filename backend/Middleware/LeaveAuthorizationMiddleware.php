<?php
// app/Middleware/LeaveAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class LeaveAuthorizationMiddleware
{
    public function handle($request, $next, $scope = 'read')
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

        // Super admins cannot access organization data (privacy)
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
                // Admins can access all leaves in their organization
                break;
                
            case 'manager':
                // Managers can access their team's leaves
                if (!$this->canManagerAccess($employee['id'], $request, $scope)) {
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
                if (!$this->canEmployeeAccess($employee['id'], $request, $scope)) {
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

    private function canManagerAccess($managerId, $request, $scope)
    {
        // If accessing specific leave, check if it belongs to manager's team
        if (isset($request['params'][0]) && is_numeric($request['params'][0])) {
            $leaveId = $request['params'][0];
            return $this->isLeaveInManagerTeam($leaveId, $managerId);
        }

        // For listing, managers can see their team's leaves
        // This will be handled in the controller with proper filtering
        return true;
    }

    private function canEmployeeAccess($employeeId, $request, $scope)
    {
        // Employees can only access their own leaves
        if (isset($request['params'][0]) && is_numeric($request['params'][0])) {
            $leaveId = $request['params'][0];
            return $this->isEmployeeLeave($leaveId, $employeeId);
        }

        // For listing, employees will only see their own leaves
        // This will be handled in the controller
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
            ";
            
            $result = DB::raw($query, [
                ':leave_id' => $leaveId,
                ':manager_id' => $managerId
            ]);
            
            return $result[0]->count > 0;
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
            
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Employee access check error: ' . $e->getMessage());
            return false;
        }
    }
}