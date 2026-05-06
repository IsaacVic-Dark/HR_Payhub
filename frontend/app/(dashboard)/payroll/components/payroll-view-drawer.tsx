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
import { PayrollType } from "@/services/api/payroll";
import { DollarSign, User, Calendar, FileText, TrendingUp, TrendingDown } from "lucide-react";

interface PayrollViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payroll: PayrollType | null;
}

export function PayrollViewDrawer({
  open,
  onOpenChange,
  payroll,
}: PayrollViewDrawerProps) {
  if (!payroll) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPeriod = (month: number, year: number) => {
    const monthName = new Date(year, month - 1).toLocaleString("default", {
      month: "long",
    });
    return `${monthName} ${year}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      approved: { color: "bg-blue-100 text-blue-800", label: "Approved" },
      paid: { color: "bg-green-100 text-green-800", label: "Paid" },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DrawerHeader className="border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                Payroll Details
              </DrawerTitle>
              <DrawerDescription>
                {payroll.employee_full_name || `${payroll.employee_first_name} ${payroll.employee_surname}`}
              </DrawerDescription>
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
                <p className="font-medium">
                  {payroll.employee_full_name ||
                    `${payroll.employee_first_name} ${payroll.employee_middle_name || ""} ${payroll.employee_surname}`.trim()}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Email</span>
                <p className="font-medium">{payroll.employee_email || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600">Employee ID</span>
                <p className="font-medium">{payroll.employee_id}</p>
              </div>
            </div>
          </div>

          {/* Pay Period */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Pay Period
            </h3>
            <div className="text-sm">
              <span className="text-gray-600">Period</span>
              <p className="font-medium text-lg">
                {formatPeriod(payroll.pay_period_month, payroll.pay_period_year)}
              </p>
            </div>
          </div>

          {/* Earnings */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Earnings
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Basic Salary</span>
                <p className="font-medium">{formatCurrency(payroll.basic_salary)}</p>
              </div>
              <div>
                <span className="text-gray-600">Overtime</span>
                <p className="font-medium">{formatCurrency(payroll.overtime_amount)}</p>
              </div>
              <div>
                <span className="text-gray-600">Bonus</span>
                <p className="font-medium">{formatCurrency(payroll.bonus_amount)}</p>
              </div>
              <div>
                <span className="text-gray-600">Commission</span>
                <p className="font-medium">{formatCurrency(payroll.commission_amount)}</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-gray-600 font-semibold">Gross Pay</span>
                <p className="font-bold text-lg text-green-600">
                  {formatCurrency(payroll.gross_pay)}
                </p>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <TrendingDown className="h-4 w-4 mr-2" />
              Deductions
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">NSSF</span>
                <p className="font-medium">{formatCurrency(payroll.nssf)}</p>
              </div>
              <div>
                <span className="text-gray-600">SHIF</span>
                <p className="font-medium">{formatCurrency(payroll.shif)}</p>
              </div>
              <div>
                <span className="text-gray-600">Housing Levy</span>
                <p className="font-medium">{formatCurrency(payroll.housing_levy)}</p>
              </div>
              <div>
                <span className="text-gray-600">PAYE</span>
                <p className="font-medium">{formatCurrency(payroll.paye)}</p>
              </div>
              <div>
                <span className="text-gray-600">Taxable Income</span>
                <p className="font-medium">{formatCurrency(payroll.taxable_income)}</p>
              </div>
              <div>
                <span className="text-gray-600">Tax Before Relief</span>
                <p className="font-medium">{formatCurrency(payroll.tax_before_relief)}</p>
              </div>
              <div>
                <span className="text-gray-600">Personal Relief</span>
                <p className="font-medium">{formatCurrency(payroll.personal_relief)}</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-gray-600 font-semibold">Total Deductions</span>
                <p className="font-bold text-lg text-red-600">
                  {formatCurrency(payroll.total_deductions)}
                </p>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-700">Net Pay</span>
              <p className="font-bold text-2xl text-green-600">
                {formatCurrency(payroll.net_pay)}
              </p>
            </div>
          </div>

          {/* Status & Approval Info */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Status & Approval
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(payroll.status)}</div>
              </div>
              {payroll.approver_full_name && (
                <>
                  <div>
                    <span className="text-gray-600">Approved By</span>
                    <p className="font-medium">{payroll.approver_full_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Approved At</span>
                    <p className="font-medium">{formatDate(payroll.approved_at)}</p>
                  </div>
                </>
              )}
              {payroll.paid_by_full_name && (
                <>
                  <div>
                    <span className="text-gray-600">Paid By</span>
                    <p className="font-medium">{payroll.paid_by_full_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Paid At</span>
                    <p className="font-medium">{formatDate(payroll.paid_at)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-600">Created At</span>
              <p className="font-medium">
                {new Date(payroll.created_at).toLocaleString("en-US", {
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
                {new Date(payroll.updated_at).toLocaleString("en-US", {
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

