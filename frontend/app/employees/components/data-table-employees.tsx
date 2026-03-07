"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Search, Plus, Eye } from "lucide-react";
import { employeeAPI, EmployeeType } from "@/services/api/employee";
import { Button } from "@/components/ui/button";
import {
  EmployeeDrawer,
  EmployeeDrawerAdd,
  EmployeeDrawerEdit,
} from "@/app/employees/components/employee-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { formatCurrency } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DrawerEmployeeStatus =
  | "active"
  | "inactive"
  | "on_leave"
  | "terminated"
  | "resigned"
  | "suspended"
  | "probation";

interface Statistics {
  total: number;
  by_department: Record<string, number>;
  by_job_title: Record<string, number>;
  salary_summary?: {
    average: number;
    min: string;
    max: string;
    total_monthly: number;
    total_yearly: number;
  };
}

interface DataTableEmployeesProps {
  statistics?: Statistics | null;
}

const DataTableEmployees: React.FC<DataTableEmployeesProps> = ({
  statistics: _statistics,
}) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeType | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchEmployees = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

const filters: {
  department?: string;
  status?: string;
  job_title?: string;
  sort_by: string;
  sort_order: "asc" | "desc";
} = {
  department: selectedDepartment || undefined,
  status: selectedStatus || undefined,
  job_title: selectedJobTitle || undefined,
  sort_by: "created_at",
  sort_order: "desc",
};

      const response = await employeeAPI.getEmployees(
        user.organization_id,
        filters,
      );

      if (response.success && response.data) {
        // The response.data is already the array of employees
        const employeesData = Array.isArray(response.data) ? response.data : [];

        // Filter by search term if provided
        const filteredEmployees = searchTerm
          ? employeesData.filter((emp: EmployeeType) =>
              `${emp.first_name} ${emp.surname}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase()),
            )
          : employeesData;

        setEmployees(filteredEmployees);
        setTotalItems(filteredEmployees.length);
        setTotalPages(Math.ceil(filteredEmployees.length / limit));

        if (filteredEmployees.length > 0) {
          toast.success(`Loaded ${filteredEmployees.length} employees`);
        } else {
          toast.info("No employees found");
        }
      } else {
        if (response.message?.includes("No employees found")) {
          setEmployees([]);
          setTotalItems(0);
          setTotalPages(0);
          setError(response.message);
        } else {
          setError(response.error || "Failed to fetch employees");
          setEmployees([]);
          setTotalItems(0);
          setTotalPages(0);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setEmployees([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [
    user?.organization_id,
    searchTerm,
    selectedDepartment,
    selectedStatus,
    selectedJobTitle,
    limit,
  ]);

  useEffect(() => {
    if (user?.organization_id) {
      fetchEmployees();
    }
  }, [fetchEmployees, user?.organization_id]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      active: {
        color: "bg-green-100 text-green-800",
        label: "Active",
      },
      inactive: {
        color: "bg-gray-100 text-gray-800",
        label: "Inactive",
      },
      on_leave: {
        color: "bg-blue-100 text-blue-800",
        label: "On Leave",
      },
      terminated: {
        color: "bg-red-100 text-red-800",
        label: "Terminated",
      },
      resigned: {
        color: "bg-orange-100 text-orange-800",
        label: "Resigned",
      },
      suspended: {
        color: "bg-yellow-100 text-yellow-800",
        label: "Suspended",
      },
      probation: {
        color: "bg-purple-100 text-purple-800",
        label: "Probation",
      },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const handleDeleteClick = (employee: EmployeeType) => {
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete || !user?.organization_id) return;

    setDeleteLoading(true);
    try {
      const response = await employeeAPI.deleteEmployee(
        user.organization_id,
        employeeToDelete.id,
      );

      if (response.success) {
        toast.success("Employee deleted successfully");
        setDeleteDialogOpen(false);
        setEmployeeToDelete(null);
        fetchEmployees();
      } else {
        toast.error(response.error || "Failed to delete employee");
      }
    } catch {
      toast.error("An error occurred while deleting employee");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDepartment("");
    setSelectedStatus("");
    setSelectedJobTitle("");
    setPage(1);
  };

  const hasActiveFilters =
    searchTerm || selectedDepartment || selectedStatus || selectedJobTitle;

  // Get unique values for filter dropdowns
  const departments = Array.from(
    new Set(employees.map((emp) => emp.department)),
  ).filter(Boolean);
  const jobTitles = Array.from(
    new Set(employees.map((emp) => emp.job_title)),
  ).filter(Boolean);
  const statuses = Array.from(
    new Set(employees.map((emp) => emp.status)),
  ).filter(Boolean);

  if (!user) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading user information...</div>
          </div>
        </div>
      </div>
    );
  }

  const columns: ColumnDef<EmployeeType>[] = [
    {
      key: "name",
      header: "Employee",
      cell: (employee) => (
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="font-medium text-gray-700">
              {employee.first_name[0]}
              {employee.surname[0]}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {employee.first_name} {employee.surname}
            </p>
            <p className="text-xs text-gray-500">{employee.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "job_title",
      header: "Position",
      cell: (employee) => (
        <span className="text-sm text-gray-700">{employee.job_title}</span>
      ),
    },
    {
      key: "department",
      header: "Department",
      cell: (employee) => (
        <span className="text-sm text-gray-700">{employee.department_id}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (employee) => getStatusBadge(employee.status),
    },
    {
      key: "salary",
      header: "Salary",
      cell: (employee) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(parseFloat(employee.base_salary))}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (employee) => (
        <div className="flex items-center gap-2">
          <EmployeeDrawer
            employee={{
              id: employee.id.toString(),
              name: `${employee.first_name} ${employee.surname}`,
              email: employee.email,
              p_email: employee.personal_email || "",
              personal_email: employee.personal_email || "",
              phone: employee.phone || "",
              position: employee.job_title,
              department: employee.department,
              status: employee.status as unknown as DrawerEmployeeStatus,
              salary: parseFloat(employee.base_salary),
              hire_date: employee.hire_date,
              bank_account_number: employee.bank_account_number || "",
              work_location: employee.work_location,
              employment_type: employee.employment_type,
              reports_to: employee.reports_to?.toString() || "",
              location: employee.work_location,
              img: (
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="font-medium text-gray-700">
                    {employee.first_name[0]}
                    {employee.surname[0]}
                  </span>
                </div>
              ),
            }}
          >
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Eye className="h-4 w-4" />
            </Button>
          </EmployeeDrawer>
          <EmployeeDrawerEdit
            employee={{
              id: employee.id.toString(),
              name: `${employee.first_name} ${employee.surname}`,
              email: employee.email,
              p_email: employee.personal_email || "",
              personal_email: employee.personal_email || "",
              phone: employee.phone || "",
              position: employee.job_title,
              department: employee.department,
              status: (employee.status as unknown) as DrawerEmployeeStatus,
              salary: parseFloat(employee.base_salary),
              hire_date: employee.hire_date,
              bank_account_number: employee.bank_account_number || "",
              work_location: employee.work_location,
              employment_type: employee.employment_type,
              reports_to: employee.reports_to?.toString() || "",
              location: employee.work_location,
              img: (
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="font-medium text-gray-700">
                    {employee.first_name[0]}
                    {employee.surname[0]}
                  </span>
                </div>
              ),
            }}
          >
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
              </svg>
            </Button>
          </EmployeeDrawerEdit>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteClick(employee)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="m10 11 6 6" />
              <path d="m16 11-6 6" />
            </svg>
          </Button>
        </div>
      ),
    },
  ];

  const paginatedEmployees = employees.slice((page - 1) * limit, page * limit);

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Employees</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by employee name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <EmployeeDrawerAdd
                employees={employees}
                onEmployeeAdded={fetchEmployees}
              >
                <Button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  Add Employee
                </Button>
              </EmployeeDrawerAdd>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Job Title
                  </label>
                  <select
                    value={selectedJobTitle}
                    onChange={(e) => setSelectedJobTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Job Titles</option>
                    {jobTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
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
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
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
            data={paginatedEmployees}
            columns={columns}
            pagination={{
              page,
              limit,
              totalItems,
              totalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            error={error}
            emptyMessage={
              hasActiveFilters
                ? "No employees match your filters"
                : "No employees found"
            }
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the employee{" "}
              <strong>
                {employeeToDelete?.first_name} {employeeToDelete?.surname}
              </strong>
              ?
              <br />
              <br />
              <strong className="text-red-600">
                This action cannot be undone.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? "Deleting..." : "Delete Employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export { DataTableEmployees };
// [file content end]
