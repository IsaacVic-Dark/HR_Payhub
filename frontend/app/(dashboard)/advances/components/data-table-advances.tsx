"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Search, Plus, Eye } from "lucide-react";
import {
  advanceAPI,
  AdvanceType,
  AdvanceFilters,
  AdvanceAction,
  ActionPayload,
  AdvancePolicySettings,
  RepaymentRecord,
  STATUS_CONFIG,
  METHOD_LABELS,
  ACTION_LABELS,
  getAvailableActions,
  getStatusLabel,
  isAdminUser,
  formatKES,
  formatDate,
  DEFAULT_ADVANCE_POLICY_SETTINGS,
} from "@/services/api/advance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AdvanceActionDialog,
  type AdvanceDialogAction,
} from "@/app/(dashboard)/advances/components/advance-action-dialog";
import { AdvanceAttachDialog } from "@/app/(dashboard)/advances/components/advance-attach-dialog";
import { AdvanceViewDrawer } from "@/app/(dashboard)/advances/components/advance-view-drawer";
import { AdvanceRequestForm } from "@/app/(dashboard)/myadvances/components/advance-request-form";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  ...Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label })),
];

function actionButtonClass(action: AdvanceAction): string {
  const base = "h-7 px-2 text-xs border";
  switch (action) {
    case "approve":
      return `${base} bg-green-50 text-green-700 border-green-200 hover:bg-green-100`;
    case "reject":
      return `${base} bg-red-50 text-red-700 border-red-200 hover:bg-red-100`;
    case "disburse":
      return `${base} bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100`;
    case "repayment":
      return `${base} bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100`;
    case "reverse":
      return `${base} bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100`;
    case "attach":
      return `${base} bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100`;
    default:
      return `${base} bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100`;
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AdvanceTableProps {
  /** Called after any change (action, create) so the page can refresh its stat cards. */
  onChanged?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const AdvanceTable: React.FC<AdvanceTableProps> = ({ onChanged }) => {
  const { user } = useAuth();
  const userType = user?.user_type ?? "";
  const orgId = user?.organization_id;
  const isAdmin = isAdminUser(userType);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [advances, setAdvances] = useState<AdvanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [policy, setPolicy] = useState<AdvancePolicySettings | null>(null);

  // ── Dialogs / drawer ─────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<AdvanceDialogAction>("approve");
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewAdvance, setViewAdvance] = useState<AdvanceType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachAdvance, setAttachAdvance] = useState<AdvanceType | null>(null);
  const [repayments, setRepayments] = useState<RepaymentRecord[]>([]);

  // ── Filters / pagination ─────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AdvanceFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Debounce the employee-name search so we don't fetch on every keystroke.
  useEffect(() => {
    if (searchTerm === debouncedSearch) return; // nothing to do (e.g. first render)
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setFilters((f) => ({ ...f, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  // Policy → allowed disbursement methods for the disburse dialog.
  useEffect(() => {
    if (!orgId) return;
    advanceAPI.getPolicy(orgId).then((res) => {
      if (res.success && res.data?.settings) setPolicy(res.data.settings);
    });
  }, [orgId]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAdvances = useCallback(async () => {
    if (!orgId) {
      setError("No organisation ID. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await advanceAPI.getAdvances(orgId, {
        ...filters,
        name: debouncedSearch || undefined,
        status: selectedStatus || undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      });
      if (res.success && res.data) {
        setAdvances(res.data);
        setTotalItems(res.metadata?.pagination?.total ?? res.data.length);
        setTotalPages(res.metadata?.pagination?.total_pages ?? 1);
      } else {
        setAdvances([]);
        setTotalItems(0);
        setTotalPages(0);
        if (!res.message?.toLowerCase().includes("no advances"))
          setError(res.error ?? "Failed to fetch advances");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAdvances([]);
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, selectedStatus, selectedMonth, selectedYear, orgId]);

  useEffect(() => {
    if (orgId) fetchAdvances();
  }, [fetchAdvances, orgId]);

  const refreshAll = () => {
    fetchAdvances();
    onChanged?.();
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
  const openAction = async (advance: AdvanceType, action: AdvanceAction) => {
    // edit/submit are employee-side only.
    if (action === "edit" || action === "submit") return;

    // Recovery schedule has its own dialog (attach / detach payruns).
    if (action === "attach") {
      setAttachAdvance(advance);
      setAttachOpen(true);
      return;
    }

    // Reversal targets a single manual repayment, so load the history first.
    if (action === "reverse" && orgId) {
      const res = await advanceAPI.repaymentHistory(orgId, advance.advance_id);
      setRepayments(res.success && Array.isArray(res.data) ? res.data : []);
    }

    setSelectedAdvance(advance);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const handleWorkflowAction = async (payload: ActionPayload) => {
    if (!selectedAdvance || !orgId) return;
    const id = selectedAdvance.advance_id;
    const reason = payload.reason ?? "";

    setActionLoading(true);
    try {
      let res;
      switch (dialogAction) {
        case "approve":
          res = await advanceAPI.approveAdvance(orgId, id, {
            amount_approved: payload.amount_approved ? Number(payload.amount_approved) : undefined,
          });
          break;
        case "reject":
          res = await advanceAPI.rejectAdvance(orgId, id, reason);
          break;
        case "disburse":
          res = await advanceAPI.disburseAdvance(orgId, id, {
            disbursement_method: payload.disbursement_method,
            disbursement_reference: payload.disbursement_reference,
            disbursement_date: payload.disbursement_date,
          });
          break;
        case "cancel":
          res = await advanceAPI.cancelAdvance(orgId, id, reason);
          break;
        case "reverse":
          res = await advanceAPI.reverseRepayment(orgId, id, Number(payload.repayment_id), reason);
          break;
        case "repayment":
          res = await advanceAPI.recordRepayment(orgId, id, {
            amount: Number(payload.amount),
            repayment_date: payload.repayment_date ?? "",
            notes: payload.notes ?? null,
          });
          break;
        default:
          return;
      }

      if (res.success) {
        toast.success(res.message ?? "Action completed successfully");
        setDialogOpen(false);
        refreshAll();
      } else {
        toast.error(res.error ?? res.message ?? "Action failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filter helpers ───────────────────────────────────────────────────────────
  const resetPage = () => setFilters((f) => ({ ...f, page: 1 }));

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedStatus("");
    setSelectedMonth("");
    setSelectedYear("");
    resetPage();
  };

  const hasActiveFilters = searchTerm || selectedStatus || selectedMonth || selectedYear;

  if (!user) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns: ColumnDef<AdvanceType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (a) => (
        <div>
          <p className="font-medium text-sm text-gray-900">{a.employee.full_name}</p>
          <p className="text-xs text-gray-400">{a.employee.employee_number}</p>
        </div>
      ),
    },
    {
      key: "advance_number",
      header: "Advance No.",
      cell: (a) => <span className="text-sm font-mono">{a.advance_number}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (a) => (
        <div>
          <p className="font-medium text-sm">{formatKES(a.amount_requested)}</p>
          {a.amount_approved != null &&
            Number(a.amount_approved) !== Number(a.amount_requested) && (
              <p className="text-xs text-green-600">Approved {formatKES(a.amount_approved)}</p>
            )}
        </div>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      cell: (a) => (
        <span className={cn("text-sm", a.status === "repaid" && "text-gray-400 line-through")}>
          {formatKES(a.balance_remaining)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => {
        const cfg = STATUS_CONFIG[a.status] ?? { label: a.status, color: "bg-gray-100 text-gray-700" };
        return (
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", cfg.color)}>
            {getStatusLabel(a)}
          </span>
        );
      },
    },
    {
      key: "method",
      header: "Method",
      cell: (a) => (
        <span className="text-sm">{METHOD_LABELS[a.disbursement_method] ?? a.disbursement_method}</span>
      ),
    },
    {
      key: "request_date",
      header: "Requested",
      cell: (a) => formatDate(a.request_date),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (a) => {
        const available = getAvailableActions(a, userType);
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setViewAdvance(a);
                setDrawerOpen(true);
              }}
              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
              title="View details"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {available.map((action) => (
              <Button
                key={action}
                size="sm"
                variant="outline"
                onClick={() => openAction(a, action)}
                className={actionButtonClass(action)}
                title={ACTION_LABELS[action]}
              >
                {ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Advance Requests</h2>
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
              {isAdmin && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs h-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Advance
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      resetPage();
                    }}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      resetPage();
                    }}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All months</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {new Date(2000, i, 1).toLocaleString("en-KE", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                  <input
                    type="number"
                    placeholder="e.g. 2026"
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      resetPage();
                    }}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div className="flex items-end">
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <DataTable
            data={advances}
            columns={columns}
            pagination={{
              page: filters.page ?? 1,
              limit: filters.per_page ?? 10,
              totalItems,
              totalPages,
            }}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            onLimitChange={(per_page) => setFilters((f) => ({ ...f, per_page, page: 1 }))}
            loading={loading}
            error={error}
            emptyMessage={hasActiveFilters ? "No advances match your filters." : "No advances found."}
          />
        </div>
      </div>

      {/* View drawer */}
      <AdvanceViewDrawer open={drawerOpen} onOpenChange={setDrawerOpen} advance={viewAdvance} />

      {/* Workflow action dialog */}
      <AdvanceActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={dialogAction}
        advance={selectedAdvance}
        methodOptions={policy?.disbursement_methods ?? DEFAULT_ADVANCE_POLICY_SETTINGS.disbursement_methods}
        repayments={repayments}
        onConfirm={handleWorkflowAction}
        loading={actionLoading}
      />

      {/* Recovery schedule (attach / detach payruns) */}
      <AdvanceAttachDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        advance={attachAdvance}
        onChanged={refreshAll}
      />

      {/* Create (on behalf of an employee) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Advance</DialogTitle>
            <DialogDescription>
              Create an advance on behalf of an employee. It enters the normal validation and
              approval flow.
            </DialogDescription>
          </DialogHeader>
          <AdvanceRequestForm
            adminMode
            policy={policy}
            onSuccess={() => {
              setCreateOpen(false);
              refreshAll();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdvanceTable;