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
import {
  AdvanceType,
  ActionPayload,
  DisbursementMethod,
  METHOD_LABELS,
  STAGE_LABELS,
  RepaymentRecord,
  formatKES,
  formatDate,
} from "@/services/api/advance";
import { AlertTriangle, Banknote, CheckCircle2, Undo2, XCircle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AdvanceDialogAction =
  | "approve"
  | "reject"
  | "disburse"
  | "cancel"
  | "reverse"
  | "repayment";

interface AdvanceActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: AdvanceDialogAction;
  advance: AdvanceType | null;
  /** Methods allowed by the org policy (used by "disburse"). */
  methodOptions?: DisbursementMethod[];
  /** Repayment history (used by "reverse": only applied manual repayments can be reversed). */
  repayments?: RepaymentRecord[];
  onConfirm: (payload: ActionPayload) => void;
  loading?: boolean;
}

type ActionConfig = {
  title: string;
  icon: React.ReactNode;
  description: (name: string, amount: string, stage?: string) => React.ReactNode;
  needsReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  confirmClass: string;
  confirmLabel: string;
};

// ─── Config ────────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<AdvanceDialogAction, ActionConfig> = {
  approve: {
    title: "Approve Advance",
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    description: (name, amount, stage) => (
      <>
        Approve the <strong>{amount}</strong> advance request from <strong>{name}</strong>
        {stage ? <> at the <strong>{stage}</strong> step</> : null}? You can lower the
        approved amount below.
      </>
    ),
    confirmClass: "bg-green-600 hover:bg-green-700 text-white",
    confirmLabel: "Approve",
  },
  reject: {
    title: "Reject Advance",
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    description: (name, amount) => (
      <>
        Reject the <strong>{amount}</strong> advance request from <strong>{name}</strong>?
        The employee will be notified.
      </>
    ),
    needsReason: true,
    reasonLabel: "Rejection reason",
    reasonPlaceholder: "Provide a reason for rejecting this request…",
    reasonRequired: true,
    confirmClass: "bg-red-600 hover:bg-red-700 text-white",
    confirmLabel: "Reject",
  },
  disburse: {
    title: "Disburse Advance",
    icon: <Banknote className="h-5 w-5 text-teal-600" />,
    description: (name, amount) => (
      <>
        Confirm disbursement of <strong>{amount}</strong> to <strong>{name}</strong>.
      </>
    ),
    confirmClass: "bg-teal-600 hover:bg-teal-700 text-white",
    confirmLabel: "Confirm Disbursement",
  },
  cancel: {
    title: "Cancel Advance",
    icon: <Ban className="h-5 w-5 text-gray-600" />,
    description: (name, amount) => (
      <>
        Cancel the <strong>{amount}</strong> advance for <strong>{name}</strong>? This
        can&apos;t be undone.
      </>
    ),
    needsReason: true,
    reasonLabel: "Reason (optional)",
    reasonPlaceholder: "Why is this advance being cancelled?",
    confirmClass: "bg-gray-800 hover:bg-gray-900 text-white",
    confirmLabel: "Cancel Advance",
  },
  reverse: {
    title: "Reverse Repayment",
    icon: <Undo2 className="h-5 w-5 text-orange-600" />,
    description: (name, amount) => (
      <>
        Reverse a manual repayment on the <strong>{amount}</strong> advance for{" "}
        <strong>{name}</strong>. The repaid amount is added back to the balance.
      </>
    ),
    needsReason: true,
    reasonLabel: "Reversal reason",
    reasonPlaceholder: "Explain why this repayment is being reversed…",
    reasonRequired: true,
    confirmClass: "bg-orange-600 hover:bg-orange-700 text-white",
    confirmLabel: "Reverse Repayment",
  },
  repayment: {
    title: "Record Repayment",
    icon: <Banknote className="h-5 w-5 text-blue-600" />,
    description: (name) => (
      <>
        Record a manual repayment received from <strong>{name}</strong>.
      </>
    ),
    confirmClass: "bg-blue-600 hover:bg-blue-700 text-white",
    confirmLabel: "Record Repayment",
  },
};

const ALL_METHODS: DisbursementMethod[] = [
  "payroll",
  "mpesa",
  "bank_transfer",
  "cash",
  "cheque",
];

const today = () => new Date().toISOString().split("T")[0];

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ─── Component ─────────────────────────────────────────────────────────────────

export function AdvanceActionDialog({
  open,
  onOpenChange,
  action,
  advance,
  methodOptions,
  repayments,
  onConfirm,
  loading = false,
}: AdvanceActionDialogProps) {
  const [reason, setReason] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [method, setMethod] = useState<DisbursementMethod>("payroll");
  const [reference, setReference] = useState("");
  const [disburseDate, setDisburseDate] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [repaymentId, setRepaymentId] = useState("");

  // Re-seed the form each time the dialog opens for an advance.
  useEffect(() => {
    if (!open) return;
    setReason("");
    setReference("");
    setDisburseDate("");
    setRepayAmount("");
    setRepayDate(today());
    setNotes("");
    setRepaymentId("");
    setApproveAmount(advance ? String(Number(advance.amount_requested)) : "");
    setMethod(advance?.disbursement_method ?? "payroll");
  }, [open, advance]);

  const config = ACTION_CONFIG[action];
  if (!config || !advance) return null;

  const requested = Number(advance.amount_requested);
  const balance = Number(advance.balance_remaining);
  const methods = methodOptions?.length ? methodOptions : ALL_METHODS;
  // Only applied MANUAL repayments can be reversed here; payroll recoveries are
  // reversed by reprocessing the draft payrun.
  const reversible = (repayments ?? []).filter(
    (r) => r.method === "manual" && r.status === "applied"
  );

  const approveNum = Number(approveAmount);
  const repayNum = Number(repayAmount);

  const fieldsValid = (() => {
    switch (action) {
      case "approve":
        return approveNum > 0 && approveNum <= requested;
      case "disburse":
        return !!method;
      case "repayment":
        return repayNum > 0 && repayNum <= balance && !!repayDate;
      case "reverse":
        return !!repaymentId;
      default:
        return true;
    }
  })();

  const canConfirm =
    !loading &&
    fieldsValid &&
    (!config.reasonRequired || reason.trim().length > 0);

  const handleConfirm = () => {
    const payload: ActionPayload = {};
    if (reason.trim()) payload.reason = reason.trim();

    if (action === "approve") payload.amount_approved = approveAmount;
    if (action === "disburse") {
      payload.disbursement_method = method;
      if (reference.trim()) payload.disbursement_reference = reference.trim();
      if (disburseDate) payload.disbursement_date = disburseDate;
    }
    if (action === "reverse") payload.repayment_id = repaymentId;
    if (action === "repayment") {
      payload.amount = repayAmount;
      payload.repayment_date = repayDate;
      if (notes.trim()) payload.notes = notes.trim();
    }
    onConfirm(payload);
  };

  const stageLabel = advance.current_stage ? STAGE_LABELS[advance.current_stage] : undefined;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p className="text-sm text-gray-600 leading-relaxed mt-1">
              {config.description(
                advance.employee.full_name,
                formatKES(requested),
                action === "approve" ? stageLabel : undefined
              )}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Approve: editable amount */}
        {action === "approve" && (
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium text-gray-700">
              Approved amount (KES) <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">
                max {formatKES(requested)}
              </span>
            </label>
            <input
              type="number"
              min={1}
              max={requested}
              step="0.01"
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
              disabled={loading}
              className={cn(inputClass, approveNum > requested && "border-red-400")}
            />
            {approveNum > requested && (
              <p className="text-xs text-red-500">
                Approved amount can&apos;t exceed the requested amount.
              </p>
            )}
          </div>
        )}

        {/* Disburse */}
        {action === "disburse" && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg text-sm text-teal-800">
              Amount to disburse:{" "}
              <strong>{formatKES(advance.amount_approved ?? requested)}</strong>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Method <span className="text-red-500">*</span>
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as DisbursementMethod)}
                disabled={loading}
                className={cn(inputClass, "bg-white")}
              >
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Reference <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. M-Pesa code"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Date <span className="text-gray-400 text-xs">(defaults to today)</span>
                </label>
                <input
                  type="date"
                  value={disburseDate}
                  onChange={(e) => setDisburseDate(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* Repayment */}
        {action === "repayment" && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
              Outstanding balance: <strong>{formatKES(balance)}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Amount (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={balance}
                  step="0.01"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  disabled={loading}
                  className={cn(inputClass, repayNum > balance && "border-red-400")}
                />
                {repayNum > balance && (
                  <p className="text-xs text-red-500">Exceeds outstanding balance.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={repayDate}
                  onChange={(e) => setRepayDate(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Notes <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={loading}
                className={cn(inputClass, "resize-none")}
              />
            </div>
          </div>
        )}

        {/* Reverse: pick the manual repayment */}
        {action === "reverse" && (
          <div className="space-y-1.5 py-2">
            {reversible.length === 0 ? (
              <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-800">
                There are no manual repayments to reverse. Payroll recoveries are reversed by
                reprocessing the draft payrun.
              </div>
            ) : (
              <>
                <label className="text-sm font-medium text-gray-700">
                  Repayment to reverse <span className="text-red-500">*</span>
                </label>
                <select
                  value={repaymentId}
                  onChange={(e) => setRepaymentId(e.target.value)}
                  disabled={loading}
                  className={cn(inputClass, "bg-white")}
                >
                  <option value="">Select a repayment…</option>
                  {reversible.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDate(r.repayment_date)} — {formatKES(r.amount)}
                      {r.notes ? ` (${r.notes})` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        {/* Reason textarea */}
        {config.needsReason && (
          <div className="space-y-1.5 py-2">
            {action === "reverse" && (
              <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-800 flex gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
                Reversals are recorded in the advance&apos;s audit trail.
              </div>
            )}
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
                action === "reject"
                  ? "border-red-300 focus:ring-red-500"
                  : action === "reverse"
                  ? "border-orange-300 focus:ring-orange-500"
                  : "border-gray-300 focus:ring-blue-500"
              )}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {action === "cancel" ? "Keep Advance" : "Close"}
          </AlertDialogCancel>
          <Button onClick={handleConfirm} disabled={!canConfirm} className={config.confirmClass}>
            {loading ? "Processing…" : config.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}