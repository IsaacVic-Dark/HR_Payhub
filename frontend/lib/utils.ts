import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency formatting now lives in utils/currency.ts (organization-aware).
export { formatCurrency } from "@/utils/currency";
