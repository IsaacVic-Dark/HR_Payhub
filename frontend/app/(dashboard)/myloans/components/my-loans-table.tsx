"use client";

import React, { useState, useMemo } from "react";
import { Eye, Gavel, Inbox } from "lucide-react";
import {
  loanAPI,
  LoanType,
  STATUS_CONFIG,
  LoanStatus,
  REJECTED_STATUSES,
  getAvailableActions,
  ActionPayload,
} from "@/services/api/loan";
import { Button } from "@/components/ui/button";
import { LoanActionDialog } from "@/app/(dashboard)/loans/components/loan-action-dialog";
import { LoanViewDrawer } from "@/app/(dashboard)/loans/components/loan-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtKES = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
      }).format(v);

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "",                  label: "All Statuses" },
  { value: "pending",           label: "Pending" },
  { value: "validated",         label: "Awaiting Manager" },
  { value: "manager_approved",  label: "Awaiting HR" },
  { value: "hr_approved",       label: "Awaiting Finance" },
  { value: "finance_approved",  label: "Awaiting Disbursement" },
  { value: "approved",          label: "Approved" },
  { value: "active",            label: "Active" },
  { value: "repaid",            label: "Fully Repaid" },
  { value: "compliance_review", label: "Compliance Review" },
  { value: "appealed",          label: "Under Appeal" },
  { value: "system_rejected",   label: "System Rejected" },
  { value: "manager_rejected",  label: "Manager Rejected" },
  { value: "hr_rejected",       label: "HR Rejected" },
  { value: "finance_rejected",  label: "Finance Rejected" },
  { value: "rejected",          label: "Rejected" },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MyLoansTableProps {
  loans: LoanType[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const MyLoansTable: React.FC<MyLoansTableProps> = ({ loans, loading, error, onRefresh }) => {
  const { user } = useAuth();
  const userType = user?.user_type ?? "employee";

  // ── View drawer ─────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewLoan, setViewLoan] = useState<LoanType | null>(null);

  // ── Appeal dialog ────────────────────────────────────────────────────────────
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealLoan, setAppealLoan] = useState<LoanType | null>(null);
  const [appealLoading, setAppealLoading] = useState(false);

  // ── Filters / pagination (client-side) ───────────────────────────────────────
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);

  const filteredLoans = useMemo(() => {
    if (!selectedStatus) return loans;
    return loans.filter((l) => l.status === selectedStatus);
  }, [loans, selectedStatus]);

  const totalItems = filteredLoans.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pagedLoans = useMemo(
    () => filteredLoans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredLoans, page]
  );

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setPage(1);
  };

  // ── Appeal ───────────────────────────────────────────────────────────────────
  const openAppeal = (loan: LoanType) => {
    setAppealLoan(loan);
    setAppealOpen(true);
  };

  const handleSubmitAppeal = async (payload?: ActionPayload) => {
    if (!appealLoan || !user?.organization_id) return;
    const reason = payload?.reason?.trim();
    if (!reason) {
      toast.error("Please provide a reason for your appeal.");
      return;
    }

    setAppealLoading(true);
    const res = await loanAPI.submitAppeal(user.organization_id, appealLoan.loan_id, {
      appeal_reason: reason,
    });
    setAppealLoading(false);

    if (res.success) {
      toast.success(res.message ?? "Appeal submitted for HR review");
      setAppealOpen(false);
      onRefresh();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to submit appeal");
    }
  };

  // ── Columns ───────────────────────────────────────────────────────────────────
  const columns: ColumnDef<LoanType>[] = [
    {
      key: "loan_type",
      header: "Loan Type",
      cell: (loan) => <span className="text-sm font-medium capitalize">{loan.loan_type.name}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (loan) => <span className="text-sm font-medium">{fmtKES(loan.amount)}</span>,
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
      header: "Start Date",
      cell: (loan) =>
        new Date(loan.start_date).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" }),
    },
    {
      key: "monthly_deduction",
      header: "Monthly Deduction",
      cell: (loan) => <span className="text-sm">{fmtKES(loan.monthly_deduction)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (loan) => {
        // appeal availability mirrors getAvailableActions("employee", ...) but is
        // computed generically here in case userType isn't strictly "employee"
        // (e.g. an admin viewing their own loans through this component).
        const canAppeal = getAvailableActions(loan, userType).includes("appeal");
        const alreadyAppealed = loan.status === "appealed";

        return (
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setViewLoan(loan); setDrawerOpen(true); }}
              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
              title="View details"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>

            {canAppeal && !alreadyAppealed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAppeal(loan)}
                className="h-7 px-2 text-xs bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                title="Submit Appeal"
              >
                <Gavel className="h-3 w-3 mr-1" />
                Appeal
              </Button>
            )}

            {alreadyAppealed && (
              <span className="text-xs text-orange-600 font-medium">Appeal pending</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">My Loans</h2>
            <div>
              <label className="sr-only">Filter by status</label>
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {!loading && !error && loans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <Inbox className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No loan applications yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Use the &quot;Apply for Loan&quot; button above to submit your first application.
              </p>
            </div>
          ) : (
            <DataTable
              data={pagedLoans}
              columns={columns}
              pagination={{ page, limit: PAGE_SIZE, totalItems, totalPages }}
              onPageChange={(p) => { if (p > 0 && p <= totalPages) setPage(p); }}
              onLimitChange={() => {}}
              loading={loading}
              error={error}
              emptyMessage={selectedStatus ? "No loans match this status." : "No loans found."}
            />
          )}
        </div>
      </div>

      {/* View drawer */}
      <LoanViewDrawer open={drawerOpen} onOpenChange={setDrawerOpen} loan={viewLoan} />

      {/* Appeal dialog */}
      <LoanActionDialog
        open={appealOpen}
        onOpenChange={setAppealOpen}
        action="appeal"
        loanAmount={appealLoan ? fmtKES(appealLoan.amount) : ""}
        employeeName={appealLoan?.employee.full_name ?? ""}
        onConfirm={handleSubmitAppeal}
        loading={appealLoading}
      />
    </>
  );
};

export default MyLoansTable;