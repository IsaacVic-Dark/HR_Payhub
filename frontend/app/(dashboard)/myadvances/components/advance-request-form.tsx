"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  advanceAPI,
  AdvanceType,
  AdvancePolicySettings,
  DisbursementMethod,
  DEFAULT_ADVANCE_POLICY_SETTINGS,
  METHOD_LABELS,
  formatKES,
} from "@/services/api/advance";
import { employeeAPI, type MinimalEmployeeType } from "@/services/api/employee";

interface AdvanceRequestFormProps {
  /** Org policy settings — falls back to sensible defaults when null. */
  policy: AdvancePolicySettings | null;
  onSuccess: () => void;
  /** Pass a draft to edit it instead of creating a new request. */
  advance?: AdvanceType | null;
  /** Admin creating on behalf of an employee (shows an employee picker). */
  adminMode?: boolean;
}

const selectClass =
  "w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

export function AdvanceRequestForm({
  policy,
  onSuccess,
  advance = null,
  adminMode = false,
}: AdvanceRequestFormProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? 0;
  const ownEmployeeId = user?.employee?.id ?? 0;

  const p: AdvancePolicySettings = { ...DEFAULT_ADVANCE_POLICY_SETTINGS, ...(policy ?? {}) };
  const isEdit = !!advance;

  const [submitting, setSubmitting] = useState<"draft" | "submit" | null>(null);
  const [employees, setEmployees] = useState<MinimalEmployeeType[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(adminMode);

  // "" for method / recoveries means "use the policy default" (policy may load late).
  const [form, setForm] = useState({
    employee_id: "",
    amount: advance ? String(Number(advance.amount_requested)) : "",
    reason: advance?.reason ?? "",
    method: (advance?.disbursement_method ?? "") as DisbursementMethod | "",
    recoveries: advance ? String(advance.number_of_recoveries) : "",
  });

  useEffect(() => {
    if (!adminMode || !orgId) return;
    employeeAPI
      .getEmployeesMinimal(orgId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setEmployees(res.data);
      })
      .finally(() => setEmployeesLoading(false));
  }, [adminMode, orgId]);

  const methods = p.disbursement_methods.length
    ? p.disbursement_methods
    : DEFAULT_ADVANCE_POLICY_SETTINGS.disbursement_methods;

  const effectiveMethod: DisbursementMethod =
    form.method && methods.includes(form.method)
      ? form.method
      : methods.includes("payroll")
      ? "payroll"
      : methods[0];

  const maxRecoveries = Math.max(1, p.max_recovery_periods);
  const effectiveRecoveries = Math.min(
    maxRecoveries,
    Math.max(1, Number(form.recoveries) || p.default_recovery_periods || 1)
  );

  const amountNum = Number(form.amount);
  const perRecovery = amountNum > 0 ? amountNum / effectiveRecoveries : null;

  const empName = (e: MinimalEmployeeType) =>
    [e.firstname, e.middlename, e.surname].filter(Boolean).join(" ");

  /** Returns an error message, or null when valid. Drafts only need an amount. */
  const validate = (asDraft: boolean): string | null => {
    if (adminMode && !form.employee_id) return "Select an employee.";
    if (!(amountNum > 0)) return "Enter a valid amount.";
    if (asDraft) return null;
    if (amountNum < p.minimum_amount)
      return `Minimum advance is ${formatKES(p.minimum_amount)}.`;
    if (amountNum > p.maximum_amount)
      return `Maximum advance is ${formatKES(p.maximum_amount)}.`;
    if (p.require_reason && !form.reason.trim()) return "A reason is required.";
    return null;
  };

  const handleSubmit = async (asDraft: boolean) => {
    const err = validate(asDraft);
    if (err) {
      toast.error(err);
      return;
    }
    if (!orgId || (!adminMode && !ownEmployeeId)) {
      toast.error("Couldn't find your employee profile. Please log in again.");
      return;
    }

    const base = {
      amount: amountNum,
      reason: form.reason.trim() || null,
      disbursement_method: effectiveMethod,
      number_of_recoveries: effectiveRecoveries,
    };

    setSubmitting(asDraft ? "draft" : "submit");
    let res;
    if (adminMode) {
      res = await advanceAPI.createAdvance(orgId, {
        ...base,
        employee_id: Number(form.employee_id),
        save_as_draft: false,
      });
    } else if (advance) {
      res = await advanceAPI.updateAdvance(orgId, advance.advance_id, base);
      if (res.success && !asDraft) {
        res = await advanceAPI.submitAdvance(orgId, advance.advance_id);
      }
    } else {
      res = await advanceAPI.requestAdvance(orgId, ownEmployeeId, {
        ...base,
        save_as_draft: asDraft,
      });
    }
    setSubmitting(null);

    if (res.success) {
      toast.success(
        asDraft && !adminMode
          ? "Draft saved."
          : res.message ??
              (adminMode
                ? "Advance created."
                : "Your advance request has been submitted for review.")
      );
      onSuccess();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to save advance request.");
    }
  };

  const busy = submitting !== null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(false);
      }}
      className="space-y-5"
    >
      {/* Employee (admin only) */}
      {adminMode && (
        <div className="space-y-1.5">
          <Label htmlFor="adv_employee">Employee *</Label>
          {employeesLoading ? (
            <div className="h-9 bg-muted rounded animate-pulse" />
          ) : (
            <select
              id="adv_employee"
              className={selectClass}
              value={form.employee_id}
              onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
              disabled={busy}
            >
              <option value="">Select an employee…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {empName(e)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="adv_amount">
          Amount (KES) *
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {formatKES(p.minimum_amount)} – {formatKES(p.maximum_amount)}
          </span>
        </Label>
        <Input
          id="adv_amount"
          type="number"
          min={p.minimum_amount}
          max={p.maximum_amount}
          step="0.01"
          placeholder="e.g. 20000"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          disabled={busy}
        />
      </div>

      {/* Recoveries + method */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="adv_recoveries">Recovery periods *</Label>
          <select
            id="adv_recoveries"
            className={selectClass}
            value={String(effectiveRecoveries)}
            onChange={(e) => setForm((f) => ({ ...f, recoveries: e.target.value }))}
            disabled={busy}
          >
            {Array.from({ length: maxRecoveries }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "payroll" : "payrolls"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adv_method">Disbursement method *</Label>
          <select
            id="adv_method"
            className={selectClass}
            value={effectiveMethod}
            onChange={(e) =>
              setForm((f) => ({ ...f, method: e.target.value as DisbursementMethod }))
            }
            disabled={busy}
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {perRecovery != null && (
        <p className="text-xs text-muted-foreground -mt-2">
          Estimated deduction: <span className="font-medium">{formatKES(perRecovery)}</span> per
          payroll.
        </p>
      )}

      {/* Reason */}
      <div className="space-y-1.5">
        <Label htmlFor="adv_reason">Reason{p.require_reason ? " *" : ""}</Label>
        <textarea
          id="adv_reason"
          rows={3}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Briefly describe why you need this advance…"
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          disabled={busy}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {!adminMode && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => handleSubmit(true)}
          >
            {submitting === "draft" ? "Saving…" : "Save as Draft"}
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={busy}>
          {submitting === "submit"
            ? "Submitting…"
            : adminMode
            ? "Create Advance"
            : isEdit
            ? "Submit Draft"
            : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}