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
import { PayslipType } from "@/services/api/payslip";
import { Receipt, User, CreditCard, TrendingDown } from "lucide-react";

interface PayslipViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payslip: PayslipType | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export function PayslipViewDrawer({
  open,
  onOpenChange,
  payslip,
}: PayslipViewDrawerProps) {
  if (!payslip) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      generated: { color: "bg-blue-100 text-blue-800", label: "Generated" },
      sent: { color: "bg-yellow-100 text-yellow-800", label: "Sent" },
      acknowledged: { color: "bg-green-100 text-green-800", label: "Acknowledged" },
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
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                Payslip Details
              </DrawerTitle>
              <DrawerDescription>{payslip.payslip_number}</DrawerDescription>
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
                <p className="font-medium">{payslip.employee.full_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Email</span>
                <p className="font-medium">{payslip.employee.email || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600">Employee Number</span>
                <p className="font-medium">{payslip.employee.employee_number}</p>
              </div>
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(payslip.status)}</div>
              </div>
            </div>
          </div>

          {/* Payrun Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Receipt className="h-4 w-4 mr-2" />
              Payrun Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Payrun Name</span>
                <p className="font-medium">{payslip.payrun.payrun_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Pay Frequency</span>
                <p className="font-medium capitalize">{payslip.payrun.pay_frequency}</p>
              </div>
              <div>
                <span className="text-gray-600">Period Start</span>
                <p className="font-medium">{formatDate(payslip.payrun.pay_period_start)}</p>
              </div>
              <div>
                <span className="text-gray-600">Period End</span>
                <p className="font-medium">{formatDate(payslip.payrun.pay_period_end)}</p>
              </div>
              <div>
                <span className="text-gray-600">Generated At</span>
                <p className="font-medium">{formatDate(payslip.generated_at)}</p>
              </div>
              <div>
                <span className="text-gray-600">Sent At</span>
                <p className="font-medium">{formatDate(payslip.sent_at)}</p>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Earnings
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Basic Salary", value: payslip.earnings.basic_salary },
                { label: "Overtime", value: payslip.earnings.overtime_amount },
                { label: "Bonus", value: payslip.earnings.bonus_amount },
                { label: "Commission", value: payslip.earnings.commission_amount },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{formatCurrency(value)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Gross Pay</span>
                <span className="text-green-700">{formatCurrency(payslip.earnings.gross_pay)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <TrendingDown className="h-4 w-4 mr-2" />
              Deductions
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "NSSF", value: payslip.deductions.nssf },
                { label: "SHIF", value: payslip.deductions.shif },
                { label: "Housing Levy", value: payslip.deductions.housing_levy },
                { label: "Taxable Income", value: payslip.deductions.taxable_income },
                { label: "Tax Before Relief", value: payslip.deductions.tax_before_relief },
                { label: "Personal Relief", value: payslip.deductions.personal_relief },
                { label: "PAYE", value: payslip.deductions.paye },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{formatCurrency(value)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total Deductions</span>
                <span className="text-red-600">{formatCurrency(payslip.deductions.total_deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
            <span className="font-semibold text-base">Net Pay</span>
            <span className="text-xl font-bold text-blue-700">
              {formatCurrency(payslip.net_pay)}
            </span>
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