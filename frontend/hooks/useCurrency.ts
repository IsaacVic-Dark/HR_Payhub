"use client";

import { useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { DEFAULT_CURRENCY, formatCurrency } from "@/utils/currency";

/**
 * Returns the organization's currency code and a bound formatter.
 *
 *   const { currency, format } = useCurrency();
 *   format(150000)  // "KES 150,000.00"
 */
export function useCurrency() {
  const { user } = useAuth();
  const currency = (user?.currency || DEFAULT_CURRENCY).toUpperCase();

  const format = useCallback(
    (amount: number | string | null | undefined, override?: string | null) =>
      formatCurrency(amount, override || currency),
    [currency],
  );

  return { currency, format };
}
