<?php
// app/Middleware/P9AuthorizationMiddleware.php

namespace App\Middleware;

use App\Services\DB;

/**
 * P9AuthorizationMiddleware
 *
 * Role-based access control for P9 tax certificate endpoints.
 *
 * Access matrix:
 * ┌──────────────────────┬────────┬────────────┬──────────────┬──────────────────┬──────────────┐
 * │ Action               │ admin  │ hr_manager │ payroll_mgr  │ dept_manager     │ employee     │
 * ├──────────────────────┼────────┼────────────┼──────────────┼──────────────────┼──────────────┤
 * │ List all P9s         │  ✓     │   ✓        │   ✓          │ own team only    │ own only     │
 * │ View single P9       │  ✓     │   ✓        │   ✓          │ own team only    │ own only     │
 * │ Generate P9s         │  ✓     │   ✗        │   ✓          │ ✗                │ ✗            │
 * │ Finalize P9          │  ✓     │   ✗        │   ✓          │ ✗                │ ✗            │
 * │ Bulk finalize        │  ✓     │   ✗        │   ✓          │ ✗                │ ✗            │
 * │ Mark submitted (KRA) │  ✓     │   ✗        │   ✓          │ ✗                │ ✗            │
 * │ View own employee P9 │  ✓     │   ✓        │   ✓          │ ✓                │ own only     │
 * └──────────────────────┴────────┴────────────┴──────────────┴──────────────────┴──────────────┘
 *
 * super_admin is explicitly blocked from org-level data (consistent with rest of system).
 * finance_manager has read-only access (same as hr_manager) since they need P9s for audits.
 */
class P9AuthorizationMiddleware
{
    /** Roles that can read all P9 forms in the organisation */
    private const READ_ALL_ROLES = ['admin', 'hr_manager', 'payroll_manager', 'payroll_officer', 'finance_manager', 'auditor'];

    /** Roles that can generate / finalize / submit P9s */
    private const WRITE_ROLES = ['admin', 'payroll_manager', 'payroll_officer'];

    public function handle($request, $next)
    {
        $user   = AuthMiddleware::getCurrentUser();
        $orgId  = AuthMiddleware::getCurrentOrganizationId();

        // ------------------------------------------------------------------
        // 1. Basic authentication check
        // ------------------------------------------------------------------
        if (!$user || !$orgId) {
            return responseJson(
                success: false,
                data: null,
                message: 'Authentication required',
                code: 401
            );
        }

        // ------------------------------------------------------------------
        // 2. Super admin is blocked from org-specific data
        // ------------------------------------------------------------------
        if ($user['user_type'] === 'super_admin') {
            return responseJson(
                success: false,
                data: null,
                message: 'Super admins cannot access organisation-level P9 data',
                code: 403
            );
        }

        // ------------------------------------------------------------------
        // 3. Role-based routing
        // ------------------------------------------------------------------
        $role     = $user['user_type'];
        $employee = AuthMiddleware::getCurrentEmployee();
        $uri      = $_SERVER['REQUEST_URI'] ?? '';
        $method   = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        switch ($role) {

            // Full access (read + write + finalize + submit)
            case 'admin':
                break;

            // Payroll roles — full write + read access
            case 'payroll_manager':
            case 'payroll_officer':
                break;

            // HR and finance can read all P9s but cannot generate/finalize/submit
            case 'hr_manager':
            case 'finance_manager':
            case 'auditor':
                if ($this->isWriteAction($uri, $method)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Your role does not have permission to generate or modify P9 forms',
                        code: 403
                    );
                }
                break;

            // Department managers: read-only, restricted to their team
            case 'department_manager':
                if ($this->isWriteAction($uri, $method)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Department managers cannot generate or modify P9 forms',
                        code: 403
                    );
                }
                // For specific P9 form access, verify it belongs to their team
                if ($this->isSpecificP9Request($request)) {
                    if (!$this->isP9InManagerTeam($request['params']['id'] ?? null, $employee['id'] ?? null)) {
                        return responseJson(
                            success: false,
                            data: null,
                            message: 'Access denied: this P9 form does not belong to your team',
                            code: 403
                        );
                    }
                }
                break;

            // Employees: read-only, own P9 only
            case 'employee':
                if ($this->isWriteAction($uri, $method)) {
                    return responseJson(
                        success: false,
                        data: null,
                        message: 'Employees cannot generate or modify P9 forms',
                        code: 403
                    );
                }
                // For specific P9 form access, verify ownership
                if ($this->isSpecificP9Request($request)) {
                    if (!$this->isOwnP9($request['params']['id'] ?? null, $employee['id'] ?? null)) {
                        return responseJson(
                            success: false,
                            data: null,
                            message: 'You can only access your own P9 forms',
                            code: 403
                        );
                    }
                }
                break;

            default:
                return responseJson(
                    success: false,
                    data: null,
                    message: 'Unknown user role — access denied',
                    code: 403
                );
        }

        return $next($request);
    }

    // -------------------------------------------------------------------------
    // Helper: is this a state-changing (write) action?
    // -------------------------------------------------------------------------

    /**
     * Identify write actions by URI suffix and HTTP method.
     * Covers: generate, finalize, bulk-finalize, mark-submitted
     */
    private function isWriteAction(string $uri, string $method): bool
    {
        // Explicit action suffixes are always writes
        $writePatterns = ['/generate', '/finalize', '/bulk-finalize', '/mark-submitted'];
        foreach ($writePatterns as $pattern) {
            if (str_contains($uri, $pattern)) {
                return true;
            }
        }

        // POST to the base collection endpoint is "generate"
        if ($method === 'POST') {
            return true;
        }

        // DELETE would also be a write
        if ($method === 'DELETE') {
            return true;
        }

        return false;
    }

    /**
     * Check if the request targets a specific P9 form (has numeric :id param).
     */
    private function isSpecificP9Request(array $request): bool
    {
        return isset($request['params']['id']) && is_numeric($request['params']['id']);
    }

    // -------------------------------------------------------------------------
    // DB checks
    // -------------------------------------------------------------------------

    /**
     * Does this P9 form belong to an employee in the manager's team?
     */
    private function isP9InManagerTeam($p9Id, $managerId): bool
    {
        if (!$p9Id || !$managerId) {
            return false;
        }

        try {
            $result = DB::raw(
                "SELECT COUNT(*) AS cnt
                 FROM p9_forms p9
                 INNER JOIN employees e ON e.id = p9.employee_id
                 WHERE p9.id        = :p9_id
                   AND e.reports_to = :manager_id
                   AND e.status     = 'active'",
                [':p9_id' => $p9Id, ':manager_id' => $managerId]
            );

            return ((int)($result[0]->cnt ?? 0)) > 0;
        } catch (\Exception $e) {
            error_log('P9 manager team check error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Does this P9 form belong to the requesting employee?
     */
    private function isOwnP9($p9Id, $employeeId): bool
    {
        if (!$p9Id || !$employeeId) {
            return false;
        }

        try {
            $result = DB::raw(
                "SELECT COUNT(*) AS cnt FROM p9_forms WHERE id = :p9_id AND employee_id = :emp_id",
                [':p9_id' => $p9Id, ':emp_id' => $employeeId]
            );

            return ((int)($result[0]->cnt ?? 0)) > 0;
        } catch (\Exception $e) {
            error_log('P9 own check error: ' . $e->getMessage());
            return false;
        }
    }
}