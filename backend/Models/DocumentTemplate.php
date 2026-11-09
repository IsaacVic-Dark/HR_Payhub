<?php

namespace App\Models;

use App\Services\DB;

/**
 * document_templates. Every read and write is scoped by organization_id so a
 * caller cannot touch another tenant's row even by guessing an id.
 */
class DocumentTemplate
{
    public static function find(int $orgId, int $id, bool $forUpdate = false): ?array
    {
        $rows = DB::raw(
            'SELECT * FROM document_templates WHERE id = :id AND organization_id = :org LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':id' => $id, ':org' => $orgId]
        );
        return $rows ? self::hydrate($rows[0]) : null;
    }

    /** @return array[] */
    public static function listForOrg(int $orgId, array $filters = []): array
    {
        $sql    = 'SELECT * FROM document_templates WHERE organization_id = :org';
        $params = [':org' => $orgId];

        if (!empty($filters['template_type'])) {
            $sql .= ' AND template_type = :type';
            $params[':type'] = $filters['template_type'];
        }
        if (!empty($filters['status'])) {
            $sql .= ' AND status = :status';
            $params[':status'] = $filters['status'];
        }
        $sql .= " ORDER BY FIELD(status, 'active', 'draft', 'archived'), updated_at DESC";

        return array_map([self::class, 'hydrate'], DB::raw($sql, $params));
    }

    /** Lock every template of a type for the org so activation is serialised. */
    public static function lockType(int $orgId, string $type): array
    {
        $rows = DB::raw(
            'SELECT * FROM document_templates WHERE organization_id = :org AND template_type = :type FOR UPDATE',
            [':org' => $orgId, ':type' => $type]
        );
        return array_map([self::class, 'hydrate'], $rows);
    }

    public static function activeFor(int $orgId, string $type): ?array
    {
        $rows = DB::raw(
            "SELECT * FROM document_templates
              WHERE organization_id = :org AND template_type = :type AND status = 'active'
              ORDER BY id DESC LIMIT 1",
            [':org' => $orgId, ':type' => $type]
        );
        return $rows ? self::hydrate($rows[0]) : null;
    }

    public static function nameTaken(int $orgId, string $type, string $name, ?int $excludeId = null): bool
    {
        $sql    = 'SELECT id FROM document_templates WHERE organization_id = :org AND template_type = :type AND name = :name';
        $params = [':org' => $orgId, ':type' => $type, ':name' => $name];
        if ($excludeId) {
            $sql .= ' AND id <> :ex';
            $params[':ex'] = $excludeId;
        }
        return !empty(DB::raw($sql . ' LIMIT 1', $params));
    }

    public static function create(array $data): int
    {
        DB::table('document_templates')->insert($data);
        return (int) DB::lastInsertId();
    }

    /**
     * Tenant-scoped update. $data keys are column names chosen by the service
     * (never user input), so interpolating them is safe; values are bound.
     */
    public static function updateScoped(int $orgId, int $id, array $data): void
    {
        $set    = [];
        $params = [':__id' => $id, ':__org' => $orgId];
        foreach ($data as $col => $val) {
            $set[]               = "`{$col}` = :v_{$col}";
            $params[":v_{$col}"] = $val;
        }
        DB::raw('UPDATE document_templates SET ' . implode(', ', $set) . ' WHERE id = :__id AND organization_id = :__org', $params);
    }

    public static function hydrate(object $row): array
    {
        $a           = (array) $row;
        $cfg         = is_string($a['config'] ?? null) ? json_decode($a['config'], true) : ($a['config'] ?? []);
        $a['config'] = is_array($cfg) ? $cfg : [];
        foreach (['id', 'organization_id', 'is_default', 'created_by', 'updated_by', 'active_version_id'] as $k) {
            if (isset($a[$k])) {
                $a[$k] = (int) $a[$k];
            }
        }
        return $a;
    }
}
