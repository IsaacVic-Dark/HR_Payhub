"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { DataTable, ColumnDef } from "@/components/table";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/currency";
import {
  Check,
  X,
  ArrowRightCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  overtimeApprovalAPI,
  OvertimeApprovalType,
  OvertimeApprovalStatus,
  MatchedPayrunSummary,
} from "@/services/api/overtime-approval";
import { payrunAPI } from "@/services/api/payrun";
import { organizationConfigAPI } from "@/services/api/organization-config";

const STATUS_TABS: OvertimeApprovalStatus[] = ["pending", "approved", "rejected"];

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  deleted_pending: "bg-gray-50 text-gray-700 border-gray-200",
};

const RESOLUTION_LABEL: Record<string, string> = {
  off_cycle: "Off-cycle adjustment",
  carry_forward: "Carried forward",
};

function needsResolution(item: OvertimeApprovalType) {
  return (
    item.status === "approved" &&
    !!item.finalized_period_payrun_id &&
    !item.resolution &&
    !item.salary_included
  );
}

function employeeName(item: OvertimeApprovalType) {
  return [item.firstname, item.middlename, item.surname].filter(Boolean).join(" ");
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatHours(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function OvertimeApprovalsPage() {
  const { user } = useAuth();
  const { canManageOvertimeApprovals } = usePermissions();

  const [statusFilter, setStatusFilter] = useState<OvertimeApprovalStatus>("pending");
  const [items, setItems] = useState<OvertimeApprovalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approve dialog
  const [approveTarget, setApproveTarget] = useState<OvertimeApprovalType | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [overtimeRateInput, setOvertimeRateInput] = useState("");
  const [approvalNotesInput, setApprovalNotesInput] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<OvertimeApprovalType | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  // Resolve dialog
  const [resolveTarget, setResolveTarget] = useState<OvertimeApprovalType | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [matchedPayrun, setMatchedPayrun] = useState<MatchedPayrunSummary | null>(null);
  const [matchedPayrunLoading, setMatchedPayrunLoading] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<
    "off_cycle" | "carry_forward" | null
  >(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [defaultOvertimeRate, setDefaultOvertimeRate] = useState<string>("");

  const fetchApprovals = async (status: OvertimeApprovalStatus) => {
    if (!user?.organization_id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await overtimeApprovalAPI.getOvertimeApprovals(
        user.organization_id,
        status,
      );
      if (response.success && response.data) {
        setItems(Array.isArray(response.data) ? response.data : []);
      } else {
        setError(response.error || "Failed to fetch overtime approvals");
        setItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.organization_id) return;
    organizationConfigAPI.getOrganizationConfigs(user.organization_id).then((res) => {
      if (res.success && res.data) {
        const rate = res.data.find(
          (c) => c.config_type === "attendance" && c.name === "Overtime Rate",
        );
        if (rate?.fixed_amount != null) {
          setDefaultOvertimeRate(rate.fixed_amount.toString());
        }
      }
    });
  }, [user?.organization_id]);

  useEffect(() => {
    fetchApprovals(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.organization_id, statusFilter]);

  // ---- Approve flow ----
  const openApproveDialog = (item: OvertimeApprovalType) => {
    setApproveTarget(item);
    setOvertimeRateInput(defaultOvertimeRate); // was: ""
    setApprovalNotesInput("");
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!user?.organization_id || !approveTarget) return;
    setApproveLoading(true);
    try {
      const response = await overtimeApprovalAPI.approveOvertime(
        user.organization_id,
        approveTarget.id,
        {
          overtime_rate: overtimeRateInput ? parseFloat(overtimeRateInput) : undefined,
          approval_notes: approvalNotesInput || undefined,
        },
      );

      if (response.success && response.data) {
        setApproveDialogOpen(false);

        if (response.data.requires_resolution && response.data.matched_payrun) {
          // Its pay period is already locked — jump straight into the resolve dialog
          toast.warning(response.message || "This overtime's pay period is already locked.");
          setResolveTarget(response.data);
          setMatchedPayrun(response.data.matched_payrun);
          setSelectedResolution(null);
          setResolveDialogOpen(true);
        } else {
          toast.success(response.message || "Overtime approved");
        }

        fetchApprovals(statusFilter);
      } else {
        toast.error(response.error || response.message || "Failed to approve overtime");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setApproveLoading(false);
    }
  };

  // ---- Reject flow ----
  const openRejectDialog = (item: OvertimeApprovalType) => {
    setRejectTarget(item);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!user?.organization_id || !rejectTarget || !rejectionReason.trim()) return;
    setRejectLoading(true);
    try {
      const response = await overtimeApprovalAPI.rejectOvertime(
        user.organization_id,
        rejectTarget.id,
        rejectionReason.trim(),
      );
      if (response.success) {
        toast.success(response.message || "Overtime rejected");
        setRejectDialogOpen(false);
        fetchApprovals(statusFilter);
      } else {
        toast.error(response.error || response.message || "Failed to reject overtime");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setRejectLoading(false);
    }
  };

  // ---- Resolve flow (off-cycle / carry-forward) ----
  const openResolveDialog = async (item: OvertimeApprovalType) => {
    setResolveTarget(item);
    setSelectedResolution(null);
    setMatchedPayrun(null);
    setResolveDialogOpen(true);

    if (!item.finalized_period_payrun_id || !user?.organization_id) return;

    setMatchedPayrunLoading(true);
    try {
      const res = await payrunAPI.getPayrunById(
        user.organization_id,
        item.finalized_period_payrun_id,
      );
      if (res.success && res.data) {
        setMatchedPayrun({
          id: res.data.id,
          name: res.data.payrun_name,
          status: res.data.status,
        });
      }
    } finally {
      setMatchedPayrunLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!user?.organization_id || !resolveTarget || !selectedResolution) return;
    setResolveLoading(true);
    try {
      const response = await overtimeApprovalAPI.resolveOvertime(
        user.organization_id,
        resolveTarget.id,
        selectedResolution,
      );
      if (response.success && response.data) {
        toast.success(response.data.message || response.message || "Overtime resolved");
        setResolveDialogOpen(false);
        fetchApprovals(statusFilter);
      } else {
        toast.error(response.error || response.message || "Failed to resolve overtime");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setResolveLoading(false);
    }
  };

  const offCycleAvailable = matchedPayrun?.status === "finalized";

  const columns: ColumnDef<OvertimeApprovalType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (item) => (
        <div>
          <p className="font-medium">{employeeName(item)}</p>
          <p className="text-xs text-gray-500">{item.employee_number}</p>
        </div>
      ),
    },
    {
      key: "attendance_date",
      header: "Date",
      cell: (item) => formatDate(item.attendance_date),
    },
    {
      key: "overtime",
      header: "Overtime",
      cell: (item) => (
        <div>
          <p className="font-medium">{formatHours(item.overtime_minutes)}</p>
          {item.overtime_amount != null && (
            <p className="text-xs text-gray-500">{formatCurrency(item.overtime_amount)}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (item) => (
        <div className="flex flex-col gap-1 items-start">
          <span
            className={`px-2 py-0.5 rounded-full border text-xs capitalize ${STATUS_BADGE_CLASS[item.status] || "bg-gray-50 text-gray-700 border-gray-200"
              }`}
          >
            {item.status.replace("_", " ")}
          </span>
          {needsResolution(item) && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs">
              <AlertTriangle className="w-3 h-3" /> Needs resolution
            </span>
          )}
        </div>
      ),
    },
    {
      key: "resolution",
      header: "Resolution",
      cell: (item) =>
        item.resolution ? (
          <span className="text-xs text-gray-700">{RESOLUTION_LABEL[item.resolution]}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (item) => {
        if (!canManageOvertimeApprovals) return <span className="text-xs text-gray-400">—</span>;

        if (item.status === "pending") {
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={() => openApproveDialog(item)}
                className="p-1.5 rounded-md text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Approve"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => openRejectDialog(item)}
                className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Reject"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        }

        if (needsResolution(item)) {
          return (
            <button
              onClick={() => openResolveDialog(item)}
              className="flex items-center gap-1 px-2 py-1 border border-amber-600 text-amber-600 rounded-md text-xs hover:bg-amber-50"
            >
              <ArrowRightCircle className="w-3.5 h-3.5" /> Resolve
            </button>
          );
        }

        return <span className="text-xs text-gray-400">—</span>;
      },
    },
  ];

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

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="mt-4 mx-6 space-y-2">
            <h1 className="text-2xl font-medium">Overtime Approvals</h1>
            <p className="text-base text-muted-foreground">
              Review, approve, and resolve employee overtime requests
            </p>
          </div>
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="w-full mx-auto p-4 bg-white">
              <div className="rounded-lg shadow-sm border p-4">
                <DataTable
                  data={items}
                  columns={columns}
                  tableTitle="Overtime Requests"
                  filters={
                    <div className="flex items-center gap-1">
                      {STATUS_TABS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`px-3 py-1.5 rounded-md text-xs border capitalize transition-colors ${statusFilter === s
                              ? "bg-blue-600 text-white border-blue-600"
                              : "text-gray-600 border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  }
                  loading={loading}
                  error={error}
                  emptyMessage={`No ${statusFilter} overtime requests found`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Overtime</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {approveTarget && (
              <div className="rounded-md border bg-gray-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Employee</span>
                  <span className="font-medium text-gray-900">{employeeName(approveTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-gray-900">{formatDate(approveTarget.attendance_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Overtime</span>
                  <span className="font-medium text-gray-900">{formatHours(approveTarget.overtime_minutes)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="overtime-rate" className="text-xs text-gray-600">
                Overtime rate (optional — currency per hour)
              </Label>
              <Input
                id="overtime-rate"
                type="number"
                step="0.01"
                placeholder="e.g. 250.00"
                value={overtimeRateInput}
                onChange={(e) => setOvertimeRateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approval-notes" className="text-xs text-gray-600">
                Notes (optional)
              </Label>
              <Textarea
                id="approval-notes"
                rows={2}
                className="text-sm"
                value={approvalNotesInput}
                onChange={(e) => setApprovalNotesInput(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={approveLoading}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {approveLoading ? "Approving..." : "Confirm Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Overtime</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {rejectTarget && (
              <div className="rounded-md border bg-gray-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Employee</span>
                  <span className="font-medium text-gray-900">{employeeName(rejectTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-gray-900">{formatDate(rejectTarget.attendance_date)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="rejection-reason" className="text-xs text-gray-600">
                Rejection reason (required)
              </Label>
              <Textarea
                id="rejection-reason"
                rows={2}
                className="text-sm"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectLoading || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {rejectLoading ? "Rejecting..." : "Confirm Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolve dialog — off-cycle vs carry-forward */}
      <AlertDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve Locked-Period Overtime</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {resolveTarget && (
              <div className="rounded-md border bg-gray-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Employee</span>
                  <span className="font-medium text-gray-900">{employeeName(resolveTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Overtime amount</span>
                  <span className="font-medium text-gray-900">
                    {resolveTarget.overtime_amount != null
                      ? formatCurrency(resolveTarget.overtime_amount)
                      : "—"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
              <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                {matchedPayrunLoading ? (
                  "Checking the original pay period…"
                ) : matchedPayrun ? (
                  <>
                    This overtime's attendance date falls inside{" "}
                    <strong>{matchedPayrun.name}</strong>, which is already{" "}
                    <strong>{matchedPayrun.status}</strong>.
                  </>
                ) : (
                  "Unable to load the original pay period."
                )}
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={!offCycleAvailable}
                onClick={() => setSelectedResolution("off_cycle")}
                className={`w-full text-left rounded-md border p-3 text-sm transition-colors ${selectedResolution === "off_cycle"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                  } ${!offCycleAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <p className="font-medium text-gray-900">Off-cycle adjustment</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {offCycleAvailable
                    ? "Creates a separate adjustment payrun for just this overtime's incremental pay."
                    : "Only available once the original payrun is finalized."}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedResolution("carry_forward")}
                className={`w-full text-left rounded-md border p-3 text-sm transition-colors ${selectedResolution === "carry_forward"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                  }`}
              >
                <p className="font-medium text-gray-900">Carry forward to next payrun</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Adds this overtime into the next regular draft payrun instead.
                </p>
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolveLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResolve}
              disabled={resolveLoading || !selectedResolution}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {resolveLoading ? "Resolving..." : "Confirm Resolution"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}