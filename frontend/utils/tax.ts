/**
 * Kenya Payroll Tax Calculator — calculation logic only (no UI).
 *
 * Ported from the legacy `logic/tax.php` / `index.php` PHP calculator.
 * Rates below reflect Kenya's statutory deductions as of Phase 4 of the
 * NSSF Act, 2013 phased implementation (effective February 2026):
 *
 *  - NSSF: two-tier contribution, 6% employee rate on both tiers
 *      Tier I : 6% of the first KES 9,000  of pensionable pay
 *      Tier II: 6% of pensionable pay between KES 9,000 and KES 108,000
 *      -> maximum employee NSSF contribution = 540 + 5,940 = KES 6,480/mo
 *        (NOTE: the original PHP file's code comment said "KES 4,320" —
 *        that was the correct max under the PRE-Feb-2026 limits of
 *        8,000 / 72,000. The constants used in the PHP calculation itself
 *        were already the current 9,000 / 108,000 figures; only the
 *        comment was stale. This port uses the current figures throughout
 *        and keeps the comment consistent with the code.)
 *  - SHIF: flat 2.75% of gross pay
 *  - Affordable Housing Levy: flat 1.5% of gross pay
 *  - PAYE: progressive bands per the Income Tax Act (Finance Act 2023
 *    bands, still current), with a flat KES 2,400 monthly personal relief.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NSSF_RATE = 0.06;
export const SHIF_RATE = 0.0275;
export const HOUSING_LEVY_RATE = 0.015;
export const PERSONAL_RELIEF = 2400;

export const NSSF_TIER_I_LIMIT = 9000; // Tier I pensionable pay ceiling
export const NSSF_TIER_II_LIMIT = 108000; // Tier II pensionable pay ceiling

/** Maximum possible employee NSSF contribution, derived from the tier limits above. */
export const NSSF_MAX_CONTRIBUTION =
  NSSF_TIER_I_LIMIT * NSSF_RATE +
  (NSSF_TIER_II_LIMIT - NSSF_TIER_I_LIMIT) * NSSF_RATE;

/**
 * PAYE bands expressed as cumulative upper bounds (clearer than the
 * original PHP's per-band "width" values, though mathematically
 * equivalent to it): each bracket's `limit` is the taxable income level
 * at which that band ends.
 */
export interface PayeBracket {
  limit: number;
  rate: number;
}

export const PAYE_BRACKETS: PayeBracket[] = [
  { limit: 24000, rate: 0.1 },
  { limit: 32333, rate: 0.25 },
  { limit: 500000, rate: 0.3 },
  { limit: 800000, rate: 0.325 },
  { limit: Infinity, rate: 0.35 },
];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InvalidSalaryError extends Error {
  constructor(message = "Please enter a valid monthly salary greater than zero.") {
    super(message);
    this.name = "InvalidSalaryError";
  }
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface TaxCalculationResult {
  basicPay: number;
  nssf: number;
  shif: number;
  housingLevy: number;
  taxableIncome: number;
  taxBeforeRelief: number;
  personalRelief: number;
  paye: number;
  netPay: number;
  /** Net pay as a % of gross salary */
  netPayPercent: number;
  /** PAYE (after relief) as a % of gross salary */
  payePercent: number;
  /** Tax before relief as a % of gross salary */
  taxPercent: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Calculate the employee's NSSF contribution using the two-tier system.
 *   Tier I : 6% of the first KES 9,000
 *   Tier II: 6% of pensionable pay between KES 9,000 and KES 108,000
 */
function calculateNSSF(salary: number): number {
  const tierOne = Math.min(salary, NSSF_TIER_I_LIMIT) * NSSF_RATE;

  let tierTwo = 0;
  if (salary > NSSF_TIER_I_LIMIT) {
    const tierTwoAmount = Math.min(salary, NSSF_TIER_II_LIMIT) - NSSF_TIER_I_LIMIT;
    tierTwo = tierTwoAmount * NSSF_RATE;
  }

  return tierOne + tierTwo;
}

/**
 * Apply Kenya's progressive PAYE bands to a taxable income amount.
 */
function calculateProgressiveTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let previousLimit = 0;

  for (const bracket of PAYE_BRACKETS) {
    if (taxableIncome <= previousLimit) break;

    const amountInBracket = Math.min(taxableIncome, bracket.limit) - previousLimit;
    tax += amountInBracket * bracket.rate;
    previousLimit = bracket.limit;
  }

  return tax;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate full net-pay breakdown for a given gross monthly salary.
 * Throws `InvalidSalaryError` for non-positive / non-finite input.
 */
export function calculateNetPay(basicSalary: number): TaxCalculationResult {
  if (!Number.isFinite(basicSalary) || basicSalary <= 0) {
    throw new InvalidSalaryError();
  }

  const nssf = calculateNSSF(basicSalary);
  const shif = basicSalary * SHIF_RATE;
  const housingLevy = basicSalary * HOUSING_LEVY_RATE;

  const taxableIncome = basicSalary - nssf - shif - housingLevy;
  const taxBeforeRelief = calculateProgressiveTax(taxableIncome);
  const paye = Math.max(0, taxBeforeRelief - PERSONAL_RELIEF);

  const netPay = basicSalary - nssf - shif - housingLevy - paye;

  return {
    basicPay: round2(basicSalary),
    nssf: round2(nssf),
    shif: round2(shif),
    housingLevy: round2(housingLevy),
    taxableIncome: round2(taxableIncome),
    taxBeforeRelief: round2(taxBeforeRelief),
    personalRelief: PERSONAL_RELIEF,
    paye: round2(paye),
    netPay: round2(netPay),
    netPayPercent: round2((netPay / basicSalary) * 100),
    payePercent: round2((paye / basicSalary) * 100),
    taxPercent: round2((taxBeforeRelief / basicSalary) * 100),
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (still logic, not JSX — safe to share across views)
// ---------------------------------------------------------------------------

const kesFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

/** Format a number as "1,234,567" (no currency symbol, no decimals). */
export function formatCurrency(amount: number): string {
  return kesFormatter.format(amount);
}

/** Format a number as a "12%" style percentage string, clamped to 0–100. */
export function formatPercent(value: number): string {
  const clamped = Math.min(100, Math.max(0, value));
  return `${Math.round(clamped)}%`;
}

/** Strip thousands separators from a user-typed string and parse to a number. */
export function parseSalaryInput(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}