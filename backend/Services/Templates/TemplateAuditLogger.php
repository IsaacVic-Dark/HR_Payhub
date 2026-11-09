<?php

namespace App\Services\Templates;

use App\Services\DB;

/**
 * Writes organisation-level audit rows for the Templates module.
 * Never throws: an audit failure must not break the user's action (same
 * contract as the createAuditLog() helpers in the other controllers).
 *
 * Requires the audit_logs.action ENUM to contain the template_* / payslip(s)_* values
 * (see database/migrations/2026_11_08_document_templates.sql).
 */
final class TemplateAuditLogger
{
    public const ACTIONS = [
        'template_created', 'template_updated', 'template_activated', 'template_archived',
        'template_previewed', 'payslips_generated', 'payslip_regenerated', 'access_denied',
    ];

    public static function log(int $orgId, int $userId, string $entityType, int $entityId, string $action, array $details = []): void
    {
        if (!in_array($action, self::ACTIONS, true)) {
            error_log("TemplateAuditLogger: unknown action {$action}");
            return;
        }
        try {
            // actor is always recorded in details too, as the spec asks
            $details = ['actor_user_id' => $userId] + $details;
            DB::table('audit_logs')->insert([
                'organization_id' => $orgId,
                'user_id'         => $userId,
                'entity_type'     => $entityType,
                'entity_id'       => $entityId,
                'action'          => $action,
                'details'         => json_encode($details, JSON_UNESCAPED_UNICODE),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $e) {
            error_log('Failed to write template audit log: ' . $e->getMessage());
        }
    }
}
