<?php

namespace App\Services;

use App\Models\DocumentTemplate;
use App\Models\DocumentTemplateVersion;
use App\Services\Templates\LogoResolver;
use App\Services\Templates\TemplateAuditLogger;
use App\Services\Templates\TemplateConfig;
use App\Services\Templates\TemplateConfigValidator;
use App\Services\Templates\TemplateException;

/**
 * Business rules for document templates.
 *
 * VERSIONING MODEL
 *  document_templates      = the working copy (what the editor loads and saves)
 *  document_template_versions = immutable snapshots
 *  document_templates.active_version_id = the snapshot PDFs are generated from
 *
 *  - Editing never changes what is being generated: PUT writes the working copy only.
 *  - Activation snapshots the working copy as version N+1 and points active_version_id at it.
 *  - If an *active* template is edited and it somehow has no snapshot yet, the
 *    current live configuration is snapshotted first so it is never lost.
 *  - Versions are never updated or deleted. Payslips keep the version id they were made with.
 *  - One active template per organisation and type: activating one archives the previous.
 */
class DocumentTemplateService
{
    private TemplateConfigValidator $validator;

    public function __construct(?TemplateConfigValidator $validator = null)
    {
        $this->validator = $validator ?? new TemplateConfigValidator();
    }

    // =====================================================================
    // Reads
    // =====================================================================

    public function list(int $orgId, int $userId, array $filters = []): array
    {
        $this->ensureDefault($orgId, $userId);

        $type = $filters['template_type'] ?? 'payslip';
        if (!in_array($type, TemplateConfig::TYPES, true)) {
            throw new TemplateException('Invalid template type', 422, ['template_type' => 'Invalid template type']);
        }
        $status = $filters['status'] ?? null;
        if ($status !== null && $status !== '' && !in_array($status, TemplateConfig::STATUSES, true)) {
            throw new TemplateException('Invalid status', 422, ['status' => 'Invalid status']);
        }

        $rows = DocumentTemplate::listForOrg($orgId, ['template_type' => $type, 'status' => $status ?: null]);
        return $this->presentMany($rows);
    }

    public function get(int $orgId, int $userId, int $id): array
    {
        $this->ensureDefault($orgId, $userId);
        $t = DocumentTemplate::find($orgId, $id);
        if (!$t) {
            throw new TemplateException('Template not found', 404);
        }
        return $this->presentMany([$t])[0];
    }

    public function versions(int $orgId, int $id): array
    {
        $t = DocumentTemplate::find($orgId, $id);
        if (!$t) {
            throw new TemplateException('Template not found', 404);
        }
        return array_map(fn($v) => $this->presentVersion($v, $t), DocumentTemplateVersion::listFor($orgId, $id));
    }

    public function version(int $orgId, int $id, int $versionId): array
    {
        $t = DocumentTemplate::find($orgId, $id);
        $v = $t ? DocumentTemplateVersion::find($orgId, $id, $versionId) : null;
        if (!$t || !$v) {
            throw new TemplateException('Template version not found', 404);
        }
        return $this->presentVersion($v, $t);
    }

    // =====================================================================
    // Create / update
    // =====================================================================

    public function create(int $orgId, int $userId, array $input): array
    {
        $res = $this->validator->validateTemplate($input, $orgId);
        $v   = $res['value'];
        $errors = $res['errors'];

        if (!isset($errors['name']) && !isset($errors['template_type']) && DocumentTemplate::nameTaken($orgId, $v['template_type'], $v['name'])) {
            $errors['name'] = 'A template with this name already exists';
        }
        if ($errors) {
            throw new TemplateException('Validation failed', 422, $errors);
        }

        try {
            $id = DocumentTemplate::create([
                'organization_id' => $orgId,
                'template_type'   => $v['template_type'],
                'name'            => $v['name'],
                'layout_key'      => $v['layout_key'],
                'config'          => json_encode($v['config'], JSON_UNESCAPED_UNICODE),
                'header_logo_url' => $v['header_logo_url'],
                'primary_color'   => $v['primary_color'],
                'accent_color'    => $v['accent_color'],
                'footer_text'     => $v['footer_text'],
                'is_default'      => 0,
                'status'          => 'draft',
                'created_by'      => $userId,
                'updated_by'      => $userId,
            ]);
        } catch (\Throwable $e) {
            $this->rethrowDuplicate($e);
        }

        TemplateAuditLogger::log($orgId, $userId, 'document_template', $id, 'template_created', [
            'template_id' => $id, 'name' => $v['name'], 'layout' => $v['layout_key'], 'status' => 'draft',
        ]);

        return $this->get($orgId, $userId, $id);
    }

    public function update(int $orgId, int $userId, int $id, array $input): array
    {
        $info = $this->transaction(function () use ($orgId, $userId, $id, $input) {
            $t = DocumentTemplate::find($orgId, $id, true);
            if (!$t) {
                throw new TemplateException('Template not found', 404);
            }
            if ($t['status'] === 'archived') {
                throw new TemplateException('Archived templates cannot be edited. Activate the template to restore it first.', 409);
            }
            if (isset($input['template_type']) && $input['template_type'] !== $t['template_type']) {
                throw new TemplateException('Validation failed', 422, ['template_type' => 'Template type cannot be changed']);
            }

            $merged = $this->mergeOntoExisting($t, $input);
            $res    = $this->validator->validateTemplate($merged, $orgId);
            $v      = $res['value'];
            $errors = $res['errors'];
            if (!isset($errors['name']) && DocumentTemplate::nameTaken($orgId, $t['template_type'], $v['name'], $id)) {
                $errors['name'] = 'A template with this name already exists';
            }
            if ($errors) {
                throw new TemplateException('Validation failed', 422, $errors);
            }

            // Safety net: never overwrite a live configuration that has no snapshot.
            $snapshotId = null;
            if ($t['status'] === 'active' && empty($t['active_version_id'])) {
                $snap       = $this->snapshot($t, $userId);
                $snapshotId = $snap['id'];
                $t['active_version_id'] = $snap['id'];
            }

            DocumentTemplate::updateScoped($orgId, $id, [
                'name'            => $v['name'],
                'layout_key'      => $v['layout_key'],
                'config'          => json_encode($v['config'], JSON_UNESCAPED_UNICODE),
                'header_logo_url' => $v['header_logo_url'],
                'primary_color'   => $v['primary_color'],
                'accent_color'    => $v['accent_color'],
                'footer_text'     => $v['footer_text'],
                'active_version_id' => $t['active_version_id'] ?: null,
                'updated_by'      => $userId,
            ]);

            return ['status' => $t['status'], 'active_version_id' => $t['active_version_id'] ?: null, 'snapshot_id' => $snapshotId, 'name' => $v['name']];
        });

        TemplateAuditLogger::log($orgId, $userId, 'document_template', $id, 'template_updated', [
            'template_id'       => $id,
            'status'            => $info['status'],
            'active_version_id' => $info['active_version_id'],
            'snapshot_version_id' => $info['snapshot_id'],
            'requires_activation' => $info['status'] === 'active',
        ]);

        return $this->get($orgId, $userId, $id);
    }

    // =====================================================================
    // Activate / archive
    // =====================================================================

    public function activate(int $orgId, int $userId, int $id): array
    {
        $info = $this->transaction(function () use ($orgId, $userId, $id) {
            $target = DocumentTemplate::find($orgId, $id);
            if (!$target) {
                throw new TemplateException('Template not found', 404);
            }
            $type = $target['template_type'];
            $all  = DocumentTemplate::lockType($orgId, $type);       // serialises concurrent activations
            $row  = null;
            foreach ($all as $r) {
                if ($r['id'] === $id) {
                    $row = $r;
                }
            }
            if (!$row) {
                throw new TemplateException('Template not found', 404);
            }

            // Never activate something invalid (covers rows created before a rule existed).
            $res = $this->validator->validateTemplate($this->toInput($row), $orgId);
            if ($res['errors']) {
                throw new TemplateException('This template is invalid and cannot be activated', 422, $res['errors']);
            }

            $pending = $this->hasPendingChanges($row);
            if ($row['status'] === 'active' && !$pending) {
                return ['noop' => true, 'version_id' => $row['active_version_id'], 'version' => null, 'archived' => []];
            }

            $snap = $this->snapshot($row, $userId);

            $archived = [];
            foreach ($all as $r) {
                if ($r['id'] !== $id && $r['status'] === 'active') {
                    DocumentTemplate::updateScoped($orgId, $r['id'], ['status' => 'archived', 'is_default' => 0, 'updated_by' => $userId]);
                    $archived[] = $r['id'];
                }
            }
            DocumentTemplate::updateScoped($orgId, $id, [
                'status'            => 'active',
                'is_default'        => 1,
                'active_version_id' => $snap['id'],
                'updated_by'        => $userId,
            ]);

            return ['noop' => false, 'version_id' => $snap['id'], 'version' => $snap['version'], 'archived' => $archived];
        });

        if (!$info['noop']) {
            TemplateAuditLogger::log($orgId, $userId, 'document_template', $id, 'template_activated', [
                'template_id' => $id,
                'version_id'  => $info['version_id'],
                'version'     => $info['version'],
                'archived_template_ids' => $info['archived'],
            ]);
        }

        // Templates that lost "active" because of this activation are archived implicitly — record that too.
        foreach ($info['archived'] ?? [] as $archivedId) {
            TemplateAuditLogger::log($orgId, $userId, 'document_template', $archivedId, 'template_archived', [
                'template_id' => $archivedId,
                'reason'      => 'superseded_by_activation',
                'superseded_by_template_id' => $id,
            ]);
        }

        $out = $this->get($orgId, $userId, $id);
        $out['activation'] = ['changed' => !$info['noop']];
        return $out;
    }

    public function archive(int $orgId, int $userId, int $id): array
    {
        $changed = $this->transaction(function () use ($orgId, $userId, $id) {
            $t = DocumentTemplate::find($orgId, $id, true);
            if (!$t) {
                throw new TemplateException('Template not found', 404);
            }
            if ($t['status'] === 'archived') {
                return false;
            }
            if ($t['status'] === 'active') {
                throw new TemplateException('The active template cannot be archived. Activate another template first.', 409);
            }
            DocumentTemplate::updateScoped($orgId, $id, ['status' => 'archived', 'is_default' => 0, 'updated_by' => $userId]);
            return true;
        });

        if ($changed) {
            TemplateAuditLogger::log($orgId, $userId, 'document_template', $id, 'template_archived', ['template_id' => $id]);
        }
        return $this->get($orgId, $userId, $id);
    }

    // =====================================================================
    // Defaults & generation support
    // =====================================================================

    /**
     * Guarantee the organisation has an active payslip template with a
     * snapshot. Safe to call on every request: one indexed read when healthy.
     */
    public function ensureDefault(int $orgId, ?int $userId = null, string $type = 'payslip'): void
    {
        $active = DocumentTemplate::activeFor($orgId, $type);
        if ($active && !empty($active['active_version_id'])) {
            return;
        }

        $this->transaction(function () use ($orgId, $userId, $type) {
            // Serialise per organisation so two admins opening the module cannot both create one.
            DB::raw('SELECT id FROM organizations WHERE id = :id FOR UPDATE', [':id' => $orgId]);

            $active = DocumentTemplate::activeFor($orgId, $type);
            if ($active && !empty($active['active_version_id'])) {
                return;
            }
            if ($active) {                       // active row without a snapshot: repair it
                $snap = $this->snapshot($active, $userId);
                DocumentTemplate::updateScoped($orgId, $active['id'], ['active_version_id' => $snap['id']]);
                return;
            }

            $name = 'Default Modern';
            for ($i = 2; DocumentTemplate::nameTaken($orgId, $type, $name); $i++) {
                $name = "Default Modern ({$i})";
            }
            $config = TemplateConfig::defaultConfig('modern');
            $id = DocumentTemplate::create([
                'organization_id' => $orgId,
                'template_type'   => $type,
                'name'            => $name,
                'layout_key'      => 'modern',
                'config'          => json_encode($config, JSON_UNESCAPED_UNICODE),
                'header_logo_url' => TemplateConfig::ORG_LOGO_SENTINEL,
                'primary_color'   => TemplateConfig::LAYOUT_COLORS['modern']['primary'],
                'accent_color'    => TemplateConfig::LAYOUT_COLORS['modern']['accent'],
                'footer_text'     => $config['footerText'],
                'is_default'      => 1,
                'status'          => 'active',
                'created_by'      => $userId,
                'updated_by'      => $userId,
            ]);
            $row  = DocumentTemplate::find($orgId, $id);
            $snap = $this->snapshot($row, $userId);
            DocumentTemplate::updateScoped($orgId, $id, ['active_version_id' => $snap['id']]);

            if ($userId) {
                TemplateAuditLogger::log($orgId, $userId, 'document_template', $id, 'template_created', [
                    'template_id' => $id, 'system_default' => true, 'version_id' => $snap['id'],
                ]);
            }
        });
    }

    /**
     * The template + immutable version PDFs must be generated from.
     *
     * @return array{template: array, version: array}
     */
    public function getActiveForGeneration(int $orgId, int $userId, string $type = 'payslip'): array
    {
        $this->ensureDefault($orgId, $userId, $type);
        $t = DocumentTemplate::activeFor($orgId, $type);
        $v = $t && $t['active_version_id'] ? DocumentTemplateVersion::find($orgId, $t['id'], $t['active_version_id']) : null;
        if (!$t || !$v) {
            throw new TemplateException('No active payslip template is available', 409);
        }
        return ['template' => $t, 'version' => $v];
    }

    /**
     * Render context from a stored template row OR a version row.
     * (Both carry config + header_logo_url + colours.)
     */
    public function renderContext(array $row, ?string $orgLogoUrl): array
    {
        $config = $row['config'];
        return [
            'layout'        => $config['layout'] ?? ($row['layout_key'] ?? 'modern'),
            'config'        => $this->validatedConfigOrDefault($config),
            'primary_color' => $row['primary_color'] ?? null,
            'accent_color'  => $row['accent_color'] ?? null,
            'logo_data_uri' => LogoResolver::dataUri($row['header_logo_url'] ?? null, $orgLogoUrl),
        ];
    }

    /**
     * Context for a draft coming from the editor (unsaved changes), validated
     * exactly like a save. $templateId supplies defaults for anything omitted.
     */
    public function draftContext(int $orgId, int $templateId, ?array $draft, ?string $orgLogoUrl): array
    {
        $t = DocumentTemplate::find($orgId, $templateId);
        if (!$t) {
            throw new TemplateException('Template not found', 404);
        }
        $input = $draft === null ? $this->toInput($t) : $this->mergeOntoExisting($t, $draft);
        $res   = $this->validator->validateTemplate($input, $orgId);
        if ($res['errors']) {
            throw new TemplateException('Validation failed', 422, $res['errors']);
        }
        $v = $res['value'];
        return [
            'template' => $t,
            'context'  => [
                'layout'        => $v['layout_key'],
                'config'        => $v['config'],
                'primary_color' => $v['primary_color'],
                'accent_color'  => $v['accent_color'],
                'logo_data_uri' => LogoResolver::dataUri($v['header_logo_url'], $orgLogoUrl),
            ],
        ];
    }

    // =====================================================================
    // Presentation (API shape — never exposes internal file paths)
    // =====================================================================

    /** @param array[] $templates */
    private function presentMany(array $templates): array
    {
        if (!$templates) {
            return [];
        }
        $ids      = array_column($templates, 'id');
        $in       = implode(',', array_map('intval', $ids));        // ints only
        $latest   = [];
        foreach (DB::raw("SELECT template_id, MAX(version) AS latest FROM document_template_versions WHERE template_id IN ($in) GROUP BY template_id") as $r) {
            $latest[(int) $r->template_id] = (int) $r->latest;
        }
        $activeIds = array_filter(array_column($templates, 'active_version_id'));
        $actives   = [];
        if ($activeIds) {
            $inA = implode(',', array_map('intval', $activeIds));
            foreach (DB::raw("SELECT * FROM document_template_versions WHERE id IN ($inA)") as $r) {
                $actives[(int) $r->id] = DocumentTemplateVersion::hydrate($r);
            }
        }

        return array_map(function (array $t) use ($latest, $actives) {
            $av = $actives[$t['active_version_id'] ?? 0] ?? null;
            return [
                'id'                  => $t['id'],
                'organization_id'     => $t['organization_id'],
                'template_type'       => $t['template_type'],
                'name'                => $t['name'],
                'layout_key'          => $t['layout_key'],
                'config'              => $t['config'],
                'logo'                => $this->logoShape($t['header_logo_url'] ?? null),
                'primary_color'       => $t['primary_color'],
                'accent_color'        => $t['accent_color'],
                'resolved_colors'     => TemplateConfig::colorsFor($t['layout_key'], $t['primary_color'], $t['accent_color']),
                'footer_text'         => $t['footer_text'],
                'is_default'          => (bool) $t['is_default'],
                'status'              => $t['status'],
                'active_version_id'   => $t['active_version_id'] ?? null,
                'active_version'      => $av['version'] ?? null,
                'latest_version'      => $latest[$t['id']] ?? null,
                'has_pending_changes' => $t['status'] === 'active' && $av ? $this->differsFrom($t, $av) : false,
                'created_by'          => $t['created_by'] ?? null,
                'updated_by'          => $t['updated_by'] ?? null,
                'created_at'          => $t['created_at'],
                'updated_at'          => $t['updated_at'],
            ];
        }, $templates);
    }

    private function presentVersion(array $v, array $template): array
    {
        return [
            'id'              => $v['id'],
            'template_id'     => $v['template_id'],
            'version'         => $v['version'],
            'is_active'       => ($template['active_version_id'] ?? null) === $v['id'],
            'config'          => $v['config'],
            'logo'            => $this->logoShape($v['header_logo_url'] ?? null),
            'primary_color'   => $v['primary_color'],
            'accent_color'    => $v['accent_color'],
            'footer_text'     => $v['footer_text'],
            'created_by'      => $v['created_by'] ?? null,
            'created_by_name' => isset($v['created_by_name']) ? trim((string) $v['created_by_name']) : null,
            'created_at'      => $v['created_at'],
        ];
    }

    /** {mode, token}: the stored path is internal; only an opaque token leaves the server. */
    private function logoShape(?string $stored): array
    {
        if ($stored === null || $stored === '') {
            return ['mode' => 'none'];
        }
        if ($stored === TemplateConfig::ORG_LOGO_SENTINEL) {
            return ['mode' => 'organization'];
        }
        return ['mode' => 'uploaded', 'token' => basename($stored)];
    }

    // =====================================================================
    // Internals
    // =====================================================================

    /** A stored row expressed as validator input. */
    private function toInput(array $t): array
    {
        return [
            'name'          => $t['name'],
            'template_type' => $t['template_type'],
            'layout_key'    => $t['layout_key'],
            'config'        => $t['config'],
            'logo'          => $this->logoShape($t['header_logo_url'] ?? null),
            'primary_color' => $t['primary_color'],
            'accent_color'  => $t['accent_color'],
        ];
    }

    /** Patch semantics: provided fields replace stored ones; config is merged key-by-key. */
    private function mergeOntoExisting(array $t, array $input): array
    {
        $base = $this->toInput($t);
        foreach ($input as $k => $val) {
            if ($k === 'config' && is_array($val)) {
                $base['config'] = array_replace_recursive($base['config'], $val);
            } else {
                $base[$k] = $val;
            }
        }
        // layout_key is the source of truth when the caller changes layout only
        if (isset($input['layout_key']) && !isset($input['config']['layout'])) {
            $base['config']['layout'] = $input['layout_key'];
        }
        return $base;
    }

    private function snapshot(array $t, ?int $userId): array
    {
        $version = DocumentTemplateVersion::nextVersion($t['id']);
        $id = DocumentTemplateVersion::create([
            'template_id'     => $t['id'],
            'version'         => $version,
            'config'          => json_encode($t['config'], JSON_UNESCAPED_UNICODE),
            'header_logo_url' => $t['header_logo_url'] ?? null,
            'primary_color'   => $t['primary_color'],
            'accent_color'    => $t['accent_color'],
            'footer_text'     => $t['footer_text'],
            'created_by'      => $userId,
        ]);
        return ['id' => $id, 'version' => $version];
    }

    private function hasPendingChanges(array $t): bool
    {
        if (empty($t['active_version_id'])) {
            return true;
        }
        $rows = DB::raw('SELECT * FROM document_template_versions WHERE id = :id AND template_id = :t LIMIT 1', [':id' => $t['active_version_id'], ':t' => $t['id']]);
        return !$rows || $this->differsFrom($t, DocumentTemplateVersion::hydrate($rows[0]));
    }

    private function differsFrom(array $t, array $v): bool
    {
        return TemplateConfig::fingerprint($t['config'], $t['header_logo_url'] ?? null, $t['primary_color'], $t['accent_color'], $t['footer_text'])
            !== TemplateConfig::fingerprint($v['config'], $v['header_logo_url'] ?? null, $v['primary_color'], $v['accent_color'], $v['footer_text']);
    }

    /**
     * Stored configs were validated on write, but a defensive pass keeps a
     * hand-edited row from reaching the renderer with unknown keys.
     */
    private function validatedConfigOrDefault(array $config): array
    {
        // 'value' is always complete and normalised (unknown keys are dropped here, rejected on write)
        return $this->validator->validateConfig($config)['value'];
    }

    /** Own transaction helper: keeps exception types (DB::transaction() re-wraps them). */
    private function transaction(callable $fn)
    {
        $pdo = $GLOBALS['pdo'] ?? null;
        if (!$pdo instanceof \PDO) {
            throw new \RuntimeException('No database connection');
        }
        if ($pdo->inTransaction()) {
            return $fn();
        }
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($e instanceof TemplateException) {
                throw $e;
            }
            $this->rethrowDuplicate($e);
        }
    }

    /** Map the unique-name violation to a friendly validation error. */
    private function rethrowDuplicate(\Throwable $e): never
    {
        if (str_contains($e->getMessage(), '1062') || stripos($e->getMessage(), 'Duplicate entry') !== false) {
            throw new TemplateException('Validation failed', 422, ['name' => 'A template with this name already exists']);
        }
        throw $e;
    }
}
