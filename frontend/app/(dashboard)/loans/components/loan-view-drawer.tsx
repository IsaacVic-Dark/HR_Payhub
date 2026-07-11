"use client";

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
import {
  LoanType,
  STATUS_CONFIG,
  LoanStatus,
  REJECTED_STATUSES,
} from "@/services/api/loan";
import {
  DollarSign,
  User,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LoanViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanType | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

const fmtKES = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
      }).format(v);

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

// ─── Workflow timeline step ────────────────────────────────────────────────────

type StepState = "done" | "rejected" | "skipped" | "active" | "pending";

interface TimelineStep {
  label: string;
  sublabel?: string;
  state: StepState;
  timestamp?: string | null;
}

function WorkflowTimeline({ steps }: { steps: TimelineStep[] }) {
  const iconFor = (state: StepState) => {
    if (state === "done")     return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (state === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    if (state === "skipped")  return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
    if (state === "active")   return <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-white animate-pulse" />;
    return <div className="h-4 w-4 rounded-full border-2 border-gray-300 bg-white" />;
  };

  const labelColor: Record<StepState, string> = {
    done:     "text-gray-900",
    rejected: "text-red-600",
    skipped:  "text-gray-400",
    active:   "text-blue-700 font-semibold",
    pending:  "text-gray-400",
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
            <p className={cn("text-sm leading-tight", labelColor[step.state])}>
              {step.label}
            </p>
            {step.sublabel && (
              <p className="text-xs text-gray-500 mt-0.5">{step.sublabel}</p>
            )}
            {step.timestamp && (
              <p className="text-xs text-gray-400 mt-0.5">{step.timestamp}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Build workflow steps from loan ───────────────────────────────────────────

function buildSteps(loan: LoanType): TimelineStep[] {
  const s = loan.status;

  const step1: TimelineStep = {
    label: "Application submitted",
    state:
      s === "system_rejected"
        ? "rejected"
        : s === "pending"
        ? "active"
        : "done",
    timestamp: fmtDateTime(loan.created_at) ?? undefined,
    sublabel:
      s === "system_rejected"
        ? loan.system_rejection_reason ?? "System validation failed"
        : undefined,
  };

  const step2: TimelineStep = {
    label: "Line manager review",
    state:
      s === "system_rejected"
        ? "pending"
        : s === "validated"
        ? "active"
        : s === "manager_rejected"
        ? "rejected"
        : ["manager_approved", "hr_approved", "hr_rejected", "compliance_review",
           "finance_approved", "finance_rejected", "approved", "active", "repaid",
           "appealed"].includes(s)
        ? "done"
        : "pending",
    timestamp: loan.manager_approved_at
      ? fmtDateTime(loan.manager_approved_at) ?? undefined
      : loan.manager_rejected_at
      ? fmtDateTime(loan.manager_rejected_at) ?? undefined
      : undefined,
    sublabel:
      s === "manager_rejected"
        ? loan.manager_rejection_reason ?? undefined
        : undefined,
  };

  const step3: TimelineStep = {
    label: "HR review",
    state:
      !["manager_approved", "hr_approved", "hr_rejected", "compliance_review",
        "finance_approved", "finance_rejected", "approved", "active", "repaid",
        "appealed"].includes(s)
        ? "pending"
        : s === "manager_approved"
        ? "active"
        : s === "hr_rejected"
        ? "rejected"
        : s === "compliance_review"
        ? "active"
        : "done",
    timestamp: loan.hr_approved_at
      ? fmtDateTime(loan.hr_approved_at) ?? undefined
      : loan.hr_rejected_at
      ? fmtDateTime(loan.hr_rejected_at) ?? undefined
      : undefined,
    sublabel:
      s === "hr_rejected"
        ? loan.hr_rejection_reason ?? undefined
        : s === "compliance_review"
        ? "Flagged for compliance review"
        : undefined,
  };

  // Finance step — may be skipped for low-value loans
  const financeSkipped =
    loan.loan_type.finance_threshold !== null &&
    loan.amount <= loan.loan_type.finance_threshold &&
    ["finance_approved", "approved", "active", "repaid"].includes(s);

  const step4: TimelineStep = {
    label: "Finance review",
    sublabel: financeSkipped ? "Skipped — below threshold" : undefined,
    state:
      financeSkipped
        ? "skipped"
        : !["hr_approved", "finance_approved", "finance_rejected",
            "approved", "active", "repaid"].includes(s)
        ? "pending"
        : s === "hr_approved"
        ? "active"
        : s === "finance_rejected"
        ? "rejected"
        : "done",
    timestamp: loan.finance_approved_at
      ? fmtDateTime(loan.finance_approved_at) ?? undefined
      : loan.finance_rejected_at
      ? fmtDateTime(loan.finance_rejected_at) ?? undefined
      : undefined,
  };

  const step5: TimelineStep = {
    label: "Disbursement",
    state:
      !["finance_approved", "approved", "active", "repaid"].includes(s)
        ? "pending"
        : s === "finance_approved"
        ? "active"
        : "done",
    timestamp: loan.disbursed_at
      ? fmtDateTime(loan.disbursed_at) ?? undefined
      : undefined,
    sublabel: loan.disbursement_date
      ? `Disburse date: ${fmt(loan.disbursement_date)}`
      : undefined,
  };

  return [step1, step2, step3, step4, step5];
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function LoanViewDrawer({ open, onOpenChange, loan }: LoanViewDrawerProps) {
  if (!loan) return null;

  const statusCfg =
    STATUS_CONFIG[loan.status as LoanStatus] ?? {
      label: loan.status,
      color: "bg-gray-100 text-gray-700",
    };

  const repayPct =
    loan.amount > 0
      ? Math.min(100, Math.round((loan.total_repaid / loan.amount) * 100))
      : 0;

  const isRejected = REJECTED_STATUSES.includes(loan.status as LoanStatus);

  const rejectionReason =
    loan.status === "system_rejected"
      ? loan.system_rejection_reason
      : loan.status === "manager_rejected"
      ? loan.manager_rejection_reason
      : loan.status === "hr_rejected"
      ? loan.hr_rejection_reason
      : loan.status === "finance_rejected"
      ? loan.finance_rejection_reason
      : loan.rejection_reason;

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
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-base font-semibold">
                {loan.loan_type.name}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-gray-500">
                {loan.employee.full_name}
              </DrawerDescription>
            </div>
            <Badge className={cn("shrink-0 text-xs", statusCfg.color)}>
              {statusCfg.label}
            </Badge>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Amount hero */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 p-3 bg-blue-50 rounded-xl text-center">
              <p className="text-xs text-blue-600 font-medium">Loan Amount</p>
              <p className="text-base font-bold text-blue-900 mt-0.5">{fmtKES(loan.amount)}</p>
            </div>
            <div className="col-span-1 p-3 bg-amber-50 rounded-xl text-center">
              <p className="text-xs text-amber-600 font-medium">Outstanding</p>
              <p className="text-base font-bold text-amber-900 mt-0.5">{fmtKES(loan.balance_remaining)}</p>
            </div>
            <div className="col-span-1 p-3 bg-green-50 rounded-xl text-center">
              <p className="text-xs text-green-600 font-medium">Repaid</p>
              <p className="text-base font-bold text-green-900 mt-0.5">{fmtKES(loan.total_repaid)}</p>
            </div>
          </div>

          {/* Repayment progress */}
          {(loan.status === "approved" || loan.status === "active") && (
            <Section title="Repayment Progress" icon={<TrendingUp className="h-4 w-4 text-gray-500" />}>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{fmtKES(loan.total_repaid)} repaid</span>
                  <span className="font-medium text-gray-700">{repayPct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${repayPct}%` }}
                  />
                </div>
                {loan.monthly_deduction && (
                  <p className="text-xs text-gray-500">
                    Monthly deduction: <span className="font-medium text-gray-700">{fmtKES(loan.monthly_deduction)}</span>
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Workflow timeline */}
          <Section title="Approval Progress" icon={<Clock className="h-4 w-4 text-gray-500" />}>
            <WorkflowTimeline steps={buildSteps(loan)} />
          </Section>

          {/* Rejection banner */}
          {isRejected && rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-medium mb-0.5">Rejection reason</p>
                <p>{rejectionReason}</p>
              </div>
            </div>
          )}

          {/* Employee */}
          <Section title="Employee" icon={<User className="h-4 w-4 text-gray-500" />}>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Full name" value={loan.employee.full_name} />
              <InfoRow label="Employee no." value={loan.employee.employee_number} />
              <InfoRow label="Email" value={loan.employee.email ?? "—"} />
              <InfoRow label="Employee ID" value={`#${loan.employee.id}`} />
            </div>
          </Section>

          {/* Loan details */}
          <Section title="Loan Details" icon={<DollarSign className="h-4 w-4 text-gray-500" />}>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Loan type" value={loan.loan_type.name} />
              <InfoRow
                label="Interest rate"
                value={loan.interest_rate != null ? `${loan.interest_rate}% p.a.` : "—"}
              />
              <InfoRow label="Start date" value={fmt(loan.start_date)} />
              <InfoRow label="End date" value={fmt(loan.end_date)} />
              {loan.disbursement_date && (
                <InfoRow label="Disbursement date" value={fmt(loan.disbursement_date)} />
              )}
              {loan.loan_type.finance_threshold != null && (
                <InfoRow
                  label="Finance threshold"
                  value={fmtKES(loan.loan_type.finance_threshold)}
                />
              )}
            </div>
          </Section>

          {/* Purpose */}
          {loan.purpose && (
            <Section title="Purpose" icon={<FileText className="h-4 w-4 text-gray-500" />}>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {loan.purpose}
              </p>
            </Section>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t text-xs text-gray-500">
            <div>
              <p className="mb-0.5">Created</p>
              <p className="text-gray-700 font-medium">
                {fmtDateTime(loan.created_at)}
              </p>
            </div>
            <div>
              <p className="mb-0.5">Last updated</p>
              <p className="text-gray-700 font-medium">
                {fmtDateTime(loan.updated_at)}
              </p>
            </div>
          </div>
        </div>

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