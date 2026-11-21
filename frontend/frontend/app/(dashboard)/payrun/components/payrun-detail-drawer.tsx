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
import { PayrunDetailType } from "@/services/api/payrun-detail";
import { User, DollarSign, Receipt, Briefcase, Wallet } from "lucide-react";
import { formatCurrency } from "@/utils/currency";

interface PayrunDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PayrunDetailType | null;
  loading?: boolean;
}

export function PayrunDetailDrawer({
  open,
  onOpenChange,
  detail,
  loading = false,
}: PayrunDetailDrawerProps) {

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        data-vaul-no-drag
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DrawerHeader className="select-text border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                {loading ? "Loading..." : (detail?.employee_full_name ?? "—")}
              </DrawerTitle>
              <DrawerDescription>
                {loading ? "" : (detail?.job_title ?? "Employee Pay Detail")}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="select-text flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-gray-400 text-sm">Loading detail...</div>
            </div>
          )}

          {!loading && detail && (
            <>
              {/* Employee Information */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Employee Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Full Name</span>
                    <p className="font-medium">{detail.employee_full_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Employee Number</span>
                    <p className="font-medium">{detail.employee_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Job Title</span>
                    <p className="font-medium">{detail.job_title || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Department</span>
                    <p className="font-medium">{detail.department || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Email</span>
                    <p className="font-medium">{detail.employee_email || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Earnings */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Earnings
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Basic Salary</span>
                    <p className="font-medium">{formatCurrency(detail.basic_salary)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Overtime</span>
                    <p className="font-medium">{formatCurrency(detail.overtime_amount)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Bonus</span>
                    <p className="font-medium">{formatCurrency(detail.bonus_amount)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Commission</span>
                    <p className="font-medium">{formatCurrency(detail.commission_amount)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Taxable Reimbursement</span>
                    <p className="font-medium">{formatCurrency(detail.taxable_reimbursement)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Non-taxable Reimbursement</span>
                    <p className="font-medium">{formatCurrency(detail.nontaxable_reimbursement)}</p>
                  </div>
                  {Number(detail.advance_payout ?? 0) > 0 && (
                    <div>
                      <span className="text-gray-600">Salary Advance Payout</span>
                      <p className="font-medium">{formatCurrency(detail.advance_payout)}</p>
                    </div>
                  )}
                  <div className="col-span-2 pt-2 border-t flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Gross Pay</span>
                    <p className="font-semibold text-base">{formatCurrency(detail.gross_pay)}</p>
                  </div>
                </div>
              </div>

              {/* Statutory Deductions */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center">
                  <Receipt className="h-4 w-4 mr-2" />
                  Statutory Deductions
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">NSSF</span>
                    <p className="font-medium text-red-600">{formatCurrency(detail.nssf)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">SHIF</span>
                    <p className="font-medium text-red-600">{formatCurrency(detail.shif)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Housing Levy</span>
                    <p className="font-medium text-red-600">{formatCurrency(detail.housing_levy)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Taxable Income</span>
                    <p className="font-medium">{formatCurrency(detail.taxable_income)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Tax Before Relief</span>
                    <p className="font-medium">{formatCurrency(detail.tax_before_relief)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Personal Relief</span>
                    <p className="font-medium text-green-600">
                      − {formatCurrency(detail.personal_relief)}
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t flex items-center justify-between">
                    <span className="text-gray-600">PAYE</span>
                    <p className="font-medium text-red-600">{formatCurrency(detail.paye)}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Total Deductions</span>
                    <p className="font-semibold text-base text-red-600">
                      {formatCurrency(detail.total_deductions)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Salary Advances: payout paid in this payrun + recovery instalments */}
              {detail.advances &&
                (detail.advances.payouts.length > 0 || detail.advances.recoveries.length > 0) && (
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center">
                      <Wallet className="h-4 w-4 mr-2" />
                      Salary Advances
                    </h3>
                    <div className="space-y-2 text-sm">
                      {detail.advances.payouts.map((p) => (
                        <div key={`payout-${p.id}`} className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="font-medium font-mono">{p.advance_number}</p>
                            <p className="text-xs text-gray-500">Paid out in this payrun</p>
                          </div>
                          <p className="font-medium text-green-600">+ {formatCurrency(p.amount)}</p>
                        </div>
                      ))}
                      {detail.advances.recoveries.map((r) => (
                        <div key={`rec-${r.line_id}`} className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="font-medium font-mono">{r.advance_number}</p>
                            <p className="text-xs text-gray-500">
                              {r.line_status === "processed" && r.repayment_status === "applied"
                                ? `Repaid · balance ${formatCurrency(r.balance_after ?? 0)}`
                                : r.line_status === "processed"
                                  ? "Deduction included — advance balance updates when the payrun is finalized"
                                  : r.line_status === "failed"
                                    ? "Repayment skipped"
                                    : "Repayment scheduled — deducted when the payrun is processed"}
                            </p>
                          </div>
                          <p className="font-medium text-red-600">
                            − {formatCurrency(r.line_status === "processed" ? (r.recovered_amount ?? 0) : r.scheduled_amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Net Pay */}
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Net Pay</span>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(detail.net_pay)}
                </p>
              </div>
            </>
          )}
        </div>

        <DrawerFooter className="select-text border-t p-6">
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