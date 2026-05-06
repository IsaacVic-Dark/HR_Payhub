"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Search, Plus, Check, X, Eye, Trash2, Banknote } from "lucide-react";
import {
  loanAPI,
  LoanType,
  LoanFilters,
  MinimalLoanType,
  RecordRepaymentPayload,
} from "@/services/api/loan";
import { Button } from "@/components/ui/button";
import { LoanActionDialog } from "@/app/(dashboard)/loans/components/loan-action-dialog";
import { LoanViewDrawer } from "@/app/(dashboard)/loans/components/loan-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { employeeAPI } from "@/services/api/employee";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(amount);
};

// -------------------------------------------------------

const LoanTable: React.FC = () => {
  const { user } = useAuth();

  // ── Data ───────────────────────────────────────────────
  const [loans, setLoans] = useState<LoanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Approve / Reject dialog ────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanType | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");

  // ── View drawer ────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewLoan, setViewLoan] = useState<LoanType | null>(null);

  // ── Create Loan dialog ─────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // ── Filter states ──────────────────────────────────────
  const [searchTerm, setSearchTerm]         = useState("");
  const [selectedLoanType, setSelectedLoanType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMonth, setSelectedMonth]   = useState("");
  const [selectedYear, setSelectedYear]     = useState("");
  const [showFilters, setShowFilters]       = useState(false);

  // ── Pagination ─────────────────────────────────────────
  const [filters, setFilters] = useState<LoanFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // ── Loan types for dropdowns ───────────────────────────
  const [loanTypes, setLoanTypes] = useState<MinimalLoanType[]>([]);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);

  // ── Repayment dialog ───────────────────────────────────
  const [repaymentDialogOpen, setRepaymentDialogOpen] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<LoanType | null>(null);
  const [repaymentLoading, setRepaymentLoading] = useState(false);
  const [repaymentForm, setRepaymentForm] = useState({
    amount: "",
    repayment_date: new Date().toISOString().split("T")[0],
    method: "manual" as "manual" | "payroll_deduction",
    notes: "",
  });
  const [repaymentErrors, setRepaymentErrors] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // ── Create-Loan form ───────────────────────────────────
  const [formData, setFormData] = useState({
    employee_id: 0,
    config_id: 0,
    amount: "",
    start_date: "",
    end_date: "",
    interest_rate: "",
    monthly_deduction: "",
    purpose: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Fetch loan types once ──────────────────────────────
  useEffect(() => {
    const fetchLoanTypes = async () => {
      if (!user?.organization_id) return;
      setLoadingLoanTypes(true);
      try {
        const response = await loanAPI.getLoanTypes(user.organization_id);
        if (response.success && response.data) {
          setLoanTypes(Array.isArray(response.data) ? response.data : []);
        }
      } catch {
        // silently fail — dropdowns will be empty
      } finally {
        setLoadingLoanTypes(false);
      }
    };
    fetchLoanTypes();
  }, [user?.organization_id]);

  // ── Reset repayment form when dialog closes ────────────
  useEffect(() => {
    if (!repaymentDialogOpen) {
      setRepaymentForm({
        amount: "",
        repayment_date: new Date().toISOString().split("T")[0],
        method: "manual",
        notes: "",
      });
      setRepaymentErrors({});
    }
  }, [repaymentDialogOpen]);

  // ── Fetch employees when create dialog opens ───────────
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!createDialogOpen || !user?.organization_id) return;
      setLoadingEmployees(true);
      try {
        const response = await employeeAPI.getEmployees(user.organization_id);
        if (response.success && response.data) {
          setEmployees(Array.isArray(response.data) ? response.data : []);
        } else {
          setEmployees([]);
        }
      } catch {
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, [createDialogOpen, user?.organization_id]);

  // ── Reset create form when dialog closes ───────────────
  useEffect(() => {
    if (!createDialogOpen) {
      setFormData({
        employee_id: 0,
        config_id: 0,
        amount: "",
        start_date: "",
        end_date: "",
        interest_rate: "",
        monthly_deduction: "",
        purpose: "",
      });
      setFormErrors({});
    }
  }, [createDialogOpen]);

  // ── Core fetch ─────────────────────────────────────────
  const fetchLoans = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const apiFilters: LoanFilters = {
        ...filters,
        name:      searchTerm       || undefined,
        config_id: selectedLoanType || undefined,
        status:    selectedStatus   || undefined,
        month:     selectedMonth    || undefined,
        year:      selectedYear     || undefined,
      };

      const response = await loanAPI.getLoans(user.organization_id, apiFilters);

      if (response.success && response.data) {
        const loansData = Array.isArray(response.data)
          ? response.data
          : (response.data as any).loans ?? [];

        const paginationData = response.metadata?.pagination;

        setLoans(loansData);
        setTotalItems(paginationData?.total      ?? 0);
        setTotalPages(paginationData?.total_pages ?? 0);
      } else {
        const noData = response.message?.toLowerCase().includes("no loans");
        setLoans([]);
        setTotalItems(0);
        setTotalPages(0);
        if (!noData) setError(response.error || "Failed to fetch loans");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoans([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, selectedLoanType, selectedStatus, selectedMonth, selectedYear, user?.organization_id]);

  useEffect(() => {
    if (user?.organization_id) fetchLoans();
  }, [fetchLoans, user?.organization_id]);

  // ── Status badge ───────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending:  { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      approved: { color: "bg-green-100 text-green-800",  label: "Approved" },
      rejected: { color: "bg-red-100 text-red-800",     label: "Rejected" },
      repaid:   { color: "bg-blue-100 text-blue-800",   label: "Repaid" },
    };
    const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", label: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // ── Action handlers ────────────────────────────────────
  const handleActionClick = (loan: LoanType, action: "approve" | "reject") => {
    setSelectedLoan(loan);
    setActionType(action);
    setDialogOpen(true);
  };

  const handleViewClick = (loan: LoanType) => {
    setViewLoan(loan);
    setDrawerOpen(true);
  };

  const handleConfirmAction = async (rejectionReason?: string) => {
    if (!selectedLoan || !user?.organization_id) return;

    setActionLoading(true);
    try {
      const response =
        actionType === "approve"
          ? await loanAPI.approveLoan(user.organization_id, selectedLoan.loan_id)
          : await loanAPI.rejectLoan(user.organization_id, selectedLoan.loan_id, rejectionReason);

      if (response.success) {
        toast.success(`Loan ${actionType === "approve" ? "approved" : "rejected"} successfully`);
        setDialogOpen(false);
        fetchLoans();
      } else {
        toast.error(response.error || `Failed to ${actionType} loan`);
      }
    } catch {
      toast.error(`An error occurred while ${actionType === "approve" ? "approving" : "rejecting"} loan`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLoan = async (loan: LoanType) => {
    if (!user?.organization_id) return;
    if (!confirm(`Delete this pending loan for ${loan.employee.full_name}? This cannot be undone.`)) return;

    try {
      const response = await loanAPI.deleteLoan(user.organization_id, loan.loan_id);
      if (response.success) {
        toast.success("Loan deleted successfully");
        fetchLoans();
      } else {
        toast.error(response.error || "Failed to delete loan");
      }
    } catch {
      toast.error("An error occurred while deleting loan");
    }
  };

  const handleRepaymentClick = (loan: LoanType) => {
    setRepaymentLoan(loan);
    setRepaymentDialogOpen(true);
  };

  const validateRepaymentForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const amt = Number(repaymentForm.amount);
    if (!repaymentForm.amount || isNaN(amt) || amt <= 0)
      newErrors.amount = "Please enter a valid repayment amount";
    if (repaymentLoan?.balance_remaining !== null && amt > (repaymentLoan?.balance_remaining ?? Infinity))
      newErrors.amount = `Amount exceeds balance remaining (KES ${formatCurrency(repaymentLoan?.balance_remaining)})`;
    if (!repaymentForm.repayment_date)
      newErrors.repayment_date = "Please select a repayment date";
    setRepaymentErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRecordRepayment = async () => {
    if (!validateRepaymentForm() || !repaymentLoan || !user?.organization_id) return;

    setRepaymentLoading(true);
    try {
      const payload: RecordRepaymentPayload = {
        amount:          Number(repaymentForm.amount),
        repayment_date:  repaymentForm.repayment_date,
        method:          repaymentForm.method,
        notes:           repaymentForm.notes || null,
      };

      const response = await loanAPI.recordRepayment(
        user.organization_id,
        repaymentLoan.loan_id,
        payload
      );

      if (response.success) {
        const isFullyRepaid = (response.data as any)?.fully_repaid;
        toast.success(
          isFullyRepaid
            ? "Repayment recorded — loan fully repaid!"
            : "Repayment recorded successfully"
        );
        setRepaymentDialogOpen(false);
        fetchLoans();
      } else {
        toast.error(response.error || "Failed to record repayment");
      }
    } catch {
      toast.error("An error occurred while recording repayment");
    } finally {
      setRepaymentLoading(false);
    }
  };

  // ── Create loan form ───────────────────────────────────
  const validateCreateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.employee_id) newErrors.employee_id = "Please select an employee";
    if (!formData.config_id)   newErrors.config_id   = "Please select a loan type";
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)
      newErrors.amount = "Please enter a valid loan amount";
    if (!formData.start_date) newErrors.start_date = "Please select a start date";

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateLoan = async () => {
    if (!validateCreateForm() || !user?.organization_id) return;

    setCreateLoading(true);
    try {
      const payload = {
        employee_id:       formData.employee_id,
        config_id:         formData.config_id,
        amount:            Number(formData.amount),
        start_date:        formData.start_date,
        end_date:          formData.end_date   || null,
        interest_rate:     formData.interest_rate     ? Number(formData.interest_rate)     : null,
        monthly_deduction: formData.monthly_deduction ? Number(formData.monthly_deduction) : null,
        purpose:           formData.purpose || null,
      };

      const response = await loanAPI.createLoan(user.organization_id, payload);

      if (response.success) {
        toast.success("Loan created successfully");
        setCreateDialogOpen(false);
        fetchLoans();
      } else {
        toast.error(response.error || "Failed to create loan");
      }
    } catch {
      toast.error("An error occurred while creating the loan");
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Pagination ─────────────────────────────────────────
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
    setSelectedLoanType("");
    setSelectedStatus("");
    setSelectedMonth("");
    setSelectedYear("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters =
    searchTerm || selectedLoanType || selectedStatus || selectedMonth || selectedYear;

  const getEmployeeFullName = (emp: any) => {
    const middle = emp.middle_name ? ` ${emp.middle_name}` : "";
    return `${emp.first_name}${middle} ${emp.surname}`;
  };

  // ── Guard ──────────────────────────────────────────────
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

  // ── Columns ────────────────────────────────────────────
  const columns: ColumnDef<LoanType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (loan) => loan.employee.full_name,
    },
    {
      key: "loan_type",
      header: "Loan Type",
      cell: (loan) => <span className="capitalize">{loan.loan_type.name}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (loan) => (
        <span className="font-medium">{formatCurrency(loan.amount)}</span>
      ),
    },
    {
      key: "balance_remaining",
      header: "Balance",
      cell: (loan) => formatCurrency(loan.balance_remaining),
    },
    {
      key: "start_date",
      header: "Start Date",
      cell: (loan) =>
        new Date(loan.start_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      key: "status",
      header: "Status",
      cell: (loan) => getStatusBadge(loan.status),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (loan) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(loan)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {loan.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleActionClick(loan, "approve")}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleActionClick(loan, "reject")}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteLoan(loan)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {loan.status === "approved" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRepaymentClick(loan)}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="Record repayment"
            >
              <Banknote className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────
  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Loans</h1>
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
                onClick={() => setCreateDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Loan
              </Button>
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Loan Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Loan Type
                  </label>
                  <select
                    value={selectedLoanType}
                    onChange={(e) => setSelectedLoanType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    disabled={loadingLoanTypes}
                  >
                    <option value="">All Types</option>
                    {loanTypes.map((lt) => (
                      <option key={lt.id} value={lt.id.toString()}>
                        {lt.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
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
                    <option value="repaid">Repaid</option>
                  </select>
                </div>

                {/* Month */}
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
                        <option key={month} value={month.toString().padStart(2, "0")}>
                          {new Date(2000, i).toLocaleString("default", { month: "long" })}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Year */}
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

                {/* Clear */}
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          <DataTable
            data={loans}
            columns={columns}
            pagination={{
              page:       filters.page     || 1,
              limit:      filters.per_page || 10,
              totalItems,
              totalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            error={error}
            emptyMessage={
              hasActiveFilters ? "No loans match your filters" : "No loans found"
            }
          />
        </div>
      </div>

      {/* Approve / Reject dialog */}
      <LoanActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={actionType}
        loanAmount={selectedLoan ? formatCurrency(selectedLoan.amount) : ""}
        employeeName={selectedLoan?.employee.full_name ?? ""}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />

      {/* Create Loan dialog */}
      <LoanActionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        action="create"
        onConfirm={handleCreateLoan}
        loading={createLoading}
      >
        <div className="space-y-4">
          {/* Employee */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Employee <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.employee_id ? formData.employee_id.toString() : ""}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, employee_id: Number(value) }));
                setFormErrors((prev) => ({ ...prev, employee_id: "" }));
              }}
              disabled={createLoading || loadingEmployees}
            >
              <SelectTrigger className={cn("w-full", formErrors.employee_id && "border-red-500")}>
                <SelectValue placeholder={loadingEmployees ? "Loading employees..." : "Select employee"} />
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

          {/* Loan Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Loan Type <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.config_id ? formData.config_id.toString() : ""}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, config_id: Number(value) }));
                setFormErrors((prev) => ({ ...prev, config_id: "" }));
              }}
              disabled={createLoading || loadingLoanTypes}
            >
              <SelectTrigger className={cn("w-full", formErrors.config_id && "border-red-500")}>
                <SelectValue placeholder={loadingLoanTypes ? "Loading loan types..." : "Select loan type"} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Loan Types</SelectLabel>
                  {loanTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id.toString()}>
                      {lt.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {formErrors.config_id && (
              <p className="text-xs text-red-500">{formErrors.config_id}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, amount: e.target.value }));
                setFormErrors((prev) => ({ ...prev, amount: "" }));
              }}
              placeholder="e.g., 50000"
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                formErrors.amount ? "border-red-500" : "border-gray-300"
              )}
              disabled={createLoading}
            />
            {formErrors.amount && (
              <p className="text-xs text-red-500">{formErrors.amount}</p>
            )}
          </div>

          {/* Start Date & End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, start_date: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, start_date: "" }));
                }}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                  formErrors.start_date ? "border-red-500" : "border-gray-300"
                )}
                disabled={createLoading}
              />
              {formErrors.start_date && (
                <p className="text-xs text-red-500">{formErrors.start_date}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                End Date <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={createLoading}
              />
            </div>
          </div>

          {/* Interest Rate & Monthly Deduction */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Interest Rate % <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.interest_rate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, interest_rate: e.target.value }))
                }
                placeholder="e.g., 10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={createLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Monthly Deduction <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.monthly_deduction}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, monthly_deduction: e.target.value }))
                }
                placeholder="e.g., 5000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={createLoading}
              />
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Purpose <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <textarea
              value={formData.purpose}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, purpose: e.target.value }))
              }
              placeholder="Describe the purpose of this loan..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={createLoading}
            />
          </div>
        </div>
      </LoanActionDialog>

      {/* View drawer */}
      <LoanViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        loan={viewLoan}
      />

      {/* Record Repayment dialog */}
      <LoanActionDialog
        open={repaymentDialogOpen}
        onOpenChange={setRepaymentDialogOpen}
        action="repayment"
        onConfirm={handleRecordRepayment}
        loading={repaymentLoading}
      >
        <div className="space-y-4">
          {/* Context banner */}
          {repaymentLoan && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm space-y-1">
              <p className="font-medium text-blue-900">{repaymentLoan.employee.full_name}</p>
              <p className="text-blue-700">
                Balance remaining:{" "}
                <span className="font-semibold">
                  {formatCurrency(repaymentLoan.balance_remaining)}
                </span>
              </p>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Repayment Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={repaymentForm.amount}
              onChange={(e) => {
                setRepaymentForm((prev) => ({ ...prev, amount: e.target.value }));
                setRepaymentErrors((prev) => ({ ...prev, amount: "" }));
              }}
              placeholder="e.g., 5000"
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                repaymentErrors.amount ? "border-red-500" : "border-gray-300"
              )}
              disabled={repaymentLoading}
            />
            {repaymentErrors.amount && (
              <p className="text-xs text-red-500">{repaymentErrors.amount}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Repayment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={repaymentForm.repayment_date}
              onChange={(e) => {
                setRepaymentForm((prev) => ({ ...prev, repayment_date: e.target.value }));
                setRepaymentErrors((prev) => ({ ...prev, repayment_date: "" }));
              }}
              className={cn(
                "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                repaymentErrors.repayment_date ? "border-red-500" : "border-gray-300"
              )}
              disabled={repaymentLoading}
            />
            {repaymentErrors.repayment_date && (
              <p className="text-xs text-red-500">{repaymentErrors.repayment_date}</p>
            )}
          </div>

          {/* Method */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Method</label>
            <Select
              value={repaymentForm.method}
              onValueChange={(value: "manual" | "payroll_deduction") =>
                setRepaymentForm((prev) => ({ ...prev, method: value }))
              }
              disabled={repaymentLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="payroll_deduction">Payroll Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Notes <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <textarea
              value={repaymentForm.notes}
              onChange={(e) =>
                setRepaymentForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Any notes about this repayment..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={repaymentLoading}
            />
          </div>
        </div>
      </LoanActionDialog>
    </>
  );
};

export default LoanTable;