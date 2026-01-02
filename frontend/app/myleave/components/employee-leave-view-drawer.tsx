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
import { EmployeeLeaveType } from "@/services/api/leave";
import { Calendar, Mail, User, FileText, Clock } from "lucide-react";

interface EmployeeLeaveViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leave: EmployeeLeaveType | null;
}

export function EmployeeLeaveViewDrawer({
  open,
  onOpenChange,
  leave,
}: EmployeeLeaveViewDrawerProps) {
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
                Leave Request Details
              </DrawerTitle>
              <DrawerDescription>
                Your leave application #{leave.leave_id}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  {leave.duration_days} day{leave.duration_days !== 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Approver</span>
                <p className="font-medium">
                  {leave.approver_full_name || "Not assigned yet"}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Reliever</span>
                <p className="font-medium">
                  {leave.reliever_full_name || "Not assigned"}
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
              <span className="text-gray-600">Applied On</span>
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}