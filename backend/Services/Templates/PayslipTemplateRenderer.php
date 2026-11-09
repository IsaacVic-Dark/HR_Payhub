<?php

namespace App\Services\Templates;

/**
 * Turns (template config + allowlisted payslip data) into self-contained HTML.
 *
 * SECURITY MODEL
 *  - Layouts are PHP owned by the system. Admin input is data only; it is
 *    never parsed as markup, CSS or an expression.
 *  - Every dynamic value goes through e() (htmlspecialchars) before output.
 *  - The only values placed in CSS are colours, re-validated here as #RRGGBB.
 *  - No <script>, no external CSS/fonts/images. The only image is a base64
 *    data: URI produced by LogoResolver.
 *  - A CSP <meta> locks the document down when it is shown in the browser
 *    preview iframe.
 *
 * The HTML uses tables and inline-safe CSS only so Dompdf and browsers
 * render it the same way (no flexbox/grid).
 */
final class PayslipTemplateRenderer
{
    /**
     * @param array $ctx   ['layout','config','primary_color','accent_color','logo_data_uri']
     * @param array $data  Output of PayslipDataBuilder (already allowlisted)
     * @param array $opts  ['sample' => bool]  adds a SAMPLE ribbon
     */
    public function render(array $ctx, array $data, array $opts = []): string
    {
        $config = $ctx['config'];
        $layout = in_array($ctx['layout'] ?? '', TemplateConfig::LAYOUTS, true) ? $ctx['layout'] : 'modern';
        $colors = TemplateConfig::colorsFor($layout, $this->hex($ctx['primary_color'] ?? null), $this->hex($ctx['accent_color'] ?? null));
        $logo   = $this->safeDataUri($ctx['logo_data_uri'] ?? null);

        $view = new RenderView($config, $data, $colors, $logo, !empty($opts['sample']));

        $body = match ($layout) {
            'classic' => $this->classic($view),
            'minimal' => $this->minimal($view),
            default   => $this->modern($view),
        };

        $title = $view->e($config['documentTitle'] . ' - ' . ($data['employee']['full_name'] ?? ''));
        $css   = $this->css($layout, $colors);

        return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            . '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'">'
            . '<title>' . $title . '</title><style>' . $css . '</style></head><body>'
            . ($view->sample ? '<div class="sample">SAMPLE DATA</div>' : '')
            . $body . '</body></html>';
    }

    // ==================================================================
    // MODERN — card based
    // ==================================================================
    private function modern(RenderView $v): string
    {
        $c = $v->config;
        $h = '';

        if ($c['showCompanyHeader']) {
            $h .= '<table class="band"><tr>'
                . '<td class="band-l">' . $v->logoImg(46) . '<div class="co-name">' . $v->e($v->d('organization.name')) . '</div>'
                . '<div class="co-sub">' . $v->companyLines() . '</div></td>'
                . '<td class="band-r"><div class="doc-title">' . $v->e($c['documentTitle']) . '</div>'
                . '<div class="doc-sub">' . $v->period() . '</div>'
                . ($v->d('payslip.payslip_number') ? '<div class="doc-sub">' . $v->label('payslipNumber') . ': ' . $v->e($v->d('payslip.payslip_number')) . '</div>' : '')
                . '</td></tr></table>';
        } else {
            $h .= '<div class="doc-title dark">' . $v->e($c['documentTitle']) . '</div>';
        }

        if ($c['showEmployeeDetails']) {
            $h .= '<table class="card gap"><tr><td class="card-pad">'
                . '<table class="kv"><tr>'
                . $v->kvCell($v->label('employee'), $v->d('employee.full_name'))
                . $v->kvCell($v->label('employeeNumber'), $v->d('employee.employee_number'))
                . $v->kvCell($v->label('jobTitle'), $v->d('employee.job_title'))
                . '</tr><tr>'
                . $v->kvCell($v->label('department'), $v->d('employee.department'))
                . $v->kvCell($v->label('hireDate'), $v->date($v->d('employee.hire_date')))
                . ($c['showPaymentDate'] ? $v->kvCell($v->label('paymentDate'), $v->date($v->d('payslip.payment_date'))) : '<td></td>')
                . '</tr></table></td></tr></table>';
        }

        if ($c['showPaymentSummary']) {
            $h .= '<table class="summary gap"><tr>'
                . '<td class="sum-card">' . '<div class="sum-l">' . $v->label('grossPay') . '</div><div class="sum-v">' . $v->money($v->n('payroll.gross_pay')) . '</div></td>'
                . '<td class="sum-sp"></td>'
                . '<td class="sum-card">' . '<div class="sum-l">' . $v->label('totalDeductions') . '</div><div class="sum-v">' . $v->money($v->n('payroll.total_deductions')) . '</div></td>'
                . '<td class="sum-sp"></td>'
                . '<td class="sum-card net">' . '<div class="sum-l">' . $v->label('netPay') . '</div><div class="sum-v">' . $v->money($v->n('payroll.net_pay')) . '</div></td>'
                . '</tr></table>';
        }

        foreach ($v->orderedSections() as $section) {
            $h .= '<table class="card gap"><tr><td class="card-pad">'
                . '<div class="sec-title">' . $v->label($section === 'earnings' ? 'earnings' : 'deductions') . '</div>'
                . $v->sectionTable($section)
                . '</td></tr></table>';
        }

        $h .= $v->extras('card gap', 'sec-title');

        // Net pay is always shown, even if the summary cards were somehow absent.
        $h .= '<table class="netbar gap"><tr><td>' . $v->label('netPay') . '</td><td class="r">' . $v->money($v->n('payroll.net_pay')) . '</td></tr></table>';

        return $h . $v->footer();
    }

    // ==================================================================
    // CLASSIC — bordered, formal, print friendly
    // ==================================================================
    private function classic(RenderView $v): string
    {
        $c = $v->config;
        $h = '';

        if ($c['showCompanyHeader']) {
            $h .= '<table class="chead"><tr><td class="chead-l">' . $v->logoImg(54) . '</td>'
                . '<td class="chead-c"><div class="co-name">' . $v->e($v->d('organization.name')) . '</div>'
                . '<div class="co-sub">' . $v->companyLines() . '</div></td><td class="chead-r"></td></tr></table>';
        }
        $h .= '<div class="rule"></div><div class="doc-title center">' . $v->e(mb_strtoupper($c['documentTitle'])) . '</div>'
            . '<div class="center doc-sub">' . $v->period() . '</div>';

        if ($c['showEmployeeDetails']) {
            $h .= '<table class="grid gap"><tr>'
                . '<td class="g-k">' . $v->label('employee') . '</td><td>' . $v->e($v->d('employee.full_name')) . '</td>'
                . '<td class="g-k">' . $v->label('employeeNumber') . '</td><td>' . $v->e($v->d('employee.employee_number')) . '</td></tr><tr>'
                . '<td class="g-k">' . $v->label('jobTitle') . '</td><td>' . $v->e($v->d('employee.job_title')) . '</td>'
                . '<td class="g-k">' . $v->label('department') . '</td><td>' . $v->e($v->d('employee.department')) . '</td></tr><tr>'
                . '<td class="g-k">' . $v->label('hireDate') . '</td><td>' . $v->e($v->date($v->d('employee.hire_date'))) . '</td>'
                . '<td class="g-k">' . $v->label('payslipNumber') . '</td><td>' . $v->e($v->d('payslip.payslip_number')) . '</td></tr>'
                . ($c['showPaymentDate'] ? '<tr><td class="g-k">' . $v->label('paymentDate') . '</td><td colspan="3">' . $v->e($v->date($v->d('payslip.payment_date'))) . '</td></tr>' : '')
                . '</table>';
        }

        foreach ($v->orderedSections() as $section) {
            $h .= '<div class="c-sec">' . $v->label($section === 'earnings' ? 'earnings' : 'deductions') . '</div>' . $v->sectionTable($section);
        }

        $h .= $v->extras('', 'c-sec');

        if ($c['showPaymentSummary']) {
            $h .= '<table class="grid gap totals">'
                . '<tr><td class="g-k">' . $v->label('grossPay') . '</td><td class="r">' . $v->money($v->n('payroll.gross_pay')) . '</td></tr>'
                . '<tr><td class="g-k">' . $v->label('totalDeductions') . '</td><td class="r">' . $v->money($v->n('payroll.total_deductions')) . '</td></tr>'
                . '<tr class="net-row"><td class="g-k">' . $v->label('netPay') . '</td><td class="r">' . $v->money($v->n('payroll.net_pay')) . '</td></tr></table>';
        } else {
            $h .= '<table class="grid gap totals"><tr class="net-row"><td class="g-k">' . $v->label('netPay') . '</td><td class="r">' . $v->money($v->n('payroll.net_pay')) . '</td></tr></table>';
        }

        return $h . $v->footer();
    }

    // ==================================================================
    // MINIMAL — compact, single column
    // ==================================================================
    private function minimal(RenderView $v): string
    {
        $c = $v->config;
        $h = '';

        if ($c['showCompanyHeader']) {
            $h .= '<table class="mhead"><tr><td>' . $v->logoImg(30) . '<span class="co-name">' . $v->e($v->d('organization.name')) . '</span></td>'
                . '<td class="r doc-title">' . $v->e($c['documentTitle']) . '</td></tr></table>';
        } else {
            $h .= '<div class="doc-title">' . $v->e($c['documentTitle']) . '</div>';
        }
        $h .= '<div class="doc-sub">' . $v->period() . '</div>';

        if ($c['showEmployeeDetails']) {
            $h .= '<div class="m-emp"><b>' . $v->e($v->d('employee.full_name')) . '</b> &middot; ' . $v->label('employeeNumber') . ' ' . $v->e($v->d('employee.employee_number'))
                . ($v->d('employee.job_title') ? ' &middot; ' . $v->e($v->d('employee.job_title')) : '')
                . ($v->d('employee.department') ? ' &middot; ' . $v->e($v->d('employee.department')) : '') . '</div>';
        }

        foreach ($v->orderedSections() as $section) {
            $h .= '<div class="m-sec">' . $v->label($section === 'earnings' ? 'earnings' : 'deductions') . '</div>' . $v->sectionTable($section);
        }
        $h .= $v->extras('', 'm-sec');

        if ($c['showPaymentSummary']) {
            $h .= '<table class="m-tot"><tr><td>' . $v->label('grossPay') . '</td><td class="r">' . $v->money($v->n('payroll.gross_pay')) . '</td></tr>'
                . '<tr><td>' . $v->label('totalDeductions') . '</td><td class="r">' . $v->money($v->n('payroll.total_deductions')) . '</td></tr></table>';
        }
        $h .= '<table class="netbar"><tr><td>' . $v->label('netPay') . '</td><td class="r">' . $v->money($v->n('payroll.net_pay')) . '</td></tr></table>';

        return $h . $v->footer();
    }

    // ==================================================================
    // CSS (colours are the only dynamic values and are re-validated)
    // ==================================================================
    private function css(string $layout, array $colors): string
    {
        $p = $this->hex($colors['primary']) ?? '#1E3A8A';
        $a = $this->hex($colors['accent']) ?? '#2563EB';

        $base = '@page{margin:0}'
            . '*{box-sizing:border-box}'
            . 'body{margin:0;padding:0;font-family:"DejaVu Sans",Helvetica,Arial,sans-serif;font-size:10px;color:#1f2937;line-height:1.35}'
            . 'table{border-collapse:collapse;width:100%}td{vertical-align:top}'
            . '.r{text-align:right}.center{text-align:center}'
            . '.sample{position:absolute;top:6px;right:10px;font-size:8px;letter-spacing:1px;color:#b91c1c;font-weight:bold}'
            . '.lines td{padding:4px 0;border-bottom:1px solid #e5e7eb}.lines tr.sub td{padding-top:8px;font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;border-bottom:0}'
            . '.lines tr.tot td{font-weight:bold;border-bottom:0;border-top:1px solid #9ca3af;padding-top:6px}'
            . '.lines td.bal{color:#6b7280;font-size:8px}'
            . '.footer{margin-top:14px;font-size:8px;color:#6b7280;text-align:center;white-space:pre-line}'
            . '.note{font-size:8px;color:#6b7280}';

        if ($layout === 'classic') {
            return $base
                . 'body{padding:28px 34px;font-family:"DejaVu Serif",Georgia,"Times New Roman",serif;font-size:10px}'
                . '.chead td{vertical-align:middle}.chead-l{width:20%}.chead-c{text-align:center}.chead-r{width:20%}'
                . '.co-name{font-size:15px;font-weight:bold;color:' . $p . '}.co-sub{font-size:8px;color:#4b5563}'
                . '.rule{border-top:2px solid ' . $p . ';margin:8px 0 6px}'
                . '.doc-title{font-size:13px;font-weight:bold;letter-spacing:2px;color:' . $p . '}.doc-sub{font-size:9px;color:#4b5563;margin-bottom:6px}'
                . '.gap{margin-top:10px}'
                . '.grid{border:1px solid #6b7280}.grid td{border:1px solid #9ca3af;padding:4px 7px}.g-k{background:#f3f4f6;font-weight:bold;width:18%}'
                . '.totals .g-k{width:70%}.net-row td{font-weight:bold;font-size:12px;border:2px solid ' . $p . ';color:' . $p . '}'
                . '.c-sec{margin-top:12px;padding:3px 7px;background:' . $p . ';color:#fff;font-weight:bold;font-size:9px;text-transform:uppercase;letter-spacing:1px}'
                . '.lines td{padding:4px 7px;border:1px solid #d1d5db}.lines tr.sub td{background:#f9fafb;border:1px solid #d1d5db;color:#374151}'
                . '.lines tr.tot td{border:1px solid #9ca3af;background:#f3f4f6}';
        }

        if ($layout === 'minimal') {
            return $base
                . 'body{padding:22px 28px;font-size:9px}'
                . '.mhead td{vertical-align:middle}.co-name{font-size:12px;font-weight:bold;color:' . $p . '}'
                . '.doc-title{font-size:11px;font-weight:bold;color:' . $p . '}.doc-sub{font-size:8px;color:#6b7280;margin:2px 0 6px}'
                . '.m-emp{padding:5px 0;border-top:1px solid ' . $a . ';border-bottom:1px solid #e5e7eb;font-size:9px}'
                . '.m-sec{margin-top:8px;font-weight:bold;color:' . $p . ';font-size:9px;text-transform:uppercase;letter-spacing:.5px}'
                . '.lines td{padding:2px 0}'
                . '.m-tot{margin-top:6px}.m-tot td{padding:2px 0}'
                . '.netbar{margin-top:8px;background:' . $p . ';color:#fff;font-weight:bold;font-size:11px}.netbar td{padding:6px 8px}'
                . '.footer{margin-top:10px}';
        }

        // modern
        return $base
            . 'body{padding:26px 30px;background:#fff}'
            . '.band{background:' . $p . ';color:#fff;border-radius:8px}.band td{padding:14px 16px;vertical-align:middle}.band-r{text-align:right}'
            . '.co-name{font-size:15px;font-weight:bold}.co-sub{font-size:8px;opacity:.85}'
            . '.doc-title{font-size:18px;font-weight:bold;letter-spacing:.5px}.doc-title.dark{color:' . $p . ';margin-bottom:6px}.doc-sub{font-size:9px;opacity:.9}'
            . '.gap{margin-top:10px}'
            . '.card{border:1px solid #e5e7eb;border-radius:8px;background:#fff}.card-pad{padding:10px 14px}'
            . '.kv td{width:33%;padding:3px 0}.kv .k{font-size:8px;text-transform:uppercase;color:#6b7280;letter-spacing:.4px}.kv .v{font-size:10px;font-weight:bold}'
            . '.summary{border-collapse:separate}.sum-card{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#f8fafc;width:32%}.sum-sp{width:2%}'
            . '.sum-card.net{background:' . $a . ';border-color:' . $a . ';color:#fff}.sum-l{font-size:8px;text-transform:uppercase;letter-spacing:.5px;opacity:.8}.sum-v{font-size:14px;font-weight:bold;margin-top:2px}'
            . '.sec-title{font-size:11px;font-weight:bold;color:' . $p . ';margin-bottom:4px;border-bottom:2px solid ' . $a . ';padding-bottom:3px}'
            . '.netbar{background:' . $p . ';color:#fff;border-radius:8px;font-weight:bold;font-size:13px}.netbar td{padding:10px 16px}';
    }

    // ==================================================================
    // Safety helpers
    // ==================================================================
    private function hex($v): ?string
    {
        return is_string($v) && preg_match('/^#[0-9A-Fa-f]{6}$/', $v) ? strtoupper($v) : null;
    }

    /** Only base64 PNG/JPEG/GIF data URIs may be embedded. */
    private function safeDataUri($v): ?string
    {
        return is_string($v) && preg_match('#^data:image/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$#', $v) ? $v : null;
    }
}
