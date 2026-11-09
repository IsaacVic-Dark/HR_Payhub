<?php

namespace App\Services\Templates;

/**
 * Single source of truth for the document-template configuration model.
 *
 * Everything a template may customise is declared here as an allowlist.
 * The validator rejects anything not listed, and the renderer only reads
 * keys that are listed. Templates control PRESENTATION only — they can
 * never change a payroll value.
 */
final class TemplateConfig
{
    public const TYPES            = ['payslip', 'p9', 'employment_letter', 'loan_statement', 'advance_statement', 'reimbursement_statement'];
    /** Types the API will accept today. Others exist in the schema for future phases. */
    public const RENDERABLE_TYPES = ['payslip'];
    public const LAYOUTS          = ['modern', 'classic', 'minimal'];
    public const STATUSES         = ['draft', 'active', 'archived'];

    /** Stored in document_templates.header_logo_url to mean "use organizations.logo_url". */
    public const ORG_LOGO_SENTINEL = '@organization';

    /** Boolean switches, in the order they appear in the editor. */
    public const BOOLEAN_KEYS = [
        'showCompanyHeader',
        'showEmployeeDetails',
        'showPaymentSummary',
        'showEarnings',
        'showDeductions',
        'showStatutoryDeductions',
        'showAllowances',
        'showReimbursements',
        'showAdvances',
        'showLoanDeductions',
        'showLeaveSummary',
        'showBankDetails',
        'showPaymentDate',
        'showFooter',
    ];

    /** These can never be switched off: removing them would hide mandatory payroll fields. */
    public const MANDATORY_TRUE = [
        'showEmployeeDetails',
        'showPaymentSummary',
        'showEarnings',
        'showDeductions',
        'showStatutoryDeductions',
    ];

    /** Orderable sections. Both are mandatory (visible must stay true). */
    public const SECTION_KEYS = ['earnings', 'deductions'];

    /** Customisable labels and their defaults. Net pay is always rendered; only its wording is editable. */
    public const LABEL_DEFAULTS = [
        'employee'            => 'Employee',
        'employeeNumber'      => 'Employee No.',
        'payPeriod'           => 'Pay Period',
        'basicSalary'         => 'Basic Salary',
        'grossPay'            => 'Gross Pay',
        'totalDeductions'     => 'Total Deductions',
        'netPay'              => 'Net Pay',
        'paye'                => 'PAYE',
        'nssf'                => 'NSSF',
        'shif'                => 'SHIF',
        'housingLevy'         => 'Housing Levy',
        // Extra labels used by the layouts (all optional to override)
        'jobTitle'            => 'Job Title',
        'department'          => 'Department',
        'hireDate'            => 'Date Hired',
        'payslipNumber'       => 'Payslip No.',
        'paymentDate'         => 'Payment Date',
        'earnings'            => 'Earnings',
        'deductions'          => 'Deductions',
        'statutoryDeductions' => 'Statutory Deductions',
        'allowances'          => 'Allowances',
        'reimbursements'      => 'Reimbursements',
        'advances'            => 'Advance Recoveries',
        'loans'               => 'Loan Repayments',
        'overtime'            => 'Overtime',
        'bonus'               => 'Bonus',
        'commission'          => 'Commission',
        'taxableIncome'       => 'Taxable Income',
        'personalRelief'      => 'Personal Relief',
        'bankDetails'         => 'Bank Details',
        'leaveSummary'        => 'Leave Summary',
        'paymentSummary'      => 'Payment Summary',
    ];

    /** Default colours per layout (used when primary_color / accent_color are NULL). */
    public const LAYOUT_COLORS = [
        'modern'  => ['primary' => '#1E3A8A', 'accent' => '#2563EB'],
        'classic' => ['primary' => '#111827', 'accent' => '#4B5563'],
        'minimal' => ['primary' => '#0F766E', 'accent' => '#14B8A6'],
    ];

    public const LAYOUT_META = [
        'modern'  => ['label' => 'Modern',  'description' => 'Clean card-based layout with strong visual hierarchy.'],
        'classic' => ['label' => 'Classic', 'description' => 'Traditional formal layout, suited to printing.'],
        'minimal' => ['label' => 'Minimal', 'description' => 'Compact one-page layout for email and mobile viewing.'],
    ];

    public const MAX_NAME_LENGTH     = 100;
    public const MAX_TITLE_LENGTH    = 100;
    public const MAX_FOOTER_LENGTH   = 1000;
    public const MAX_LABEL_LENGTH    = 40;

    public static function defaultConfig(string $layout = 'modern'): array
    {
        return [
            'layout'                  => $layout,
            'documentTitle'           => 'Payslip',
            'showCompanyHeader'       => true,
            'showEmployeeDetails'     => true,
            'showPaymentSummary'      => true,
            'showEarnings'            => true,
            'showDeductions'          => true,
            'showStatutoryDeductions' => true,
            'showAllowances'          => true,
            'showReimbursements'      => true,
            'showAdvances'            => true,
            'showLoanDeductions'      => true,
            'showLeaveSummary'        => false,
            'showBankDetails'         => false,
            'showPaymentDate'         => true,
            'showFooter'              => true,
            'footerText'              => 'This is a system-generated payslip.',
            'labels'                  => self::LABEL_DEFAULTS,
            'sections'                => [
                'earnings'   => ['visible' => true, 'order' => 1],
                'deductions' => ['visible' => true, 'order' => 2],
            ],
        ];
    }

    /** Resolved colours: explicit value, else the layout default. */
    public static function colorsFor(string $layout, ?string $primary, ?string $accent): array
    {
        $d = self::LAYOUT_COLORS[$layout] ?? self::LAYOUT_COLORS['modern'];
        return [
            'primary' => $primary ?: $d['primary'],
            'accent'  => $accent ?: $d['accent'],
        ];
    }

    /**
     * Deterministic JSON (recursively key-sorted) so two equal configs always
     * serialise — and hash — identically.
     */
    public static function canonicalJson(array $value): string
    {
        return json_encode(self::ksortRecursive($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    /** Fingerprint of everything that affects how a document looks. */
    public static function fingerprint(array $config, ?string $logo, ?string $primary, ?string $accent, ?string $footer): string
    {
        return hash('sha256', self::canonicalJson([
            'config'  => $config,
            'logo'    => $logo,
            'primary' => $primary ? strtoupper($primary) : null,
            'accent'  => $accent ? strtoupper($accent) : null,
            'footer'  => $footer,
        ]));
    }

    private static function ksortRecursive(array $a): array
    {
        foreach ($a as $k => $v) {
            if (is_array($v)) {
                $a[$k] = self::ksortRecursive($v);
            }
        }
        // Only associative arrays are sorted; lists keep their order.
        if (array_keys($a) !== range(0, count($a) - 1)) {
            ksort($a);
        }
        return $a;
    }
}
