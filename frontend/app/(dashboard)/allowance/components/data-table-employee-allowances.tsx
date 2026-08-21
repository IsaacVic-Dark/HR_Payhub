"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Filter,
  Plus,
  Eye,
  Send,
  Check,
  X,
  PauseCircle,
  Ban,
  Trash2,
  CalendarPlus,
  CalendarMinus,
} from "lucide-react";
import {
  allowanceAPI,
  type EmployeeAllowanceType,
  type AllowanceTypeType,
  type EmployeeAllowanceFilters,
} from "@/services/api/allowance";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmployeeAllowanceActionDialog,
  type EmployeeAllowanceActionType,
} from "./employee-allowance-action-dialog";
import { EmployeeAllowanceViewDrawer } from "./employee-allowance-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { employeeAPI } from "@/services/api/employee";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT: { color: "bg-gray-100 text-gray-800", label: "Draft" },
  PENDING_APPROVAL: { color: "bg-yellow-100 text-yellow-800", label: "Pending Approval" },
  APPROVED: { color: "bg-green-100 text-green-800", label: "Approved" },
  REJECTED: { color: "bg-red-100 text-red-800", label: "Rejected" },
  SUSPENDED: { color: "bg-amber-100 text-amber-800", label: "Suspended" },
  EXPIRED: { color: "bg-gray-100 text-gray-500", label: "Expired" },
  CANCELLED: { color: "bg-gray-100 text-gray-500", label: "Cancelled" },
};

const getStatusBadge = (status: string) => {
  const config = STATUS_CONFIG[status] || { color: "bg-gray-100 text-gray-800", label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const getEmployeeFullName = (emp: any) =>
  [emp.firstname, emp.middlename, emp.surname].filter(Boolean).join(" ") ||
  emp.full_name ||
  `Employee #${emp.id}`;

const amountLabel = (r: EmployeeAllowanceType) => {
  switch (r.calculation_method) {
    case "FIXED_AMOUNT": {
      const amount = r.amount ?? r.type_default_amount;
      return amount ? `${Number(amount).toLocaleString()} KES` : "—";
    }
    case "PERCENTAGE_OF_BASIC": {
      const pct = r.percentage ?? r.type_default_percentage;
      return pct ? `${Number(pct)}% basic` : "—";
    }
    case "PERCENTAGE_OF_GROSS": {
      const pct = r.percentage ?? r.type_default_percentage;
      return pct ? `${Number(pct)}% gross` : "—";
    }
    default:
      return "—";
  }
};

interface ApplyFormState {
  employee_id: number | null;
  allowance_type_id: number | null;
  amount: string;
  percentage: string;
  start_date: string;
  end_date: string;
  eligibility_reason: string;
  submit: boolean;
}

const emptyApplyForm = (): ApplyFormState => ({
  employee_id: null,
  allowance_type_id: null,
  amount: "",
  percentage: "",
  start_date: "",
  end_date: "",
  eligibility_reason: "",
  submit: false,
});

const DataTableEmployeeAllowances: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<EmployeeAllowanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [filters, setFilters] = useState<EmployeeAllowanceFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Workflow action dialog (approve/reject/suspend/cancel/submit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<EmployeeAllowanceActionType>("submit");
  const [selected, setSelected] = useState<EmployeeAllowanceType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // View drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewRow, setViewRow] = useState<EmployeeAllowanceType | null>(null);

  // Create ("apply") dialog
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [formData, setFormData] = useState<ApplyFormState>(emptyApplyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceTypeType[]>([]);
  const [loadingAllowanceTypes, setLoadingAllowanceTypes] = useState(false);

  // Row-level attach/detach — one-click, backend auto-resolves the current
  // draft payrun when no payrun_id is given (see resolvePayrunId() on the backend).
  const [attachingId, setAttachingId] = useState<number | null>(null);
  const [detachingId, setDetachingId] = useState<number | null>(null);

  const fetchAllowances = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const apiFilters: EmployeeAllowanceFilters = {
        ...filters,
        status: (selectedStatus as any) || undefined,
        employee_id: selectedEmployeeId || undefined,
      };

      const response = await allowanceAPI.getEmployeeAllowances(user.organization_id, apiFilters);

      if (response.success && response.data) {
        setRows(Array.isArray(response.data) ? response.data : []);
        const pagination = response.metadata?.pagination;
        setTotalItems(pagination?.total || 0);
        setTotalPages(pagination?.total_pages || 0);
      } else {
        setError(response.error || "Failed to fetch employee allowances");
        setRows([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedStatus, selectedEmployeeId, user?.organization_id]);

  useEffect(() => {
    if (user?.organization_id) fetchAllowances();
  }, [fetchAllowances, user?.organization_id]);

  // Load employees + active allowance types when the create dialog opens.
  useEffect(() => {
    const load = async () => {
      if (!applyDialogOpen || !user?.organization_id) return;
      setLoadingEmployees(true);
      setLoadingAllowanceTypes(true);
      try {
        const [employeesRes, typesRes] = await Promise.all([
          employeeAPI.getEmployees(user.organization_id),
          allowanceAPI.getAllowanceTypes(user.organization_id, { status: "ACTIVE" }),
        ]);
        if (employeesRes.success && employeesRes.data) {
          setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
        }
        if (typesRes.success && typesRes.data) {
          setAllowanceTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
        }
      } catch {
        setEmployees([]);
        setAllowanceTypes([]);
      } finally {
        setLoadingEmployees(false);
        setLoadingAllowanceTypes(false);
      }
    };
    load();
  }, [applyDialogOpen, user?.organization_id]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, per_page: newLimit, page: 1 }));
  };

  const clearFilters = () => {
    setSelectedStatus("");
    setSelectedEmployeeId("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters = selectedStatus || selectedEmployeeId;

  const openAction = (row: EmployeeAllowanceType, action: EmployeeAllowanceActionType) => {
    setSelected(row);
    setActionType(action);
    setDialogOpen(true);
  };

  const openView = (row: EmployeeAllowanceType) => {
    setViewRow(row);
    setDrawerOpen(true);
  };

  const handleConfirmAction = async (payload: Record<string, any>) => {
    if (!user?.organization_id || !selected) return;
    setActionLoading(true);
    try {
      let response;
      switch (actionType) {
        case "submit":
          response = await allowanceAPI.submitEmployeeAllowance(user.organization_id, selected.id);
          break;
        case "approve":
          response = await allowanceAPI.approveEmployeeAllowance(user.organization_id, selected.id);
          break;
        case "reject":
          response = await allowanceAPI.rejectEmployeeAllowance(
            user.organization_id,
            selected.id,
            payload.rejection_reason
          );
          break;
        case "suspend":
          response = await allowanceAPI.suspendEmployeeAllowance(user.organization_id, selected.id);
          break;
        case "cancel":
          response = await allowanceAPI.cancelEmployeeAllowance(user.organization_id, selected.id);
          break;
        default:
          return;
      }

      if (response?.success) {
        toast.success(response.message || "Allowance updated");
        setDialogOpen(false);
        fetchAllowances();
      } else {
        toast.error(response?.error || "Action failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (row: EmployeeAllowanceType) => {
    if (!user?.organization_id) return;
    const response = await allowanceAPI.deleteEmployeeAllowance(user.organization_id, row.id);
    if (response.success) {
      toast.success(response.message || "Allowance deleted");
      fetchAllowances();
    } else {
      toast.error(response.error || "Failed to delete allowance");
    }
  };

  const handleAttach = async (row: EmployeeAllowanceType) => {
    if (!user?.organization_id) return;
    setAttachingId(row.id);
    try {
      const response = await allowanceAPI.attachToPayrun(user.organization_id, row.id);
      if (response.success) {
        toast.success(response.message || "Attached to the current draft payrun");
        fetchAllowances();
      } else {
        toast.error(response.error || "Failed to attach to payrun");
      }
    } finally {
      setAttachingId(null);
    }
  };

  const handleDetach = async (row: EmployeeAllowanceType) => {
    if (!user?.organization_id) return;
    setDetachingId(row.id);
    try {
      const response = await allowanceAPI.detachFromPayrun(user.organization_id, row.id);
      if (response.success) {
        toast.success(response.message || "Detached from the current draft payrun");
        fetchAllowances();
      } else {
        toast.error(response.error || "Failed to detach from payrun");
      }
    } finally {
      setDetachingId(null);
    }
  };

  const validateApplyForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.employee_id) errors.employee_id = "Select an employee";
    if (!formData.allowance_type_id) errors.allowance_type_id = "Select an allowance";
    if (!formData.start_date) errors.start_date = "Start date is required";
    if (
      formData.percentage &&
      (Number(formData.percentage) < 0 || Number(formData.percentage) > 100)
    ) {
      errors.percentage = "Percentage must be between 0 and 100";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitApply = async () => {
    if (!user?.organization_id) return;
    if (!validateApplyForm()) return;
    setApplyLoading(true);
    try {
      const response = await allowanceAPI.createEmployeeAllowance(user.organization_id, {
        employee_id: formData.employee_id!,
        allowance_type_id: formData.allowance_type_id!,
        amount: formData.amount ? Number(formData.amount) : null,
        percentage: formData.percentage ? Number(formData.percentage) : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        eligibility_reason: formData.eligibility_reason || null,
        submit: formData.submit,
      });

      if (response.success) {
        toast.success(response.message || "Employee allowance created");
        setApplyDialogOpen(false);
        setFormData(emptyApplyForm());
        setFormErrors({});
        fetchAllowances();
      } else {
        toast.error(response.error || "Failed to create employee allowance");
      }
    } finally {
      setApplyLoading(false);
    }
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

  const selectedAllowanceType = allowanceTypes.find(
    (t) => t.id === formData.allowance_type_id
  );

  const columns: ColumnDef<EmployeeAllowanceType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.employee_name || `#${r.employee_id}`}</p>
          {r.employee_number && <p className="text-xs text-gray-500">{r.employee_number}</p>}
        </div>
      ),
    },
    {
      key: "allowance",
      header: "Allowance",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.allowance_name}</p>
          <p className="text-xs text-gray-500 capitalize">{r.category}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => amountLabel(r),
    },
    {
      key: "dates",
      header: "Active Window",
      cell: (r) => (
        <span className="text-xs text-gray-700">
          {r.start_date} → {r.end_date || "ongoing"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => getStatusBadge(r.status),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openView(r)}
            className="h-8 w-8 p-0"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {r.status === "DRAFT" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openAction(r, "submit")}
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                title="Submit for Approval"
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(r)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}

          {r.status === "PENDING_APPROVAL" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openAction(r, "approve")}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                title="Approve"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openAction(r, "reject")}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Reject"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}

          {r.status === "APPROVED" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAttach(r)}
                disabled={attachingId === r.id}
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                title="Attach to current draft payrun"
              >
                <CalendarPlus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDetach(r)}
                disabled={detachingId === r.id}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                title="Detach from current draft payrun"
              >
                <CalendarMinus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openAction(r, "suspend")}
                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                title="Suspend"
              >
                <PauseCircle className="h-4 w-4" />
              </Button>
            </>
          )}

          {["DRAFT", "PENDING_APPROVAL", "APPROVED", "SUSPENDED"].includes(r.status) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openAction(r, "cancel")}
              className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
              title="Cancel"
            >
              <Ban className="h-4 w-4" />
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
            <h2 className="text-lg font-semibold text-gray-900">Employee Allowances</h2>
            <div className="flex items-center gap-3">
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
                New Allowance
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                      <option key={value} value={value}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    placeholder="Filter by employee ID..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end">
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
            data={rows}
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
                ? "No allowances match your filters"
                : "No employee allowances yet"
            }
          />
        </div>
      </div>

      <EmployeeAllowanceActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={actionType}
        employeeAllowance={selected}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />

      <EmployeeAllowanceActionDialog
        open={applyDialogOpen}
        onOpenChange={(open) => {
          setApplyDialogOpen(open);
          if (!open) {
            setFormData(emptyApplyForm());
            setFormErrors({});
          }
        }}
        action="apply"
        onConfirm={handleSubmitApply}
        loading={applyLoading}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Employee <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.employee_id ? formData.employee_id.toString() : ""}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, employee_id: Number(value) }))
              }
              disabled={applyLoading || loadingEmployees}
            >
              <SelectTrigger
                className={cn("w-full", formErrors.employee_id && "border-red-500")}
              >
                <SelectValue
                  placeholder={loadingEmployees ? "Loading employees..." : "Select employee"}
                />
              </SelectTrigger>
              <SelectContent searchable searchPlaceholder="Search employees...">
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Allowance Type <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.allowance_type_id ? formData.allowance_type_id.toString() : ""}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, allowance_type_id: Number(value) }))
              }
              disabled={applyLoading || loadingAllowanceTypes}
            >
              <SelectTrigger
                className={cn("w-full", formErrors.allowance_type_id && "border-red-500")}
              >
                <SelectValue
                  placeholder={loadingAllowanceTypes ? "Loading..." : "Select allowance type"}
                />
              </SelectTrigger>
              <SelectContent searchable searchPlaceholder="Search allowance types...">
                <SelectGroup>
                  <SelectLabel>Active Allowance Types</SelectLabel>
                  {allowanceTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {formErrors.allowance_type_id && (
              <p className="text-xs text-red-500">{formErrors.allowance_type_id}</p>
            )}
          </div>

          {selectedAllowanceType?.calculation_method === "FIXED_AMOUNT" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Amount Override (KES, optional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                disabled={applyLoading}
                placeholder={
                  selectedAllowanceType.amount
                    ? `Default: ${Number(selectedAllowanceType.amount).toLocaleString()}`
                    : ""
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {(selectedAllowanceType?.calculation_method === "PERCENTAGE_OF_BASIC" ||
            selectedAllowanceType?.calculation_method === "PERCENTAGE_OF_GROSS") && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Percentage Override (optional)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={formData.percentage}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, percentage: e.target.value }))
                }
                disabled={applyLoading}
                placeholder={
                  selectedAllowanceType.percentage
                    ? `Default: ${Number(selectedAllowanceType.percentage)}%`
                    : ""
                }
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  formErrors.percentage ? "border-red-500" : "border-gray-300"
                )}
              />
              {formErrors.percentage && (
                <p className="text-xs text-red-500">{formErrors.percentage}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                }
                disabled={applyLoading}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  formErrors.start_date ? "border-red-500" : "border-gray-300"
                )}
              />
              {formErrors.start_date && (
                <p className="text-xs text-red-500">{formErrors.start_date}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">End Date (optional)</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                disabled={applyLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Eligibility Reason (optional)
            </label>
            <textarea
              value={formData.eligibility_reason}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, eligibility_reason: e.target.value }))
              }
              rows={2}
              disabled={applyLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.submit}
              onChange={(e) => setFormData((prev) => ({ ...prev, submit: e.target.checked }))}
              disabled={applyLoading}
            />
            Submit for approval immediately (otherwise saved as a draft)
          </label>
        </div>
      </EmployeeAllowanceActionDialog>

      <EmployeeAllowanceViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        employeeAllowance={viewRow}
      />
    </>
  );
};

export default DataTableEmployeeAllowances;