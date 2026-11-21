"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { DataTable, ColumnDef } from "@/components/table";
import { Button } from "@/components/ui/button";
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
import { OvertimeRequestDialog } from "@/components/overtime-request-dialog";
import { overtimeRequestAPI } from "@/services/api/overtime-request";
import type { OvertimeApprovalType } from "@/services/api/overtime-approval";
import { useAuth } from "@/lib/AuthContext";

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  deleted_pending: "bg-gray-50 text-gray-700 border-gray-200",
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// "2026-11-10 18:30:00" -> "18:30"
const hhmm = (dt?: string | null) => (dt ? dt.slice(11, 16) : "");

export default function MyOvertimePage() {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? 0;
  const employeeId = user?.employee?.id ?? 0;

  const [items, setItems] = useState<OvertimeApprovalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const [withdrawTarget, setWithdrawTarget] = useState<OvertimeApprovalType | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!orgId || !employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await overtimeRequestAPI.getMyRequests(orgId);
    if (res.success && res.data) {
      setItems(Array.isArray(res.data) ? res.data : []);
    } else {
      setItems([]);
      setError(res.error || "Failed to fetch your overtime");
    }
    setLoading(false);
  }, [orgId, employeeId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleWithdraw = async () => {
    if (!withdrawTarget || !orgId) return;
    setWithdrawLoading(true);
    const res = await overtimeRequestAPI.withdrawRequest(orgId, withdrawTarget.id);
    setWithdrawLoading(false);
    if (res.success) {
      toast.success(res.message || "Overtime request withdrawn");
      setWithdrawTarget(null);
      fetchItems();
    } else {
      toast.error(res.error || res.message || "Failed to withdraw request");
    }
  };

  // ---- Summary cards (derived client-side) ----------------------------------
  const pending = items.filter((i) => i.status === "pending");
  const approved = items.filter((i) => i.status === "approved");
  const rejected = items.filter((i) => i.status === "rejected");
  const sumMinutes = (list: OvertimeApprovalType[]) =>
    list.reduce((s, i) => s + (Number(i.overtime_minutes) || 0), 0);

  const cardDetails: CardDetail[] = [
    {
      title: "Pending",
      value: pending.length.toString(),
      change: pending.length ? formatDuration(sumMinutes(pending)) : "—",
      changeIcon: null,
      description: "Requests awaiting approval.",
      footerText: "Decided by an administrator",
    },
    {
      title: "Approved",
      value: approved.length.toString(),
      change: approved.length ? formatDuration(sumMinutes(approved)) : "—",
      changeIcon: null,
      description: "Overtime approved for payment.",
      footerText: "Added to payroll after approval",
    },
    {
      title: "Rejected",
      value: rejected.length.toString(),
      change: rejected.length ? formatDuration(sumMinutes(rejected)) : "—",
      changeIcon: null,
      description: "Requests that were not approved.",
      footerText: "See the reason in the table",
    },
  ];

  const columns: ColumnDef<OvertimeApprovalType>[] = [
    {
      key: "date",
      header: "Date",
      cell: (item) => formatDate(item.attendance_date),
    },
    {
      key: "window",
      header: "Time",
      cell: (item) =>
        item.overtime_start && item.overtime_end ? (
          <span className="text-sm">
            {hhmm(item.overtime_start)} – {hhmm(item.overtime_end)}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: "duration",
      header: "Duration",
      cell: (item) => <span className="font-medium">{formatDuration(item.overtime_minutes)}</span>,
    },
    {
      key: "source",
      header: "Source",
      cell: (item) => (
        <span className="text-xs text-gray-700">
          {item.source === "manual" ? "Requested" : "From attendance"}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (item) =>
        item.reason ? (
          <span className="block max-w-[240px] truncate text-sm" title={item.reason}>
            {item.reason}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (item) => (
        <div className="flex flex-col gap-1 items-start">
          <span
            className={`px-2 py-0.5 rounded-full border text-xs capitalize ${
              STATUS_BADGE_CLASS[item.status] || "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            {item.status.replace("_", " ")}
          </span>
          {item.status === "rejected" && item.rejection_reason && (
            <span className="max-w-[220px] text-xs text-red-600" title={item.rejection_reason}>
              {item.rejection_reason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (item) =>
        item.source === "manual" && item.status === "pending" ? (
          <button
            onClick={() => setWithdrawTarget(item)}
            className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-700 rounded-md text-xs hover:bg-gray-50"
          >
            <Undo2 className="w-3.5 h-3.5" /> Withdraw
          </button>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">My Overtime</h1>
            <p className="text-sm text-muted-foreground">
              Request overtime you have worked and track its approval.
            </p>
          </div>
          <Button onClick={() => setRequestOpen(true)} className="flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            Request Overtime
          </Button>
        </div>

        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards details={cardDetails} />
          <div className="w-full mx-auto p-4 bg-white">
            <div className="rounded-lg shadow-sm border p-4">
              <DataTable
                data={items}
                columns={columns}
                tableTitle="My Overtime"
                loading={loading}
                error={error}
                emptyMessage="You have no overtime records yet"
              />
            </div>
          </div>
        </div>
      </div>

      <OvertimeRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        organizationId={orgId}
        mode="self"
        currentEmployeeId={employeeId || null}
        onSuccess={fetchItems}
      />

      <AlertDialog open={!!withdrawTarget} onOpenChange={(o) => !o && setWithdrawTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {withdrawTarget
                ? `Your ${formatDuration(withdrawTarget.overtime_minutes)} overtime request for ${formatDate(
                    withdrawTarget.attendance_date,
                  )} will be removed. You can submit a new one afterwards.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawLoading}>Keep request</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleWithdraw();
              }}
              disabled={withdrawLoading}
            >
              {withdrawLoading ? "Withdrawing..." : "Withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
