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

interface PayslipSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "send" = single payslip, "bulk-send" = all generated in payrun */
  action: "send" | "bulk-send";
  employeeName?: string;   // used only for "send"
  payslipNumber?: string;  // used only for "send"
  payrunName?: string;     // used only for "bulk-send"
  pendingCount?: number;   // used only for "bulk-send"
  onConfirm: () => void;
  loading?: boolean;
}

export function PayslipSendDialog({
  open,
  onOpenChange,
  action,
  employeeName,
  payslipNumber,
  payrunName,
  pendingCount,
  onConfirm,
  loading = false,
}: PayslipSendDialogProps) {
  const isBulk = action === "bulk-send";

  const getTitle = () =>
    isBulk ? "Bulk Send Payslips" : "Send Payslip";

  const getDescription = () => {
    if (isBulk) {
      return (
        <>
          You are about to send all{" "}
          <strong>{pendingCount ?? 0} generated payslip(s)</strong> in payrun{" "}
          <strong>{payrunName}</strong>. Each employee will be notified.
        </>
      );
    }
    return (
      <>
        Send payslip <strong>{payslipNumber}</strong> to{" "}
        <strong>{employeeName}</strong>? The employee will be notified.
      </>
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? "Sending…" : isBulk ? "Send All" : "Send Payslip"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}