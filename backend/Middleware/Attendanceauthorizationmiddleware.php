<?php

namespace App\Middleware;

use App\Services\DB;

/**
 * Gates access to attendance, public-holiday, and overtime-approval routes.
 * $scope: 'read' | 'write' | 'approve' — passed from routes.php per-endpoint.
 *
 * Route param convention (matches EmployeeAuthorizationMiddleware):
 *   $request['params'][0] = org_id
 *   $request['params'][1] = employee_id  (when the route is employee-scoped)
 */
class AttendanceAuthorizationMiddleware
{
    public function handle($request, $next, $scope = 'read')
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        // Super admins cannot access organization data (privacy) — same rule as employees.
        if ($user['user_type'] === 'super_admin') {
            return responseJson(success: false, data: null, message: 'Access to organization data is restricted', code: 403);
        }

        switch ($user['user_type']) {
            case 'admin':
            case 'hr_manager':
                // Full read/write across the organization's attendance data.
                break;

            case 'payroll_manager':
            case 'payroll_officer':
                // Read + payroll-summary access; can approve/reject overtime;
                // cannot edit raw attendance/punches (that's HR's job).
                if ($scope === 'write' && !$this->isOvertimeOrHolidayDecisionRoute($request)) {
                    return responseJson(success: false, data: null, message: 'Payroll roles cannot edit attendance records directly', code: 403);
                }
                break;

            case 'department_manager':
                // Can view their own team's attendance only. No direct edits —
                // corrections go through HR.
                if ($scope === 'write') {
                    return responseJson(success: false, data: null, message: 'Department managers cannot edit attendance records', code: 403);
                }
                if (!$this->canManagerAccess($employee['id'], $request)) {
                    return responseJson(success: false, data: null, message: 'Access denied to this attendance record', code: 403);
                }
                break;

            case 'auditor':
            case 'compliance_officer':
                if ($scope !== 'read') {
                    return responseJson(success: false, data: null, message: 'Auditors have read-only access', code: 403);
                }
                break;

            case 'employee':
                // Employees may only check themselves in/out and view their own records.
                if (!$this->canEmployeeAccess($employee['id'], $request, $scope)) {
                    return responseJson(success: false, data: null, message: 'You can only manage your own attendance', code: 403);
                }
                break;

            default:
                return responseJson(success: false, data: null, message: 'Unknown user role', code: 403);
        }

        return $next($request);
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

    private function canEmployeeAccess($employeeId, $request, $scope)
    {
        // Self check-in/check-out routes carry no employee_id param — always allowed;
        // the controller derives the employee from the authenticated session.
        if (!isset($request['params'][1])) {
            return true;
        }

        if (is_numeric($request['params'][1])) {
            $targetEmployeeId = $request['params'][1];

            // Employees cannot submit manual punches or corrections for anyone (including themselves) —
            // manual entry is HR-only, so any 'write' hitting an employee-scoped route is denied here.
            if ($scope === 'write') {
                return false;
            }

            return (int) $targetEmployeeId === (int) $employeeId;
        }

        return true;
    }

    /**
     * Allows payroll roles through on the overtime-approval and
     * holiday-work-approval endpoints even though those are 'write' actions,
     * since approving overtime/holiday pay is squarely a payroll function.
     */
    private function isOvertimeOrHolidayDecisionRoute($request)
    {
        $path = $request['path'] ?? '';
        return (bool) preg_match('#(overtime-approvals/\d+/(approve|reject)|approve-holiday-work|reject-holiday-work)#', $path);
    }
}