<?php

namespace App\Controllers;

use App\Middleware\AuthMiddleware;
use App\Services\DocumentTemplateService;
use App\Services\Templates\LogoResolver;
use App\Services\Templates\PayslipDataBuilder;
use App\Services\Templates\PayslipPdfGenerator;
use App\Services\Templates\PayslipTemplateRenderer;
use App\Services\Templates\TemplateAuditLogger;
use App\Services\Templates\TemplateConfig;
use App\Services\Templates\TemplateException;
use App\Services\Templates\TemplatePreviewService;
use App\Services\Templates\TemplateVariables;

/**
 * /api/v1/organizations/{org_id}/templates*
 *
 * Authorisation (role + tenant match) is enforced by
 * DocumentTemplateAuthorizationMiddleware BEFORE any method here runs; every
 * query below is additionally scoped by organization_id.
 */
class DocumentTemplateController
{
    private DocumentTemplateService $service;

    public function __construct()
    {
        $this->service = new DocumentTemplateService();
    }

    // GET /templates?template_type=payslip&status=
    public function index($orgId): mixed
    {
        return $this->run(function () use ($orgId) {
            $org  = $this->id($orgId);
            $rows = $this->service->list($org, $this->userId(), [
                'template_type' => $_GET['template_type'] ?? 'payslip',
                'status'        => $_GET['status'] ?? null,
            ]);
            return responseJson(success: true, data: $rows, message: 'Templates fetched successfully', metadata: ['count' => count($rows)]);
        });
    }

    // GET /templates/meta
    public function meta($orgId): mixed
    {
        return $this->run(function () {
            $layouts = [];
            foreach (TemplateConfig::LAYOUTS as $key) {
                $layouts[] = [
                    'key'         => $key,
                    'label'       => TemplateConfig::LAYOUT_META[$key]['label'],
                    'description' => TemplateConfig::LAYOUT_META[$key]['description'],
                    'colors'      => TemplateConfig::LAYOUT_COLORS[$key],
                ];
            }
            return responseJson(success: true, message: 'Template metadata', data: [
                'layouts'         => $layouts,
                'default_config'  => TemplateConfig::defaultConfig('modern'),
                'label_defaults'  => TemplateConfig::LABEL_DEFAULTS,
                'boolean_keys'    => TemplateConfig::BOOLEAN_KEYS,
                'mandatory_keys'  => TemplateConfig::MANDATORY_TRUE,
                'section_keys'    => TemplateConfig::SECTION_KEYS,
                'template_types'  => TemplateConfig::RENDERABLE_TYPES,
                'variables'       => TemplateVariables::names(),
                'limits'          => [
                    'name'          => TemplateConfig::MAX_NAME_LENGTH,
                    'document_title' => TemplateConfig::MAX_TITLE_LENGTH,
                    'footer_text'   => TemplateConfig::MAX_FOOTER_LENGTH,
                    'label'         => TemplateConfig::MAX_LABEL_LENGTH,
                    'logo_bytes'    => LogoResolver::MAX_UPLOAD_BYTES,
                ],
            ]);
        });
    }

    // GET /templates/{id}
    public function show($orgId, $id): mixed
    {
        return $this->run(function () use ($orgId, $id) {
            $t = $this->service->get($this->id($orgId), $this->userId(), $this->id($id));
            return responseJson(success: true, data: $t, message: 'Template fetched successfully');
        });
    }

    // POST /templates
    public function store($orgId): mixed
    {
        return $this->run(function () use ($orgId) {
            $t = $this->service->create($this->id($orgId), $this->userId(), getInputData());
            return responseJson(success: true, data: $t, message: 'Template created as draft', code: 201);
        });
    }

    // PUT /templates/{id}
    public function update($orgId, $id): mixed
    {
        return $this->run(function () use ($orgId, $id) {
            $t = $this->service->update($this->id($orgId), $this->userId(), $this->id($id), getInputData());
            $msg = $t['status'] === 'active'
                ? 'Draft changes saved. Activate the template to use them for new payslips.'
                : 'Template saved';
            return responseJson(success: true, data: $t, message: $msg);
        });
    }

    // POST /templates/{id}/activate
    public function activate($orgId, $id): mixed
    {
        return $this->run(function () use ($orgId, $id) {
            $t = $this->service->activate($this->id($orgId), $this->userId(), $this->id($id));
            $changed = $t['activation']['changed'] ?? true;
            return responseJson(
                success: true,
                data: $t,
                message: $changed ? 'Template activated. New payslips will use this version.' : 'Template is already active with no pending changes'
            );
        });
    }

    // POST /templates/{id}/archive
    public function archive($orgId, $id): mixed
    {
        return $this->run(function () use ($orgId, $id) {
            $t = $this->service->archive($this->id($orgId), $this->userId(), $this->id($id));
            return responseJson(success: true, data: $t, message: 'Template archived');
        });
    }

    // GET /templates/{id}/versions
    public function versions($orgId, $id): mixed
    {
        return $this->run(function () use ($orgId, $id) {
            $v = $this->service->versions($this->id($orgId), $this->id($id));
            return responseJson(success: true, data: $v, message: 'Template versions fetched successfully', metadata: ['count' => count($v)]);
        });
    }

    // GET /templates/{id}/versions/{versionId}
    public function version($orgId, $id, $versionId): mixed
    {
        return $this->run(function () use ($orgId, $id, $versionId) {
            $v = $this->service->version($this->id($orgId), $this->id($id), $this->id($versionId));
            return responseJson(success: true, data: $v, message: 'Template version fetched successfully');
        });
    }

    // POST /templates/{id}/preview   body: {payrun_id?, employee_id?, draft?, format?: html|pdf, live?: bool}
    public function preview($orgId, $id): mixed
    {
        return $this->run(function () use ($orgId, $id) {
            $org  = $this->id($orgId);
            $tid  = $this->id($id);
            $user = AuthMiddleware::getCurrentUser();
            $body = getInputData();

            $svc = new TemplatePreviewService(
                $this->service, new PayslipDataBuilder(), new PayslipTemplateRenderer(), new PayslipPdfGenerator()
            );
            $res = $svc->preview($org, $user, AuthMiddleware::getCurrentEmployee(), $tid, $body);

            // Auto-refreshing editor previews (live:true) are not audited — only deliberate ones are.
            if (empty($body['live'])) {
                TemplateAuditLogger::log($org, (int) $user['id'], 'document_template', $tid, 'template_previewed', [
                    'template_id' => $tid,
                    'format'      => $res['format'],
                    'sample'      => $res['sample'],
                    'payrun_id'   => $body['payrun_id'] ?? null,
                    'employee_id' => $body['employee_id'] ?? null,
                    'unsaved_draft' => isset($body['draft']),
                ]);
            }

            if ($res['format'] === 'pdf') {
                header_remove('Content-Type');
                header('Content-Type: application/pdf');
                header('Content-Disposition: inline; filename="payslip-preview.pdf"');
                header('Content-Length: ' . strlen($res['pdf']));
                header('Cache-Control: private, no-store');
                header('X-Content-Type-Options: nosniff');
                http_response_code(200);
                echo $res['pdf'];
                exit;
            }

            return responseJson(success: true, message: 'Preview rendered', data: [
                'format' => 'html',
                'sample' => $res['sample'],
                'html'   => $res['html'],
            ]);
        });
    }

    // GET /templates/preview-options?payrun_id=
    public function previewOptions($orgId): mixed
    {
        return $this->run(function () use ($orgId) {
            $svc = new TemplatePreviewService(
                $this->service, new PayslipDataBuilder(), new PayslipTemplateRenderer(), new PayslipPdfGenerator()
            );
            $payrunId = isset($_GET['payrun_id']) && ctype_digit((string) $_GET['payrun_id']) ? (int) $_GET['payrun_id'] : null;
            $data = $svc->options($this->id($orgId), AuthMiddleware::getCurrentUser(), AuthMiddleware::getCurrentEmployee(), $payrunId);
            return responseJson(success: true, data: $data, message: 'Preview options fetched successfully');
        });
    }

    // POST /templates/logo   (multipart/form-data, field "logo")
    public function uploadLogo($orgId): mixed
    {
        return $this->run(function () use ($orgId) {
            $res = LogoResolver::storeUpload($this->id($orgId), $_FILES['logo'] ?? []);
            if (isset($res['error'])) {
                throw new TemplateException($res['error'], 422, ['logo' => $res['error']]);
            }
            return responseJson(success: true, message: 'Logo uploaded', code: 201, data: [
                'logo' => ['mode' => 'uploaded', 'token' => $res['token']],
            ]);
        });
    }

    // =====================================================================

    /** Uniform error handling: business errors → their code, anything else → generic 500 (details go to the log). */
    private function run(callable $fn): mixed
    {
        try {
            return $fn();
        } catch (TemplateException $e) {
            return responseJson(success: false, data: null, message: $e->getMessage(), code: $e->getCode() ?: 422, errors: $e->errors);
        } catch (\Throwable $e) {
            error_log('DocumentTemplateController: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            return responseJson(success: false, data: null, message: 'Something went wrong while processing the template request', code: 500);
        }
    }

    private function id($v): int
    {
        if (!ctype_digit((string) $v) || (int) $v < 1) {
            throw new TemplateException('Not found', 404);
        }
        return (int) $v;
    }

    private function userId(): int
    {
        $u = AuthMiddleware::getCurrentUser();
        return (int) ($u['id'] ?? 0);
    }
}
