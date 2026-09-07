<?php

namespace App\Middleware;

use App\Services\DB;
use App\Services\PermissionService;

class LeaveAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required',
                code: 401
            );
        }

        // Note: the old `super_admin` org-data block is no longer checked
        // here — AuthMiddleware::checkOrganizationAccess() already rejects
        // any org-scoped request from a platform-account user before this
        // middleware ever runs.

        $permission = $this->resolvePermission($request);

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: 'You do not have permission to perform this action',
                code: 403
            );
        }

        $scope = PermissionService::scopeOf($user['id'], $permission);

        if (in_array($scope, ['own', 'team'], true) && isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $leaveId = $request['params']['id'];

            $allowed = $scope === 'own'
                ? $this->isEmployeeLeave($leaveId, $employee['id'])
                : $this->isLeaveInManagerTeam($leaveId, $employee['id']);

            if (!$allowed) {
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Access denied to this leave resource',
                    code: 403
                );
            }
        }
        // For listing endpoints (no :id param) we let the request through —
        // LeaveController::applyRoleBasedFilters() applies the row filter
        // based on the same scope (see the accompanying controller diff).

        return $next($request);
    }

    /**
     * Map the incoming request to the single permission that governs it.
     */
    private function resolvePermission($request): string
    {
        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? '';

        if (strpos($uri, '/leave-types') !== false) {
            return $method === 'GET' ? 'leave_types.view' : 'leave_types.manage';
        }

        if (preg_match('#/leaves/\d+/(approve|reject)$#', $uri)) {
            return 'leaves.approve';
        }

        if (preg_match('#/leaves/\d+/cancel$#', $uri)) {
            return 'leaves.cancel';
        }

        if (preg_match('#/leaves/\d+/assign-reliever$#', $uri)) {
            return 'leaves.assign_reliever';
        }

        return match ($method) {
            'GET'              => 'leaves.view',
            'POST'             => 'leaves.create',
            'PUT', 'PATCH'     => 'leaves.update',
            'DELETE'           => 'leaves.delete',
            default            => 'leaves.view',
        };
    }

    // -------------------------------------------------------------------
    // Unchanged from the original middleware — same queries, same intent.
    // -------------------------------------------------------------------

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