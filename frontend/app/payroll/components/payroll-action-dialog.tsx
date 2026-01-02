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
import { useState, useEffect } from "react";

interface PayrollActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "pay" | "generate";
  payrollPeriod?: string;
  employeeName?: string;
  netPay?: number;
  onConfirm: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function PayrollActionDialog({
  open,
  onOpenChange,
  action,
  payrollPeriod,
  employeeName,
  netPay,
  onConfirm,
  loading = false,
  children,
}: PayrollActionDialogProps) {
  const isApprove = action === "approve";
  const isPay = action === "pay";
  const isGenerate = action === "generate";

  const getTitle = () => {
    if (isGenerate) return "Generate Payroll";
    if (isApprove) return "Approve Payroll";
    return "Mark Payroll as Paid";
  };

  const getDescription = () => {
    if (isGenerate) return null;
    return (
      <>
        Are you sure you want to {isApprove ? "approve" : "mark as paid"} the payroll
        for <strong>{employeeName}</strong>?
        <br />
        <br />
        <strong>Pay Period:</strong>
        <br />
        <strong className="text-gray-900">{payrollPeriod}</strong>
        {netPay && (
          <>
            <br />
            <br />
            <strong>Net Pay:</strong>
            <br />
            <strong className="text-gray-900">
              {new Intl.NumberFormat("en-KE", {
                style: "currency",
                currency: "KES",
              }).format(netPay)}
            </strong>
          </>
        )}
      </>
    );
  };

  const getButtonText = () => {
    if (loading) return "Processing...";
    if (isGenerate) return "Generate Payroll";
    if (isApprove) return "Confirm Approval";
    return "Confirm Payment";
  };

  const getButtonClass = () => {
    if (isGenerate) return "bg-blue-600 hover:bg-blue-700";
    if (isApprove) return "bg-blue-600 hover:bg-blue-700";
    return "bg-green-600 hover:bg-green-700";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          {!isGenerate && (
            <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {/* Custom content for generate action */}
        {isGenerate && children && <div className="py-4">{children}</div>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={getButtonClass()}
          >
            {getButtonText()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

