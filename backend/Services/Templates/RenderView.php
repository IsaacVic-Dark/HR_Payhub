<?php

namespace App\Services\Templates;

/**
 * Read-only helper handed to the layouts. Everything it returns as HTML is
 * already escaped; everything returned by d()/n()/date() is raw and must be
 * passed through e() (or money()/kvCell(), which escape for you).
 */
final class RenderView
{
    public function __construct(
        public readonly array $config,
        public readonly array $data,
        public readonly array $colors,
        public readonly ?string $logo,
        public readonly bool $sample
    ) {
    }

    // ---- escaping & data access ------------------------------------

    public function e($v): string
    {
        return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** Dotted lookup into the allowlisted payload ("employee.full_name"). */
    public function d(string $path)
    {
        [$group, $key] = explode('.', $path, 2);
        return $this->data[$group][$key] ?? null;
    }

    public function n(string $path): float
    {
        return (float) ($this->d($path) ?? 0);
    }

    /** Escaped, customised label. */
    public function label(string $key): string
    {
        return $this->e($this->config['labels'][$key] ?? TemplateConfig::LABEL_DEFAULTS[$key] ?? $key);
    }

    public function money(float $amount, ?string $currency = null): string
    {
        $cur = $currency ?? $this->d('organization.currency') ?? '';
        return $this->e(trim($cur . ' ' . number_format($amount, 2, '.', ',')));
    }

    public function date($v): string
    {
        if (!$v || !is_string($v)) {
            return '';
        }
        $t = strtotime($v);
        return $t ? date('d M Y', $t) : '';
    }

    // ---- fragments ---------------------------------------------------

    public function period(): string
    {
        $s = $this->date($this->d('payrun.pay_period_start'));
        $e = $this->date($this->d('payrun.pay_period_end'));
        if ($s === '' && $e === '') {
            return '';
        }
        return $this->label('payPeriod') . ': ' . $this->e($s) . ' &ndash; ' . $this->e($e);
    }

    public function logoImg(int $height): string
    {
        if (!$this->logo) {
            return '';
        }
        // $logo was validated as a base64 image data URI by the renderer.
        return '<img src="' . $this->logo . '" alt="" style="height:' . (int) $height . 'px;margin-right:8px;vertical-align:middle">';
    }

    public function companyLines(): string
    {
        $parts = array_filter([
            $this->d('organization.physical_address'),
            $this->d('organization.postal_address'),
            $this->d('organization.primary_phone'),
            $this->d('organization.official_email'),
        ]);
        $line1 = implode(' | ', array_map([$this, 'e'], $parts));
        $ids   = [];
        if ($this->d('organization.kra_pin')) {
            $ids[] = 'KRA PIN: ' . $this->e($this->d('organization.kra_pin'));
        }
        if ($this->d('organization.nssf_number')) {
            $ids[] = 'NSSF: ' . $this->e($this->d('organization.nssf_number'));
        }
        if ($this->d('organization.nhif_number')) {
            $ids[] = 'SHIF/NHIF: ' . $this->e($this->d('organization.nhif_number'));
        }
        return $line1 . ($ids ? '<br>' . implode(' | ', $ids) : '');
    }

    public function kvCell(string $escapedLabel, $value): string
    {
        return '<td><div class="k kv-k">' . $escapedLabel . '</div><div class="v kv-v">' . $this->e($value ?: '—') . '</div></td>';
    }

    public function footer(): string
    {
        if (empty($this->config['showFooter']) || trim((string) ($this->config['footerText'] ?? '')) === '') {
            return '';
        }
        return '<div class="footer">' . $this->e($this->config['footerText']) . '</div>';
    }

    /** Section keys sorted by sections.*.order. */
    public function orderedSections(): array
    {
        $sections = [];
        foreach (TemplateConfig::SECTION_KEYS as $k) {
            if (!empty($this->config['sections'][$k]['visible']) && !empty($this->config['show' . ucfirst($k)])) {
                $sections[$k] = (int) ($this->config['sections'][$k]['order'] ?? 99);
            }
        }
        asort($sections);
        return array_keys($sections);
    }

    // ---- tables ---------------------------------------------------------

    public function sectionTable(string $section): string
    {
        return $section === 'earnings' ? $this->earningsTable() : $this->deductionsTable();
    }

    private function row(string $label, float $amount, string $cls = '', ?float $balance = null, ?string $cur = null): string
    {
        $bal = $balance !== null ? ' <span class="note">(balance ' . $this->money($balance, $cur) . ')</span>' : '';
        return '<tr class="' . $cls . '"><td>' . $label . $bal . '</td><td class="r">' . $this->money($amount, $cur) . '</td></tr>';
    }

    private function sub(string $label): string
    {
        return '<tr class="sub"><td colspan="2">' . $label . '</td></tr>';
    }

    private function earningsTable(): string
    {
        $c    = $this->config;
        $keyMap = ['basic_salary' => 'basicSalary', 'overtime' => 'overtime', 'bonus' => 'bonus', 'commission' => 'commission'];
        $h    = '<table class="lines">';

        foreach ($this->data['payroll']['earnings'] ?? [] as $l) {
            $label = isset($keyMap[$l['key'] ?? '']) ? $this->label($keyMap[$l['key']]) : $this->e($l['label']);
            $h .= $this->row($label, (float) $l['amount'], '', null, $l['currency']);
        }
        if (!empty($c['showAllowances']) && !empty($this->data['payroll']['allowances'])) {
            $h .= $this->sub($this->label('allowances'));
            foreach ($this->data['payroll']['allowances'] as $l) {
                $h .= $this->row($this->e($l['label']), (float) $l['amount'], '', null, $l['currency']);
            }
        }
        if (!empty($c['showReimbursements']) && !empty($this->data['payroll']['reimbursements'])) {
            $h .= $this->sub($this->label('reimbursements'));
            foreach ($this->data['payroll']['reimbursements'] as $l) {
                $h .= $this->row($this->e($l['label']), (float) $l['amount'], '', null, $l['currency']);
            }
        }
        $h .= $this->row($this->label('grossPay'), $this->n('payroll.gross_pay'), 'tot') . '</table>';
        return $h;
    }

    private function deductionsTable(): string
    {
        $c = $this->config;
        $h = '<table class="lines">';

        if (!empty($c['showStatutoryDeductions'])) {
            $h .= $this->sub($this->label('statutoryDeductions'));
            $h .= $this->row($this->label('nssf'), $this->n('payroll.nssf'));
            $h .= $this->row($this->label('shif'), $this->n('payroll.shif'));
            $h .= $this->row($this->label('housingLevy'), $this->n('payroll.housing_levy'));
            $h .= $this->row($this->label('paye'), $this->n('payroll.paye'));
        }
        $other = $this->data['payroll']['deductions'] ?? [];
        if ($other) {
            $h .= $this->sub($this->label('deductions'));
            foreach ($other as $l) {
                $h .= $this->row($this->e($l['label']), (float) $l['amount'], '', null, $l['currency']);
            }
        }
        if (!empty($c['showAdvances']) && !empty($this->data['payroll']['advance_recoveries'])) {
            $h .= $this->sub($this->label('advances'));
            foreach ($this->data['payroll']['advance_recoveries'] as $l) {
                $h .= $this->row($this->e($l['label']), (float) $l['amount'], '', isset($l['balance_after']) ? (float) $l['balance_after'] : null, $l['currency']);
            }
        }
        if (!empty($c['showLoanDeductions']) && !empty($this->data['payroll']['loan_repayments'])) {
            $h .= $this->sub($this->label('loans'));
            foreach ($this->data['payroll']['loan_repayments'] as $l) {
                $h .= $this->row($this->e($l['label']), (float) $l['amount'], '', isset($l['balance_after']) ? (float) $l['balance_after'] : null, $l['currency']);
            }
        }
        $h .= $this->row($this->label('totalDeductions'), $this->n('payroll.total_deductions'), 'tot') . '</table>';
        return $h;
    }

    /**
     * Optional blocks: bank details and leave summary.
     *
     * @param string $wrapClass  non-empty → wrap each block in a card table
     */
    public function extras(string $wrapClass, string $titleClass): string
    {
        $out = '';
        $c   = $this->config;

        if (!empty($c['showBankDetails']) && ($this->d('employee.bank_name') || $this->d('employee.bank_account_number_masked'))) {
            $body = '<table class="lines"><tr><td>' . $this->e($this->d('employee.bank_name')) . '</td><td class="r">'
                . $this->e($this->d('employee.bank_account_number_masked')) . '</td></tr></table>';
            $out .= $this->block($wrapClass, $titleClass, $this->label('bankDetails'), $body);
        }
        if (!empty($c['showLeaveSummary']) && !empty($this->data['leave'])) {
            $body = '<table class="lines"><tr class="sub"><td>&nbsp;</td><td class="r">Entitled</td><td class="r">Used</td><td class="r">Available</td></tr>';
            foreach ($this->data['leave'] as $l) {
                $body .= '<tr><td>' . $this->e($l['label']) . '</td><td class="r">' . $this->e($l['entitled'])
                    . '</td><td class="r">' . $this->e($l['used']) . '</td><td class="r">' . $this->e($l['available']) . '</td></tr>';
            }
            $out .= $this->block($wrapClass, $titleClass, $this->label('leaveSummary'), $body . '</table>');
        }
        return $out;
    }

    private function block(string $wrapClass, string $titleClass, string $title, string $body): string
    {
        if ($wrapClass !== '') {
            return '<table class="' . $wrapClass . '"><tr><td class="card-pad"><div class="' . $titleClass . '">' . $title . '</div>' . $body . '</td></tr></table>';
        }
        return '<div class="' . $titleClass . '">' . $title . '</div>' . $body;
    }
}
