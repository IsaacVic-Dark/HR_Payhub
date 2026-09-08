<?php

namespace App\Middleware;

use App\Services\DB;
use App\Services\PermissionService;

class P9AuthorizationMiddleware
{
    public function handle($request, $next)
    {
        $user     = AuthMiddleware::getCurrentUser();
        $orgId    = AuthMiddleware::getCurrentOrganizationId();
        $employee = AuthMiddleware::getCurrentEmployee();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }

        $uri    = $_SERVER['REQUEST_URI'] ?? '';
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        $permission = $this->isWriteAction($uri, $method) ? $this->writePermission($uri) : 'p9.view';

        if (!PermissionService::can($user['id'], $permission)) {
            return responseJson(
                success: false,
                data: null,
                message: 'Your role does not have permission to generate or modify P9 forms',
                code: 403
            );
        }

        $scope = PermissionService::scopeOf($user['id'], $permission);

        if (in_array($scope, ['own', 'team'], true) && isset($request['params']['id']) && is_numeric($request['params']['id'])) {
            $p9Id = $request['params']['id'];

            $allowed = $scope === 'own'
                ? $this->isOwnP9($p9Id, $employee['id'] ?? null)
                : $this->isP9InManagerTeam($p9Id, $employee['id'] ?? null);

            if (!$allowed) {
                return responseJson(
                    success: false,
                    data: null,
                    message: $scope === 'own' ? 'You can only access your own P9 forms' : 'Access denied: this P9 form does not belong to your team',
                    code: 403
                );
            }
        }

        return $next($request);
    }

    private function isWriteAction(string $uri, string $method): bool
    {
        foreach (['/generate', '/finalize', '/bulk-finalize', '/mark-submitted'] as $pattern) {
            if (str_contains($uri, $pattern)) {
                return true;
            }
        }
        return $method === 'POST' || $method === 'DELETE';
    }

    private function writePermission(string $uri): string
    {
        return match (true) {
            str_contains($uri, '/bulk-finalize')  => 'p9.bulk_finalize',
            str_contains($uri, '/finalize')       => 'p9.finalize',
            str_contains($uri, '/mark-submitted') => 'p9.mark_submitted',
            default                               => 'p9.generate',
        };
    }

    private function isP9InManagerTeam($p9Id, $managerId): bool
    {
        if (!$p9Id || !$managerId) {
            return false;
        }
        try {
            $result = DB::raw(
                "SELECT COUNT(*) AS cnt FROM p9_forms p9
                 INNER JOIN employees e ON e.id = p9.employee_id
                 WHERE p9.id = :p9_id AND e.reports_to = :manager_id AND e.status = 'active'",
                [':p9_id' => $p9Id, ':manager_id' => $managerId]
            );
            return ((int) ($result[0]->cnt ?? 0)) > 0;
        } catch (\Exception $e) {
            error_log('P9 manager team check error: ' . $e->getMessage());
            return false;
        }
    }

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
            return ((int) ($result[0]->cnt ?? 0)) > 0;
        } catch (\Exception $e) {
            error_log('P9 own check error: ' . $e->getMessage());
            return false;
        }
    }
}