<?php

namespace App\Middleware;

use App\Services\DB;
use App\Services\PermissionService;

class EmployeeAuthorizationMiddleware
{
    public function handle($request, $next, $scope = 'read')
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $permission = $this->resolvePermission($scope, $request);

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(success: false, data: null, message: 'Access denied to this employee resource', code: 403);
        }

        $permScope = PermissionService::scopeOf($user['id'], $permission);

        if (isset($request['params'][1]) && is_numeric($request['params'][1])) {
            $targetEmployeeId = (int) $request['params'][1];

            $allowed = match ($permScope) {
                'team'  => $this->isEmployeeInManagerTeam($targetEmployeeId, $employee['id']),
                'own'   => (int) $targetEmployeeId === (int) $employee['id'],
                default => $this->isEmployeeInOrganization($targetEmployeeId, $orgId), // department/all
            };

            // Extra write-field checks that used to live under
            // canPayrollAccess()/canFinanceAccess() — unchanged, they inspect
            // $request['data'] keys rather than the user's role.
            if ($allowed && $scope === 'write') {
                if ($permission === 'employees.update_payroll_fields' && !$this->isPayrollRelatedUpdate($request)) {
                    $allowed = false;
                }
                if ($permission === 'employees.update_financial_fields' && !$this->isFinancialUpdate($request)) {
                    $allowed = false;
                }
            }

            if (!$allowed) {
                return responseJson(success: false, data: null, message: 'Access denied to this employee resource', code: 403);
            }
        }
        // Listing endpoints — controller applies the row filter (see
        // EmployeeController::applyRoleBasedFilters).

        return $next($request);
    }

    /**
     * The original middleware branched purely on $scope ('read'|'write') plus
     * which role-group the user was in (payroll/finance/manager/etc.) to
     * decide the applicable field-restriction message. Since PermissionService
     * now tells us the role directly via which permission the user holds, we
     * pick the most specific permission that's actually granted for reads;
     * for writes we mirror employees.update vs the two narrower field-level
     * permissions your matrix already encodes.
     */
    private function resolvePermission(string $scope, $request): string
    {
        if ($scope !== 'write') {
            return 'employees.view';
        }

        $user = AuthMiddleware::getCurrentUser();

        // Prefer the most specific write permission the user actually holds —
        // this matches the old canFinanceAccess/canPayrollAccess split without
        // needing to know the caller's role name.
        if (PermissionService::can($user['id'], 'employees.update_financial_fields')
            && !PermissionService::can($user['id'], 'employees.update')) {
            return 'employees.update_financial_fields';
        }

        if (PermissionService::can($user['id'], 'employees.update_payroll_fields')
            && !PermissionService::can($user['id'], 'employees.update')) {
            return 'employees.update_payroll_fields';
        }

        return 'employees.update';
    }

    private function isEmployeeInManagerTeam($employeeId, $managerId)
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count FROM employees
                 WHERE id = :employee_id AND reports_to = :manager_id AND status = 'active'",
                [':employee_id' => $employeeId, ':manager_id' => $managerId]
            );
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Manager team access check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isEmployeeInOrganization($employeeId, $orgId)
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count FROM employees WHERE id = :employee_id AND organization_id = :org_id",
                [':employee_id' => $employeeId, ':org_id' => $orgId]
            );
            return $result[0]->count > 0;
        } catch (\Exception $e) {
            error_log('Organization employee check error: ' . $e->getMessage());
            return false;
        }
    }

    private function isPayrollRelatedUpdate($request)
    {
        $payrollFields = ['base_salary', 'allowances', 'deductions', 'bank_account_number', 'tax_id'];

        if (isset($request['data'])) {
            foreach (array_keys($request['data']) as $field) {
                if (!in_array($field, $payrollFields, true)) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    private function isFinancialUpdate($request)
    {
        $financialFields = ['base_salary', 'bank_account_number', 'tax_id'];

        if (isset($request['data'])) {
            foreach (array_keys($request['data']) as $field) {
                if (!in_array($field, $financialFields, true)) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
}