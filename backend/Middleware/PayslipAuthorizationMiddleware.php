<?php

namespace App\Middleware;

use App\Services\DB;
use App\Services\PermissionService;

class PayslipAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        // super_admin's old "read-only, cross-tenant" carve-out is gone —
        // AuthMiddleware::checkOrganizationAccess() already blocks platform
        // accounts from any org-scoped route before this middleware runs.

        $permission = $this->resolvePermission();

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(success: false, data: null, message: $this->denyMessage($permission), code: 403);
        }

        $scope = PermissionService::scopeOf($user['id'], $permission);

        if ($permission === 'payslips.view' && $this->isSinglePayslipRoute() && in_array($scope, ['own', 'team', 'department'], true)) {
            if (!isset($request['params']['id']) || !is_numeric($request['params']['id'])) {
                return $next($request); // listing — controller filters by scope
            }

            $payslipId = (int) $request['params']['id'];

            $allowed = match ($scope) {
                'own'        => $this->isOwnPayslip($payslipId, $employee['id']),
                'team'       => $this->isOwnPayslip($payslipId, $employee['id']) || $this->isPayslipInManagerTeam($payslipId, $employee['id']),
                'department' => $this->isOwnPayslip($payslipId, $employee['id']) || $this->isPayslipInOfficerDept($payslipId, $employee['id']),
            };

            if (!$allowed) {
                return responseJson(success: false, data: null, message: 'Access denied to this payslip', code: 403);
            }
        }

        return $next($request);
    }

    private function resolvePermission(): string
    {
        $uri    = $_SERVER['REQUEST_URI']    ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        if ($this->isGenerateRoute($uri) && $method === 'POST') return 'payslips.generate';
        if ($this->isBulkSendRoute($uri))                        return 'payslips.bulk_send';
        if ($this->isSendRoute($uri) && $method === 'POST')      return 'payslips.send';
        if ($this->isPdfPathRoute($uri) && $method === 'PATCH')  return 'payslips.update_pdf_path';
        if ($this->isStatisticsRoute($uri))                      return 'payslips.statistics';

        return 'payslips.view';
    }

    private function denyMessage(string $permission): string
    {
        return match ($permission) {
            'payslips.generate'        => 'You cannot generate payslips',
            'payslips.bulk_send'       => 'You cannot bulk-send payslips',
            'payslips.send'            => 'You cannot send payslips',
            'payslips.update_pdf_path' => 'You cannot update PDF paths',
            'payslips.statistics'      => 'You cannot access payslip statistics',
            default                    => 'Access denied to this payslip',
        };
    }

    // =========================================================================
    // Route pattern helpers — unchanged from the original
    // =========================================================================

    private function isSafeReadMethod(): bool
    {
        return in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS']);
    }

    private function isSinglePayslipRoute(): bool
    {
        return (bool) preg_match('#/payslips/(\d+)#', $_SERVER['REQUEST_URI'] ?? '');
    }

    private function isGenerateRoute(string $uri): bool
    {
        return strpos($uri, '/payslips/generate') !== false;
    }

    private function isSendRoute(string $uri): bool
    {
        return strpos($uri, '/send') !== false && !strpos($uri, '/bulk-send');
    }

    private function isBulkSendRoute(string $uri): bool
    {
        return strpos($uri, '/bulk-send') !== false;
    }

    private function isPdfPathRoute(string $uri): bool
    {
        return strpos($uri, '/pdf-path') !== false;
    }

    private function isStatisticsRoute(string $uri): bool
    {
        return strpos($uri, '/statistics') !== false;
    }

    // =========================================================================
    // DB checks — unchanged from the original
    // =========================================================================

    private function isOwnPayslip(int $payslipId, int $employeeId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count FROM payslips WHERE id = :payslip_id AND employee_id = :employee_id",
                [':payslip_id' => $payslipId, ':employee_id' => $employeeId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log("Own payslip check error: " . $e->getMessage());
            return false;
        }
    }

    private function isPayslipInManagerTeam(int $payslipId, int $managerId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count
                 FROM payslips ps
                 INNER JOIN employees e ON ps.employee_id = e.id
                 WHERE ps.id = :payslip_id AND e.reports_to = :manager_id AND e.status = 'active'",
                [':payslip_id' => $payslipId, ':manager_id' => $managerId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log("Manager payslip check error: " . $e->getMessage());
            return false;
        }
    }

    private function isPayslipInOfficerDept(int $payslipId, int $officerEmployeeId): bool
    {
        try {
            $result = DB::raw(
                "SELECT COUNT(*) as count
                 FROM payslips ps
                 INNER JOIN employees emp_target ON ps.employee_id = emp_target.id
                 INNER JOIN employees emp_officer ON emp_officer.id = :officer_id
                 WHERE ps.id = :payslip_id
                   AND emp_target.department_id = emp_officer.department_id
                   AND emp_target.status = 'active'",
                [':payslip_id' => $payslipId, ':officer_id' => $officerEmployeeId]
            );
            return ($result[0]->count ?? 0) > 0;
        } catch (\Exception $e) {
            error_log("Officer dept check error: " . $e->getMessage());
            return false;
        }
    }
}