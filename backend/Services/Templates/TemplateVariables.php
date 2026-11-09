<?php

namespace App\Services\Templates;

/**
 * The ONLY data a template renderer may see.
 *
 * Every payslip payload is passed through filter() before it reaches the
 * renderer, so even if the data builder is later extended with extra columns
 * (internal ids, file paths, full bank account numbers…) they cannot leak into
 * a document. There is no expression language: layouts are PHP code owned by
 * the system and read variables by their allowlisted names.
 */
final class TemplateVariables
{
    /** Scalar variables, grouped. */
    public const SCALARS = [
        'organization' => [
            'name', 'logo_url', 'kra_pin', 'nssf_number', 'nhif_number',
            'physical_address', 'postal_address', 'official_email', 'primary_phone', 'currency',
        ],
        'employee' => [
            'employee_number', 'full_name', 'job_title', 'department', 'hire_date',
            'bank_name', 'bank_account_number_masked',
        ],
        'payrun' => [
            'name', 'pay_period_start', 'pay_period_end', 'pay_frequency', 'payrun_type', 'status',
        ],
        'payslip' => [
            'payslip_number', 'generated_at', 'status', 'payment_date',
        ],
        'payroll' => [
            'basic_salary', 'overtime_amount', 'bonus_amount', 'commission_amount',
            'taxable_reimbursement', 'non_taxable_reimbursement',
            'gross_pay', 'taxable_income', 'tax_before_relief', 'personal_relief',
            'paye', 'nssf', 'shif', 'housing_levy', 'total_deductions', 'net_pay',
        ],
    ];

    /** Line-item collections. Every line: label, amount, currency, type (+ optional key, balance_after). */
    public const LINE_COLLECTIONS = [
        'earnings', 'deductions', 'allowances', 'reimbursements', 'advance_recoveries', 'loan_repayments',
    ];

    public const LINE_FIELDS = ['key', 'label', 'amount', 'currency', 'type', 'balance_after'];

    /** Leave summary rows (rendered only when showLeaveSummary is on). */
    public const LEAVE_FIELDS = ['label', 'entitled', 'used', 'available'];

    /** Flat dotted names, for documentation / the /templates/meta endpoint. */
    public static function names(): array
    {
        $out = [];
        foreach (self::SCALARS as $group => $keys) {
            foreach ($keys as $k) {
                $out[] = "{$group}.{$k}";
            }
        }
        foreach (self::LINE_COLLECTIONS as $c) {
            $out[] = "payroll.{$c}[]";
        }
        return $out;
    }

    /**
     * Drop everything that is not allowlisted. Missing scalars become null so
     * the renderer never has to guard against undefined keys.
     */
    public static function filter(array $payload): array
    {
        $out = [];
        foreach (self::SCALARS as $group => $keys) {
            foreach ($keys as $k) {
                $v = $payload[$group][$k] ?? null;
                $out[$group][$k] = is_scalar($v) ? $v : null;
            }
        }

        foreach (self::LINE_COLLECTIONS as $c) {
            $lines = [];
            foreach (($payload['payroll'][$c] ?? []) as $line) {
                if (!is_array($line)) {
                    continue;
                }
                $clean = [];
                foreach (self::LINE_FIELDS as $f) {
                    $clean[$f] = isset($line[$f]) && is_scalar($line[$f]) ? $line[$f] : null;
                }
                $clean['amount'] = round((float) $clean['amount'], 2);
                $lines[] = $clean;
            }
            $out['payroll'][$c] = $lines;
        }

        $leave = [];
        foreach (($payload['leave'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $clean = [];
            foreach (self::LEAVE_FIELDS as $f) {
                $clean[$f] = isset($row[$f]) && is_scalar($row[$f]) ? $row[$f] : null;
            }
            $leave[] = $clean;
        }
        $out['leave'] = $leave;

        return $out;
    }
}
