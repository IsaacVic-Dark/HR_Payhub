"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Wallet, History } from "lucide-react";
import type { EmployeeAllowanceType } from "@/services/api/allowance";

interface EmployeeAllowanceViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeAllowance: EmployeeAllowanceType | null;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT: { color: "bg-gray-100 text-gray-800", label: "Draft" },
  PENDING_APPROVAL: { color: "bg-yellow-100 text-yellow-800", label: "Pending Approval" },
  APPROVED: { color: "bg-green-100 text-green-800", label: "Approved" },
  REJECTED: { color: "bg-red-100 text-red-800", label: "Rejected" },
  SUSPENDED: { color: "bg-amber-100 text-amber-800", label: "Suspended" },
  EXPIRED: { color: "bg-gray-100 text-gray-500", label: "Expired" },
  CANCELLED: { color: "bg-gray-100 text-gray-500", label: "Cancelled" },
};

const getStatusBadge = (status: string) => {
  const config = STATUS_CONFIG[status] || { color: "bg-gray-100 text-gray-800", label: status };
  return <Badge className={config.color}>{config.label}</Badge>;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const amountLabel = (ea: EmployeeAllowanceType) => {
  switch (ea.calculation_method) {
    case "FIXED_AMOUNT": {
      const amount = ea.amount ?? ea.type_default_amount;
      return amount ? `${Number(amount).toLocaleString()} KES` : "—";
    }
    case "PERCENTAGE_OF_BASIC": {
      const pct = ea.percentage ?? ea.type_default_percentage;
      return pct ? `${Number(pct)}% of basic salary` : "—";
    }
    case "PERCENTAGE_OF_GROSS": {
      const pct = ea.percentage ?? ea.type_default_percentage;
      return pct ? `${Number(pct)}% of gross pay` : "—";
    }
    default:
      return "—";
  }
};

const isOverride = (ea: EmployeeAllowanceType) => ea.amount !== null || ea.percentage !== null;

export function EmployeeAllowanceViewDrawer({
  open,
  onOpenChange,
  employeeAllowance,
}: EmployeeAllowanceViewDrawerProps) {
  if (!employeeAllowance) return null;

  // History entries built from the fields already present on the row — no
  // separate audit-log endpoint exists for employee_allowance yet.
  const historyEntries = [
    employeeAllowance.requested_at && {
      label: "Requested",
      at: employeeAllowance.requested_at,
    },
    employeeAllowance.approved_at && {
      label: "Approved",
      at: employeeAllowance.approved_at,
    },
    employeeAllowance.rejected_at && {
      label: "Rejected",
      at: employeeAllowance.rejected_at,
    },
  ].filter(Boolean) as { label: string; at: string }[];

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DrawerHeader className="border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                {employeeAllowance.allowance_name}
              </DrawerTitle>
              <DrawerDescription>
                {employeeAllowance.employee_name || `Employee #${employeeAllowance.employee_id}`}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Grant Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(employeeAllowance.status)}</div>
              </div>
              <div>
                <span className="text-gray-600">Category</span>
                <p className="font-medium capitalize">{employeeAllowance.category}</p>
              </div>
              <div>
                <span className="text-gray-600">Amount</span>
                <p className="font-medium">
                  {amountLabel(employeeAllowance)}
                  {!isOverride(employeeAllowance) && (
                    <span className="text-xs text-gray-500"> (org default)</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Tax Treatment</span>
                <p className="font-medium">
                  {!employeeAllowance.taxable_income
                    ? "Exempt"
                    : employeeAllowance.taxable_limit
                      ? `Exempt up to ${Number(employeeAllowance.taxable_limit).toLocaleString()}`
                      : "Fully taxable"}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Start Date</span>
                <p className="font-medium">{formatDate(employeeAllowance.start_date)}</p>
              </div>
              <div>
                <span className="text-gray-600">End Date</span>
                <p className="font-medium">{formatDate(employeeAllowance.end_date)}</p>
              </div>
            </div>
          </div>

          {employeeAllowance.eligibility_reason && (
            <div>
              <h3 className="font-semibold mb-2">Eligibility Reason</h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {employeeAllowance.eligibility_reason}
              </p>
            </div>
          )}

          {employeeAllowance.rejection_reason && (
            <div>
              <h3 className="font-semibold mb-2 text-red-700">Rejection Reason</h3>
              <p className="text-sm text-red-700 bg-red-50 p-3 rounded-md">
                {employeeAllowance.rejection_reason}
              </p>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-3 flex items-center">
              <History className="h-4 w-4 mr-2" />
              Activity
            </h3>
            <div className="space-y-2">
              {historyEntries.map((entry) => (
                <div key={entry.label} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                  <p className="font-medium">{entry.label}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(entry.at)}</p>
                </div>
              ))}
              {historyEntries.length === 0 && (
                <p className="text-sm text-gray-500">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <DrawerClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}