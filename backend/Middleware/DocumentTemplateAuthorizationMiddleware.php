<?php

namespace App\Middleware;

use App\Services\Templates\TemplateAuditLogger;

/**
 * Guards every /organizations/{org_id}/templates* route.
 *
 *  1. Authenticated, not a super_admin (platform staff never touch tenant documents)
 *  2. Role is admin | payroll_manager | payroll_officer
 *  3. The {org_id} in the URL IS the caller's own organisation.
 *     (Controllers use the URL value, so this check is what stops tenant A
 *      from addressing tenant B's templates.)
 *
 * Denials are written to audit_logs (action = access_denied) under the
 * caller's own organisation.
 */
class DocumentTemplateAuthorizationMiddleware
{
    private const MANAGERS = ['admin', 'payroll_manager', 'payroll_officer'];

    public function handle($request, $next)
    {
        $user  = AuthMiddleware::getCurrentUser();
        $orgId = AuthMiddleware::getCurrentOrganizationId();

        if (!$user || !$orgId) {
            return responseJson(success: false, data: null, message: 'Authentication required', code: 401);
        }
        if (($user['user_type'] ?? '') === 'super_admin') {
            return responseJson(success: false, data: null, message: 'Access to organisation data is restricted', code: 403);
        }
        if (!in_array($user['user_type'] ?? '', self::MANAGERS, true)) {
            return $this->deny($user, (int) $orgId, $request, 'role_not_allowed', 'You do not have permission to manage document templates');
        }

        $urlOrg = $request['params'][0] ?? null;
        if ($urlOrg === null || !ctype_digit((string) $urlOrg) || (int) $urlOrg !== (int) $orgId) {
            return $this->deny($user, (int) $orgId, $request, 'organization_mismatch', 'Access to this organization is denied');
        }

        return $next($request);
    }

    private function deny(array $user, int $ownOrgId, $request, string $reason, string $message)
    {
        TemplateAuditLogger::log($ownOrgId, (int) $user['id'], 'document_template', (int) ($request['params'][1] ?? 0), 'access_denied', [
            'reason'               => $reason,
            'requested_org_id'     => $request['params'][0] ?? null,
            'method'               => $_SERVER['REQUEST_METHOD'] ?? null,
            'path'                 => parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH),
            'user_type'            => $user['user_type'] ?? null,
        ]);
        return responseJson(success: false, data: null, message: $message, code: 403);
    }
}
