"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Filter,
  Search,
  Plus,
  Check,
  Eye,
  DollarSign,
} from "lucide-react";
import { payrollAPI, PayrollType, PayrollFilters } from "@/services/api/payroll";
import { Button } from "@/components/ui/button";
import { PayrollActionDialog } from "@/app/payroll/components/payroll-action-dialog";
import { PayrollViewDrawer } from "@/app/payroll/components/payroll-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { employeeAPI } from "@/services/api/employee";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PayrollTable: React.FC = () => {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<PayrollType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollType | null>(null);
  const [actionType, setActionType] = useState<"approve" | "pay">("approve");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewPayroll, setViewPayroll] = useState<PayrollType | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<PayrollFilters>({
    page: 1,
    per_page: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Generate Payroll Dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: 0,
    pay_period_month: new Date().getMonth() + 1,
    pay_period_year: new Date().getFullYear(),
    basic_salary: 0,
    overtime_amount: 0,
    bonus_amount: 0,
    commission_amount: 0,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchPayrolls = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const filtersToSend: PayrollFilters = {
        ...filters,
        name: searchTerm || undefined,
        status: selectedStatus || undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      };

      const response = await payrollAPI.getPayrolls(
        user.organization_id,
        filtersToSend
      );

      if (response.success && response.data) {
        setPayrolls(Array.isArray(response.data) ? response.data : []);
        if (response.metadata?.pagination) {
          setTotalItems(response.metadata.pagination.total);
          setTotalPages(response.metadata.pagination.total_pages);
        }
      } else {
        setError(response.error || "Failed to fetch payrolls");
        setPayrolls([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, filters, searchTerm, selectedStatus, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchPayrolls();
  }, [fetchPayrolls]);

  // Fetch employees for generate payroll form
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!user?.organization_id || !generateDialogOpen) return;

      try {
        setLoadingEmployees(true);
        const response = await employeeAPI.getEmployees(user.organization_id);
        if (response.success && response.data) {
          setEmployees(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [user?.organization_id, generateDialogOpen]);

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleLimitChange = (limit: number) => {
    setFilters((prev) => ({ ...prev, per_page: limit, page: 1 }));
  };

  const handleViewClick = (payroll: PayrollType) => {
    setViewPayroll(payroll);
    setDrawerOpen(true);
  };

  const handleActionClick = (payroll: PayrollType, action: "approve" | "pay") => {
    setSelectedPayroll(payroll);
    setActionType(action);
    setDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedPayroll || !user?.organization_id) return;

    try {
      setActionLoading(true);
      let response;

      if (actionType === "approve") {
        response = await payrollAPI.approvePayroll(
          user.organization_id,
          selectedPayroll.payroll_id
        );
      } else {
        response = await payrollAPI.markPayrollAsPaid(
          user.organization_id,
          selectedPayroll.payroll_id
        );
      }

      if (response.success) {
        toast.success(
          `Payroll ${actionType === "approve" ? "approved" : "marked as paid"} successfully`
        );
        setDialogOpen(false);
        setSelectedPayroll(null);
        fetchPayrolls();
      } else {
        toast.error(response.error || `Failed to ${actionType} payroll`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to ${actionType} payroll`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    if (!user?.organization_id) return;

    // Validate form
    const errors: Record<string, string> = {};
    if (!formData.employee_id) {
      errors.employee_id = "Employee is required";
    }
    if (!formData.pay_period_month || formData.pay_period_month < 1 || formData.pay_period_month > 12) {
      errors.pay_period_month = "Valid month is required";
    }
    if (!formData.pay_period_year || formData.pay_period_year < 2000) {
      errors.pay_period_year = "Valid year is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setGenerateLoading(true);
      setFormErrors({});

      const response = await payrollAPI.generatePayroll(
        user.organization_id,
        {
          employee_id: formData.employee_id,
          pay_period_month: formData.pay_period_month,
          pay_period_year: formData.pay_period_year,
          basic_salary: formData.basic_salary || undefined,
          overtime_amount: formData.overtime_amount || undefined,
          bonus_amount: formData.bonus_amount || undefined,
          commission_amount: formData.commission_amount || undefined,
        }
      );

      if (response.success) {
        toast.success("Payroll generated successfully");
        setGenerateDialogOpen(false);
        setFormData({
          employee_id: 0,
          pay_period_month: new Date().getMonth() + 1,
          pay_period_year: new Date().getFullYear(),
          basic_salary: 0,
          overtime_amount: 0,
          bonus_amount: 0,
          commission_amount: 0,
        });
        fetchPayrolls();
      } else {
        toast.error(response.error || "Failed to generate payroll");
        if (response.errors) {
          setFormErrors(response.errors);
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate payroll"
      );
    } finally {
      setGenerateLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("");
    setSelectedMonth("");
    setSelectedYear("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters =
    searchTerm || selectedStatus || selectedMonth || selectedYear;

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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800",
      },
      approved: {
        label: "Approved",
        className: "bg-blue-100 text-blue-800",
      },
      paid: {
        label: "Paid",
        className: "bg-green-100 text-green-800",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  const getEmployeeFullName = (employee: any) => {
    return `${employee.first_name || ""} ${employee.middle_name || ""} ${employee.surname || ""}`.trim();
  };

  const columns: ColumnDef<PayrollType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (payroll) =>
        payroll.employee_full_name ||
        `${payroll.employee_first_name} ${payroll.employee_surname}`,
    },
    {
      key: "period",
      header: "Period",
      cell: (payroll) =>
        formatPeriod(payroll.pay_period_month, payroll.pay_period_year),
    },
    {
      key: "gross_pay",
      header: "Gross Pay",
      cell: (payroll) => formatCurrency(payroll.gross_pay),
    },
    {
      key: "deductions",
      header: "Deductions",
      cell: (payroll) => formatCurrency(payroll.total_deductions),
    },
    {
      key: "net_pay",
      header: "Net Pay",
      cell: (payroll) => (
        <span className="font-semibold">{formatCurrency(payroll.net_pay)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (payroll) => getStatusBadge(payroll.status),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (payroll) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(payroll)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {payroll.status === "pending" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleActionClick(payroll, "approve")}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          {payroll.status === "approved" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleActionClick(payroll, "pay")}
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <DollarSign className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Payrolls</h1>
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
              <Button
                onClick={() => setGenerateDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Generate Payroll
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Month
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      return (
                        <option key={month} value={month.toString()}>
                          {new Date(2000, i).toLocaleString("default", {
                            month: "long",
                          })}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 2025"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
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
            data={payrolls}
            columns={columns}
            pagination={{
              page: filters.page || 1,
              limit: filters.per_page || 10,
              totalItems,
              totalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            error={error}
            emptyMessage={
              hasActiveFilters
                ? "No payrolls match your filters"
                : "No payrolls found"
            }
          />
        </div>
      </div>

      <PayrollActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={actionType}
        payrollPeriod={
          selectedPayroll
            ? formatPeriod(
                selectedPayroll.pay_period_month,
                selectedPayroll.pay_period_year
              )
            : ""
        }
        employeeName={selectedPayroll ? selectedPayroll.employee_full_name : ""}
        netPay={selectedPayroll ? selectedPayroll.net_pay : 0}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />

      <PayrollActionDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        action="generate"
        onConfirm={handleGeneratePayroll}
        loading={generateLoading}
      >
        <div className="space-y-4">
          {/* Employee */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Employee <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.employee_id.toString()}
              onValueChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  employee_id: Number(value),
                }));
                setFormErrors((prev) => ({ ...prev, employee_id: "" }));
              }}
              disabled={generateLoading || loadingEmployees}
            >
              <SelectTrigger
                className={
                  formErrors.employee_id ? "border-red-500" : ""
                }
              >
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Employees</SelectLabel>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {getEmployeeFullName(emp)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {formErrors.employee_id && (
              <p className="text-xs text-red-500">{formErrors.employee_id}</p>
            )}
          </div>

          {/* Month */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Month <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.pay_period_month}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  pay_period_month: Number(e.target.value),
                }));
                setFormErrors((prev) => ({ ...prev, pay_period_month: "" }));
              }}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.pay_period_month ? "border-red-500" : "border-gray-300"
              }`}
              disabled={generateLoading}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                return (
                  <option key={month} value={month}>
                    {new Date(2000, i).toLocaleString("default", {
                      month: "long",
                    })}
                  </option>
                );
              })}
            </select>
            {formErrors.pay_period_month && (
              <p className="text-xs text-red-500">{formErrors.pay_period_month}</p>
            )}
          </div>

          {/* Year */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.pay_period_year}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  pay_period_year: Number(e.target.value),
                }));
                setFormErrors((prev) => ({ ...prev, pay_period_year: "" }));
              }}
              placeholder="e.g., 2025"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.pay_period_year ? "border-red-500" : "border-gray-300"
              }`}
              disabled={generateLoading}
            />
            {formErrors.pay_period_year && (
              <p className="text-xs text-red-500">{formErrors.pay_period_year}</p>
            )}
          </div>

          {/* Optional: Basic Salary Override */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Basic Salary (Optional - uses employee default if not provided)
            </label>
            <input
              type="number"
              value={formData.basic_salary || ""}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  basic_salary: Number(e.target.value) || 0,
                }));
              }}
              placeholder="Leave empty to use employee default"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={generateLoading}
            />
          </div>
        </div>
      </PayrollActionDialog>

      <PayrollViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        payroll={viewPayroll}
      />
    </>
  );
};

export default PayrollTable;

