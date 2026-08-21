"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  AllowanceTypeType,
  AllowanceCategory,
  PaymentNature,
  AllowanceFrequency,
  SupportedCalculationMethod,
  AllowanceTypeStatus,
  CreateAllowanceTypePayload,
} from "@/services/api/allowance";

const CATEGORY_OPTIONS: { value: AllowanceCategory; label: string }[] = [
  { value: "housing", label: "Housing" },
  { value: "transport", label: "Transport" },
  { value: "meal", label: "Meal" },
  { value: "medical", label: "Medical" },
  { value: "travel", label: "Travel" },
  { value: "responsibility", label: "Responsibility" },
];

const PAYMENT_NATURE_OPTIONS: { value: PaymentNature; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "non_cash", label: "Non-Cash" },
];

const FREQUENCY_OPTIONS: { value: AllowanceFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
  { value: "per_pay_run", label: "Per Pay Run" },
  { value: "one_time", label: "One-Time" },
  { value: "per_event", label: "Per Event" },
];

// Only these three are evaluated by PayrunProcessingService today — the
// create/edit form intentionally doesn't offer PER_DAY / PER_UNIT / FORMULA
// / ACTUAL_EXPENSE, since the backend rejects them anyway (phase 2).
const CALCULATION_METHOD_OPTIONS: { value: SupportedCalculationMethod; label: string }[] = [
  { value: "FIXED_AMOUNT", label: "Fixed Amount" },
  { value: "PERCENTAGE_OF_BASIC", label: "Percentage of Basic Salary" },
  { value: "PERCENTAGE_OF_GROSS", label: "Percentage of Gross Pay" },
];

const STATUS_OPTIONS: { value: AllowanceTypeStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
];

interface AllowanceTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowanceType?: AllowanceTypeType | null; // null/undefined = create mode
  onSubmit: (payload: CreateAllowanceTypePayload) => void;
  loading?: boolean;
}

type FormState = {
  name: string;
  code: string;
  description: string;
  category: AllowanceCategory;
  payment_nature: PaymentNature;
  frequency: AllowanceFrequency;
  calculation_method: SupportedCalculationMethod;
  amount: string;
  percentage: string;
  is_recurring: boolean;
  requires_receipt: boolean;
  taxable_income: boolean;
  taxable_limit: string;
  effective_from: string;
  effective_to: string;
  status: AllowanceTypeStatus;
};

const emptyForm = (): FormState => ({
  name: "",
  code: "",
  description: "",
  category: "housing",
  payment_nature: "cash",
  frequency: "monthly",
  calculation_method: "FIXED_AMOUNT",
  amount: "",
  percentage: "",
  is_recurring: true,
  requires_receipt: false,
  taxable_income: true,
  taxable_limit: "",
  effective_from: "",
  effective_to: "",
  status: "ACTIVE",
});

export function AllowanceTypeFormDialog({
  open,
  onOpenChange,
  allowanceType,
  onSubmit,
  loading = false,
}: AllowanceTypeFormDialogProps) {
  const isEdit = !!allowanceType;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setErrors({});
      return;
    }
    if (allowanceType) {
      setForm({
        name: allowanceType.name,
        code: allowanceType.code,
        description: allowanceType.description ?? "",
        category: allowanceType.category,
        payment_nature: allowanceType.payment_nature,
        frequency: allowanceType.frequency,
        calculation_method:
          (allowanceType.calculation_method as SupportedCalculationMethod) ?? "FIXED_AMOUNT",
        amount: allowanceType.amount ?? "",
        percentage: allowanceType.percentage ?? "",
        is_recurring: !!allowanceType.is_recurring,
        requires_receipt: !!allowanceType.requires_receipt,
        taxable_income: !!allowanceType.taxable_income,
        taxable_limit: allowanceType.taxable_limit ?? "",
        effective_from: allowanceType.effective_from ?? "",
        effective_to: allowanceType.effective_to ?? "",
        status: allowanceType.status,
      });
    }
  }, [open, allowanceType]);

  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.code.trim()) next.code = "Code is required";
    if (form.calculation_method === "FIXED_AMOUNT" && !form.amount) {
      next.amount = "Amount is required for a fixed amount allowance";
    }
    if (
      (form.calculation_method === "PERCENTAGE_OF_BASIC" ||
        form.calculation_method === "PERCENTAGE_OF_GROSS") &&
      !form.percentage
    ) {
      next.percentage = "Percentage is required";
    }
    if (form.percentage && (Number(form.percentage) < 0 || Number(form.percentage) > 100)) {
      next.percentage = "Percentage must be between 0 and 100";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    onSubmit({
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description || null,
      category: form.category,
      payment_nature: form.payment_nature,
      frequency: form.frequency,
      calculation_method: form.calculation_method,
      amount: form.calculation_method === "FIXED_AMOUNT" ? Number(form.amount) : null,
      percentage:
        form.calculation_method === "PERCENTAGE_OF_BASIC" ||
        form.calculation_method === "PERCENTAGE_OF_GROSS"
          ? Number(form.percentage)
          : null,
      is_recurring: form.is_recurring,
      requires_receipt: form.requires_receipt,
      taxable_income: form.taxable_income,
      taxable_limit: form.taxable_income && form.taxable_limit ? Number(form.taxable_limit) : null,
      effective_from: form.effective_from || null,
      effective_to: form.effective_to || null,
      status: form.status,
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isEdit ? "Edit Allowance Type" : "New Allowance Type"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isEdit
              ? "Update this allowance's defaults. Existing employee grants keep their own overrides."
              : "Define a new allowance available to this organisation's employees."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2 max-h-[65vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                disabled={loading}
                placeholder="e.g. House Allowance"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.name ? "border-red-500" : "border-gray-300"
                )}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => update({ code: e.target.value.toUpperCase() })}
                disabled={loading}
                placeholder="e.g. HOUSE_ALLOW"
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.code ? "border-red-500" : "border-gray-300"
                )}
              />
              {errors.code && <p className="text-xs text-red-500">{errors.code}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <Select
                value={form.category}
                onValueChange={(value) => update({ category: value as AllowanceCategory })}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Category</SelectLabel>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Payment Nature</label>
              <Select
                value={form.payment_nature}
                onValueChange={(value) => update({ payment_nature: value as PaymentNature })}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Payment Nature</SelectLabel>
                    {PAYMENT_NATURE_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Frequency</label>
              <Select
                value={form.frequency}
                onValueChange={(value) => update({ frequency: value as AllowanceFrequency })}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Frequency</SelectLabel>
                    {FREQUENCY_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Calculation Method</label>
              <Select
                value={form.calculation_method}
                onValueChange={(value) =>
                  update({ calculation_method: value as SupportedCalculationMethod })
                }
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Calculation Method</SelectLabel>
                    {CALCULATION_METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.calculation_method === "FIXED_AMOUNT" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Default Amount (KES) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => update({ amount: e.target.value })}
                disabled={loading}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.amount ? "border-red-500" : "border-gray-300"
                )}
              />
              {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
            </div>
          )}

          {(form.calculation_method === "PERCENTAGE_OF_BASIC" ||
            form.calculation_method === "PERCENTAGE_OF_GROSS") && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Default Percentage <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.percentage}
                onChange={(e) => update({ percentage: e.target.value })}
                disabled={loading}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.percentage ? "border-red-500" : "border-gray-300"
                )}
              />
              <p className="text-xs text-gray-500">
                {form.calculation_method === "PERCENTAGE_OF_BASIC"
                  ? "% of the employee's basic salary."
                  : "% of gross pay before allowances are added."}
              </p>
              {errors.percentage && <p className="text-xs text-red-500">{errors.percentage}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Effective From</label>
              <input
                type="date"
                value={form.effective_from}
                onChange={(e) => update({ effective_from: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Effective To</label>
              <input
                type="date"
                value={form.effective_to}
                onChange={(e) => update({ effective_to: e.target.value })}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => update({ is_recurring: e.target.checked })}
                disabled={loading}
              />
              Recurring (applies every pay run while active, not just once)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.requires_receipt}
                onChange={(e) => update({ requires_receipt: e.target.checked })}
                disabled={loading}
              />
              Requires a supporting document/receipt
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.taxable_income}
                onChange={(e) => update({ taxable_income: e.target.checked })}
                disabled={loading}
              />
              Subject to PAYE
            </label>
          </div>

          {form.taxable_income && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Tax-Exempt Threshold (KES, optional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.taxable_limit}
                onChange={(e) => update({ taxable_limit: e.target.value })}
                disabled={loading}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                The amount up to this threshold is tax-free per pay period; only the excess is
                taxed. Leave blank if the full amount is taxable.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <Select
              value={form.status}
              onValueChange={(value) => update({ status: value as AllowanceTypeStatus })}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Status</SelectLabel>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Allowance Type"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}