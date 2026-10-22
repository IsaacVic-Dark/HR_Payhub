"use client";

import React, { useState, useMemo } from "react";
import { Eye, Inbox, Pencil, Send, X } from "lucide-react";
import {
  advanceAPI,
  AdvanceType,
  ActionPayload,
  STATUS_CONFIG,
  METHOD_LABELS,
  getAvailableActions,
  getStatusLabel,
  formatKES,
  formatDate,
} from "@/services/api/advance";
import { Button } from "@/components/ui/button";
import { AdvanceActionDialog } from "@/app/(dashboard)/advances/components/advance-action-dialog";
import { AdvanceViewDrawer } from "@/app/(dashboard)/advances/components/advance-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  ...Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label })),
];

interface MyAdvancesTableProps {
  advances: AdvanceType[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Open the request form pre-filled with a draft. */
  onEdit: (advance: AdvanceType) => void;
}

const MyAdvancesTable: React.FC<MyAdvancesTableProps> = ({
  advances,
  loading,
  error,
  onRefresh,
  onEdit,
}) => {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  // ── View drawer ──────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewAdvance, setViewAdvance] = useState<AdvanceType | null>(null);

  // ── Cancel dialog ────────────────────────────────────────────────────────────
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelAdvance, setCancelAdvance] = useState<AdvanceType | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Draft submit ─────────────────────────────────────────────────────────────
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // ── Filters / pagination (client-side) ───────────────────────────────────────
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => (selectedStatus ? advances.filter((a) => a.status === selectedStatus) : advances),
    [advances, selectedStatus]
  );

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCancel = async (payload: ActionPayload) => {
    if (!cancelAdvance || !orgId) return;
    setCancelLoading(true);
    const res = await advanceAPI.cancelAdvance(orgId, cancelAdvance.advance_id, payload.reason);
    setCancelLoading(false);

    if (res.success) {
      toast.success(res.message ?? "Advance request cancelled");
      setCancelOpen(false);
      onRefresh();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to cancel advance");
    }
  };

  const handleSubmitDraft = async (advance: AdvanceType) => {
    if (!orgId) return;
    setSubmittingId(advance.advance_id);
    const res = await advanceAPI.submitAdvance(orgId, advance.advance_id);
    setSubmittingId(null);

    if (res.success) {
      toast.success(res.message ?? "Advance request submitted for review");
      onRefresh();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to submit advance");
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns: ColumnDef<AdvanceType>[] = [
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
          <p className="text-sm font-medium">{formatKES(a.amount_requested)}</p>
          {a.amount_approved != null && Number(a.amount_approved) !== Number(a.amount_requested) && (
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
        // Self-service page → always evaluate as an employee.
        const available = getAvailableActions(a, "employee");
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

            {available.includes("edit") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(a)}
                className="h-7 px-2 text-xs"
                title="Edit draft"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}

            {available.includes("submit") && (
              <Button
                size="sm"
                variant="outline"
                disabled={submittingId === a.advance_id}
                onClick={() => handleSubmitDraft(a)}
                className="h-7 px-2 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                title="Submit for review"
              >
                <Send className="h-3 w-3 mr-1" />
                {submittingId === a.advance_id ? "Submitting…" : "Submit"}
              </Button>
            )}

            {available.includes("cancel") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCancelAdvance(a);
                  setCancelOpen(true);
                }}
                className="h-7 px-2 text-xs bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
                title="Cancel request"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
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
            <h2 className="text-base font-semibold text-gray-900">My Advances</h2>
            <div>
              <label className="sr-only">Filter by status</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!loading && !error && advances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <Inbox className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No advance requests yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Use the &quot;Request Advance&quot; button above to submit your first request.
              </p>
            </div>
          ) : (
            <DataTable
              data={paged}
              columns={columns}
              pagination={{ page, limit: PAGE_SIZE, totalItems, totalPages }}
              onPageChange={(p) => {
                if (p > 0 && p <= totalPages) setPage(p);
              }}
              onLimitChange={() => {}}
              loading={loading}
              error={error}
              emptyMessage={selectedStatus ? "No advances match this status." : "No advances found."}
            />
          )}
        </div>
      </div>

      <AdvanceViewDrawer open={drawerOpen} onOpenChange={setDrawerOpen} advance={viewAdvance} />

      <AdvanceActionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        action="cancel"
        advance={cancelAdvance}
        onConfirm={handleCancel}
        loading={cancelLoading}
      />
    </>
  );
};

export default MyAdvancesTable;