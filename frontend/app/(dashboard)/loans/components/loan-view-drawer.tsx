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
import { LoanType } from "@/services/api/loan";
import { DollarSign, User, FileText, Calendar, Clock } from "lucide-react";

interface LoanViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanType | null;
}

export function LoanViewDrawer({
  open,
  onOpenChange,
  loan,
}: LoanViewDrawerProps) {
  if (!loan) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending:  { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      approved: { color: "bg-green-100 text-green-800",  label: "Approved" },
      rejected: { color: "bg-red-100 text-red-800",     label: "Rejected" },
      repaid:   { color: "bg-blue-100 text-blue-800",   label: "Repaid" },
    };
    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const repaymentPercent =
    loan.amount > 0
      ? Math.min(100, Math.round((loan.total_repaid / loan.amount) * 100))
      : 0;

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
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                Loan Request Details
              </DrawerTitle>
              <DrawerDescription>{loan.employee.full_name}</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Employee Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Employee Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Full Name</span>
                <p className="font-medium">{loan.employee.full_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Email</span>
                <p className="font-medium">{loan.employee.email || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600">Employee Number</span>
                <p className="font-medium">{loan.employee.employee_number}</p>
              </div>
              <div>
                <span className="text-gray-600">Employee ID</span>
                <p className="font-medium">{loan.employee.id}</p>
              </div>
            </div>
          </div>

          {/* Loan Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Loan Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Loan Type</span>
                <p className="font-medium">{loan.loan_type.name}</p>
              </div>
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(loan.status)}</div>
              </div>
              <div>
                <span className="text-gray-600">Loan Amount</span>
                <p className="font-medium">{formatCurrency(loan.amount)}</p>
              </div>
              <div>
                <span className="text-gray-600">Interest Rate</span>
                <p className="font-medium">
                  {loan.interest_rate !== null ? `${loan.interest_rate}%` : "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Monthly Deduction</span>
                <p className="font-medium">
                  {loan.monthly_deduction !== null
                    ? formatCurrency(loan.monthly_deduction)
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Balance Remaining</span>
                <p className="font-medium">
                  {formatCurrency(loan.balance_remaining)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Total Repaid</span>
                <p className="font-medium">{formatCurrency(loan.total_repaid)}</p>
              </div>
            </div>
          </div>

          {/* Repayment Progress */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Repayment Progress
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {formatCurrency(loan.total_repaid)} of{" "}
                  {formatCurrency(loan.amount)}
                </span>
                <span className="font-medium">{repaymentPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${repaymentPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Dates
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Start Date</span>
                <p className="font-medium">{formatDate(loan.start_date)}</p>
              </div>
              <div>
                <span className="text-gray-600">End Date</span>
                <p className="font-medium">{formatDate(loan.end_date)}</p>
              </div>
              <div>
                <span className="text-gray-600">Approved By</span>
                <p className="font-medium">{loan.approver?.full_name || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600">Approved At</span>
                <p className="font-medium">{formatDate(loan.approved_at)}</p>
              </div>
              {loan.rejecter && (
                <>
                  <div>
                    <span className="text-gray-600">Rejected By</span>
                    <p className="font-medium">{loan.rejecter.full_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Rejected At</span>
                    <p className="font-medium">{formatDate(loan.rejected_at)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rejection Reason */}
          {loan.rejection_reason && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Rejection Reason
              </h3>
              <p className="text-sm text-gray-700 bg-red-50 p-3 rounded-md border border-red-100">
                {loan.rejection_reason}
              </p>
            </div>
          )}

          {/* Purpose */}
          {loan.purpose && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Purpose
              </h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {loan.purpose}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-600">Created At</span>
              <p className="font-medium">
                {new Date(loan.created_at).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Last Updated</span>
              <p className="font-medium">
                {new Date(loan.updated_at).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
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