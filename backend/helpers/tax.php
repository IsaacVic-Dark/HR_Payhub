<?php
const NSSF_RATE = 0.06;
const SHIF_RATE = 0.0275; 
const HOUSING_LEVY_RATE = 0.015; 
const PERSONAL_RELIEF = 2400; 


/**
 * Kenya Payroll Calculator
 * Calculates net pay based on Kenya's progressive tax system (as of 2025)
 */

function calculateNetPay($basicSalary) {

    if ($basicSalary <= 0) {
        return "Invalid salary amount.";
    }
    
    // Calculate NSSF using the correct tiered system
    $nssf = calculateNSSF($basicSalary);
    
    // Calculate other statutory deductions
    $shif = $basicSalary * SHIF_RATE;
    $housingLevy = $basicSalary * HOUSING_LEVY_RATE;
    
    // Calculate taxable income
    $taxableIncome = $basicSalary - $nssf - $shif - $housingLevy;
    
    // Calculate tax using progressive tax system
    $tax = calculateProgressiveTax($taxableIncome);
    
    // Apply personal relief
    $paye = max(0, $tax - PERSONAL_RELIEF);
    
    // Calculate net pay
    $netPay = $basicSalary - $nssf - $shif - $housingLevy - $paye;

    $netPayPerc = ($netPay / $basicSalary) * 100;
    $payePerc = ($paye / $basicSalary) * 100;
    $taxPerc = ($tax / $basicSalary) * 100;
    
    return [
        'taxPerc' => number_format($taxPerc ),
        'payePerc' => number_format($payePerc ),
        'netPayPerc' => number_format($netPayPerc),
        'basicPay' => number_format($basicSalary),
        'nssf' => number_format($nssf),
        'shif' => number_format($shif),
        'housingLevy' => number_format($housingLevy ),
        'taxableIncome' => number_format($taxableIncome ),
        'taxBeforeRelief' => number_format($tax),
        'personalRelief' => number_format(PERSONAL_RELIEF),
        'paye' => number_format($paye ),
        'netPay' => number_format(floor($netPay * 100 - 0.0001) / 100, 2, '.', ',')
    ];
}

/**
 * Calculate NSSF contribution based on the tiered system (as of February 2025)
 * Tier I: 6% of the first KSh 8,000
 * Tier II: 6% of earnings between KSh 8,001 and KSh 72,000
 * Maximum total contribution: KSh 4,320
 */
function calculateNSSF($salary) {
    $TIER_I_MAX = 8000; // Tier I ceiling
    $TIER_II_MAX = 72000; // Tier II ceiling
    
    // Tier I contribution: 6% of first KSh 8,000
    $tierIContribution = min($salary, $TIER_I_MAX) * NSSF_RATE; // KSh 480 maximum
    
    // Tier II contribution: 6% of earnings between KSh 8,001 and KSh 72,000
    $tierIIContribution = 0;
    if ($salary > $TIER_I_MAX) {
        $tierIIAmount = min($salary, $TIER_II_MAX) - $TIER_I_MAX;
        $tierIIContribution = $tierIIAmount * NSSF_RATE; // KSh 3,840 maximum
    }
    
    // Total NSSF contribution (employee portion only)
    $totalNSSF = $tierIContribution + $tierIIContribution;
    
    return $totalNSSF;
}

function calculateProgressiveTax($taxableIncome) {
    $taxBrackets = [
        ['limit' => 24000, 'rate' => 0.10],
        ['limit' => 8333, 'rate' => 0.25],
        ['limit' => 467667, 'rate' => 0.30],
        ['limit' => 300000, 'rate' => 0.325],
        ['limit' => PHP_FLOAT_MAX, 'rate' => 0.35]
    ];
    
    $tax = 0;
    $remainingIncome = $taxableIncome;
    
    foreach ($taxBrackets as $bracket) {
        $taxableAmount = min($remainingIncome, $bracket['limit']);
        $tax += $taxableAmount * $bracket['rate'];
        $remainingIncome -= $taxableAmount;
        
        if ($remainingIncome <= 0) {
            break;
        }
    }
    
    return $tax;
}