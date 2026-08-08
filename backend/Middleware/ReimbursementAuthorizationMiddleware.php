<?php
// app/Middleware/ReimbursementAuthorizationMiddleware.php
//
// Baseline authorization for /reimbursements routes. Fine-grained,
// stage-aware checks (e.g. "only THIS employee's manager may approve at the
// manager stage") are enforced inside ReimbursementController itself, since
// they need the claim's row (employee_id, current status) which isn't known
// from the URI alone. This middleware handles the coarse, role-based layer:
// who may read, who may write at all, and who may never touch the module.

namespace App\Middleware;

class ReimbursementAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user = AuthMiddleware::getCurrentUser();
        $employee = AuthMiddleware::getCurrentEmployee();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        if ($user['user_type'] === 'super_admin') {
            return responseJson(success: false, data: null, message: 'Access to organization data is restricted', code: 403);
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        $isApprovalAction = (bool) preg_match(
            '#/reimbursement(s)?/\d+/(approve|reject|request-clarification|dispute|resolve-dispute)$#',
            $uri
        );
        $isPaymentAction = (bool) preg_match(
            '#/reimbursement(s)?/\d+/(process-payment|confirm-payment|fail-payment|reverse|attach-payrun)$#',
            $uri
        );
        $isCancelAction = (bool) preg_match('#/reimbursement(s)?/\d+/cancel$#', $uri);

        switch ($user['user_type']) {
            case 'admin':
            case 'payroll_manager':
                // Full access to everything in the module.
                break;

            case 'hr_manager':
                // Full read access; can act on approvals/disputes but not
                // finance-only payment actions (enforced again in the
                // controller for the specific stage/decision).
                if ($isPaymentAction && $method !== 'GET') {
                    return responseJson(success: false, data: null,
                        message: 'HR cannot process or reverse payments', code: 403);
                }
                break;

            case 'finance_manager':
            case 'accountant':
                // Full read access; can act on payments and the finance
                // approval stage, but not manager/HR-stage approvals or
                // employee-only actions (cancel/dispute of others' claims —
                // controller enforces ownership on cancel/dispute).
                if ($method !== 'GET' && !$isPaymentAction && !$isApprovalAction) {
                    return responseJson(success: false, data: null,
                        message: 'You do not have permission to modify reimbursements', code: 403);
                }
                break;

            case 'payroll_officer':
                // Read-only visibility into the module.
                if ($method !== 'GET') {
                    return responseJson(success: false, data: null,
                        message: 'You do not have permission to modify reimbursements', code: 403);
                }
                break;

            case 'department_manager':
                // Can view their team's claims and act at the manager
                // approval stage; cannot process payments or edit line items
                // on behalf of employees.
                if ($isPaymentAction) {
                    return responseJson(success: false, data: null,
                        message: 'Department managers cannot process payments', code: 403);
                }
                if ($method !== 'GET' && !$isApprovalAction) {
                    return responseJson(success: false, data: null,
                        message: 'You do not have permission to modify this reimbursement', code: 403);
                }
                break;

            case 'employee':
                // Can submit, view, edit, and cancel their own claims, and
                // dispute a decision on their own claim. Ownership of the
                // specific claim/employee_id is enforced in the controller.
                if ($isPaymentAction || (preg_match('#/(approve|reject|resolve-dispute)$#', $uri))) {
                    return responseJson(success: false, data: null,
                        message: 'You do not have permission to perform this action', code: 403);
                }
                break;

            default:
                return responseJson(success: false, data: null, message: 'Unknown user role', code: 403);
        }

        return $next($request);
    }
}