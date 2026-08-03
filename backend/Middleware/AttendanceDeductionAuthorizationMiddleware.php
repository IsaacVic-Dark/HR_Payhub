<?php
// app/Middleware/AttendanceDeductionAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

/**
 * Resource-level authorization for attendance_deductions, mirroring
 * LeaveAuthorizationMiddleware. Route-level role gating (routes.php)
 * already restricts /waive and /reverse to admin + hr_manager; this
 * middleware adds the same "can this specific user touch this specific
 * row" check that LeaveAuthorizationMiddleware does for leaves, and
 * covers read-access scoping for index/show.
 */
class AttendanceDeductionAuthorizationMiddleware
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

        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Access to organization data is restricted',
                code: 403
            );
        }

        $uri      = $_SERVER['REQUEST_URI'] ?? '';
        $isWrite  = strpos($uri, '/waive') !== false || strpos($uri, '/reverse') !== false;

        switch ($user['user_type']) {
            case 'admin':
            case 'hr_manager':
                // Full read/write access within their organization
                break;

            case 'hr_officer':
            case 'payroll_manager':
            case 'payroll_officer':
            case 'finance_manager':
            case 'auditor':
            case 'compliance_officer':
                // Full read access, but waive/reverse are HR-manager-and-up actions
                if ($isWrite) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Only admin or hr_manager can waive or reverse an attendance deduction',
                        code: 403
                    );
                }
                break;

            case 'department_manager':
            case 'manager':
                if ($isWrite) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Only admin or hr_manager can waive or reverse an attendance deduction',
                        code: 403
                    );
                }
                if (!$this->canManagerAccess($employee['id'], $request)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Access denied to this attendance deduction resource',
                        code: 403
                    );
                }
                break;

            case 'employee':
                if ($isWrite) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Only admin or hr_manager can waive or reverse an attendance deduction',
                        code: 403
                    );
                }
                if (!$this->canEmployeeAccess($employee['id'], $request)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You can only view your own attendance deductions',
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
        if (isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $deductionId = $request['params']['id'];
            return $this->isDeductionInManagerTeam($deductionId, $managerId);
        }

        // For listing, allow — filtering happens in the controller
        return true;
    }

    private function canEmployeeAccess($employeeId, $request)
    {
        if (isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $deductionId = $request['params']['id'];
            return $this->isEmployeeDeduction($deductionId, $employeeId);
        }

        // For listing, allow — filtering happens in the controller
        return true;
    }

    private function isDeductionInManagerTeam($deductionId, $managerId)
    {
        try {
            $query = "
                SELECT COUNT(*) as count
                FROM attendance_deductions ad
                INNER JOIN employees e ON ad.employee_id = e.id
                WHERE ad.id = :deduction_id
                AND e.reports_to = :manager_id
                AND e.status = 'active'
            ";

            $result = DB::raw($query, [
                ':deduction_id' => $deductionId,
                ':manager_id'   => $managerId
            ]);

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Manager access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isEmployeeDeduction($deductionId, $employeeId)
    {
        try {
            $query = "
                SELECT COUNT(*) as count
                FROM attendance_deductions
                WHERE id = :deduction_id
                AND employee_id = :employee_id
            ";

            $result = DB::raw($query, [
                ':deduction_id' => $deductionId,
                ':employee_id'  => $employeeId
            ]);

            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log('Employee access check error: ' . $e->getMessage());
            return false;
        }
    }
}