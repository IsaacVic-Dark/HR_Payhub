<?php

namespace App\Services\Templates;

use App\Services\DB;
use App\Services\DocumentTemplateService;

/**
 * Renders a template — saved draft or unsaved editor state — with either a
 * real payroll record the caller may see, or built-in sample data.
 *
 * A preview NEVER writes: no payslips row, no PDF on disk, no status change.
 */
final class TemplatePreviewService
{
    public function __construct(
        private DocumentTemplateService $templates,
        private PayslipDataBuilder $builder,
        private PayslipTemplateRenderer $renderer,
        private PayslipPdfGenerator $pdf
    ) {
    }

    /**
     * @param array  $user      authenticated user row
     * @param ?array $employee  authenticated user's employee row (for department scoping)
     * @param array  $body      {payrun_id?, employee_id?, draft?, format?}
     * @return array{html: string, pdf: ?string, sample: bool, format: string}
     */
    public function preview(int $orgId, array $user, ?array $employee, int $templateId, array $body): array
    {
        $allowed = ['payrun_id', 'employee_id', 'draft', 'format', 'live'];
        foreach (array_keys($body) as $k) {
            if (!in_array($k, $allowed, true)) {
                throw new TemplateException('Validation failed', 422, [(string) $k => 'Unknown field']);
            }
        }
        $format = $body['format'] ?? 'html';
        if (!in_array($format, ['html', 'pdf'], true)) {
            throw new TemplateException('Validation failed', 422, ['format' => 'Format must be html or pdf']);
        }
        if (isset($body['draft']) && !is_array($body['draft'])) {
            throw new TemplateException('Validation failed', 422, ['draft' => 'Draft must be an object']);
        }

        $org = $this->builder->organization($orgId);
        if (!$org) {
            throw new TemplateException('Organization not found', 404);
        }

        $resolved = $this->templates->draftContext($orgId, $templateId, $body['draft'] ?? null, $org->logo_url);
        $ctx      = $resolved['context'];

        $payrunId   = $body['payrun_id'] ?? null;
        $employeeId = $body['employee_id'] ?? null;
        $isSample   = $payrunId === null && $employeeId === null;

        if ($isSample) {
            $data = $this->builder->sample($orgId, $ctx['logo_data_uri']);
        } else {
            if (!is_int($payrunId) && !(is_string($payrunId) && ctype_digit($payrunId))
                || !is_int($employeeId) && !(is_string($employeeId) && ctype_digit($employeeId))) {
                throw new TemplateException('Validation failed', 422, ['payrun_id' => 'payrun_id and employee_id must both be provided']);
            }
            $payrunId   = (int) $payrunId;
            $employeeId = (int) $employeeId;

            $this->assertMayViewEmployee($orgId, $user, $employee, $employeeId);

            $rows = DB::raw(
                'SELECT pd.id, pr.pay_period_start FROM payrun_details pd
           INNER JOIN payruns pr ON pr.id = pd.payrun_id
                WHERE pd.payrun_id = :p AND pd.employee_id = :e AND pd.organization_id = :o AND pr.organization_id = :o2
                LIMIT 1',
                [':p' => $payrunId, ':e' => $employeeId, ':o' => $orgId, ':o2' => $orgId]
            );
            if (!$rows) {
                throw new TemplateException('No payroll record found for that employee in this payrun', 404);
            }
            $detailId = (int) $rows[0]->id;

            // Read-only: reuse the number of an existing payslip so the preview matches it.
            $existing = DB::raw(
                'SELECT payslip_number, generated_at, status FROM payslips WHERE payrun_id = :p AND employee_id = :e AND organization_id = :o LIMIT 1',
                [':p' => $payrunId, ':e' => $employeeId, ':o' => $orgId]
            );
            $slip = $existing[0] ?? (object) [
                'payslip_number' => sprintf('PAYSLIP-%s-EMP%d', date('Y-m', strtotime((string) $rows[0]->pay_period_start)), $employeeId),
                'generated_at'   => null,
                'status'         => 'preview',
            ];

            $data = $this->builder->build($orgId, $detailId, $slip, $ctx['logo_data_uri'], !empty($ctx['config']['showLeaveSummary']));
            if ($data === null) {
                throw new TemplateException('No payroll record found for that employee in this payrun', 404);
            }
        }

        $html = $this->renderer->render($ctx, $data, ['sample' => $isSample]);

        $pdf = null;
        if ($format === 'pdf') {
            $pdf = $this->pdf->render($html, [
                'title'   => ($ctx['config']['documentTitle'] ?? 'Payslip') . ' (preview)',
                'subject' => 'Preview',
            ]);
        }

        return ['html' => $html, 'pdf' => $pdf, 'sample' => $isSample, 'format' => $format];
    }

    /**
     * Payruns and employees the caller can pick in the preview screen.
     */
    public function options(int $orgId, array $user, ?array $employee, ?int $payrunId): array
    {
        $payruns = DB::raw(
            'SELECT id, payrun_name, pay_period_start, pay_period_end, status
               FROM payruns WHERE organization_id = :o
           ORDER BY pay_period_end DESC, id DESC LIMIT 24',
            [':o' => $orgId]
        );

        $employees = [];
        if ($payrunId) {
            $owned = DB::raw('SELECT id FROM payruns WHERE id = :p AND organization_id = :o LIMIT 1', [':p' => $payrunId, ':o' => $orgId]);
            if (!$owned) {
                throw new TemplateException('Payrun not found', 404);
            }
            $sql    = "SELECT e.id, e.employee_number, CONCAT(e.firstname, ' ', e.surname) AS full_name
                         FROM payrun_details pd
                   INNER JOIN employees e ON e.id = pd.employee_id
                        WHERE pd.payrun_id = :p AND pd.organization_id = :o AND e.organization_id = :o2";
            $params = [':p' => $payrunId, ':o' => $orgId, ':o2' => $orgId];

            if (($user['user_type'] ?? '') === 'payroll_officer') {
                $dept = $this->officerDepartment($employee);
                if (!$dept) {
                    $sql .= ' AND 1 = 0';
                } else {
                    $sql .= ' AND e.department_id = :dept';
                    $params[':dept'] = $dept;
                }
            }
            $employees = DB::raw($sql . ' ORDER BY e.firstname, e.surname LIMIT 300', $params);
        }

        return ['payruns' => $payruns, 'employees' => $employees];
    }

    // ------------------------------------------------------------------

    /** admin & payroll_manager: whole organisation. payroll_officer: own department only. */
    private function assertMayViewEmployee(int $orgId, array $user, ?array $employee, int $employeeId): void
    {
        $role = $user['user_type'] ?? '';
        if (in_array($role, ['admin', 'payroll_manager'], true)) {
            return;
        }
        if ($role === 'payroll_officer') {
            $dept = $this->officerDepartment($employee);
            $rows = $dept ? DB::raw(
                'SELECT id FROM employees WHERE id = :e AND organization_id = :o AND department_id = :d LIMIT 1',
                [':e' => $employeeId, ':o' => $orgId, ':d' => $dept]
            ) : [];
            if ($rows) {
                return;
            }
        }
        throw new TemplateException('You do not have access to this employee\'s payroll data', 403);
    }

    private function officerDepartment(?array $employee): ?int
    {
        return !empty($employee['department_id']) ? (int) $employee['department_id'] : null;
    }
}
