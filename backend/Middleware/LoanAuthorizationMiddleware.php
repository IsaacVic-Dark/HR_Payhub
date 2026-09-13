<?php
// app/Middleware/LoanAuthorizationMiddleware.php
//
// Both items previously flagged here as guesses have since been confirmed
// against LoanController.php directly and corrected:
//
// 1. Fast-track /approve and /reject (not a stage-specific route) is
//    hardcoded admin-only in LoanController::approve()/reject() itself
//    ("Direct approval is restricted to admins. Use the step-by-step
//    workflow."). The permission-based equivalent is "holds all three
//    approval-stage permissions" — under the default matrix that's only
//    admin (hr_manager lacks approve_finance, finance_manager lacks
//    approve_manager/approve_hr), so this now uses canAll() instead of the
//    earlier canAny()-on-'all'-scope approximation.
//
// 2. loans.create ("apply for a loan on someone else's behalf") is granted,
//    per LoanController::applyLoan()'s own $isPrivileged check, to
//    admin, hr_manager, hr_officer, and payroll_manager — not just admin as
//    originally guessed. The default matrix now grants loans.create 'all'
//    to exactly those four roles, plus 'own' to employee.

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
        // admin-only, matching LoanController's own hardcoded check.
        if (preg_match('#/\d+/(approve|reject)$#', $uri) && $method !== 'GET'
            && !preg_match('#/(manager|hr|finance)-(approve|reject)$#', $uri)) {
            $hasFullApprovalAuthority = PermissionService::canAll($user['id'], [
                'loans.approve_manager',
                'loans.approve_hr',
                'loans.approve_finance',
            ]);

            if (!$hasFullApprovalAuthority) {
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

        if ($method === 'POST') {
            return 'loans.create';
        }

        return 'loans.view';
    }
}