"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Search, Plus, Eye, Trash2, AlertTriangle } from "lucide-react";
import {
  loanAPI,
  LoanType,
  LoanFilters,
  MinimalLoanType,
  STATUS_CONFIG,
  LoanStatus,
  getAvailableActions,
  WorkflowAction,
  ACTION_LABELS,
  ActionPayload,
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtKES = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
      }).format(v);

/** Map a WorkflowAction to a button variant / colour class */
function actionButtonClass(action: WorkflowAction): string {
  if (["manager_approve", "hr_approve", "finance_approve", "approve"].includes(action))
    return "h-7 px-2 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100";
  if (["manager_reject", "hr_reject", "finance_reject", "reject", "delete"].includes(action))
    return "h-7 px-2 text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100";
  if (action === "hr_flag_compliance")
    return "h-7 px-2 text-xs bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100";
  if (action === "disburse")
    return "h-7 px-2 text-xs bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100";
  if (action === "repayment")
    return "h-7 px-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100";
  if (action === "appeal")
    return "h-7 px-2 text-xs bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100";
  return "h-7 px-2 text-xs";
}

// ─── All possible status filter options ────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "",                  label: "All Statuses" },
  { value: "pending",           label: "Pending" },
  { value: "validated",         label: "Awaiting Manager" },
  { value: "system_rejected",   label: "System Rejected" },
  { value: "manager_approved",  label: "Awaiting HR" },
  { value: "manager_rejected",  label: "Manager Rejected" },
  { value: "hr_approved",       label: "Awaiting Finance" },
  { value: "hr_rejected",       label: "HR Rejected" },
  { value: "compliance_review", label: "Compliance Review" },
  { value: "finance_approved",  label: "Awaiting Disbursement" },
  { value: "finance_rejected",  label: "Finance Rejected" },
  { value: "approved",          label: "Approved" },
  { value: "active",            label: "Active" },
  { value: "rejected",          label: "Rejected" },
  { value: "repaid",            label: "Repaid" },
  { value: "appealed",          label: "Under Appeal" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

const LoanTable: React.FC = () => {
  const { user } = useAuth();
  const userType = user?.user_type ?? "";

  // ── Data ────────────────────────────────────────────────────────────────────
  const [loans, setLoans] = useState<LoanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Workflow action dialog ───────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<WorkflowAction | "create">("manager_approve");
  const [selectedLoan, setSelectedLoan] = useState<LoanType | null>(null);

  // ── View drawer ─────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewLoan, setViewLoan] = useState<LoanType | null>(null);

  // ── Create loan dialog ───────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: number; firstname: string; middlename?: string; surname: string }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
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

  // ── Repayment dialog ─────────────────────────────────────────────────────────
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

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoanType, setSelectedLoanType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<LoanFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // ── Loan types ───────────────────────────────────────────────────────────────
  const [loanTypes, setLoanTypes] = useState<MinimalLoanType[]>([]);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);

  // ── Load loan types ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.organization_id) return;
    setLoadingLoanTypes(true);
    loanAPI.getLoanTypes(user.organization_id)
      .then((r) => { if (r.success && r.data) setLoanTypes(Array.isArray(r.data) ? r.data : []); })
      .finally(() => setLoadingLoanTypes(false));
  }, [user?.organization_id]);

  // ── Load employees when create dialog opens ──────────────────────────────────
  useEffect(() => {
    if (!createDialogOpen || !user?.organization_id) return;
    setLoadingEmployees(true);
    employeeAPI.getEmployees(user.organization_id)
      .then((r) => setEmployees(r.success && r.data ? (Array.isArray(r.data) ? r.data : []) : []))
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, [createDialogOpen, user?.organization_id]);

  // ── Reset create form ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!createDialogOpen) {
      setFormData({ employee_id: 0, config_id: 0, amount: "", start_date: "", end_date: "", interest_rate: "", monthly_deduction: "", purpose: "" });
      setFormErrors({});
    }
  }, [createDialogOpen]);

  // ── Reset repayment form ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!repaymentDialogOpen) {
      setRepaymentForm({ amount: "", repayment_date: new Date().toISOString().split("T")[0], method: "manual", notes: "" });
      setRepaymentErrors({});
    }
  }, [repaymentDialogOpen]);

  // ── Fetch loans ──────────────────────────────────────────────────────────────
  const fetchLoans = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organisation ID. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await loanAPI.getLoans(user.organization_id, {
        ...filters,
        name: searchTerm || undefined,
        config_id: selectedLoanType || undefined,
        status: selectedStatus || undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      });
      if (res.success && res.data) {
        const data = Array.isArray(res.data) ? res.data : (res.data as any).loans ?? [];
        setLoans(data);
        setTotalItems(res.metadata?.pagination?.total ?? 0);
        setTotalPages(res.metadata?.pagination?.total_pages ?? 0);
      } else {
        setLoans([]);
        setTotalItems(0);
        setTotalPages(0);
        if (!res.message?.toLowerCase().includes("no loans"))
          setError(res.error ?? "Failed to fetch loans");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, selectedLoanType, selectedStatus, selectedMonth, selectedYear, user?.organization_id]);

  useEffect(() => { if (user?.organization_id) fetchLoans(); }, [fetchLoans]);

  // ── Open workflow action dialog ──────────────────────────────────────────────
  const openAction = (loan: LoanType, action: WorkflowAction) => {
    if (action === "delete") {
      handleDelete(loan);
      return;
    }
    if (action === "repayment") {
      setRepaymentLoan(loan);
      setRepaymentDialogOpen(true);
      return;
    }
    setSelectedLoan(loan);
    setDialogAction(action);
    setDialogOpen(true);
  };

  // ── Dispatch workflow action ─────────────────────────────────────────────────
  const handleWorkflowAction = async (payload?: ActionPayload) => {
    if (!selectedLoan || !user?.organization_id) return;
    const orgId  = user.organization_id;
    const loanId = selectedLoan.loan_id;
    const reason = payload?.reason ?? "";

    setActionLoading(true);
    try {
      let res;
      switch (dialogAction) {
        case "manager_approve":   res = await loanAPI.managerApproveLoan(orgId, loanId); break;
        case "manager_reject":    res = await loanAPI.managerRejectLoan(orgId, loanId, reason); break;
        case "hr_approve":        res = await loanAPI.hrApproveLoan(orgId, loanId); break;
        case "hr_reject":         res = await loanAPI.hrRejectLoan(orgId, loanId, reason); break;
        case "hr_flag_compliance":res = await loanAPI.hrFlagCompliance(orgId, loanId, reason); break;
        case "finance_approve":   res = await loanAPI.financeApproveLoan(orgId, loanId); break;
        case "finance_reject":    res = await loanAPI.financeRejectLoan(orgId, loanId, reason); break;
        case "disburse":
          res = await loanAPI.disburseLoan(orgId, loanId, {
            disbursement_date: payload?.disbursement_date,
            monthly_deduction: payload?.monthly_deduction ? Number(payload.monthly_deduction) : undefined,
          });
          break;
        case "approve":           res = await loanAPI.approveLoan(orgId, loanId); break;
        case "reject":            res = await loanAPI.rejectLoan(orgId, loanId, reason); break;
        default: return;
      }

      if (res.success) {
        toast.success(res.message ?? "Action completed successfully");
        setDialogOpen(false);
        fetchLoans();
      } else {
        toast.error(res.error ?? res.message ?? "Action failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (loan: LoanType) => {
    if (!user?.organization_id) return;
    if (!confirm(`Delete loan for ${loan.employee.full_name}? This cannot be undone.`)) return;
    const res = await loanAPI.deleteLoan(user.organization_id, loan.loan_id);
    if (res.success) { toast.success("Loan deleted"); fetchLoans(); }
    else toast.error(res.error ?? "Failed to delete loan");
  };

  // ── Repayment ────────────────────────────────────────────────────────────────
  const validateRepayment = () => {
    const errs: Record<string, string> = {};
    const amt = Number(repaymentForm.amount);
    if (!repaymentForm.amount || isNaN(amt) || amt <= 0)
      errs.amount = "Enter a valid amount";
    if (repaymentLoan?.balance_remaining != null && amt > repaymentLoan.balance_remaining)
      errs.amount = `Exceeds balance (${fmtKES(repaymentLoan.balance_remaining)})`;
    if (!repaymentForm.repayment_date)
      errs.repayment_date = "Select a date";
    setRepaymentErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRecordRepayment = async () => {
    if (!validateRepayment() || !repaymentLoan || !user?.organization_id) return;
    setRepaymentLoading(true);
    const res = await loanAPI.recordRepayment(user.organization_id, repaymentLoan.loan_id, {
      amount: Number(repaymentForm.amount),
      repayment_date: repaymentForm.repayment_date,
      method: repaymentForm.method,
      notes: repaymentForm.notes || null,
    });
    setRepaymentLoading(false);
    if (res.success) {
      const full = (res.data as any)?.fully_repaid;
      toast.success(full ? "Repayment recorded — loan fully repaid!" : "Repayment recorded");
      setRepaymentDialogOpen(false);
      fetchLoans();
    } else {
      toast.error(res.error ?? "Failed to record repayment");
    }
  };

  // ── Create loan ──────────────────────────────────────────────────────────────
  const validateCreate = () => {
    const errs: Record<string, string> = {};
    if (!formData.employee_id) errs.employee_id = "Select an employee";
    if (!formData.config_id)   errs.config_id   = "Select a loan type";
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)
      errs.amount = "Enter a valid amount";
    if (!formData.start_date)  errs.start_date  = "Select a start date";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateLoan = async () => {
    if (!validateCreate() || !user?.organization_id) return;
    setCreateLoading(true);
    const res = await loanAPI.createLoan(user.organization_id, {
      employee_id:       formData.employee_id,
      config_id:         formData.config_id,
      amount:            Number(formData.amount),
      start_date:        formData.start_date,
      end_date:          formData.end_date || null,
      interest_rate:     formData.interest_rate ? Number(formData.interest_rate) : null,
      monthly_deduction: formData.monthly_deduction ? Number(formData.monthly_deduction) : null,
      purpose:           formData.purpose || null,
    });
    setCreateLoading(false);
    if (res.success) { toast.success("Loan created"); setCreateDialogOpen(false); fetchLoans(); }
    else toast.error(res.error ?? "Failed to create loan");
  };

  // ── Pagination ────────────────────────────────────────────────────────────────
  const handlePageChange = (p: number) => {
    if (p > 0 && p <= totalPages) setFilters((f) => ({ ...f, page: p }));
  };
  const handleLimitChange = (l: number) => setFilters((f) => ({ ...f, per_page: l, page: 1 }));

  const clearFilters = () => {
    setSearchTerm(""); setSelectedLoanType(""); setSelectedStatus("");
    setSelectedMonth(""); setSelectedYear("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters = searchTerm || selectedLoanType || selectedStatus || selectedMonth || selectedYear;

  // Only show "Create Loan" to privileged roles
  const canCreateLoan = ["admin", "hr_manager", "payroll_manager"].includes(userType);

  const empName = (e: { firstname: string; middlename?: string; surname: string }) =>
    [e.firstname, e.middlename, e.surname].filter(Boolean).join(" ");

  if (!user) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  // ── Columns ───────────────────────────────────────────────────────────────────
  const columns: ColumnDef<LoanType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (loan) => (
        <div>
          <p className="font-medium text-sm text-gray-900">{loan.employee.full_name}</p>
          <p className="text-xs text-gray-400">{loan.employee.employee_number}</p>
        </div>
      ),
    },
    {
      key: "loan_type",
      header: "Type",
      cell: (loan) => <span className="text-sm capitalize">{loan.loan_type.name}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (loan) => <span className="font-medium text-sm">{fmtKES(loan.amount)}</span>,
    },
    {
      key: "balance_remaining",
      header: "Balance",
      cell: (loan) => (
        <span className={cn("text-sm", loan.status === "repaid" ? "text-gray-400 line-through" : "")}>
          {fmtKES(loan.balance_remaining)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (loan) => {
        const cfg = STATUS_CONFIG[loan.status as LoanStatus] ?? { label: loan.status, color: "bg-gray-100 text-gray-700" };
        return (
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", cfg.color)}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: "start_date",
      header: "Start",
      cell: (loan) =>
        new Date(loan.start_date).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" }),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (loan) => {
        const available = getAvailableActions(loan, userType);
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {/* View is always shown */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setViewLoan(loan); setDrawerOpen(true); }}
              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
              title="View details"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>

            {/* Workflow action buttons */}
            {available.map((action) => (
              <Button
                key={action}
                size="sm"
                variant="outline"
                onClick={() => openAction(loan, action)}
                className={actionButtonClass(action)}
                title={ACTION_LABELS[action]}
              >
                {action === "delete" ? <Trash2 className="h-3 w-3" /> : ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Loan Applications</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 border text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors",
                  showFilters ? "border-blue-400 text-blue-700 bg-blue-50" : "border-gray-200"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {hasActiveFilters && (
                  <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                    !
                  </span>
                )}
              </button>
              {canCreateLoan && (
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs h-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Loan
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Loan Type</label>
                  <select
                    value={selectedLoanType}
                    onChange={(e) => setSelectedLoanType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    disabled={loadingLoanTypes}
                  >
                    <option value="">All Types</option>
                    {loanTypes.map((lt) => <option key={lt.id} value={String(lt.id)}>{lt.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                        {new Date(2000, i).toLocaleString("default", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                  <input
                    type="number"
                    placeholder="e.g. 2025"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div className="flex items-end">
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <DataTable
            data={loans}
            columns={columns}
            pagination={{ page: filters.page ?? 1, limit: filters.per_page ?? 10, totalItems, totalPages }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            error={error}
            emptyMessage={hasActiveFilters ? "No loans match your filters." : "No loans found."}
          />
        </div>
      </div>

      {/* Workflow action dialog */}
      <LoanActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={dialogAction}
        loanAmount={selectedLoan ? fmtKES(selectedLoan.amount) : ""}
        employeeName={selectedLoan?.employee.full_name ?? ""}
        onConfirm={handleWorkflowAction}
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Employee <span className="text-red-500">*</span></label>
            <Select
              value={formData.employee_id ? String(formData.employee_id) : ""}
              onValueChange={(v) => { setFormData((f) => ({ ...f, employee_id: Number(v) })); setFormErrors((e) => ({ ...e, employee_id: "" })); }}
              disabled={createLoading || loadingEmployees}
            >
              <SelectTrigger className={cn("w-full", formErrors.employee_id && "border-red-500")}>
                <SelectValue placeholder={loadingEmployees ? "Loading…" : "Select employee"} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Employees</SelectLabel>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{empName(e)}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            {formErrors.employee_id && <p className="text-xs text-red-500">{formErrors.employee_id}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Loan Type <span className="text-red-500">*</span></label>
              <Select
                value={formData.config_id ? String(formData.config_id) : ""}
                onValueChange={(v) => { setFormData((f) => ({ ...f, config_id: Number(v) })); setFormErrors((e) => ({ ...e, config_id: "" })); }}
                disabled={createLoading || loadingLoanTypes}
              >
                <SelectTrigger className={cn("w-full", formErrors.config_id && "border-red-500")}>
                  <SelectValue placeholder={loadingLoanTypes ? "Loading…" : "Select type"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Loan Types</SelectLabel>
                    {loanTypes.map((lt) => <SelectItem key={lt.id} value={String(lt.id)}>{lt.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {formErrors.config_id && <p className="text-xs text-red-500">{formErrors.config_id}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Amount (KES) <span className="text-red-500">*</span></label>
              <input
                type="number" min="0" step="0.01" value={formData.amount}
                onChange={(e) => { setFormData((f) => ({ ...f, amount: e.target.value })); setFormErrors((er) => ({ ...er, amount: "" })); }}
                placeholder="e.g. 50000" disabled={createLoading}
                className={cn("w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", formErrors.amount ? "border-red-500" : "border-gray-300")}
              />
              {formErrors.amount && <p className="text-xs text-red-500">{formErrors.amount}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date" value={formData.start_date}
                onChange={(e) => { setFormData((f) => ({ ...f, start_date: e.target.value })); setFormErrors((er) => ({ ...er, start_date: "" })); }}
                disabled={createLoading}
                className={cn("w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", formErrors.start_date ? "border-red-500" : "border-gray-300")}
              />
              {formErrors.start_date && <p className="text-xs text-red-500">{formErrors.start_date}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">End Date <span className="text-gray-400 text-xs">(optional)</span></label>
              <input
                type="date" value={formData.end_date}
                onChange={(e) => setFormData((f) => ({ ...f, end_date: e.target.value }))}
                disabled={createLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Interest Rate % <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" min="0" step="0.01" value={formData.interest_rate} onChange={(e) => setFormData((f) => ({ ...f, interest_rate: e.target.value }))} placeholder="e.g. 10" disabled={createLoading} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Monthly Deduction <span className="text-gray-400 text-xs">(optional)</span></label>
              <input type="number" min="0" step="0.01" value={formData.monthly_deduction} onChange={(e) => setFormData((f) => ({ ...f, monthly_deduction: e.target.value }))} placeholder="e.g. 5000" disabled={createLoading} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Purpose <span className="text-gray-400 text-xs">(optional)</span></label>
            <textarea value={formData.purpose} onChange={(e) => setFormData((f) => ({ ...f, purpose: e.target.value }))} placeholder="Describe the purpose…" rows={2} disabled={createLoading} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      </LoanActionDialog>

      {/* Repayment dialog */}
      <LoanActionDialog
        open={repaymentDialogOpen}
        onOpenChange={setRepaymentDialogOpen}
        action="repayment"
        onConfirm={handleRecordRepayment}
        loading={repaymentLoading}
      >
        <div className="space-y-4">
          {repaymentLoan && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
              <p className="font-medium text-blue-900">{repaymentLoan.employee.full_name}</p>
              <p className="text-blue-700 text-xs mt-0.5">
                Balance remaining: <span className="font-semibold">{fmtKES(repaymentLoan.balance_remaining)}</span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Amount (KES) <span className="text-red-500">*</span></label>
            <input
              type="number" min="0" step="0.01" value={repaymentForm.amount}
              onChange={(e) => { setRepaymentForm((f) => ({ ...f, amount: e.target.value })); setRepaymentErrors((er) => ({ ...er, amount: "" })); }}
              disabled={repaymentLoading} placeholder="e.g. 5000"
              className={cn("w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", repaymentErrors.amount ? "border-red-500" : "border-gray-300")}
            />
            {repaymentErrors.amount && <p className="text-xs text-red-500">{repaymentErrors.amount}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Date <span className="text-red-500">*</span></label>
            <input
              type="date" value={repaymentForm.repayment_date}
              onChange={(e) => { setRepaymentForm((f) => ({ ...f, repayment_date: e.target.value })); setRepaymentErrors((er) => ({ ...er, repayment_date: "" })); }}
              disabled={repaymentLoading}
              className={cn("w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", repaymentErrors.repayment_date ? "border-red-500" : "border-gray-300")}
            />
            {repaymentErrors.repayment_date && <p className="text-xs text-red-500">{repaymentErrors.repayment_date}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Method</label>
            <Select value={repaymentForm.method} onValueChange={(v: "manual" | "payroll_deduction") => setRepaymentForm((f) => ({ ...f, method: v }))} disabled={repaymentLoading}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="payroll_deduction">Payroll Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Notes <span className="text-gray-400 text-xs">(optional)</span></label>
            <textarea value={repaymentForm.notes} onChange={(e) => setRepaymentForm((f) => ({ ...f, notes: e.target.value }))} rows={2} disabled={repaymentLoading} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      </LoanActionDialog>

      {/* View drawer */}
      <LoanViewDrawer open={drawerOpen} onOpenChange={setDrawerOpen} loan={viewLoan} />
    </>
  );
};

export default LoanTable;