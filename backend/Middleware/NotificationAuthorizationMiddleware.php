<?php
// app/Middleware/NotificationAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class NotificationAuthorizationMiddleware
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
                // Admins can access all notifications in their organization
                break;
                
            case 'hr_manager':
                // HR Managers can access all notifications
                break;
                
            case 'payroll_manager':
            case 'payroll_officer':
                // Payroll roles can access payroll-related notifications
                if (!$this->canPayrollAccessNotification($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this notification',
                        code: 403
                    );
                }
                break;
                
            case 'department_manager':
                // Department managers can access their team's notifications
                if (!$this->canManagerAccessNotification($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this notification',
                        code: 403
                    );
                }
                break;
                
            case 'employee':
                // Employees can only access their own notifications
                if (!$this->canEmployeeAccessNotification($employee['id'], $request, $scope)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You can only access your own notifications',
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

    private function canPayrollAccessNotification($payrollUserId, $request, $scope)
    {
        // Payroll roles can access payroll-related notifications
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $notificationId = $request['params'][1];
            return $this->isPayrollRelatedNotification($notificationId);
        }

        // For listing, payroll can see all payroll-related notifications
        return true;
    }

    private function canManagerAccessNotification($managerId, $request, $scope)
    {
        // Department managers can access notifications for their team members
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $notificationId = $request['params'][1];
            return $this->isNotificationForManagerTeam($notificationId, $managerId);
        }

        // For listing, managers can see their team's notifications
        return true;
    }

    private function canEmployeeAccessNotification($employeeId, $request, $scope)
    {
        // Employees can only access their own notifications
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $notificationId = $request['params'][1];
            return $this->isNotificationForEmployee($notificationId, $employeeId);
        }

        // For listing, employees should only see their own notifications
        return true;
    }

    private function isPayrollRelatedNotification($notificationId)
    {
        try {
            $orgId = AuthMiddleware::getCurrentOrganizationId();
            
            $query = "
                SELECT COUNT(*) as count 
                FROM notifications 
                WHERE id = :notification_id 
                AND organization_id = :org_id
                AND type IN ('salary', 'tax', 'loan', 'advance', 'refund', 'per_diem')
            ";
            
            $result = DB::raw($query, [
                ':notification_id' => $notificationId,
                ':org_id' => $orgId
            ]);
            
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Payroll notification access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isNotificationForManagerTeam($notificationId, $managerId)
    {
        try {
            $orgId = AuthMiddleware::getCurrentOrganizationId();
            
            $query = "
                SELECT COUNT(*) as count 
                FROM notifications n
                INNER JOIN employees e ON n.employee_id = e.id
                WHERE n.id = :notification_id 
                AND n.organization_id = :org_id
                AND e.reports_to = :manager_id
                AND e.status = 'active'
            ";
            
            $result = DB::raw($query, [
                ':notification_id' => $notificationId,
                ':org_id' => $orgId,
                ':manager_id' => $managerId
            ]);
            
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Manager notification access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isNotificationForEmployee($notificationId, $employeeId)
    {
        try {
            $orgId = AuthMiddleware::getCurrentOrganizationId();
            
            $query = "
                SELECT COUNT(*) as count 
                FROM notifications 
                WHERE id = :notification_id 
                AND employee_id = :employee_id
                AND organization_id = :org_id
            ";
            
            $result = DB::raw($query, [
                ':notification_id' => $notificationId,
                ':employee_id' => $employeeId,
                ':org_id' => $orgId
            ]);
            
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Employee notification access check error: ' . $e->getMessage());
            return false;
        }
    }
}