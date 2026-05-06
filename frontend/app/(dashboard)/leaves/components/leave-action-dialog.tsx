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

interface LeaveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "reject" | "apply";
  leavePeriod?: string;
  employeeName?: string;
  onConfirm: (rejectionReason?: string) => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function LeaveActionDialog({
  open,
  onOpenChange,
  action,
  leavePeriod,
  employeeName,
  onConfirm,
  loading = false,
  children,
}: LeaveActionDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");

  const isApprove = action === "approve";
  const isApply = action === "apply";
  const isReject = action === "reject";

  // Reset rejection reason when dialog closes
  useEffect(() => {
    if (!open) {
      setRejectionReason("");
    }
  }, [open]);

  const getTitle = () => {
    if (isApply) return "Apply for Leave";
    return isApprove ? "Approve Leave Request" : "Reject Leave Request";
  };

  const getDescription = () => {
    if (isApply) return null;
    return (
      <>
        Are you sure you want to {isApprove ? "approve" : "reject"} the leave
        request for <strong>{employeeName}</strong>?
        <br />
        <br />
        <strong>Leave Period:</strong>
        <br />
        <strong className="text-gray-900">{leavePeriod}</strong>
      </>
    );
  };

  const getButtonText = () => {
    if (loading) return "Processing...";
    if (isApply) return "Submit Leave Request";
    return `Confirm ${isApprove ? "Approval" : "Rejection"}`;
  };

  const getButtonClass = () => {
    if (isApply) return "bg-blue-600 hover:bg-blue-700 text-white";
    return isApprove
      ? "bg-green-600 hover:bg-green-700 text-white"
      : "bg-red-600 hover:bg-red-700 text-white";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          {!isApply && (
            <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {/* Custom content for apply action */}
        {isApply && children && <div className="py-4">{children}</div>}

        {/* Rejection reason textarea for reject action */}
        {isReject && (
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Rejection Reason (Optional)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejecting this leave request..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              disabled={loading}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>

          {/*
            Use a plain Button instead of AlertDialogAction for the apply case.
            AlertDialogAction auto-closes the dialog the moment it is clicked,
            which fires the form-reset useEffect in the parent BEFORE the API
            call reads formData — so the payload arrives empty.
            A plain Button lets onConfirm control when the dialog closes.
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