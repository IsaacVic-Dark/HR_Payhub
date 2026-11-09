<?php

namespace App\Middleware;

use App\Services\DB;
use App\Services\Templates\TemplateAuditLogger;

/**
 * Authorisation for GET /organizations/{org_id}/payslips/{id}/download.
 *
 * Kept separate from PayslipAuthorizationMiddleware on purpose: that class
 * reads $request['params']['id'] but the router passes positional params,
 * so its per-payslip scope checks never see an id. This middleware reads the
 * positional values directly.
 *
 *   org-wide    : admin, payroll_manager, finance_manager, auditor
 *   own department: payroll_officer, hr_manager, hr_officer
 *   own team    : department_manager (plus their own payslip)
 *   own only    : employee
 *
 * The tenant check always applies: the URL org must be the caller's org AND
 * the payslip must belong to that org.
 */
class PayslipDownloadMiddleware
{
    public function handle($request, $next)
    {
        $user     = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }
        if (($user['user_type'] ?? '') === 'super_admin') {
            return responseJson(success: false, data: null, message: 'Access to organisation data is restricted', code: 403);
        }

        $urlOrg    = $request['params'][0] ?? null;
        $payslipId = $request['params'][1] ?? null;
        if (!ctype_digit((string) $urlOrg) || (int) $urlOrg !== (int) $orgId || !ctype_digit((string) $payslipId)) {
            return $this->deny($user, (int) $orgId, (int) $payslipId, 'organization_mismatch');
        }

        $rows = DB::raw(
            'SELECT employee_id FROM payslips WHERE id = :id AND organization_id = :org LIMIT 1',
            [':id' => (int) $payslipId, ':org' => (int) $orgId]
        );
        if (!$rows) {
            // Same answer whether it does not exist or belongs to someone else: no enumeration.
            return responseJson(success: false, data: null, message: 'Payslip not found', code: 404);
        }
        $targetEmployeeId = (int) $rows[0]->employee_id;
        $myEmployeeId     = $employee['id'] ?? null;

        $allowed = false;
        switch ($user['user_type']) {
            case 'admin':
            case 'payroll_manager':
            case 'finance_manager':
            case 'auditor':
                $allowed = true;
                break;

            case 'payroll_officer':
            case 'hr_manager':
            case 'hr_officer':
                $allowed = $myEmployeeId && ($targetEmployeeId === (int) $myEmployeeId || $this->sameDepartment((int) $orgId, (int) $myEmployeeId, $targetEmployeeId));
                break;

            case 'department_manager':
                $allowed = $myEmployeeId && ($targetEmployeeId === (int) $myEmployeeId || $this->reportsTo((int) $orgId, $targetEmployeeId, (int) $myEmployeeId));
                break;

            case 'employee':
                $allowed = $myEmployeeId && $targetEmployeeId === (int) $myEmployeeId;
                break;
        }

        if (!$allowed) {
            return $this->deny($user, (int) $orgId, (int) $payslipId, 'payslip_scope');
        }
        return $next($request);
    }

    private function sameDepartment(int $orgId, int $myEmployeeId, int $targetEmployeeId): bool
    {
        $r = DB::raw(
            'SELECT t.id FROM employees t INNER JOIN employees m ON m.id = :me AND m.organization_id = :o1
              WHERE t.id = :target AND t.organization_id = :o2 AND m.department_id IS NOT NULL AND t.department_id = m.department_id LIMIT 1',
            [':me' => $myEmployeeId, ':o1' => $orgId, ':target' => $targetEmployeeId, ':o2' => $orgId]
        );
        return !empty($r);
    }

    private function reportsTo(int $orgId, int $targetEmployeeId, int $managerId): bool
    {
        $r = DB::raw(
            'SELECT id FROM employees WHERE id = :t AND organization_id = :o AND reports_to = :m LIMIT 1',
            [':t' => $targetEmployeeId, ':o' => $orgId, ':m' => $managerId]
        );
        return !empty($r);
    }

    private function deny(array $user, int $ownOrgId, int $payslipId, string $reason)
    {
        TemplateAuditLogger::log($ownOrgId, (int) $user['id'], 'payslip', $payslipId, 'access_denied', [
            'reason'    => $reason,
            'path'      => parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH),
            'user_type' => $user['user_type'] ?? null,
        ]);
        return responseJson(success: false, data: null, message: 'You do not have access to this payslip', code: 403);
    }
}
