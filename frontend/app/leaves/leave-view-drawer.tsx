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
import { LeaveType } from "@/services/api/leave";
import { Calendar, Mail, User, FileText, Clock } from "lucide-react";

interface LeaveViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leave: LeaveType | null;
}

export function LeaveViewDrawer({
  open,
  onOpenChange,
  leave,
}: LeaveViewDrawerProps) {
  if (!leave) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      approved: { color: "bg-green-100 text-green-800", label: "Approved" },
      rejected: { color: "bg-red-100 text-red-800", label: "Rejected" },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full min-w-xl ml-auto bg-white">
        <DrawerHeader className="border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                Leave Request Details
              </DrawerTitle>
              <DrawerDescription>
                {leave.first_name} {leave.surname}
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
                  {leave.first_name} {leave.surname}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Email</span>
                <p className="font-medium">{leave.employee_email || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600">Employee ID</span>
                <p className="font-medium">{leave.employee_id}</p>
              </div>
            </div>
          </div>

          {/* Leave Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Leave Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Leave Type</span>
                <p className="font-medium capitalize">{leave.leave_type}</p>
              </div>
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(leave.status)}</div>
              </div>
              <div>
                <span className="text-gray-600">Start Date</span>
                <p className="font-medium">{formatDate(leave.start_date)}</p>
              </div>
              <div>
                <span className="text-gray-600">End Date</span>
                <p className="font-medium">{formatDate(leave.end_date)}</p>
              </div>
              <div>
                <span className="text-gray-600">Duration</span>
                <p className="font-medium">
                  {calculateDuration(leave.start_date, leave.end_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          {leave.reason && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Reason
              </h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {leave.reason}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-600">Created At</span>
              <p className="font-medium">
                {new Date(leave.created_at).toLocaleString("en-US", {
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
                {new Date(leave.updated_at).toLocaleString("en-US", {
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
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}