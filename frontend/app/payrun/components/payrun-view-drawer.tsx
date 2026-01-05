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
import { PayrunType } from "@/services/api/payrun";
import { Calendar, User, DollarSign, Users, FileText, Clock, Trash2 } from "lucide-react";

interface PayrunViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrun: PayrunType | null;
  onViewDetails?: (payrun: PayrunType) => void;
}

export function PayrunViewDrawer({
  open,
  onOpenChange,
  payrun,
  onViewDetails,
}: PayrunViewDrawerProps) {
  if (!payrun) return null;

  const formatDate = (dateString: string) => {
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      draft: { color: "bg-yellow-100 text-yellow-800", label: "Draft" },
      reviewed: { color: "bg-blue-100 text-blue-800", label: "Reviewed" },
      finalized: { color: "bg-green-100 text-green-800", label: "Finalized" },
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
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                {payrun.payrun_name}
              </DrawerTitle>
              <DrawerDescription>
                Payrun Details and Information
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Payrun Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Payrun Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Payrun Name</span>
                <p className="font-medium">{payrun.payrun_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(payrun.status)}</div>
              </div>
              <div>
                <span className="text-gray-600">Pay Period Start</span>
                <p className="font-medium">{formatDate(payrun.pay_period_start)}</p>
              </div>
              <div>
                <span className="text-gray-600">Pay Period End</span>
                <p className="font-medium">{formatDate(payrun.pay_period_end)}</p>
              </div>
              <div>
                <span className="text-gray-600">Pay Frequency</span>
                <p className="font-medium capitalize">{payrun.pay_frequency}</p>
              </div>
              <div>
                <span className="text-gray-600">Employee Count</span>
                <p className="font-medium">{payrun.employee_count}</p>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Financial Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Gross Pay</span>
                <p className="font-medium">
                  Kshs {payrun.total_gross_pay.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Total Deductions</span>
                <p className="font-medium">
                  Kshs {payrun.total_deductions.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Total Net Pay</span>
                <p className="font-medium text-green-600">
                  Kshs {payrun.total_net_pay.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Created By
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Creator</span>
                <p className="font-medium">{payrun.creator_full_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Email</span>
                <p className="font-medium">{payrun.creator_email}</p>
              </div>
              {payrun.reviewer_full_name && (
                <>
                  <div>
                    <span className="text-gray-600">Reviewed By</span>
                    <p className="font-medium">{payrun.reviewer_full_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Reviewed At</span>
                    <p className="font-medium">{formatDateTime(payrun.reviewed_at)}</p>
                  </div>
                </>
              )}
              {payrun.finalizer_full_name && (
                <>
                  <div>
                    <span className="text-gray-600">Finalized By</span>
                    <p className="font-medium">{payrun.finalizer_full_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Finalized At</span>
                    <p className="font-medium">{formatDateTime(payrun.finalized_at)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Deletion Information */}
          {payrun.deleted_at && (
            <div>
              <h3 className="font-semibold mb-4 flex items-center text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Deletion Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Deleted At</span>
                  <p className="font-medium">{formatDateTime(payrun.deleted_at)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Deleted By</span>
                  <p className="font-medium">
                    {payrun.deleter_full_name || "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-600">Created At</span>
              <p className="font-medium">{formatDateTime(payrun.created_at)}</p>
            </div>
            <div>
              <span className="text-gray-600">Last Updated</span>
              <p className="font-medium">{formatDateTime(payrun.updated_at)}</p>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <div className="flex gap-2">
            {onViewDetails && (
              <Button
                onClick={() => {
                  onViewDetails(payrun);
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                View Payrun Details
              </Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

