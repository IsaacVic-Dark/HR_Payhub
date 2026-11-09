<?php

namespace App\Services\Templates;

use App\Services\DB;
use App\Services\Money;

/**
 * Assembles the data a payslip template can display.
 *
 * RULES
 *  - Read-only. Every figure comes from rows the payrun already persisted
 *    (payrun_details, payrun_deductions, the *_metadata JSON columns,
 *    loan_repayments, advance_repayments). Nothing is recalculated.
 *  - Tenant-scoped. Every query is constrained by organization_id.
 *  - The result is passed through TemplateVariables::filter() so only
 *    allowlisted variables ever reach a layout.
 *
 * The one piece of derived data is a display-only reconciliation line (see
 * reconcileDeductions): if the persisted deduction lines do not add up to
 * payrun_details.total_deductions, the difference is shown as "Other
 * deductions" so the printed slip foots. Payroll values are never modified.
 */
final class PayslipDataBuilder
{
    /**
     * Build the payload for one payrun_details row.
     *
     * @param ?object $payslip  payslips row, when one exists (for number/status/date)
     * @return ?array           null when the detail does not belong to the organisation
     */
    public function build(int $orgId, int $payrunDetailId, ?object $payslip = null, ?string $orgLogoDataUri = null, bool $includeLeave = false): ?array
    {
        $rows = DB::raw(
            "SELECT pd.*,
                    pr.payrun_name, pr.pay_period_start, pr.pay_period_end, pr.pay_frequency,
                    pr.payrun_type, pr.status AS payrun_status,
                    e.employee_number, e.firstname, e.middlename, e.surname, e.hire_date,
                    e.bank_name, e.bank_account_number,
                    d.name  AS department_name,
                    jt.title AS job_title
               FROM payrun_details pd
         INNER JOIN payruns   pr ON pr.id = pd.payrun_id
         INNER JOIN employees e  ON e.id  = pd.employee_id
          LEFT JOIN departments d ON d.id = e.department_id
          LEFT JOIN job_titles jt ON jt.id = e.job_title_id
              WHERE pd.id = :id
                AND pd.organization_id = :org_pd
                AND pr.organization_id = :org_pr
                AND e.organization_id  = :org_e
              LIMIT 1",
            [':id' => $payrunDetailId, ':org_pd' => $orgId, ':org_pr' => $orgId, ':org_e' => $orgId]
        );
        if (empty($rows)) {
            return null;
        }
        $r   = $rows[0];
        $org = $this->organization($orgId);
        if (!$org) {
            return null;
        }
        $cur = $org->currency ?: 'KES';

        $statutory = (float) $r->nssf + (float) $r->shif + (float) $r->housing_levy + (float) $r->paye;

        // ---- Earnings (persisted columns) --------------------------------
        $earnings = [$this->line($cur, 'earning', 'Basic Salary', $r->basic_salary, 'basic_salary')];
        foreach ([
            'overtime_amount'   => ['overtime', 'Overtime'],
            'bonus_amount'      => ['bonus', 'Bonus'],
            'commission_amount' => ['commission', 'Commission'],
        ] as $col => [$key, $label]) {
            if ((float) $r->{$col} > 0) {
                $earnings[] = $this->line($cur, 'earning', $label, $r->{$col}, $key);
            }
        }
        foreach ($this->advancePayoutLines($r, $cur) as $l) {
            $earnings[] = $l;
        }

        // ---- Allowances / reimbursements (metadata JSON, with total fallback)
        $allowances     = $this->metadataLines(
            $r->allowance_metadata ?? null, $cur, 'allowance', 'allowance_type', 'Allowance',
            (float) ($r->taxable_allowance ?? 0) + (float) ($r->nontaxable_allowance ?? 0), 'Allowances'
        );
        $reimbursements = $this->metadataLines(
            $r->reimbursement_metadata ?? null, $cur, 'reimbursement', 'reimbursement_number', 'Reimbursement',
            (float) $r->taxable_reimbursement + (float) $r->nontaxable_reimbursement, 'Reimbursements',
            'Reimbursement '
        );

        // ---- Voluntary deductions (payrun_deductions → organization_configs)
        [$deductions, $loans, $advances] = $this->deductionLines($orgId, (int) $r->id, (int) $r->payrun_id, (int) $r->employee_id, $cur);
        $deductions = $this->reconcileDeductions($deductions, $loans, $advances, (float) $r->total_deductions, $statutory, $cur);

        $leave = $includeLeave ? $this->leaveSummary($orgId, (int) $r->employee_id, (string) $r->pay_period_end) : [];

        $payload = [
            'organization' => [
                'name'             => $org->name,
                'logo_url'         => $orgLogoDataUri,
                'kra_pin'          => $org->kra_pin,
                'nssf_number'      => $org->nssf_number,
                'nhif_number'      => $org->nhif_number,
                'physical_address' => $org->physical_address,
                'postal_address'   => $org->postal_address,
                'official_email'   => $org->official_email,
                'primary_phone'    => $org->primary_phone,
                'currency'         => $cur,
            ],
            'employee' => [
                'employee_number'            => $r->employee_number,
                'full_name'                  => trim($r->firstname . ' ' . ($r->middlename ? $r->middlename . ' ' : '') . $r->surname),
                'job_title'                  => $r->job_title,
                'department'                 => $r->department_name,
                'hire_date'                  => $r->hire_date,
                'bank_name'                  => $r->bank_name,
                'bank_account_number_masked' => self::maskAccount($r->bank_account_number),
            ],
            'payrun' => [
                'name'             => $r->payrun_name,
                'pay_period_start' => $r->pay_period_start,
                'pay_period_end'   => $r->pay_period_end,
                'pay_frequency'    => $r->pay_frequency,
                'payrun_type'      => $r->payrun_type,
                'status'           => $r->payrun_status,
            ],
            'payslip' => [
                'payslip_number' => $payslip->payslip_number ?? null,
                'generated_at'   => $payslip->generated_at ?? null,
                'status'         => $payslip->status ?? null,
                // Payruns carry no separate pay-date column; the period end is the payment date.
                'payment_date'   => $r->pay_period_end,
            ],
            'payroll' => [
                'basic_salary'              => (float) $r->basic_salary,
                'overtime_amount'           => (float) $r->overtime_amount,
                'bonus_amount'              => (float) $r->bonus_amount,
                'commission_amount'         => (float) $r->commission_amount,
                'taxable_reimbursement'     => (float) $r->taxable_reimbursement,
                'non_taxable_reimbursement' => (float) $r->nontaxable_reimbursement,
                'gross_pay'                 => (float) $r->gross_pay,
                'taxable_income'            => (float) $r->taxable_income,
                'tax_before_relief'         => (float) $r->tax_before_relief,
                'personal_relief'           => (float) $r->personal_relief,
                'paye'                      => (float) $r->paye,
                'nssf'                      => (float) $r->nssf,
                'shif'                      => (float) $r->shif,
                'housing_levy'              => (float) $r->housing_levy,
                'total_deductions'          => (float) $r->total_deductions,
                'net_pay'                   => (float) $r->net_pay,
                'earnings'                  => $earnings,
                'deductions'                => $deductions,
                'allowances'                => $allowances,
                'reimbursements'            => $reimbursements,
                'advance_recoveries'        => $advances,
                'loan_repayments'           => $loans,
            ],
            'leave' => $leave,
        ];

        return TemplateVariables::filter($payload);
    }

    /**
     * Realistic demo data for previews when the organisation has no payrun yet.
     * Figures foot: 151,700.00 gross − 46,759.35 deductions = 104,940.65 net.
     */
    public function sample(int $orgId, ?string $orgLogoDataUri = null): array
    {
        $org = $this->organization($orgId);
        $cur = ($org->currency ?? null) ?: 'KES';

        $payload = [
            'organization' => [
                'name'             => $org->name ?? 'Your Company Ltd',
                'logo_url'         => $orgLogoDataUri,
                'kra_pin'          => $org->kra_pin ?? 'P000000000X',
                'nssf_number'      => $org->nssf_number ?? '000000000',
                'nhif_number'      => $org->nhif_number ?? '000000000',
                'physical_address' => $org->physical_address ?? 'Westlands, Nairobi',
                'postal_address'   => $org->postal_address ?? 'P.O. Box 00100, Nairobi',
                'official_email'   => $org->official_email ?? 'payroll@example.com',
                'primary_phone'    => $org->primary_phone ?? '+254 700 000000',
                'currency'         => $cur,
            ],
            'employee' => [
                'employee_number'            => 'EMP-0001',
                'full_name'                  => 'Amina Wanjiru Otieno',
                'job_title'                  => 'Senior Accountant',
                'department'                 => 'Finance',
                'hire_date'                  => '2021-03-15',
                'bank_name'                  => 'Equity Bank',
                'bank_account_number_masked' => '****4821',
            ],
            'payrun' => [
                'name'             => 'Sample Payrun',
                'pay_period_start' => date('Y-m-01'),
                'pay_period_end'   => date('Y-m-t'),
                'pay_frequency'    => 'monthly',
                'payrun_type'      => 'regular',
                'status'           => 'finalized',
            ],
            'payslip' => [
                'payslip_number' => 'PAYSLIP-' . date('Y-m') . '-EMP0',
                'generated_at'   => date('Y-m-d H:i:s'),
                'status'         => 'generated',
                'payment_date'   => date('Y-m-t'),
            ],
            'payroll' => [
                'basic_salary'              => 120000.00,
                'overtime_amount'           => 8500.00,
                'bonus_amount'              => 0.00,
                'commission_amount'         => 0.00,
                'taxable_reimbursement'     => 0.00,
                'non_taxable_reimbursement' => 3200.00,
                'gross_pay'                 => 151700.00,
                'taxable_income'            => 137320.00,
                'tax_before_relief'         => 35979.35,
                'personal_relief'           => 2400.00,
                'paye'                      => 33579.35,
                'nssf'                      => 1080.00,
                'shif'                      => 3300.00,
                'housing_levy'              => 1800.00,
                'total_deductions'          => 46759.35,
                'net_pay'                   => 104940.65,
                'earnings' => [
                    $this->line($cur, 'earning', 'Basic Salary', 120000, 'basic_salary'),
                    $this->line($cur, 'earning', 'Overtime', 8500, 'overtime'),
                ],
                'allowances' => [
                    $this->line($cur, 'allowance', 'House Allowance', 15000),
                    $this->line($cur, 'allowance', 'Transport Allowance', 5000),
                ],
                'reimbursements' => [
                    $this->line($cur, 'reimbursement', 'Reimbursement REIM-0042', 3200),
                ],
                'deductions' => [],
                'advance_recoveries' => [
                    $this->line($cur, 'advance_recovery', 'Advance recovery ADV-0007', 2000),
                ],
                'loan_repayments' => [
                    $this->line($cur, 'loan_repayment', 'Staff Loan', 5000) + ['balance_after' => 45000.00],
                ],
            ],
            'leave' => [
                ['label' => 'Annual Leave', 'entitled' => 21.0, 'used' => 6.0, 'available' => 15.0],
                ['label' => 'Sick Leave',   'entitled' => 14.0, 'used' => 1.0, 'available' => 13.0],
            ],
        ];

        return TemplateVariables::filter($payload);
    }

    // ------------------------------------------------------------------
    // Sources
    // ------------------------------------------------------------------

    public function organization(int $orgId): ?object
    {
        $rows = DB::raw(
            "SELECT name, logo_url, kra_pin, nssf_number, nhif_number, physical_address,
                    postal_address, official_email, primary_phone, currency
               FROM organizations WHERE id = :id LIMIT 1",
            [':id' => $orgId]
        );
        return $rows[0] ?? null;
    }

    /** Salary-advance payout earning lines (persisted in advance_payout_metadata). */
    private function advancePayoutLines(object $r, string $cur): array
    {
        $total = (float) ($r->advance_payout ?? 0);
        if ($total <= 0) {
            return [];
        }
        $meta  = $this->decode($r->advance_payout_metadata ?? null);
        $lines = [];
        foreach ($meta as $m) {
            if (is_array($m) && isset($m['amount']) && (float) $m['amount'] > 0) {
                $lines[] = $this->line($cur, 'earning', 'Salary advance ' . ($m['advance_number'] ?? ''), $m['amount'], 'advance_payout');
            }
        }
        if (!$lines || Money::toCents(array_sum(array_column($lines, 'amount'))) !== Money::toCents($total)) {
            $lines = [$this->line($cur, 'earning', 'Salary advance payout', $total, 'advance_payout')];
        }
        return $lines;
    }

    /**
     * Lines from a *_metadata JSON column. If the metadata is missing or does
     * not add up to the persisted total (older rows), a single total line is
     * used instead so the section always agrees with gross pay.
     */
    private function metadataLines(?string $json, string $cur, string $type, string $labelKey, string $fallbackLabel, float $persistedTotal, string $totalLabel, string $labelPrefix = ''): array
    {
        if ($persistedTotal <= 0) {
            return [];
        }
        $lines = [];
        foreach ($this->decode($json) as $m) {
            if (!is_array($m) || !isset($m['amount']) || (float) $m['amount'] <= 0) {
                continue;
            }
            $label   = trim($labelPrefix . ($m[$labelKey] ?? $fallbackLabel));
            $lines[] = $this->line($cur, $type, $label !== '' ? $label : $fallbackLabel, $m['amount']);
        }
        $sum = Money::toCents(array_sum(array_column($lines, 'amount')));
        if (!$lines || $sum !== Money::toCents($persistedTotal)) {
            return [$this->line($cur, $type, $totalLabel, $persistedTotal)];
        }
        return $lines;
    }

    /**
     * Split payrun_deductions (excluding statutory 'tax' rows, which come from
     * payrun_details columns) into other deductions / loan repayments / advance recoveries.
     * Loan and advance lines are enriched from loan_repayments / advance_repayments
     * only when those rows add up exactly to the persisted deduction.
     *
     * @return array{0: array, 1: array, 2: array}
     */
    private function deductionLines(int $orgId, int $detailId, int $payrunId, int $employeeId, string $cur): array
    {
        $rows = DB::raw(
            "SELECT pdd.amount, oc.name, oc.config_type
               FROM payrun_deductions pdd
         INNER JOIN organization_configs oc ON oc.id = pdd.config_id
              WHERE pdd.payrun_detail_id = :detail
                AND oc.organization_id   = :org
                AND oc.config_type <> 'tax'
           ORDER BY pdd.id",
            [':detail' => $detailId, ':org' => $orgId]
        );

        $other = $loans = $advances = [];
        foreach ($rows as $d) {
            if ((float) $d->amount <= 0) {
                continue;
            }
            switch ($d->config_type) {
                case 'loan':
                    $loans[]    = $this->line($cur, 'loan_repayment', $d->name, $d->amount);
                    break;
                case 'advance':
                    $advances[] = $this->line($cur, 'advance_recovery', $d->name, $d->amount);
                    break;
                default:
                    $other[]    = $this->line($cur, 'deduction', $d->name, $d->amount);
            }
        }

        if ($loans) {
            $detail = DB::raw(
                "SELECT lr.amount, lr.balance_after, oc.name
                   FROM loan_repayments lr
             INNER JOIN loans l ON l.id = lr.loan_id
             INNER JOIN organization_configs oc ON oc.id = l.config_id
                  WHERE lr.payrun_id        = :payrun
                    AND lr.employee_id      = :emp
                    AND lr.organization_id  = :org
                    AND lr.method           = 'payroll_deduction'
               ORDER BY lr.id",
                [':payrun' => $payrunId, ':emp' => $employeeId, ':org' => $orgId]
            );
            $loans = $this->enrich($loans, $detail, $cur, 'loan_repayment', fn($d) => $d->name);
        }
        if ($advances) {
            $detail = DB::raw(
                "SELECT ar.amount, ar.balance_after, a.advance_number
                   FROM advance_repayments ar
             INNER JOIN advances a ON a.id = ar.advance_id
                  WHERE ar.payrun_detail_id = :detail
                    AND ar.organization_id  = :org
                    AND ar.method           = 'payroll_deduction'
                    AND ar.status           = 'applied'
               ORDER BY ar.id",
                [':detail' => $detailId, ':org' => $orgId]
            );
            $advances = $this->enrich($advances, $detail, $cur, 'advance_recovery', fn($d) => 'Advance recovery ' . $d->advance_number);
        }

        return [$other, $loans, $advances];
    }

    /** Swap a summary line for per-record lines when the per-record rows sum to the same total. */
    private function enrich(array $summary, array $detailRows, string $cur, string $type, callable $labeler): array
    {
        if (!$detailRows) {
            return $summary;
        }
        $detailCents  = 0;
        foreach ($detailRows as $d) {
            $detailCents += Money::toCents($d->amount);
        }
        $summaryCents = Money::toCents(array_sum(array_column($summary, 'amount')));
        if ($detailCents !== $summaryCents) {
            return $summary;
        }
        $out = [];
        foreach ($detailRows as $d) {
            $line = $this->line($cur, $type, $labeler($d), $d->amount);
            if (isset($d->balance_after)) {
                $line['balance_after'] = round((float) $d->balance_after, 2);
            }
            $out[] = $line;
        }
        return $out;
    }

    /**
     * Display-only: make the printed deductions foot to total_deductions.
     * total_deductions = statutory (nssf+shif+levy+paye) + voluntary lines.
     */
    private function reconcileDeductions(array $other, array $loans, array $advances, float $totalDeductions, float $statutory, string $cur): array
    {
        $listed = 0;
        foreach (array_merge($other, $loans, $advances) as $l) {
            $listed += Money::toCents($l['amount']);
        }
        $diff = Money::toCents($totalDeductions) - Money::toCents($statutory) - $listed;
        if ($diff > 0) {
            $other[] = $this->line($cur, 'deduction', 'Other deductions', $diff / 100);
            error_log('PayslipDataBuilder: deduction lines did not foot to total_deductions; added a balancing "Other deductions" line of ' . number_format($diff / 100, 2));
        }
        return $other;
    }

    private function leaveSummary(int $orgId, int $employeeId, string $periodEnd): array
    {
        $year = (int) substr($periodEnd, 0, 4) ?: (int) date('Y');
        $rows = DB::raw(
            "SELECT lt.name AS label, lb.entitled_days, lb.accrued_days, lb.carried_over, lb.used_days, lb.pending_days
               FROM leave_balances lb
         INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
              WHERE lb.employee_id = :emp AND lb.organization_id = :org AND lb.leave_year = :yr AND lt.is_active = 1
           ORDER BY lt.name",
            [':emp' => $employeeId, ':org' => $orgId, ':yr' => $year]
        );
        $out = [];
        foreach ($rows as $b) {
            $entitled = (float) $b->entitled_days + (float) $b->accrued_days + (float) $b->carried_over;
            $out[] = [
                'label'     => $b->label,
                'entitled'  => round($entitled, 1),
                'used'      => round((float) $b->used_days, 1),
                // Same formula LeaveController uses for available_days
                'available' => round($entitled - (float) $b->used_days - (float) $b->pending_days, 1),
            ];
        }
        return $out;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private function line(string $cur, string $type, string $label, $amount, ?string $key = null): array
    {
        return [
            'key'           => $key,
            'label'         => $label,
            'amount'        => round((float) $amount, 2),
            'currency'      => $cur,
            'type'          => $type,
            'balance_after' => null,
        ];
    }

    private function decode($json): array
    {
        if ($json === null || $json === '') {
            return [];
        }
        $v = is_string($json) ? json_decode($json, true) : $json;
        return is_array($v) ? $v : [];
    }

    /** "0123456789" → "****6789". Never returns more than the last four characters. */
    public static function maskAccount(?string $account): ?string
    {
        $account = trim((string) $account);
        if ($account === '') {
            return null;
        }
        return '****' . substr($account, -4);
    }
}
