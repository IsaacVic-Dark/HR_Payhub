<?php

/**
 * Kenya Payroll Tax Calculator
 * Rates are loaded from organization_configs, not hardcoded.
 *
 * Expected config names in organization_configs (config_type = 'tax'):
 *   - NSSF Rate           → percentage (e.g. 6.00 means 6%)
 *   - SHIF Rate           → percentage (e.g. 2.75 means 2.75%)
 *   - Housing Levy Rate   → percentage (e.g. 1.50 means 1.50%)
 *   - Personal Relief     → fixed_amount (e.g. 2400.00)
 *   - NSSF Tier I Max     → fixed_amount (e.g. 8000.00)
 *   - NSSF Tier II Max    → fixed_amount (e.g. 72000.00)
 */

use App\Services\DB;

/**
 * Load statutory tax configuration for an organisation from organization_configs.
 * Returns an associative array of rate values.
 */
function loadTaxConfig(int $org_id): array
{
    $rows = DB::raw(
        "SELECT name, percentage, fixed_amount
         FROM organization_configs
         WHERE organization_id = :org_id
           AND config_type = 'tax'
           AND is_active = 1
           AND status = 'approved'",
        [':org_id' => $org_id]
    );

    // Build a lookup keyed by name (normalised to lowercase)
    $lookup = [];
    foreach ($rows as $row) {
        $key = strtolower(trim($row->name));
        $lookup[$key] = $row;
    }

    // Helper: fetch percentage as decimal fraction (6.00 → 0.06)
    $pct = fn(string $name, float $default): float =>
        isset($lookup[strtolower($name)])
            ? (float) $lookup[strtolower($name)]->percentage / 100
            : $default;

    // Helper: fetch fixed amount
    $fixed = fn(string $name, float $default): float =>
        isset($lookup[strtolower($name)])
            ? (float) $lookup[strtolower($name)]->fixed_amount
            : $default;

    return [
        'nssf_rate'        => $pct('NSSF Rate',         0.06),
        'shif_rate'        => $pct('SHIF Rate',          0.0275),
        'housing_levy_rate'=> $pct('Housing Levy Rate',  0.015),
        'personal_relief'  => $fixed('Personal Relief',  2400.00),

        // TODO :// This data depends on default values instead of data from database
        'nssf_tier1_max'   => $fixed('NSSF Tier I Max',  9000.00),
        'nssf_tier2_max'   => $fixed('NSSF Tier II Max', 108000.00),
    ];
}

/**
 * Calculate NSSF contribution using the tiered system.
 *
 * Tier I : 6% of earnings up to Tier I max (KSh 8,000) → max KSh 480
 * Tier II: 6% of earnings between Tier I max and Tier II max (KSh 72,000) → max KSh 3,840
 */
function calculateNSSF(float $salary, array $config): float
{
    $rate      = $config['nssf_rate'];
    $tier1Max  = $config['nssf_tier1_max'];
    $tier2Max  = $config['nssf_tier2_max'];

    $tier1 = min($salary, $tier1Max) * $rate;

    $tier2 = 0.0;
    if ($salary > $tier1Max) {
        $tier2 = (min($salary, $tier2Max) - $tier1Max) * $rate;
    }

    return $tier1 + $tier2;
}

/**
 * Kenya progressive income tax bands (2025).
 * These are statutory and do not come from organisation configs.
 *
 * Band 1: 0 – 24,000        → 10%
 * Band 2: 24,001 – 32,333   → 25%   (width = 8,333)
 * Band 3: 32,334 – 500,000  → 30%   (width = 467,667)
 * Band 4: 500,001 – 800,000 → 32.5% (width = 300,000)
 * Band 5: > 800,000          → 35%
 */
function calculateProgressiveTax(float $taxableIncome): float
{
    $brackets = [
        ['limit' => 24000,          'rate' => 0.10],
        ['limit' => 8333,           'rate' => 0.25],
        ['limit' => 467667,         'rate' => 0.30],
        ['limit' => 300000,         'rate' => 0.325],
        ['limit' => PHP_FLOAT_MAX,  'rate' => 0.35],
    ];

    $tax       = 0.0;
    $remaining = max(0.0, $taxableIncome);

    foreach ($brackets as $bracket) {
        if ($remaining <= 0) break;
        $taxable    = min($remaining, $bracket['limit']);
        $tax       += $taxable * $bracket['rate'];
        $remaining -= $taxable;
    }

    return $tax;
}

/**
 * Full net-pay calculation for a single employee.
 *
 * @param float $basicSalary     Employee's basic (base) salary
 * @param float $grossPay        Total gross: basic + overtime + bonuses + commissions
 * @param array $config          Result of loadTaxConfig()
 * @param float $extraDeductions Any additional voluntary/org deductions already summed
 *
 * @return array  Detailed breakdown of all figures
 */
function calculateNetPay(
    float $basicSalary,
    float $grossPay,
    array $config,
    float $extraDeductions = 0.0
): array {
    if ($basicSalary <= 0) {
        throw new \InvalidArgumentException('Basic salary must be greater than zero');
    }

    // Statutory deductions — all based on basic salary per KRA rules
    $nssf         = calculateNSSF($basicSalary, $config);
    $shif         = $basicSalary * $config['shif_rate'];
    $housingLevy  = $basicSalary * $config['housing_levy_rate'];

    // PAYE taxable income = basic − NSSF − SHIF − Housing Levy
    $taxableIncome  = $basicSalary - $nssf - $shif - $housingLevy;
    $taxBeforeRelief = calculateProgressiveTax($taxableIncome);
    $paye           = max(0.0, $taxBeforeRelief - $config['personal_relief']);

    $totalStatutory  = $nssf + $shif + $housingLevy + $paye;
    $totalDeductions = $totalStatutory + $extraDeductions;
    $netPay          = $grossPay - $totalDeductions;

    return [
        // Earnings
        'basic_salary'      => round($basicSalary, 2),
        'gross_pay'         => round($grossPay, 2),

        // Statutory deductions
        'nssf'              => round($nssf, 2),
        'shif'              => round($shif, 2),
        'housing_levy'      => round($housingLevy, 2),
        'taxable_income'    => round($taxableIncome, 2),
        'tax_before_relief' => round($taxBeforeRelief, 2),
        'personal_relief'   => round($config['personal_relief'], 2),
        'paye'              => round($paye, 2),

        // Totals
        'extra_deductions'  => round($extraDeductions, 2),
        'total_deductions'  => round($totalDeductions, 2),
        'net_pay'           => round($netPay, 2),
    ];
}