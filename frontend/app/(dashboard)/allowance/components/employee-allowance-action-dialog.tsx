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
import type { EmployeeAllowanceType } from "@/services/api/allowance";

export type EmployeeAllowanceActionType =
  | "submit"
  | "approve"
  | "reject"
  | "suspend"
  | "cancel"
  | "apply";

interface EmployeeAllowanceActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: EmployeeAllowanceActionType;
  employeeAllowance?: EmployeeAllowanceType | null;
  onConfirm: (payload: Record<string, any>) => void;
  loading?: boolean;
  children?: React.ReactNode;
}

const TITLES: Record<EmployeeAllowanceActionType, string> = {
  submit: "Submit for Approval",
  approve: "Approve Allowance",
  reject: "Reject Allowance",
  suspend: "Suspend Allowance",
  cancel: "Cancel Allowance",
  apply: "New Employee Allowance",
};

const CONFIRM_LABEL: Record<EmployeeAllowanceActionType, string> = {
  submit: "Submit",
  approve: "Confirm Approval",
  reject: "Confirm Rejection",
  suspend: "Confirm Suspension",
  cancel: "Confirm Cancellation",
  apply: "Create Allowance",
};

const BUTTON_CLASS: Record<EmployeeAllowanceActionType, string> = {
  submit: "bg-blue-600 hover:bg-blue-700 text-white",
  approve: "bg-green-600 hover:bg-green-700 text-white",
  reject: "bg-red-600 hover:bg-red-700 text-white",
  suspend: "bg-amber-600 hover:bg-amber-700 text-white",
  cancel: "bg-red-600 hover:bg-red-700 text-white",
  apply: "bg-blue-600 hover:bg-blue-700 text-white",
};

const DESCRIPTIONS: Record<EmployeeAllowanceActionType, string | null> = {
  submit: "This sends the request into the approval queue.",
  approve: null,
  reject: null,
  suspend: "The employee stops receiving this allowance until it's cancelled and re-created — approval history is kept.",
  cancel: "This cannot be undone. The allowance will no longer be eligible to attach to any payrun.",
  apply: null,
};

export function EmployeeAllowanceActionDialog({
  open,
  onOpenChange,
  action,
  employeeAllowance,
  onConfirm,
  loading = false,
  children,
}: EmployeeAllowanceActionDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (!open) {
      setRejectionReason("");
    }
  }, [open]);

  const handleConfirm = () => {
    switch (action) {
      case "reject":
        onConfirm({ rejection_reason: rejectionReason });
        break;
      case "submit":
      case "approve":
      case "suspend":
      case "cancel":
        onConfirm({});
        break;
      case "apply":
        onConfirm({});
        break;
    }
  };

  const isApply = action === "apply";
  const amountLabel = (ea: EmployeeAllowanceType) => {
    if (ea.amount) return `${Number(ea.amount).toLocaleString()} KES`;
    if (ea.percentage) return `${Number(ea.percentage)}%`;
    if (ea.type_default_amount) return `${Number(ea.type_default_amount).toLocaleString()} KES (default)`;
    if (ea.type_default_percentage) return `${Number(ea.type_default_percentage)}% (default)`;
    return "—";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLES[action]}</AlertDialogTitle>
          {!isApply && employeeAllowance && (
            <AlertDialogDescription>
              {employeeAllowance.allowance_name}
              {employeeAllowance.employee_name ? ` — ${employeeAllowance.employee_name}` : ""}
              <br />
              Amount: <strong className="text-gray-900">{amountLabel(employeeAllowance)}</strong>
              {DESCRIPTIONS[action] && (
                <>
                  <br />
                  <span className="text-xs">{DESCRIPTIONS[action]}</span>
                </>
              )}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {isApply && children && <div className="py-2 max-h-[60vh] overflow-y-auto">{children}</div>}

        {action === "reject" && (
          <div className="py-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Explain why this request is being rejected..."
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          {/* Plain Button (not AlertDialogAction) so onConfirm controls closing —
              matches reimbursement-action-dialog.tsx's rationale for the apply case. */}
          <Button
            onClick={handleConfirm}
            disabled={loading || (action === "reject" && !rejectionReason)}
            className={BUTTON_CLASS[action]}
          >
            {loading ? "Processing..." : CONFIRM_LABEL[action]}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}