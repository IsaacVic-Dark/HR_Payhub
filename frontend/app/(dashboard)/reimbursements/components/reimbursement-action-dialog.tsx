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
import type { ReimbursementType } from "@/services/api/reimbursement";

export type ReimbursementActionType =
  | "approve"
  | "reject"
  | "cancel"
  | "dispute"
  | "resolve-dispute"
  | "process-payment"
  | "confirm-payment"
  | "fail-payment"
  | "reverse"
  | "request-clarification"
  | "apply";

interface ReimbursementActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ReimbursementActionType;
  reimbursement?: ReimbursementType | null;
  onConfirm: (payload: Record<string, any>) => void;
  loading?: boolean;
  children?: React.ReactNode;
}

const TITLES: Record<ReimbursementActionType, string> = {
  approve: "Approve Reimbursement",
  reject: "Reject Reimbursement",
  cancel: "Cancel Reimbursement",
  dispute: "Dispute Decision",
  "resolve-dispute": "Resolve Dispute",
  "process-payment": "Process Payment",
  "confirm-payment": "Confirm Payment",
  "fail-payment": "Mark Payment Failed",
  reverse: "Reverse Payment",
  "request-clarification": "Request Clarification",
  apply: "Submit Reimbursement Claim",
};

const CONFIRM_LABEL: Record<ReimbursementActionType, string> = {
  approve: "Confirm Approval",
  reject: "Confirm Rejection",
  cancel: "Confirm Cancellation",
  dispute: "Submit Dispute",
  "resolve-dispute": "Resolve",
  "process-payment": "Initiate Payment",
  "confirm-payment": "Confirm Payment",
  "fail-payment": "Mark Failed",
  reverse: "Confirm Reversal",
  "request-clarification": "Send Request",
  apply: "Submit Claim",
};

const BUTTON_CLASS: Record<ReimbursementActionType, string> = {
  approve: "bg-green-600 hover:bg-green-700 text-white",
  reject: "bg-red-600 hover:bg-red-700 text-white",
  cancel: "bg-red-600 hover:bg-red-700 text-white",
  dispute: "bg-amber-600 hover:bg-amber-700 text-white",
  "resolve-dispute": "bg-blue-600 hover:bg-blue-700 text-white",
  "process-payment": "bg-blue-600 hover:bg-blue-700 text-white",
  "confirm-payment": "bg-green-600 hover:bg-green-700 text-white",
  "fail-payment": "bg-red-600 hover:bg-red-700 text-white",
  reverse: "bg-red-600 hover:bg-red-700 text-white",
  "request-clarification": "bg-amber-600 hover:bg-amber-700 text-white",
  apply: "bg-blue-600 hover:bg-blue-700 text-white",
};

export function ReimbursementActionDialog({
  open,
  onOpenChange,
  action,
  reimbursement,
  onConfirm,
  loading = false,
  children,
}: ReimbursementActionDialogProps) {
  const [approvedAmount, setApprovedAmount] = useState("");
  const [comments, setComments] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<"confirm" | "increase" | "reject">("confirm");
  const [newAmount, setNewAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!open) {
      setApprovedAmount("");
      setComments("");
      setReason("");
      setNotes("");
      setDecision("confirm");
      setNewAmount("");
      setPaymentReference("");
      setAmountPaid("");
      setPhone("");
    } else if (reimbursement) {
      setApprovedAmount(reimbursement.amount_requested);
      setAmountPaid(reimbursement.amount_approved);
    }
  }, [open, reimbursement]);

  const handleConfirm = () => {
    switch (action) {
      case "approve":
        onConfirm({
          approved_amount: approvedAmount ? Number(approvedAmount) : undefined,
          comments: comments || undefined,
        });
        break;
      case "reject":
        onConfirm({ reason: reason || undefined });
        break;
      case "cancel":
        onConfirm({ reason: reason || undefined });
        break;
      case "dispute":
        onConfirm({ reason });
        break;
      case "resolve-dispute":
        onConfirm({
          decision,
          new_amount: decision === "increase" ? Number(newAmount) : undefined,
          comments: comments || undefined,
        });
        break;
      case "process-payment":
        onConfirm({ phone: phone || undefined, reference: paymentReference || undefined });
        break;
      case "confirm-payment":
        onConfirm({
          amount_paid: amountPaid ? Number(amountPaid) : undefined,
          payment_reference: paymentReference || undefined,
        });
        break;
      case "fail-payment":
        onConfirm({ reason: reason || undefined });
        break;
      case "reverse":
        onConfirm({ reason: reason || undefined });
        break;
      case "request-clarification":
        onConfirm({ notes });
        break;
      case "apply":
        onConfirm({});
        break;
    }
  };

  const isApply = action === "apply";
  const requiresReceiptRefForPayment =
    action === "confirm-payment" &&
    (reimbursement?.payout_method === "cash" || reimbursement?.payout_method === "check");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLES[action]}</AlertDialogTitle>
          {!isApply && reimbursement && (
            <AlertDialogDescription>
              {reimbursement.reimbursement_number}
              {reimbursement.employee_full_name ? ` — ${reimbursement.employee_full_name}` : ""}
              <br />
              Requested:{" "}
              <strong className="text-gray-900">
                {Number(reimbursement.amount_requested).toLocaleString()} {reimbursement.currency}
              </strong>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {isApply && children && <div className="py-2 max-h-[60vh] overflow-y-auto">{children}</div>}

        {action === "approve" && (
          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Approved Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500">
                Lower than the requested amount to record a partial approval.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Comments (Optional)</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
          </div>
        )}

        {(action === "reject" || action === "cancel" || action === "fail-payment" || action === "reverse") && (
          <div className="py-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Reason {action === "reject" ? "(Optional)" : ""}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Provide a reason..."
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
        )}

        {action === "dispute" && (
          <div className="py-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Dispute Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why you're disputing this decision..."
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>
        )}

        {action === "request-clarification" && (
          <div className="py-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              What do you need clarified? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>
        )}

        {action === "resolve-dispute" && (
          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Decision</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as any)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="confirm">Confirm original decision</option>
                <option value="increase">Increase approved amount</option>
                <option value="reject">Reject the dispute</option>
              </select>
            </div>
            {decision === "increase" && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">New Amount</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Comments (Optional)</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={2}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {action === "process-payment" && (
          <div className="py-2 space-y-3">
            {reimbursement?.payout_method === "mpesa" && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Recipient Phone (Optional — defaults to employee record)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="2547XXXXXXXX"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Provider Reference (Optional)
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {action === "confirm-payment" && (
          <div className="py-2 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Amount Paid</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Payment Reference{" "}
                {requiresReceiptRefForPayment ? (
                  <span className="text-red-500">*</span>
                ) : (
                  "(Optional)"
                )}
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={
                  reimbursement?.payout_method === "cash"
                    ? "e.g. CASH-VOUCHER-2026-0081"
                    : "M-Pesa / bank / check reference"
                }
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          {/* Plain Button (not AlertDialogAction) so onConfirm controls closing —
              matches leave-action-dialog.tsx's rationale for the apply case. */}
          <Button
            onClick={handleConfirm}
            disabled={
              loading ||
              (action === "dispute" && !reason) ||
              (action === "request-clarification" && !notes) ||
              (requiresReceiptRefForPayment && !paymentReference)
            }
            className={BUTTON_CLASS[action]}
          >
            {loading ? "Processing..." : CONFIRM_LABEL[action]}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}