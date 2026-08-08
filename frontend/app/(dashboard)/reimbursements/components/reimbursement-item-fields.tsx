"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReimbursementItemInput } from "@/services/api/reimbursement";

const EXPENSE_CATEGORIES = [
  { value: "expense", label: "Other Expense" },
  { value: "travel", label: "Travel" },
  { value: "medical", label: "Medical" },
  { value: "training", label: "Training" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

interface ReimbursementItemFieldsProps {
  items: ReimbursementItemInput[];
  onChange: (items: ReimbursementItemInput[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

const emptyItem = (): ReimbursementItemInput => ({
  expense_category: "expense",
  expense_item: "",
  receipt_number: "",
  amount: 0,
  tax_amount: 0,
  expense_date: "",
  vendor_name: "",
  notes: "",
});

export function ReimbursementItemFields({
  items,
  onChange,
  errors = {},
  disabled = false,
}: ReimbursementItemFieldsProps) {
  const updateItem = (index: number, patch: Partial<ReimbursementItemInput>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  };

  const addItem = () => onChange([...items, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="border border-gray-200 rounded-lg p-3 space-y-3 relative"
        >
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={disabled}
              className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={item.expense_category}
                onChange={(e) => updateItem(index, { expense_category: e.target.value })}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={item.amount || ""}
                onChange={(e) => updateItem(index, { amount: Number(e.target.value) })}
                disabled={disabled}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors[`item_${index}_amount`] ? "border-red-500" : "border-gray-300"
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Expense Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={item.expense_date}
                onChange={(e) => updateItem(index, { expense_date: e.target.value })}
                disabled={disabled}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors[`item_${index}_expense_date`] ? "border-red-500" : "border-gray-300"
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Vendor Name</label>
              <input
                type="text"
                value={item.vendor_name ?? ""}
                onChange={(e) => updateItem(index, { vendor_name: e.target.value })}
                disabled={disabled}
                placeholder="e.g. Kenya Airways"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Item Description</label>
              <input
                type="text"
                value={item.expense_item ?? ""}
                onChange={(e) => updateItem(index, { expense_item: e.target.value })}
                disabled={disabled}
                placeholder="e.g. Flight ticket"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Receipt Number</label>
              <input
                type="text"
                value={item.receipt_number ?? ""}
                onChange={(e) => updateItem(index, { receipt_number: e.target.value })}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {errors[`item_${index}_amount`] && (
            <p className="text-xs text-red-500">{errors[`item_${index}_amount`]}</p>
          )}
          {errors[`item_${index}_expense_date`] && (
            <p className="text-xs text-red-500">{errors[`item_${index}_expense_date`]}</p>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={disabled}
          className="flex items-center gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add Item
        </Button>
        <span className="text-sm font-medium text-gray-700">
          Total: {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export function validateReimbursementItems(
  items: ReimbursementItemInput[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  items.forEach((item, index) => {
    if (!item.amount || item.amount <= 0) {
      errors[`item_${index}_amount`] = "Enter a valid amount";
    }
    if (!item.expense_date) {
      errors[`item_${index}_expense_date`] = "Expense date is required";
    }
  });
  return errors;
}