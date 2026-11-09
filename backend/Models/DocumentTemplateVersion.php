<?php

namespace App\Models;

use App\Services\DB;

/**
 * document_template_versions — immutable snapshots. This class deliberately
 * has no update or delete method: a version is written once and never changed.
 */
class DocumentTemplateVersion
{
    /** Next version number. Call only while holding the template row lock. */
    public static function nextVersion(int $templateId): int
    {
        $rows = DB::raw('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM document_template_versions WHERE template_id = :t', [':t' => $templateId]);
        return (int) $rows[0]->next;
    }

    public static function create(array $data): int
    {
        DB::table('document_template_versions')->insert($data);
        return (int) DB::lastInsertId();
    }

    /** Org-scoped via the parent template. */
    public static function find(int $orgId, int $templateId, int $versionId): ?array
    {
        $rows = DB::raw(
            'SELECT v.* FROM document_template_versions v
        INNER JOIN document_templates t ON t.id = v.template_id
             WHERE v.id = :v AND v.template_id = :t AND t.organization_id = :org LIMIT 1',
            [':v' => $versionId, ':t' => $templateId, ':org' => $orgId]
        );
        return $rows ? self::hydrate($rows[0]) : null;
    }

    /** @return array[] newest first */
    public static function listFor(int $orgId, int $templateId): array
    {
        $rows = DB::raw(
            'SELECT v.*, CONCAT(u.first_name, " ", u.surname) AS created_by_name
               FROM document_template_versions v
         INNER JOIN document_templates t ON t.id = v.template_id
          LEFT JOIN users u ON u.id = v.created_by
              WHERE v.template_id = :t AND t.organization_id = :org
           ORDER BY v.version DESC',
            [':t' => $templateId, ':org' => $orgId]
        );
        return array_map([self::class, 'hydrate'], $rows);
    }

    public static function hydrate(object $row): array
    {
        $a           = (array) $row;
        $cfg         = is_string($a['config'] ?? null) ? json_decode($a['config'], true) : ($a['config'] ?? []);
        $a['config'] = is_array($cfg) ? $cfg : [];
        foreach (['id', 'template_id', 'version', 'created_by'] as $k) {
            if (isset($a[$k])) {
                $a[$k] = (int) $a[$k];
            }
        }
        return $a;
    }
}
