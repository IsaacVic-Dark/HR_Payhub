"use client";

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
import { useState, useEffect } from "react";
import { WorkflowAction } from "@/services/api/loan";
import { AlertTriangle, CheckCircle2, XCircle, Banknote, FileWarning, Gavel, Send } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DialogAction = WorkflowAction | "create";

interface LoanActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: DialogAction;
  loanAmount?: string;
  employeeName?: string;
  /** Called with an optional reason string (for reject / appeal actions) or disburse payload */
  onConfirm: (payload?: ActionPayload) => void;
  loading?: boolean;
  /** Injected form content for "create" and "repayment" actions */
  children?: React.ReactNode;
}

export interface ActionPayload {
  reason?: string;
  disbursement_date?: string;
  monthly_deduction?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

type ActionConfig = {
  title: string;
  icon: React.ReactNode;
  description?: (name: string, amount: string) => React.ReactNode;
  /** Whether the action needs a free-text reason */
  needsReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  /** Whether this is a disburse action (needs extra fields) */
  isDisburse?: boolean;
  /** Confirm button style */
  confirmClass: string;
  confirmLabel: string;
};

const ACTION_CONFIG: Partial<Record<DialogAction, ActionConfig>> = {
  manager_approve: {
    title: "Approve Loan Request",
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    description: (name, amount) => (
      <>Approve the <strong>{amount}</strong> loan request from <strong>{name}</strong>? This will forward the application to HR for review.</>
    ),
    confirmClass: "bg-green-600 hover:bg-green-700 text-white",
    confirmLabel: "Approve",
  },
  manager_reject: {
    title: "Reject Loan Request",
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    description: (name, amount) => (
      <>Reject the <strong>{amount}</strong> loan request from <strong>{name}</strong>? The employee will be notified and may submit an appeal.</>
    ),
    needsReason: true,
    reasonLabel: "Rejection reason",
    reasonPlaceholder: "Provide a reason for rejecting this request…",
    reasonRequired: true,
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
    confirmLabel: "Reject",
  },
  hr_approve: {
    title: "HR Approval",
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    description: (name, amount) => (
      <>Approve the <strong>{amount}</strong> loan for <strong>{name}</strong> from an HR policy perspective? The application will proceed to Finance or be marked ready for disbursement.</>
    ),
    confirmClass: "bg-green-600 hover:bg-green-700 text-white",
    confirmLabel: "HR Approve",
  },
  hr_reject: {
    title: "HR Rejection",
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    description: (name, amount) => (
      <>Reject the <strong>{amount}</strong> loan for <strong>{name}</strong>? The employee will be notified and may appeal.</>
    ),
    needsReason: true,
    reasonLabel: "HR rejection reason",
    reasonPlaceholder: "Describe the compliance or policy issue…",
    reasonRequired: true,
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
    confirmLabel: "HR Reject",
  },
  hr_flag_compliance: {
    title: "Flag for Compliance Review",
    icon: <FileWarning className="h-5 w-5 text-purple-600" />,
    description: (name, amount) => (
      <>Flag the <strong>{amount}</strong> loan for <strong>{name}</strong> for a formal compliance review. The employee will be informed of the hold.</>
    ),
    needsReason: true,
    reasonLabel: "Compliance concern",
    reasonPlaceholder: "Describe the compliance concern that triggered this flag…",
    confirmClass: "bg-purple-600 hover:bg-purple-700 text-white",
    confirmLabel: "Flag for Review",
  },
  finance_approve: {
    title: "Finance Approval",
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    description: (name, amount) => (
      <>Approve the <strong>{amount}</strong> loan for <strong>{name}</strong> from a Finance perspective? This is the final approval step — the loan will be ready for disbursement.</>
    ),
    confirmClass: "bg-green-600 hover:bg-green-700 text-white",
    confirmLabel: "Finance Approve",
  },
  finance_reject: {
    title: "Finance Rejection",
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    description: (name, amount) => (
      <>Reject the <strong>{amount}</strong> loan for <strong>{name}</strong> at the Finance level? The employee will be notified.</>
    ),
    needsReason: true,
    reasonLabel: "Finance rejection reason",
    reasonPlaceholder: "Describe the financial concern…",
    reasonRequired: true,
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
    confirmLabel: "Finance Reject",
  },
  disburse: {
    title: "Set Up Disbursement",
    icon: <Banknote className="h-5 w-5 text-teal-600" />,
    isDisburse: true,
    confirmClass: "bg-teal-600 hover:bg-teal-700 text-white",
    confirmLabel: "Confirm Disbursement",
  },
  approve: {
    title: "Approve Loan (Admin)",
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    description: (name, amount) => (
      <>Directly approve the <strong>{amount}</strong> loan for <strong>{name}</strong>? This bypasses the normal approval workflow.</>
    ),
    confirmClass: "bg-green-600 hover:bg-green-700 text-white",
    confirmLabel: "Approve",
  },
  reject: {
    title: "Reject Loan (Admin)",
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    description: (name, amount) => (
      <>Directly reject the <strong>{amount}</strong> loan for <strong>{name}</strong>?</>
    ),
    needsReason: true,
    reasonLabel: "Rejection reason",
    reasonPlaceholder: "Provide a reason…",
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
    confirmLabel: "Reject",
  },
  repayment: {
    title: "Record Repayment",
    icon: <Banknote className="h-5 w-5 text-blue-600" />,
    confirmClass: "bg-blue-600 hover:bg-blue-700 text-white",
    confirmLabel: "Record Repayment",
  },
  appeal: {
    title: "Submit Appeal",
    icon: <Gavel className="h-5 w-5 text-orange-600" />,
    description: () => (
      <>Disagree with the rejection? Submit an appeal to HR for re-evaluation. Provide a clear reason below.</>
    ),
    needsReason: true,
    reasonLabel: "Appeal reason",
    reasonPlaceholder: "Explain why the rejection should be reconsidered…",
    reasonRequired: true,
    confirmClass: "bg-orange-600 hover:bg-orange-700 text-white",
    confirmLabel: "Submit Appeal",
  },
  create: {
    title: "Create Loan",
    icon: <Send className="h-5 w-5 text-blue-600" />,
    confirmClass: "bg-blue-600 hover:bg-blue-700 text-white",
    confirmLabel: "Create Loan",
  },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function LoanActionDialog({
  open,
  onOpenChange,
  action,
  loanAmount = "",
  employeeName = "",
  onConfirm,
  loading = false,
  children,
}: LoanActionDialogProps) {
  const [reason, setReason] = useState("");
  const [disburseDate, setDisburseDate] = useState("");
  const [monthlyDeduction, setMonthlyDeduction] = useState("");

  const config = ACTION_CONFIG[action];

  useEffect(() => {
    if (!open) {
      setReason("");
      setDisburseDate("");
      setMonthlyDeduction("");
    }
  }, [open]);

  const handleConfirm = () => {
    const payload: ActionPayload = {};
    if (reason) payload.reason = reason;
    if (disburseDate) payload.disbursement_date = disburseDate;
    if (monthlyDeduction) payload.monthly_deduction = monthlyDeduction;
    onConfirm(payload);
  };

  const canConfirm =
    !loading &&
    (!config?.needsReason || !config.reasonRequired || reason.trim().length > 0) &&
    (!config?.isDisburse || monthlyDeduction.trim().length > 0);

  if (!config) return null;

  const isCreateOrRepaymentOrDisburse =
    action === "create" || action === "repayment" || action === "disburse";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </AlertDialogTitle>

          {config.description && !isCreateOrRepaymentOrDisburse && (
            <AlertDialogDescription asChild>
              <p className="text-sm text-gray-600 leading-relaxed mt-1">
                {config.description(employeeName, loanAmount)}
              </p>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {/* Injected form (create / repayment) */}
        {(action === "create" || action === "repayment") && children && (
          <div className="py-2">{children}</div>
        )}

        {/* Disburse form */}
        {action === "disburse" && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg text-sm text-teal-800">
              All approvals are complete. Set the disbursement date and confirm
              the monthly repayment deduction to activate the loan.
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Monthly Deduction (KES) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 5000"
                value={monthlyDeduction}
                onChange={(e) => setMonthlyDeduction(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Disbursement Date{" "}
                <span className="text-gray-400 text-xs">(defaults to today)</span>
              </label>
              <input
                type="date"
                value={disburseDate}
                onChange={(e) => setDisburseDate(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        )}

        {/* Reason textarea */}
        {config.needsReason && (
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium text-gray-700">
              {config.reasonLabel}
              {config.reasonRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.reasonPlaceholder}
              rows={3}
              disabled={loading}
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none",
                action === "appeal"
                  ? "border-orange-300 focus:ring-orange-500"
                  : action.includes("reject")
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300 focus:ring-blue-500"
              )}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={config.confirmClass}
          >
            {loading ? "Processing…" : config.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}