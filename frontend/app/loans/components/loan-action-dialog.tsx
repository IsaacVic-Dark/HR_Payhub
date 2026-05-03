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

interface LoanActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "reject" | "create" | "repayment";
  loanAmount?: string;
  employeeName?: string;
  onConfirm: (rejectionReason?: string) => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function LoanActionDialog({
  open,
  onOpenChange,
  action,
  loanAmount,
  employeeName,
  onConfirm,
  loading = false,
  children,
}: LoanActionDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");

  const isApprove   = action === "approve";
  const isCreate    = action === "create";
  const isReject    = action === "reject";
  const isRepayment = action === "repayment";

  // Reset rejection reason when dialog closes
  useEffect(() => {
    if (!open) {
      setRejectionReason("");
    }
  }, [open]);

  const getTitle = () => {
    if (isRepayment) return "Record Repayment";
    if (isCreate)    return "Create Loan";
    return isApprove ? "Approve Loan Request" : "Reject Loan Request";
  };

  const getDescription = () => {
    if (isCreate || isRepayment) return null;
    return (
      <>
        Are you sure you want to {isApprove ? "approve" : "reject"} the loan
        request for <strong>{employeeName}</strong>?
        <br />
        <br />
        <strong>Loan Amount:</strong>
        <br />
        <strong className="text-gray-900">{loanAmount}</strong>
      </>
    );
  };

  const getButtonText = () => {
    if (loading)     return "Processing...";
    if (isRepayment) return "Record Repayment";
    if (isCreate)    return "Submit Loan";
    return `Confirm ${isApprove ? "Approval" : "Rejection"}`;
  };

  const getButtonClass = () => {
    if (isRepayment) return "bg-blue-600 hover:bg-blue-700 text-white";
    if (isCreate)    return "bg-blue-600 hover:bg-blue-700 text-white";
    return isApprove
      ? "bg-green-600 hover:bg-green-700 text-white"
      : "bg-red-600 hover:bg-red-700 text-white";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          {!isCreate && !isRepayment && (
            <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {/* Custom content for create / repayment action */}
        {(isCreate || isRepayment) && children && <div className="py-4">{children}</div>}

        {/* Rejection reason textarea */}
        {isReject && (
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Rejection Reason (Optional)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejecting this loan request..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              disabled={loading}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>

          {/*
            Use a plain Button (not AlertDialogAction) so onConfirm controls
            when the dialog closes — same pattern as leave-action-dialog.
          */}
          <Button
            onClick={() => onConfirm(rejectionReason)}
            disabled={loading}
            className={getButtonClass()}
          >
            {getButtonText()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}