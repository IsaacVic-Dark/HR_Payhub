<?php

namespace App\Middleware;

use App\Services\DB;

/**
 * EmployeeAllowanceAuthorizationMiddleware
 *
 * Guards api/v1/organizations/{org_id}/employee-allowances* — per-employee
 * allowance grants and their approval / payrun-attach workflow. Modeled on
 * PayrunAuthorizationMiddleware's single-middleware, URI-pattern-switch style.
 *
 * Role map:
 *   - admin, payroll_manager        : full access to everything below.
 *   - hr_manager, payroll_officer   : can create/submit/update (while DRAFT)
 *                                     and suspend/cancel; can attach/detach
 *                                     payrun (payroll_officer only, mirrors
 *                                     PayrunAuthorizationMiddleware where
 *                                     payroll_officer can process but not
 *                                     finalize); CANNOT approve/reject.
 *   - finance_manager                : can approve/reject only; otherwise read-only.
 *   - accountant, department_manager,
 *     employee                       : read-only (row-level scoping for
 *                                     department_manager/employee is left to
 *                                     the controller's WHERE clause, same
 *                                     pattern as AttendanceDeductionAuthorizationMiddleware).
 */
class EmployeeAllowanceAuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

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
                message: 'Access to organisation data is restricted',
                code: 403
            );
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        $uri    = $_SERVER['REQUEST_URI']    ?? '';

        $isApprove = preg_match('#/employee-allowances/\d+/approve$#', $uri);
        $isReject  = preg_match('#/employee-allowances/\d+/reject$#',  $uri);
        $isSuspend = preg_match('#/employee-allowances/\d+/suspend$#', $uri);
        $isCancel  = preg_match('#/employee-allowances/\d+/cancel$#',  $uri);
        $isSubmit  = preg_match('#/employee-allowances/\d+/submit$#',  $uri);
        $isAttach  = preg_match('#/employee-allowances/\d+/attach-payrun$#',  $uri);
        $isDetach  = preg_match('#/employee-allowances/\d+/detach-payrun$#', $uri);

        switch ($user['user_type']) {

            // Full access
            case 'admin':
            case 'payroll_manager':
                break;

            // Create/submit/update/suspend/cancel + attach-payrun, but not approve/reject
            case 'payroll_officer':
                if ($isApprove || $isReject) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Only admins, payroll managers, or finance managers can approve or reject allowances',
                        code: 403
                    );
                }
                break;

            // Create/submit/update/suspend/cancel, but not approve/reject/attach-payrun
            case 'hr_manager':
                if ($isApprove || $isReject || $isAttach || $isDetach) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'HR managers cannot approve, reject, or attach allowances to a payrun',
                        code: 403
                    );
                }
                break;

            // Can only approve/reject; everything else is read-only
            case 'finance_manager':
                if ($method !== 'GET' && !($isApprove || $isReject)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Finance managers can only view allowances or approve/reject pending requests',
                        code: 403
                    );
                }
                break;

            // Read-only (row-level scoping — own team / own records — is
            // applied by the controller's WHERE clause, not here)
            case 'accountant':
            case 'department_manager':
            case 'employee':
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You do not have permission to modify allowances',
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
}