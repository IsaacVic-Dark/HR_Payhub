<?php
// app/Middleware/AttendanceDeductionAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;
use App\Services\PermissionService;

class AttendanceDeductionAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $uri  = $_SERVER['REQUEST_URI'] ?? '';
        $isWrite = strpos($uri, '/waive') !== false || strpos($uri, '/reverse') !== false;

        $permission = $isWrite ? 'attendance_deductions.waive' : 'attendance_deductions.view';

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: $isWrite
                    ? 'Only admin or hr_manager can waive or reverse an attendance deduction'
                    : 'You do not have permission to view attendance deductions',
                code: 403
            );
        }

        $scope = PermissionService::scopeOf($user['id'], $permission);

        if (in_array($scope, ['own', 'team'], true) && isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $deductionId = $request['params']['id'];

            $allowed = $scope === 'own'
                ? $this->isEmployeeDeduction($deductionId, $employee['id'])
                : $this->isDeductionInManagerTeam($deductionId, $employee['id']);

            if (!$allowed) {
                return responseJson(success: false, data: null, message: 'Access denied to this attendance deduction resource', code: 403);
            }
        }

        return $next($request);
    }

    private function isDeductionInManagerTeam($deductionId, $managerId)
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count
                 FROM attendance_deductions ad
                 INNER JOIN employees e ON ad.employee_id = e.id
                 WHERE ad.id = :deduction_id AND e.reports_to = :manager_id AND e.status = 'active'",
                [':deduction_id' => $deductionId, ':manager_id' => $managerId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Manager access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isEmployeeDeduction($deductionId, $employeeId)
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count FROM attendance_deductions WHERE id = :deduction_id AND employee_id = :employee_id",
                [':deduction_id' => $deductionId, ':employee_id' => $employeeId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Employee access check error: ' . $e->getMessage());
            return false;
        }
    }
}