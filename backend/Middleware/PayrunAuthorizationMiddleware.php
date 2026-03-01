<?php
// app/Middleware/PayrunAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

class PayrunAuthorizationMiddleware
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

        // Super admins cannot access organisation data
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

        // ----------------------------------------------------------------
        // Determine the action being attempted from the URI
        // ----------------------------------------------------------------
        $isReview   = preg_match('#/payrun/\d+/review$#',   $uri);
        $isFinalize = preg_match('#/payrun/\d+/finalize$#', $uri);
        $isProcess  = preg_match('#/payrun/\d+/process$#',  $uri);

        switch ($user['user_type']) {

            // Full access to all payrun actions
            case 'admin':
            case 'payroll_manager':
                break;

            // Can process (draft → reviewed) and explicitly review; cannot finalize
            case 'payroll_officer':
            case 'hr_manager':
                if ($isFinalize) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Only admins, payroll managers, or finance managers can finalize payruns',
                        code: 403
                    );
                }
                // Block any other non-GET mutations except process/review
                if ($method !== 'GET' && !$isProcess && !$isReview) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You do not have permission to modify payruns',
                        code: 403
                    );
                }
                break;

            // Can only finalize (reviewed → finalized); read-only otherwise
            case 'finance_manager':
                if ($method !== 'GET' && !$isFinalize) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Finance managers can only view payruns or finalize reviewed payruns',
                        code: 403
                    );
                }
                break;

            // Read-only
            case 'accountant':
            case 'department_manager':
            case 'employee':
                if ($method !== 'GET') {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'You do not have permission to modify payruns',
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
