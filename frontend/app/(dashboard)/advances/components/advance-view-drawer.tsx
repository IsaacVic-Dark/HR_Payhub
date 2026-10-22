"use client";

import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  advanceAPI,
  AdvanceType,
  RepaymentRecord,
  STATUS_CONFIG,
  STAGE_LABELS,
  METHOD_LABELS,
  REJECTED_STATUSES,
  getStatusLabel,
  formatKES,
  formatDate,
  formatDateTime,
} from "@/services/api/advance";
import {
  Wallet,
  User,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Banknote,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

interface AdvanceViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advance: AdvanceType | null;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Workflow timeline ─────────────────────────────────────────────────────────

type StepState = "done" | "rejected" | "skipped" | "active" | "pending";

interface TimelineStep {
  label: string;
  sublabel?: string;
  state: StepState;
  timestamp?: string | null;
}

function WorkflowTimeline({ steps }: { steps: TimelineStep[] }) {
  const iconFor = (state: StepState) => {
    if (state === "done") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (state === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    if (state === "skipped") return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
    if (state === "active")
      return <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-white animate-pulse" />;
    return <div className="h-4 w-4 rounded-full border-2 border-gray-300 bg-white" />;
  };

  const labelColor: Record<StepState, string> = {
    done: "text-gray-900",
    rejected: "text-red-600",
    skipped: "text-gray-400",
    active: "text-blue-700 font-semibold",
    pending: "text-gray-400",
  };

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="mt-0.5">{iconFor(step.state)}</div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-px flex-1 min-h-[20px] mt-1",
                  step.state === "done" ? "bg-green-300" : "bg-gray-200"
                )}
              />
            )}
          </div>
          <div className="pb-4">
            <p className={cn("text-sm leading-tight", labelColor[step.state])}>{step.label}</p>
            {step.sublabel && <p className="text-xs text-gray-500 mt-0.5">{step.sublabel}</p>}
            {step.timestamp && <p className="text-xs text-gray-400 mt-0.5">{step.timestamp}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Builds the timeline from `workflow_stages` + `approvals` + `current_stage`,
 * so it adapts to the org's policy (e.g. finance step only above threshold).
 */
function buildSteps(advance: AdvanceType): TimelineStep[] {
  const s = advance.status;
  const approvals = advance.approvals ?? [];
  const stages = advance.workflow_stages ?? [];
  const steps: TimelineStep[] = [];

  // 1. Submission
  steps.push({
    label: s === "draft" ? "Draft — not yet submitted" : "Request submitted",
    state: s === "system_rejected" ? "rejected" : s === "draft" ? "active" : "done",
    timestamp: formatDateTime(advance.created_at),
    sublabel:
      s === "system_rejected"
        ? advance.system_rejection_reason ?? "System validation failed"
        : undefined,
  });

  // 2. Approval stages
  const approvalFinished = ["approved", "scheduled", "disbursed", "partially_recovered", "repaid", "failed", "reversed"].includes(s);

  stages.forEach((stage) => {
    const rec = approvals.find((a) => a.stage === stage);
    let state: StepState = "pending";

    if (rec?.status === "approved") state = "done";
    else if (rec?.status === "rejected") state = "rejected";
    else if ((s === "pending" || s === "validated") && advance.current_stage === stage) state = "active";
    else if (approvalFinished) state = "done";

    const who = rec?.approver_name ? `By ${rec.approver_name}` : undefined;
    const comment = rec?.comments ?? undefined;

    steps.push({
      label: `${STAGE_LABELS[stage]} approval`,
      state,
      timestamp: formatDateTime(rec?.acted_at),
      sublabel: [who, comment].filter(Boolean).join(" — ") || undefined,
    });
  });

  // 3. Disbursement
  const disbursedStates = ["disbursed", "partially_recovered", "repaid", "reversed"];
  steps.push({
    label: "Disbursement",
    state:
      s === "failed"
        ? "rejected"
        : disbursedStates.includes(s)
        ? "done"
        : s === "approved" || s === "scheduled"
        ? "active"
        : "pending",
    timestamp: formatDateTime(advance.disbursed_at),
    sublabel:
      s === "failed"
        ? "Disbursement failed — retry from the actions menu"
        : advance.disbursement_date
        ? `${METHOD_LABELS[advance.disbursement_method]} · ${formatDate(advance.disbursement_date)}${
            advance.disbursement_reference ? ` · Ref ${advance.disbursement_reference}` : ""
          }`
        : s === "scheduled"
        ? "Scheduled for payroll"
        : undefined,
  });

  // 4. Terminal side-branches
  if (s === "cancelled") {
    steps.push({
      label: "Cancelled",
      state: "rejected",
      timestamp: formatDateTime(advance.cancelled_at),
      sublabel: advance.cancellation_reason ?? undefined,
    });
  }
  if (s === "reversed") {
    steps.push({ label: "Reversed", state: "rejected" });
  }

  return steps;
}

// ─── Repayments tab ────────────────────────────────────────────────────────────

const REPAY_STATUS_COLOR: Record<RepaymentRecord["status"], string> = {
  applied: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  reversed: "bg-orange-100 text-orange-800",
};

const REPAY_METHOD_LABEL: Record<RepaymentRecord["method"], string> = {
  payroll_deduction: "Payroll deduction",
  manual: "Manual",
  reversal: "Reversal",
};

function RepaymentsTab({ advance, active }: { advance: AdvanceType; active: boolean }) {
  const { user } = useAuth();
  const orgId = user?.organization_id;
  const [rows, setRows] = useState<RepaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    advanceAPI.repaymentHistory(orgId, advance.advance_id).then((res) => {
      if (cancelled) return;
      if (res.success) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.repayments ?? [];
        setRows(list);
      } else {
        setRows([]);
        setError(res.error ?? "Failed to load repayment history");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [active, orgId, advance.advance_id, advance.amount_recovered]);

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">Loading repayments…</div>;
  }
  if (error) {
    return <div className="py-10 text-center text-sm text-red-600">{error}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="h-10 w-10 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-2">
          <Banknote className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700">No repayments yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Payroll deductions and manual payments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="p-3 border border-gray-100 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{formatKES(r.amount)}</p>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] font-medium capitalize",
                REPAY_STATUS_COLOR[r.status]
              )}
            >
              {r.status}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
            <span>
              {formatDate(r.repayment_date)} · {REPAY_METHOD_LABEL[r.method]}
            </span>
            <span>Balance after: {formatKES(r.balance_after)}</span>
          </div>
          {(r.notes || r.recorded_by_name) && (
            <p className="text-xs text-gray-400 mt-1">
              {[r.recorded_by_name && `Recorded by ${r.recorded_by_name}`, r.notes]
                .filter(Boolean)
                .join(" — ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AdvanceViewDrawer({ open, onOpenChange, advance }: AdvanceViewDrawerProps) {
  const [tab, setTab] = useState("details");

  // Always land on Details when a different advance is opened.
  useEffect(() => {
    if (open) setTab("details");
  }, [open, advance?.advance_id]);

  if (!advance) return null;

  const statusCfg = STATUS_CONFIG[advance.status] ?? {
    label: advance.status,
    color: "bg-gray-100 text-gray-700",
  };

  const requested = Number(advance.amount_requested);
  const approved = advance.amount_approved != null ? Number(advance.amount_approved) : null;
  const disbursed = Number(advance.amount_disbursed);
  const recovered = Number(advance.amount_recovered);
  const recoveryPct = disbursed > 0 ? Math.min(100, Math.round((recovered / disbursed) * 100)) : 0;
  const perRecovery =
    advance.number_of_recoveries > 0
      ? (approved ?? requested) / advance.number_of_recoveries
      : null;

  const bannerReason = REJECTED_STATUSES.includes(advance.status)
    ? advance.status === "system_rejected"
      ? advance.system_rejection_reason
      : advance.rejection_reason
    : advance.status === "cancelled"
    ? advance.cancellation_reason
    : null;

  const showRecovery = ["disbursed", "partially_recovered", "repaid"].includes(advance.status);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-[420px] max-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        {/* Header */}
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-base font-semibold">{advance.advance_number}</DrawerTitle>
              <DrawerDescription className="text-sm text-gray-500">
                {advance.employee.full_name}
              </DrawerDescription>
            </div>
            <Badge className={cn("shrink-0 text-xs", statusCfg.color)}>
              {getStatusLabel(advance)}
            </Badge>
          </div>
        </DrawerHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-4 self-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="repayments">Repayments</TabsTrigger>
          </TabsList>

          {/* ── Details ── */}
          <TabsContent value="details" className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Amount hero */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 rounded-xl text-center">
                <p className="text-xs text-blue-600 font-medium">
                  {approved != null ? "Approved" : "Requested"}
                </p>
                <p className="text-base font-bold text-blue-900 mt-0.5">
                  {formatKES(approved ?? requested)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-center">
                <p className="text-xs text-amber-600 font-medium">Outstanding</p>
                <p className="text-base font-bold text-amber-900 mt-0.5">
                  {formatKES(advance.balance_remaining)}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl text-center">
                <p className="text-xs text-green-600 font-medium">Recovered</p>
                <p className="text-base font-bold text-green-900 mt-0.5">{formatKES(recovered)}</p>
              </div>
            </div>

            {/* Recovery progress */}
            {showRecovery && (
              <Section title="Recovery Progress" icon={<TrendingUp className="h-4 w-4 text-gray-500" />}>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{formatKES(recovered)} recovered</span>
                    <span className="font-medium text-gray-700">{recoveryPct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${recoveryPct}%` }}
                    />
                  </div>
                </div>
              </Section>
            )}

            {/* Timeline */}
            <Section title="Approval Progress" icon={<Clock className="h-4 w-4 text-gray-500" />}>
              <WorkflowTimeline steps={buildSteps(advance)} />
            </Section>

            {/* Rejection / cancellation banner */}
            {bannerReason && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <div>
                  <p className="font-medium mb-0.5">
                    {advance.status === "cancelled" ? "Cancellation reason" : "Rejection reason"}
                  </p>
                  <p>{bannerReason}</p>
                </div>
              </div>
            )}

            {/* Employee */}
            <Section title="Employee" icon={<User className="h-4 w-4 text-gray-500" />}>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Full name" value={advance.employee.full_name} />
                <InfoRow label="Employee no." value={advance.employee.employee_number} />
                <InfoRow label="Email" value={advance.employee.email ?? "—"} />
                <InfoRow label="Employee ID" value={`#${advance.employee.id}`} />
              </div>
            </Section>

            {/* Advance details */}
            <Section title="Advance Details" icon={<Wallet className="h-4 w-4 text-gray-500" />}>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Advance no." value={advance.advance_number} />
                <InfoRow label="Request date" value={formatDate(advance.request_date)} />
                <InfoRow label="Amount requested" value={formatKES(requested)} />
                <InfoRow label="Amount approved" value={formatKES(approved)} />
                <InfoRow label="Amount disbursed" value={formatKES(disbursed)} />
                <InfoRow
                  label="Disbursement method"
                  value={METHOD_LABELS[advance.disbursement_method] ?? advance.disbursement_method}
                />
                <InfoRow
                  label="Recoveries"
                  value={
                    perRecovery != null
                      ? `${advance.number_of_recoveries} × ${formatKES(perRecovery)}`
                      : advance.number_of_recoveries
                  }
                />
                <InfoRow
                  label="Recovery window"
                  value={
                    advance.recovery_start_date
                      ? `${formatDate(advance.recovery_start_date)} – ${formatDate(advance.recovery_end_date)}`
                      : "—"
                  }
                />
              </div>
            </Section>

            {/* Reason */}
            {advance.reason && (
              <Section title="Reason" icon={<FileText className="h-4 w-4 text-gray-500" />}>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
                  {advance.reason}
                </p>
              </Section>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t text-xs text-gray-500">
              <div>
                <p className="mb-0.5">Created</p>
                <p className="text-gray-700 font-medium">{formatDateTime(advance.created_at)}</p>
              </div>
              <div>
                <p className="mb-0.5">Last updated</p>
                <p className="text-gray-700 font-medium">{formatDateTime(advance.updated_at)}</p>
              </div>
            </div>
          </TabsContent>

          {/* ── Repayments ── */}
          <TabsContent value="repayments" className="flex-1 overflow-y-auto p-5">
            <RepaymentsTab advance={advance} active={open && tab === "repayments"} />
          </TabsContent>
        </Tabs>

        <DrawerFooter className="border-t p-4">
          <DrawerClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}