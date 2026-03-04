"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  departmentAPI,
  DepartmentType,
  DepartmentFilters,
} from "@/services/api/department";
import { DataTable, ColumnDef } from "@/components/table";
import { DepartmentViewDrawer } from "@/app/employees/departments/components/department-view-drawer";
import { DepartmentFormDialog } from "@/app/employees/departments/components/department-form-dialog";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Filter, Plus, UserCog } from "lucide-react";
import { toast } from "sonner";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [departments, setDepartments] = useState<DepartmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewDepartment, setViewDepartment] = useState<DepartmentType | null>(null);

  // Create / Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<DepartmentType | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [filters, setFilters] = useState<DepartmentFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Role helpers
  const canWrite =
    user?.user_type === "admin" || user?.user_type === "hr_manager";

  const fetchDepartments = useCallback(async () => {
    if (!user?.organization_id) return;

    setLoading(true);
    setError(null);

    const apiFilters: DepartmentFilters = {
      ...filters,
      search: searchInput || undefined,
      is_active:
        selectedStatus === "1"
          ? 1
          : selectedStatus === "0"
          ? 0
          : undefined,
    };

    const response = await departmentAPI.getDepartments(
      user.organization_id,
      apiFilters
    );

    if (response.success && response.data) {
      setDepartments(Array.isArray(response.data) ? response.data : []);
      const pagination = response.metadata?.pagination;
      setTotalItems(pagination?.total || 0);
      setTotalPages(pagination?.total_pages || 0);
    } else {
      setError(response.error || "Failed to fetch departments");
      setDepartments([]);
      setTotalItems(0);
      setTotalPages(0);
    }

    setLoading(false);
  }, [filters, searchInput, selectedStatus, user?.organization_id]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleViewClick = (dept: DepartmentType) => {
    setViewDepartment(dept);
    setDrawerOpen(true);
  };

  const handleEditClick = (dept: DepartmentType) => {
    setEditDepartment(dept);
    setFormOpen(true);
  };

  const handleCreateClick = () => {
    setEditDepartment(null);
    setFormOpen(true);
  };

  const handleViewDetails = (dept: DepartmentType) => {
    router.push(`/employees/departments/${dept.id}`);
  };

  const handleDeactivate = async (dept: DepartmentType) => {
    if (!user?.organization_id) return;
    if (
      !confirm(
        `Are you sure you want to deactivate "${dept.name}"? This cannot be done if the department has active employees.`
      )
    )
      return;

    setDeleteLoading(true);
    const response = await departmentAPI.deactivateDepartment(
      user.organization_id,
      dept.id
    );

    if (response.success) {
      toast.success("Department deactivated successfully");
      fetchDepartments();
    } else {
      toast.error(response.error || "Failed to deactivate department");
    }
    setDeleteLoading(false);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSelectedStatus("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters = searchInput || selectedStatus;

  const getStatusBadge = (isActive: number) =>
    isActive === 1 ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Inactive
      </span>
    );

  const columns: ColumnDef<DepartmentType>[] = [
    {
      key: "name",
      header: "Department Name",
      cell: (dept) => (
        <span className="font-medium text-gray-900">{dept.name}</span>
      ),
    },
    {
      key: "code",
      header: "Code",
      cell: (dept) => dept.code || "—",
    },
    {
      key: "head",
      header: "Department Head",
      cell: (dept) =>
        dept.head_full_name ? (
          <div>
            <p className="font-medium">{dept.head_full_name}</p>
            {dept.head_employee_number && (
              <p className="text-gray-500 text-xs">{dept.head_employee_number}</p>
            )}
          </div>
        ) : (
          <span className="text-gray-400 italic">Not assigned</span>
        ),
    },
    {
      key: "employee_count",
      header: "Employees",
      cell: (dept) => dept.employee_count,
    },
    {
      key: "is_active",
      header: "Status",
      cell: (dept) => getStatusBadge(dept.is_active),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (dept) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(dept)}
            className="h-8 w-8 p-0"
            title="Quick view"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewDetails(dept)}
            className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            View Details
          </Button>
          {canWrite && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEditClick(dept)}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {dept.is_active === 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeactivate(dept)}
                  disabled={deleteLoading}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Deactivate"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="mt-4 mx-6 space-y-2">
              <h1 className="text-2xl font-medium">Departments</h1>
              <p className="text-base text-muted-foreground">
                Manage your organisation's departments and team structure
              </p>
            </div>

            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="w-full mx-auto px-4">
                <div className="rounded-lg shadow-sm border p-4 bg-white">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      All Departments
                    </h2>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Filter className="w-4 h-4" />
                        Filters
                      </button>
                      {canWrite && (
                        <Button
                          onClick={handleCreateClick}
                          className="flex items-center gap-2 text-xs"
                          size="sm"
                        >
                          <Plus className="w-4 h-4" />
                          New Department
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Filter Panel */}
                  {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Search
                          </label>
                          <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by name or code…"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">All Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={clearFilters}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>
                  )}

                  <DataTable
                    data={departments}
                    columns={columns}
                    pagination={{
                      page: filters.page || 1,
                      limit: filters.per_page || 10,
                      totalItems,
                      totalPages,
                    }}
                    onPageChange={(page) =>
                      setFilters((prev) => ({ ...prev, page }))
                    }
                    onLimitChange={(per_page) =>
                      setFilters((prev) => ({ ...prev, per_page, page: 1 }))
                    }
                    loading={loading}
                    error={error}
                    emptyMessage={
                      hasActiveFilters
                        ? "No departments match your filters"
                        : "No departments found"
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Quick-view Drawer */}
      <DepartmentViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        department={viewDepartment}
        onViewDetails={handleViewDetails}
        onDepartmentUpdated={fetchDepartments}
      />

      {/* Create / Edit Dialog */}
      {user?.organization_id && (
        <DepartmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          organizationId={user.organization_id}
          department={editDepartment}
          onSuccess={fetchDepartments}
        />
      )}
    </SidebarProvider>
  );
}