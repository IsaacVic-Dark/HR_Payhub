<?php

namespace App\Middleware;

use App\Services\DB;
use App\Services\PermissionService;

/**
 * $action: 'read' | 'write' | 'approve' — still passed from routes.php per
 * endpoint exactly as before (e.g. ['AttendanceAuthorizationMiddleware', 'write']).
 * It's now just one input (alongside the URI) used to pick the right
 * permission — the actual allow/deny + scoping decision is PermissionService's
 * job, not a switch on user_type.
 */
class AttendanceAuthorizationMiddleware
{
    public function handle($request, $next, $action = 'read')
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $permission = $this->resolvePermission($request, $action);

        if (!PermissionService::can($user['id'], $permission)) {
            $message = $permission === 'attendance.write'
                ? 'You do not have permission to edit attendance records'
                : 'You do not have permission to perform this action';
            return responseJson(success: false, data: null, message: $message, code: 403);
        }

        // Self check-in/out and overtime-approval carry no row-level scoping
        // beyond "can you do this at all", which the check above covers.
        if (!in_array($permission, ['attendance.check_in_out', 'attendance.approve_overtime'], true)) {
            $scope = PermissionService::scopeOf($user['id'], $permission);

            if ($scope === 'team' && !$this->canManagerAccess($employee['id'], $request)) {
                return responseJson(success: false, data: null, message: 'Access denied to this attendance record', code: 403);
            }

            if ($scope === 'own' && !$this->canEmployeeAccess($employee['id'], $request, $permission)) {
                return responseJson(success: false, data: null, message: 'You can only manage your own attendance', code: 403);
            }
        }

        return $next($request);
    }

    private function resolvePermission($request, string $action): string
    {
        if ($this->isOvertimeOrHolidayDecisionRoute($request)) {
            return 'attendance.approve_overtime';
        }

        if ($action === 'write') {
            // No employee_id param => self check-in/out. Has one => a manual
            // punch/correction being made on someone's record (HR-only in
            // the default matrix, via attendance.write with scope 'all').
            return isset($request['params'][1]) ? 'attendance.write' : 'attendance.check_in_out';
        }

        return 'attendance.view';
    }

    private function canManagerAccess($managerId, $request)
    {
        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $employeeId = $request['params'][1];

            $result = DB::raw(
                "SELECT COUNT(*) as count FROM employees
                 WHERE id = :employee_id AND reports_to = :manager_id AND status = 'active'",
                [':employee_id' => $employeeId, ':manager_id' => $managerId]
            );

            return $result[0]->count > 0;
        }

        // Listing endpoints — controller must additionally filter to team members.
        return true;
    }

    private function canEmployeeAccess($employeeId, $request, string $permission)
    {
        if (!isset($request['params'][1])) {
            return true;
        }

        if (is_numeric($request['params'][1])) {
            $targetEmployeeId = $request['params'][1];

            if ($permission === 'attendance.write') {
                // Manual entry is never self-service, even for your own record.
                return false;
            }

            return (int) $targetEmployeeId === (int) $employeeId;
        }

        return true;
    }

    private function isOvertimeOrHolidayDecisionRoute($request)
    {
        $path = $request['path'] ?? '';
        return (bool) preg_match('#(overtime-approvals/\d+/(approve|reject)|approve-holiday-work|reject-holiday-work)#', $path);
    }
}