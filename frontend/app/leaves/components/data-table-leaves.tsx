"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Filter,
  Search,
  Plus,
  Check,
  X,
  Eye,
  ChevronDownIcon,
} from "lucide-react";
import { leaveAPI, LeaveType, LeaveFilters } from "@/services/api/leave";
import { Button } from "@/components/ui/button";
import { LeaveActionDialog } from "@/app/leaves/components/leave-action-dialog";
import { LeaveViewDrawer } from "@/app/leaves/components/leave-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { type DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { employeeAPI } from "@/services/api/employee";
import { useAuth } from "@/lib/AuthContext";

const LeaveTable: React.FC = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveType | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewLeave, setViewLeave] = useState<LeaveType | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<LeaveFilters>({
    page: 1,
    per_page: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Apply Leave Dialog state
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  // Apply Leave Form state
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: 0,
    reliever_id: null as number | null,
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateRangePopoverOpen, setDateRangePopoverOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchLeaves = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const apiFilters: LeaveFilters = {
        ...filters,
        name: searchTerm || undefined,
        leave_type: selectedLeaveType || undefined,
        status: selectedStatus || undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      };

      const response = await leaveAPI.getLeaves(
        user.organization_id,
        apiFilters
      );

      if (response.success && response.data) {
        const leavesData = response.data.leaves || [];
        const paginationData = response.data.pagination;

        setLeaves(leavesData);
        setTotalItems(paginationData?.total || 0);
        setTotalPages(paginationData?.total_pages || 0);
      } else {
        if (response.message?.includes("No leaves found")) {
          setLeaves([]);
          setTotalItems(0);
          setTotalPages(0);
          setError(response.message);
        } else {
          setError(response.error || "Failed to fetch leaves");
          setLeaves([]);
          setTotalItems(0);
          setTotalPages(0);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setLeaves([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [
    filters,
    searchTerm,
    selectedLeaveType,
    selectedStatus,
    selectedMonth,
    selectedYear,
    user?.organization_id,
  ]);

  useEffect(() => {
    if (user?.organization_id) {
      fetchLeaves();
    }
  }, [fetchLeaves, user?.organization_id]);

  // Fetch employees for reliever dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!applyDialogOpen || !user?.organization_id) return;

      setLoadingEmployees(true);
      try {
        const response = await employeeAPI.getEmployees(user.organization_id);

        if (response.success && response.data) {
          // The response.data is already the array of employees
          const employeesArray = Array.isArray(response.data)
            ? response.data
            : [];
          const filteredEmployees = employeesArray.filter(
            (emp: any) => emp.id !== user?.employee?.id
          );
          setEmployees(filteredEmployees);
        } else {
          setEmployees([]);
        }
      } catch (error) {
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [applyDialogOpen, user?.organization_id, user?.employee?.id]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!applyDialogOpen) {
      setFormData({
        employee_id: user?.employee?.id || 0,
        reliever_id: null,
        leave_type: "",
        start_date: "",
        end_date: "",
        reason: "",
      });
      setDateRange(undefined);
      setFormErrors({});
    } else {
      // Set employee_id when dialog opens
      setFormData((prev) => ({
        ...prev,
        employee_id: user?.employee?.id || 0,
      }));
    }
  }, [applyDialogOpen, user?.employee?.id]);

  const formatDateRange = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const startFormatted = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const endFormatted = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return `${startFormatted} — ${endFormatted}`;
    } catch (error) {
      return "Invalid date";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: {
        color: "bg-yellow-100 text-yellow-800",
        label: "Pending",
      },
      approved: {
        color: "bg-green-100 text-green-800",
        label: "Approved",
      },
      rejected: {
        color: "bg-red-100 text-red-800",
        label: "Rejected",
      },
      expired: {
        color: "bg-gray-100 text-gray-800",
        label: "Expired",
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

  const handleActionClick = (
    leave: LeaveType,
    action: "approve" | "reject"
  ) => {
    setSelectedLeave(leave);
    setActionType(action);
    setDialogOpen(true);
  };

  const handleViewClick = (leave: LeaveType) => {
    setViewLeave(leave);
    setDrawerOpen(true);
  };

  const handleConfirmAction = async (rejectionReason?: string) => {
    // ADD parameter
    if (!selectedLeave || !user?.organization_id) return;

    setActionLoading(true);
    try {
      let response;

      if (actionType === "approve") {
        response = await leaveAPI.approveLeave(
          user.organization_id,
          selectedLeave.leave_id
        );
      } else {
        response = await leaveAPI.rejectLeave(
          user.organization_id,
          selectedLeave.leave_id,
          rejectionReason
        );
      }

      if (response.success) {
        toast.success(
          `Leave ${
            actionType === "approve" ? "approved" : "rejected"
          } successfully`
        );
        setDialogOpen(false);
        fetchLeaves();
      } else {
        toast.error(response.error || `Failed to ${actionType} leave`);
      }
    } catch (err) {
      toast.error(
        `An error occurred while ${
          actionType === "approve" ? "approving" : "rejecting"
        } leave`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, per_page: newLimit, page: 1 }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedLeaveType("");
    setSelectedStatus("");
    setSelectedMonth("");
    setSelectedYear("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters =
    searchTerm ||
    selectedLeaveType ||
    selectedStatus ||
    selectedMonth ||
    selectedYear;

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from) {
      setFormData((prev) => ({
        ...prev,
        start_date: format(range.from, "yyyy-MM-dd"),
        end_date: range.to
          ? format(range.to, "yyyy-MM-dd")
          : format(range.from, "yyyy-MM-dd"),
      }));
      setFormErrors((prev) => ({ ...prev, start_date: "", end_date: "" }));
    }
  };

  const validateApplyForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.leave_type) {
      newErrors.leave_type = "Please select a leave type";
    }
    if (!formData.start_date) {
      newErrors.date_range = "Please select a date range";
    }
    if (!formData.end_date) {
      newErrors.date_range = "Please select a date range";
    }
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end < start) {
        newErrors.date_range = "End date must be after start date";
      }
    }
    if (!formData.reason || formData.reason.trim() === "") {
      newErrors.reason = "Please provide a reason for leave";
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApplyLeave = async () => {
    if (!validateApplyForm() || !user?.organization_id) return;

    setApplyLoading(true);
    try {
      console.log("Submitting leave data:", formData);
      const response = await leaveAPI.createLeave(
        user.organization_id,
        formData
      );

      if (response.success) {
        toast.success("Leave request submitted successfully");
        setApplyDialogOpen(false);
        fetchLeaves();
      } else {
        toast.error(response.error || "Failed to submit leave request");
      }
    } catch (err) {
      console.error("Error submitting leave:", err);
      toast.error("An error occurred while submitting leave request");
    } finally {
      setApplyLoading(false);
    }
  };

  const getEmployeeFullName = (emp: any) => {
    const middle = emp.middle_name ? ` ${emp.middle_name}` : "";
    return `${emp.first_name}${middle} ${emp.surname}`;
  };

  const formatDateRangeDisplay = () => {
    if (!dateRange?.from) return "Select date range";

    if (!dateRange.to) {
      return format(dateRange.from, "MMM dd, yyyy");
    }

    return `${format(dateRange.from, "MMM dd, yyyy")} - ${format(
      dateRange.to,
      "MMM dd, yyyy"
    )}`;
  };

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

  const columns: ColumnDef<LeaveType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (leave) =>
        leave.employee_full_name ||
        `${leave.employee_first_name} ${leave.employee_surname}`,
    },
    {
      key: "leave_type",
      header: "Leave Type",
      cell: (leave) => <span className="capitalize">{leave.leave_type}</span>,
    },
    {
      key: "period",
      header: "Period",
      cell: (leave) => formatDateRange(leave.start_date, leave.end_date),
    },
    {
      key: "status",
      header: "Status",
      cell: (leave) => getStatusBadge(leave.status),
    },
    {
      key: "email",
      header: "Email",
      cell: (leave) => leave.employee_email || "—",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (leave) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(leave)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {leave.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleActionClick(leave, "approve")}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleActionClick(leave, "reject")}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
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
            <h1 className="text-xl font-semibold text-gray-900">Leaves</h1>
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
                onClick={() => setApplyDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Apply Leave
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Leave Type
                  </label>
                  <select
                    value={selectedLeaveType}
                    onChange={(e) => setSelectedLeaveType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Types</option>
                    <option value="annual">Annual</option>
                    <option value="sick">Sick</option>
                    <option value="casual">Casual</option>
                    <option value="maternity">Maternity</option>
                    <option value="paternity">Paternity</option>
                    <option value="other">Other</option>
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
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
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
                        <option
                          key={month}
                          value={month.toString().padStart(2, "0")}
                        >
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
            data={leaves}
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
                ? "No leaves match your filters"
                : "No leaves found"
            }
          />
        </div>
      </div>

      <LeaveActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={actionType}
        leavePeriod={
          selectedLeave
            ? formatDateRange(selectedLeave.start_date, selectedLeave.end_date)
            : ""
        }
        employeeName={selectedLeave ? selectedLeave.employee_full_name : ""}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />

      <LeaveActionDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        action="apply"
        onConfirm={handleApplyLeave}
        loading={applyLoading}
      >
        <div className="space-y-4">
          {/* Leave Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Leave Type <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.leave_type}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, leave_type: value }));
                setFormErrors((prev) => ({ ...prev, leave_type: "" }));
              }}
              disabled={applyLoading}
            >
              <SelectTrigger
                className={cn(
                  "w-full",
                  formErrors.leave_type && "border-red-500"
                )}
              >
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Leave Types</SelectLabel>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                  <SelectItem value="maternity">Maternity Leave</SelectItem>
                  <SelectItem value="paternity">Paternity Leave</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {formErrors.leave_type && (
              <p className="text-xs text-red-500">{formErrors.leave_type}</p>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Date Range <span className="text-red-500">*</span>
            </label>
            <Popover
              open={dateRangePopoverOpen}
              onOpenChange={setDateRangePopoverOpen}
              modal={true}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between font-normal",
                    !dateRange?.from && "text-muted-foreground",
                    formErrors.date_range && "border-red-500"
                  )}
                  disabled={applyLoading}
                >
                  {formatDateRangeDisplay()}
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                  className="rounded-lg"
                />
              </PopoverContent>
            </Popover>
            {formErrors.date_range && (
              <p className="text-xs text-red-500">{formErrors.date_range}</p>
            )}
          </div>

          {/* Reliever */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Reliever (Optional)
            </label>
            <Select
              value={formData.reliever_id?.toString() || "none"}
              onValueChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  reliever_id: value === "none" ? null : Number(value),
                }));
              }}
              disabled={applyLoading || loadingEmployees}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reliever" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Employees</SelectLabel>
                  <SelectItem value="none">No Reliever</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {getEmployeeFullName(emp)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {loadingEmployees && (
              <p className="text-xs text-gray-500">Loading employees...</p>
            )}
            {!loadingEmployees && employees.length === 0 && (
              <p className="text-xs text-gray-500">
                No other employees available
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, reason: e.target.value }));
                setFormErrors((prev) => ({ ...prev, reason: "" }));
              }}
              placeholder="Please provide a reason for your leave request"
              rows={3}
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none",
                formErrors.reason ? "border-red-500" : "border-gray-300"
              )}
              disabled={applyLoading}
            />
            {formErrors.reason && (
              <p className="text-xs text-red-500">{formErrors.reason}</p>
            )}
          </div>
        </div>
      </LeaveActionDialog>

      <LeaveViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        leave={viewLeave}
      />
    </>
  );
};

export default LeaveTable;
