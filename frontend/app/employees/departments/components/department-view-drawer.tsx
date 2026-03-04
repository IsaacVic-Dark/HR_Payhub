"use client";

import { useState } from "react";
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
import { DepartmentType } from "@/services/api/department";
import { Building2, User, Users, UserCog } from "lucide-react";
import { AssignHeadDialog } from "@/app/employees/departments/components/assign-head-dialog";
import { useAuth } from "@/lib/AuthContext";

interface DepartmentViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentType | null;
  onViewDetails?: (department: DepartmentType) => void;
  onDepartmentUpdated?: () => void;
}

export function DepartmentViewDrawer({
  open,
  onOpenChange,
  department,
  onViewDetails,
  onDepartmentUpdated,
}: DepartmentViewDrawerProps) {
  const { user } = useAuth();
  const [assignHeadOpen, setAssignHeadOpen] = useState(false);

  if (!department) return null;

  const canWrite =
    user?.user_type === "admin" || user?.user_type === "hr_manager";

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (isActive: number) =>
    isActive === 1 ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
    );

  const handleAssignHeadSuccess = () => {
    setAssignHeadOpen(false);
    onDepartmentUpdated?.();
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="right">
        <DrawerContent
          className="h-full min-w-xl ml-auto bg-white"
          onInteractOutside={() => onOpenChange(false)}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <DrawerHeader className="border-b">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DrawerTitle className="text-xl font-semibold">
                  {department.name}
                </DrawerTitle>
                <DrawerDescription>
                  Department Details and Information
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Department Information */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center text-sm">
                <Building2 className="h-4 w-4 mr-2" />
                Department Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Department Name</span>
                  <p className="font-medium mt-0.5">{department.name}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Status</span>
                  <div className="mt-1">{getStatusBadge(department.is_active)}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Department Code</span>
                  <p className="font-medium mt-0.5">{department.code || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Active Employees</span>
                  <p className="font-medium mt-0.5">{department.employee_count}</p>
                </div>
                {department.description && (
                  <div className="col-span-2">
                    <span className="text-gray-500 text-xs">Description</span>
                    <p className="font-medium mt-0.5">{department.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Department Head */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center text-sm">
                  <User className="h-4 w-4 mr-2" />
                  Department Head
                </h3>
                {canWrite && (
                  <button
                    onClick={() => setAssignHeadOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <UserCog className="h-3.5 w-3.5" />
                    {department.head_employee_id ? "Change Head" : "Assign Head"}
                  </button>
                )}
              </div>

              {department.head_employee_id ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                    {department.head_first_name?.[0] ?? ""}
                    {department.head_surname?.[0] ?? ""}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {department.head_full_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {department.head_employee_number}
                    </p>
                    <p className="text-xs text-gray-500">{department.head_email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-400 italic">
                    No department head assigned
                  </p>
                </div>
              )}
            </div>

            {/* Workforce */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center text-sm">
                <Users className="h-4 w-4 mr-2" />
                Workforce
              </h3>
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-3xl font-bold text-blue-600">
                  {department.employee_count}
                </span>
                <span className="text-sm text-blue-700">active employees</span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
              <div>
                <span className="text-gray-500 text-xs">Created At</span>
                <p className="font-medium mt-0.5">
                  {formatDateTime(department.created_at)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Last Updated</span>
                <p className="font-medium mt-0.5">
                  {formatDateTime(department.updated_at)}
                </p>
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t p-6">
            <div className="flex gap-2">
              {onViewDetails && (
                <Button
                  onClick={() => {
                    onViewDetails(department);
                    onOpenChange(false);
                  }}
                  className="flex-1"
                >
                  View Department Details
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

      {/* AssignHeadDialog rendered outside the drawer so it layers correctly */}
      {user?.organization_id && (
        <AssignHeadDialog
          open={assignHeadOpen}
          onOpenChange={setAssignHeadOpen}
          organizationId={user.organization_id}
          departmentId={department.id}
          departmentName={department.name}
          currentHeadEmployeeId={department.head_employee_id}
          onSuccess={handleAssignHeadSuccess}
        />
      )}
    </>
  );
}