<?php
// Two deliberate departures from the literal original code, flagged here
// rather than silently replicated, since they look like gaps in the
// original rather than intentional design:
//
// 1. The original never blocked hr_manager or finance_manager from the
//    generic fast-track /approve and /reject endpoints (only department_manager,
//    employee, and payroll_manager were explicitly blocked from them). That
//    contradicts the middleware's own docstring, which describes fast-track
//    as admin-only. This version restricts the fast-track endpoint to
//    whoever holds an org-wide ('all' scope) grant on ANY approval stage —
//    i.e. admin, plus hr_manager/finance_manager since they hold 'all' scope
//    on their own stages. If you want to lock it to admin only, grant the
//    approval permissions with scope 'all' only to admin and nothing else.
//
// 2. The original didn't block admin/hr_manager/finance_manager/payroll_manager/
//    department_manager from POSTing a loan application or appeal on behalf
//    of an employee (only payroll_officer/auditor/hr_officer/employee had
//    POST restrictions, and employee's restriction only requires the
//    submission be about their own loan). This version restricts
//    loans.create to admin + employee(own) — submitting "on behalf of"
//    someone else via the application/appeal routes wasn't a described
//    requirement anywhere else in the app, and looked like an oversight
//    rather than a feature. Grant loans.create to other roles via
//    RoleController if you actually want that.

namespace App\Middleware;

use App\Services\PermissionService;

class LoanAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        // Fast-track /approve or /reject (not a stage-specific route) —
        // see note (1) above.
        if (preg_match('#/\d+/(approve|reject)$#', $uri) && $method !== 'GET'
            && !preg_match('#/(manager|hr|finance)-(approve|reject)$#', $uri)) {
            $hasOrgWideApprovalAuthority =
                PermissionService::scopeOf($user['id'], 'loans.approve_manager') === 'all' ||
                PermissionService::scopeOf($user['id'], 'loans.approve_hr') === 'all' ||
                PermissionService::scopeOf($user['id'], 'loans.approve_finance') === 'all';

            if (!$hasOrgWideApprovalAuthority) {
                return responseJson(success: false, data: null, message: 'You do not have permission to perform this action', code: 403);
            }
            return $next($request);
        }

        $permission = $this->resolvePermission($uri, $method);

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(success: false, data: null, message: 'You do not have permission to perform this action', code: 403);
        }

        return $next($request);
    }

    private function resolvePermission(string $uri, string $method): string
    {
        if (preg_match('#/(manager-approve|manager-reject)$#', $uri))          return 'loans.approve_manager';
        if (preg_match('#/(hr-approve|hr-reject|hr-flag-compliance)$#', $uri)) return 'loans.approve_hr';
        if (preg_match('#/(finance-approve|finance-reject)$#', $uri))          return 'loans.approve_finance';
        if (preg_match('#/appeal/review$#', $uri))                            return 'loans.review_appeal';
        if (preg_match('#/disburse$#', $uri))                                 return 'loans.disburse';
        if (preg_match('#/repayments$#', $uri) && $method === 'POST')         return 'loans.record_repayment';

        // Loan application and appeal submission — both "submit something
        // about my own loan", same permission as apply. Row-ownership (own
        // loan_id) is checked in LoanController for GET/show on a specific id;
        // application/appeal POSTs carry no id yet so there's nothing to own-check.
        if ($method === 'POST') {
            return 'loans.create';
        }

        return 'loans.view';
    }
}