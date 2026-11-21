/**
 * Currency helpers.
 *
 * The organization's currency comes from the backend (`organizations.currency`,
 * returned by /auth/login and /auth/me). AuthContext calls `setOrgCurrency()`
 * whenever the signed-in user changes, so `formatCurrency(150000)` anywhere in
 * the app (components, tables, PDF generators) renders "KES 150,000.00" using
 * the organization's own currency without having to pass it around.
 *
 * You can still pass a currency explicitly, e.g. for records that carry their
 * own currency: formatCurrency(r.amount, r.currency).
 */

export const DEFAULT_CURRENCY = "KES";

let orgCurrency: string = DEFAULT_CURRENCY;

/** Called by AuthContext. Falls back to KES when the value is empty. */
export const setOrgCurrency = (currency?: string | null): void => {
  const c = (currency ?? "").trim().toUpperCase();
  orgCurrency = c || DEFAULT_CURRENCY;
};

export const getOrgCurrency = (): string => orgCurrency;

/** Safely turns "150,000.50" | "150000" | 150000 | null into a number (NaN-safe → 0). */
export const toAmount = (amount: number | string | null | undefined): number => {
  if (amount === null || amount === undefined || amount === "") return 0;
  const value =
    typeof amount === "string" ? parseFloat(amount.replace(/,/g, "")) : amount;
  return Number.isFinite(value) ? value : 0;
};

/** 150000 → "150,000.00" (no currency code). */
export const formatNumber = (
  amount: number | string | null | undefined,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(toAmount(amount));

/**
 * 150000 → "KES 150,000.00"
 * Uses the organization's currency unless one is passed explicitly.
 */
export const formatCurrency = (
  amount: number | string | null | undefined,
  currency?: string | null,
): string => {
  const code = (currency ?? "").trim().toUpperCase() || orgCurrency;
  return `${code} ${formatNumber(amount)}`;
};

/** "1,500.5" → "1500.5" (what you should send to the API). */
export const parseAmount = (display: string): string =>
  display.replace(/,/g, "");

/** Like formatCurrency, but renders "—" when there is no value (null / undefined / ""). */
export const formatCurrencyOrDash = (
  amount: number | string | null | undefined,
  currency?: string | null,
): string =>
  amount === null || amount === undefined || amount === ""
    ? "—"
    : formatCurrency(amount, currency);

/** 1250000 → "KES 1.3M" — for tight spaces such as stat cards. */
export const formatCompactCurrency = (
  amount: number | string | null | undefined,
  currency?: string | null,
): string => {
  const code = (currency ?? "").trim().toUpperCase() || orgCurrency;
  const n = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(toAmount(amount));
  return `${code} ${n}`;
};
