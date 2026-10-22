<?php
// app/Middleware/AdvanceAuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

/**
 * Role + tenant + ownership checks for the Salary Advances module.
 *
 * Usage in routes (AuthMiddleware must run first):
 *   ['AuthMiddleware', ['AdvanceAuthorizationMiddleware', 'approve']]
 *
 * NOTE: Router passes route params as a positional list (['params' => [..]]),
 * so the advance / employee id is $request['params'][0].
 */
class AdvanceAuthorizationMiddleware
{
    /** ability => user_type values allowed. Edit here to change who can do what. */
    private const ABILITIES = [
        'list'              => ['admin', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor', 'employee'],
        'view'              => ['admin', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor', 'employee'],
        'view_repayments'   => ['admin', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor', 'employee'],
        'view_lines'        => ['admin', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor'],
        'create'            => ['admin', 'employee'],
        'update'            => ['admin', 'employee'],
        'delete'            => ['admin', 'employee'],
        'submit'            => ['admin', 'employee'],
        'cancel'            => ['admin', 'employee'],
        'approve'           => ['admin'],
        'reject'            => ['admin'],
        'disburse'          => ['admin'],
        'attach'            => ['admin', 'payroll_manager', 'payroll_officer'],
        'detach'            => ['admin', 'payroll_manager', 'payroll_officer'],
        'manual_repayment'  => ['admin', 'finance_manager'],
        'reverse_repayment' => ['admin', 'finance_manager'],
        'payrun_options'    => ['admin', 'payroll_manager', 'payroll_officer'],
        'policy_view'       => ['admin', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor', 'employee'],
        'policy_update'     => ['admin'],
        'employee_view'     => ['admin', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor', 'employee'],
    ];

    /** Abilities whose first route param is an advance id ('list' and 'create' have none). */
    private const ADVANCE_TARGET = [
        'view', 'view_repayments', 'view_lines', 'update', 'delete', 'submit', 'cancel', 'approve', 'reject',
        'disburse', 'attach', 'detach', 'manual_repayment', 'reverse_repayment',
    ];

    public function handle($request, $next, $ability = 'view')
    {
        $user  = AuthMiddleware::getCurrentUser();
        $emp   = AuthMiddleware::getCurrentEmployee();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return $this->deny('Authentication required', 401);
        }
        if ($user['user_type'] === 'super_admin') {
            return $this->deny('Access to organization data is restricted', 403);
        }
        if (!isset(self::ABILITIES[$ability])) {
            return $this->deny('Unknown permission', 403);
        }
        if (!in_array($user['user_type'], self::ABILITIES[$ability], true)) {
            return $this->deny('You do not have permission to perform this action', 403);
        }

        $isEmployeeRole = $user['user_type'] === 'employee';

        // Employees must be linked to an employee record for anything self-service.
        if ($isEmployeeRole && !$emp) {
            return $this->deny('No employee profile is linked to your account', 403);
        }

        $targetId = $request['params'][0] ?? null;

        // advances/{advance}...: tenant scope + ownership
        if (in_array($ability, self::ADVANCE_TARGET, true)) {
            if (!$targetId || !ctype_digit((string) $targetId)) {
                return $this->deny('Invalid advance ID', 404);
            }
            $row = DB::raw(
                'SELECT employee_id FROM advances WHERE id = :id AND organization_id = :org',
                [':id' => (int) $targetId, ':org' => (int) $orgId]
            );
            if (empty($row)) {
                return $this->deny('Advance not found', 404);
            }
            if ($isEmployeeRole && (int) $row[0]->employee_id !== (int) $emp['id']) {
                return $this->deny('You can only access your own advances', 403);
            }
        }

        // employees/{employee}/...: tenant scope + ownership
        if ($ability === 'employee_view') {
            if (!$targetId || !ctype_digit((string) $targetId)) {
                return $this->deny('Invalid employee ID', 404);
            }
            $row = DB::raw(
                'SELECT id FROM employees WHERE id = :id AND organization_id = :org',
                [':id' => (int) $targetId, ':org' => (int) $orgId]
            );
            if (empty($row)) {
                return $this->deny('Employee not found', 404);
            }
            if ($isEmployeeRole && (int) $targetId !== (int) $emp['id']) {
                return $this->deny('You can only access your own advances', 403);
            }
        }

        return $next($request);
    }

    private function deny(string $message, int $code)
    {
        return responseJson(success: false, data: null, message: $message, code: $code);
    }
}
