<?php

namespace App\Controllers;

use App\Services\DB;
use App\Middleware\AuthMiddleware;

class NotificationController
{
    public function index($request)
    {
        // Get organization ID from the authenticated user
        $orgId = AuthMiddleware::getCurrentOrganizationId();
        $user = AuthMiddleware::getCurrentUser();

        if (!$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Organization ID not found',
                code: 400
            );
        }

        // Base SQL query with organization filter
        $query = "
            SELECT 
                notifications.*, 
                employees.email AS employee_email,
                users.first_name,
                users.surname
            FROM notifications
            INNER JOIN employees ON notifications.employee_id = employees.id
            INNER JOIN users ON employees.user_id = users.id
            WHERE notifications.organization_id = :org_id
        ";

        // Apply role-based filtering
        $params = [':org_id' => $orgId];

        switch ($user['user_type']) {
            case 'admin':
            case 'hr_manager':
                // Admins and HR can see all notifications in their organization
                break;
                
            case 'payroll_manager':
            case 'payroll_officer':
                // Payroll roles can only see payroll-related notifications
                $query .= " AND notifications.type IN ('salary', 'tax', 'loan', 'advance', 'refund', 'per_diem')";
                break;
                
            case 'department_manager':
                // Department managers can see notifications for their team
                $employee = AuthMiddleware::getCurrentEmployee();
                $query .= " AND employees.reports_to = :manager_id";
                $params[':manager_id'] = $employee['id'];
                break;
                
            case 'employee':
                // Employees can only see their own notifications
                $employee = AuthMiddleware::getCurrentEmployee();
                $query .= " AND notifications.employee_id = :employee_id";
                $params[':employee_id'] = $employee['id'];
                break;
                
            default:
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Unauthorized access',
                    code: 403
                );
        }

        $query .= " ORDER BY notifications.created_at DESC";

        // Fetch data
        $notifications = DB::raw($query, $params);

        // Count unread notifications
        $unreadQuery = "
            SELECT COUNT(*) as unread_count 
            FROM notifications 
            WHERE organization_id = :org_id 
            AND is_read = 0
        ";
        
        $unreadParams = [':org_id' => $orgId];
        
        // Apply same role-based filtering for unread count
        switch ($user['user_type']) {
            case 'payroll_manager':
            case 'payroll_officer':
                $unreadQuery .= " AND type IN ('salary', 'tax', 'loan', 'advance', 'refund', 'per_diem')";
                break;
                
            case 'department_manager':
                $employee = AuthMiddleware::getCurrentEmployee();
                $unreadQuery .= " AND employee_id IN (
                    SELECT id FROM employees WHERE reports_to = :manager_id
                )";
                $unreadParams[':manager_id'] = $employee['id'];
                break;
                
            case 'employee':
                $employee = AuthMiddleware::getCurrentEmployee();
                $unreadQuery .= " AND employee_id = :employee_id";
                $unreadParams[':employee_id'] = $employee['id'];
                break;
        }

        $unreadResult = DB::raw($unreadQuery, $unreadParams);
        $unreadCount = $unreadResult[0]->unread_count ?? 0;

        // Send JSON response
        return responseJson(
            data: [
                'notifications' => $notifications,
                'unread_count' => $unreadCount
            ],
            message: "Fetched Notifications Successfully"
        );
    }

    public function show($request)
    {
        $orgId = AuthMiddleware::getCurrentOrganizationId();
        $notificationId = $request['params'][1] ?? null;

        if (!$notificationId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Notification ID is required',
                code: 400
            );
        }

        $query = "
            SELECT 
                notifications.*, 
                employees.email AS employee_email,
                users.first_name,
                users.surname
            FROM notifications
            INNER JOIN employees ON notifications.employee_id = employees.id
            INNER JOIN users ON employees.user_id = users.id
            WHERE notifications.id = :notification_id
            AND notifications.organization_id = :org_id
        ";

        $notification = DB::raw($query, [
            ':notification_id' => $notificationId,
            ':org_id' => $orgId
        ]);

        if (empty($notification)) {
            return responseJson(
                success: false,
                data: null,
                message: 'Notification not found',
                code: 404
            );
        }

        return responseJson(
            data: $notification[0],
            message: "Notification fetched successfully"
        );
    }

    public function markAsRead($request)
    {
        $orgId = AuthMiddleware::getCurrentOrganizationId();
        $notificationId = $request['params'][1] ?? null;

        if (!$notificationId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Notification ID is required',
                code: 400
            );
        }

        // Update notification
        $query = "
            UPDATE notifications 
            SET is_read = 1, updated_at = NOW()
            WHERE id = :notification_id 
            AND organization_id = :org_id
        ";

        try {
            DB::raw($query, [
                ':notification_id' => $notificationId,
                ':org_id' => $orgId
            ]);

            return responseJson(
                data: null,
                message: "Notification marked as read"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to mark notification as read: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    public function markAllAsRead($request)
    {
        $orgId = AuthMiddleware::getCurrentOrganizationId();
        $user = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();

        // Build query based on user role
        $query = "
            UPDATE notifications 
            SET is_read = 1, updated_at = NOW()
            WHERE organization_id = :org_id
        ";

        $params = [':org_id' => $orgId];

        // Apply role-based filtering
        switch ($user['user_type']) {
            case 'employee':
                // Employees can only mark their own notifications as read
                $query .= " AND employee_id = :employee_id";
                $params[':employee_id'] = $employee['id'];
                break;
                
            case 'department_manager':
                // Managers can mark their team's notifications as read
                $query .= " AND employee_id IN (
                    SELECT id FROM employees WHERE reports_to = :manager_id
                )";
                $params[':manager_id'] = $employee['id'];
                break;
        }

        try {
            DB::raw($query, $params);

            return responseJson(
                data: null,
                message: "All notifications marked as read"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to mark notifications as read: ' . $e->getMessage(),
                code: 500
            );
        }
    }

    public function destroy($request)
    {
        $orgId = AuthMiddleware::getCurrentOrganizationId();
        $notificationId = $request['params'][1] ?? null;

        if (!$notificationId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Notification ID is required',
                code: 400
            );
        }

        $query = "
            DELETE FROM notifications 
            WHERE id = :notification_id 
            AND organization_id = :org_id
        ";

        try {
            DB::raw($query, [
                ':notification_id' => $notificationId,
                ':org_id' => $orgId
            ]);

            return responseJson(
                data: null,
                message: "Notification deleted successfully"
            );
        } catch (\Exception $e) {
            return responseJson(
                success: false,
                data: null,
                message: 'Failed to delete notification: ' . $e->getMessage(),
                code: 500
            );
        }
    }
}