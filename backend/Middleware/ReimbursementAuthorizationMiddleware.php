<?php
// Row/stage-level checks (exact approval stage, department_manager's direct
// reports, employee ownership) stay in ReimbursementController — see the
// accompanying controller diff. This middleware is just the coarse "can you
// touch this endpoint at all" layer, same as before.

namespace App\Middleware;

use App\Services\PermissionService;

class ReimbursementAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $permission = $this->resolvePermission();

        $allowed = is_array($permission)
            ? PermissionService::canAny($user['id'], $permission)
            : PermissionService::can($user['id'], $permission);

        if (!$allowed) {
            return responseJson(
                success: false,
                data: null,
                message: 'You do not have permission to perform this action',
                code: 403
            );
        }

        return $next($request);
    }

    /**
     * Returns either a single permission name, or an array meaning
     * "any one of these" — used for approve/reject/request-clarification,
     * where the exact required stage permission depends on the claim's
     * current stage and is only knowable inside the controller.
     */
    private function resolvePermission()
    {
        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'] ?? '';

        if (preg_match('#/reimbursement(s)?/\d+/(approve|reject|request-clarification)$#', $uri)) {
            return ['reimbursements.approve_manager', 'reimbursements.approve_hr', 'reimbursements.approve_finance'];
        }
        if (preg_match('#/reimbursement(s)?/\d+/dispute$#', $uri)) {
            return 'reimbursements.dispute';
        }
        if (preg_match('#/reimbursement(s)?/\d+/resolve-dispute$#', $uri)) {
            return 'reimbursements.resolve_dispute';
        }
        if (preg_match('#/reimbursement(s)?/\d+/reverse$#', $uri)) {
            return 'reimbursements.reverse_payment';
        }
        if (preg_match('#/reimbursement(s)?/\d+/(process-payment|confirm-payment|fail-payment|attach-payrun)$#', $uri)) {
            return 'reimbursements.process_payment';
        }
        if (preg_match('#/reimbursement(s)?/\d+/cancel$#', $uri)) {
            return 'reimbursements.cancel';
        }

        return match ($method) {
            'GET'          => 'reimbursements.view',
            'POST'         => 'reimbursements.create',
            'PUT', 'PATCH' => 'reimbursements.update',
            default        => 'reimbursements.view',
        };
    }
}