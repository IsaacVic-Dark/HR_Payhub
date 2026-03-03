/**
 * Formats a number into a currency string with thousand separators
 * and two decimal places.
 */
export const formatCurrency = (amount: number | string): string => {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(value)) return "Kshs 0.00";

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(value);
};
