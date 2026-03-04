"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  departmentAPI,
  DepartmentType,
  DepartmentEmployeeType,
  DepartmentEmployeeFilters,
} from "@/services/api/department";
import { DataTable, ColumnDef } from "@/components/table";
import { DepartmentFormDialog } from "@/app/employees/departments/components/department-form-dialog";
import { AssignHeadDialog } from "@/app/employees/departments/components/assign-head-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building2,
  Users,
  User,
  Pencil,
  UserCog,
} from "lucide-react";

export default function DepartmentDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const departmentId = Number(params?.id);

  const [department, setDepartment] = useState<DepartmentType | null>(null);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<DepartmentEmployeeType[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState<string | null>(null);
  const [empFilters, setEmpFilters] = useState<DepartmentEmployeeFilters>({
    page: 1,
    per_page: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [assignHeadOpen, setAssignHeadOpen] = useState(false);

  const canWrite =
    user?.user_type === "admin" || user?.user_type === "hr_manager";

  const fetchDepartment = useCallback(async () => {
    if (!user?.organization_id || !departmentId) return;
    setDeptLoading(true);
    setDeptError(null);
    const response = await departmentAPI.getDepartment(
      user.organization_id,
      departmentId
    );
    if (response.success && response.data) {
      setDepartment(response.data);
    } else {
      setDeptError(response.error || "Failed to fetch department");
    }
    setDeptLoading(false);
  }, [user?.organization_id, departmentId]);

  const fetchEmployees = useCallback(async () => {
    if (!user?.organization_id || !departmentId) return;
    setEmpLoading(true);
    setEmpError(null);
    const response = await departmentAPI.getDepartmentEmployees(
      user.organization_id,
      departmentId,
      empFilters
    );
    if (response.success && response.data) {
      setEmployees(Array.isArray(response.data) ? response.data : []);
      const pagination = response.metadata?.pagination;
      setTotalItems(pagination?.total || 0);
      setTotalPages(pagination?.total_pages || 0);
    } else {
      setEmpError(response.error || "Failed to fetch employees");
      setEmployees([]);
    }
    setEmpLoading(false);
  }, [user?.organization_id, departmentId, empFilters]);

  useEffect(() => { fetchDepartment(); }, [fetchDepartment]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const getStatusBadge = (isActive: number) =>
    isActive === 1 ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
    );

  const employeeColumns: ColumnDef<DepartmentEmployeeType>[] = [
    {
      key: "employee_number",
      header: "Emp #",
      cell: (emp) => (
        <span className="font-mono text-xs">{emp.employee_number}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      cell: (emp) => (
        <span className="font-medium">
          {emp.first_name} {emp.surname}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (emp) => emp.email,
    },
    {
      key: "job_title",
      header: "Job Title",
      cell: (emp) => emp.job_title || "—",
    },
    {
      key: "employment_type",
      header: "Type",
      cell: (emp) => (
        <span className="capitalize">{emp.employment_type || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (emp) => (
        <span className="capitalize px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {emp.status}
        </span>
      ),
    },
  ];

  const sidebarStyle = {
    "--sidebar-width": "calc(var(--spacing) * 72)",
    "--header-height": "calc(var(--spacing) * 12)",
  } as React.CSSProperties;

  if (deptLoading) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading department…</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (deptError || !department) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 font-medium">Failed to load department</p>
              <p className="text-gray-500 text-sm mt-1">{deptError}</p>
              <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                Go Back
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">

            {/* Page header */}
            <div className="mt-4 mx-6 space-y-2">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Departments
              </button>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-medium">{department.name}</h1>
                  <p className="text-base text-muted-foreground">
                    {department.description || "Department details and employee roster"}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignHeadOpen(true)}
                      className="flex items-center gap-2 text-xs"
                    >
                      <UserCog className="h-4 w-4" />
                      {department.head_employee_id ? "Change Head" : "Assign Head"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setFormOpen(true)}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Department
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 mx-6">
              {/* Info cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Department info */}
                <div className="bg-white border rounded-lg p-5 space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                    <Building2 className="h-4 w-4" />
                    Department Info
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Code</span>
                      <span className="font-medium">{department.code || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status</span>
                      {getStatusBadge(department.is_active)}
                    </div>
                  </div>
                </div>

                {/* Head card */}
                <div className="bg-white border rounded-lg p-5 space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                    <User className="h-4 w-4" />
                    Department Head
                  </div>
                  {department.head_employee_id ? (
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                        {department.head_first_name?.[0] ?? ""}
                        {department.head_surname?.[0] ?? ""}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{department.head_full_name}</p>
                        <p className="text-xs text-gray-500">{department.head_employee_number}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No head assigned</p>
                  )}
                </div>

                {/* Employee count */}
                <div className="bg-white border rounded-lg p-5 space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                    <Users className="h-4 w-4" />
                    Workforce
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {department.employee_count}
                  </div>
                  <p className="text-xs text-gray-500">Active employees</p>
                </div>
              </div>

              {/* Employees table */}
              <div className="bg-white border rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Employees in {department.name}
                </h2>
                <DataTable
                  data={employees}
                  columns={employeeColumns}
                  pagination={{
                    page: empFilters.page || 1,
                    limit: empFilters.per_page || 10,
                    totalItems,
                    totalPages,
                  }}
                  onPageChange={(page) =>
                    setEmpFilters((prev) => ({ ...prev, page }))
                  }
                  onLimitChange={(per_page) =>
                    setEmpFilters((prev) => ({ ...prev, per_page, page: 1 }))
                  }
                  loading={empLoading}
                  error={empError}
                  emptyMessage="No active employees in this department"
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Edit dialog */}
      {user?.organization_id && (
        <DepartmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          organizationId={user.organization_id}
          department={department}
          onSuccess={fetchDepartment}
        />
      )}

      {/* Assign Head dialog */}
      {user?.organization_id && (
        <AssignHeadDialog
          open={assignHeadOpen}
          onOpenChange={setAssignHeadOpen}
          organizationId={user.organization_id}
          departmentId={department.id}
          departmentName={department.name}
          currentHeadEmployeeId={department.head_employee_id}
          onSuccess={() => {
            setAssignHeadOpen(false);
            fetchDepartment();
          }}
        />
      )}
    </SidebarProvider>
  );
}