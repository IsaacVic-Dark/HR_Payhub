/**
 * Formats a number into a currency string with thousand separators
 * and two decimal places.
 */
export function formatCurrency(
  amount: number,
  currency: string = "Kshs"
): string {
  if (isNaN(amount)) {
    return `${currency} 0.00`;
  }

  const formattedAmount = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currency} ${formattedAmount}`;
}
