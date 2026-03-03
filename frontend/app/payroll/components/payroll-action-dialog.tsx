"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface PayrollActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "review" | "finalize";
  payrunStatus?: string;
  payrunName?: string;
  payPeriodStart?: string;
  payPeriodEnd?: string;
  totalGrossPay?: number;
  totalDeductions?: number;
  employeeCount?: number;
  onConfirm: () => void;
  loading?: boolean;
}

const formatCurrency = (amount?: number) => {
  if (amount === undefined) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function PayrollActionDialog({
  open,
  onOpenChange,
  action,
  payrunStatus,
  payrunName,
  payPeriodStart,
  payPeriodEnd,
  totalGrossPay,
  totalDeductions,
  employeeCount,
  onConfirm,
  loading = false,
}: PayrollActionDialogProps) {
  const isReview = action === "review";
  const cannotFinalize = !isReview && payrunStatus !== "reviewed";

  const title = isReview ? "Review Payrun" : "Finalize Payrun";
  const buttonLabel = loading
    ? "Processing..."
    : isReview
      ? "Confirm Review"
      : "Confirm Finalize";
  const buttonClass = isReview
    ? "bg-blue-600 hover:bg-blue-700"
    : "bg-green-600 hover:bg-green-700";
  const warningText = isReview
    ? "Are you sure you want to review this payrun? This will mark it as reviewed and ready for finalization."
    : "Are you sure you want to finalize this payrun? This action cannot be undone and will lock the payrun.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>

        {/* Payrun summary */}
        <div className="space-y-3 py-2">
          {/* Status warning — only shown when trying to finalize a non-reviewed payrun */}
          {cannotFinalize && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800">
                This payrun cannot be finalized because its current status is{" "}
                <strong>"{payrunStatus || "unknown"}"</strong>. It must be{" "}
                <strong>reviewed</strong> first before it can be finalized.
              </p>
            </div>
          )}
          <div className="rounded-md border bg-gray-50 p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Payrun</span>
              <span className="font-medium text-gray-900">
                {payrunName || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pay Period</span>
              <span className="font-medium text-gray-900">
                {formatDate(payPeriodStart)} – {formatDate(payPeriodEnd)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Employees</span>
              <span className="font-medium text-gray-900">
                {employeeCount ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Gross Pay</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(totalGrossPay)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Deductions</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(totalDeductions)}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-800">{warningText}</p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading || cannotFinalize}
            className={`${buttonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {buttonLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
