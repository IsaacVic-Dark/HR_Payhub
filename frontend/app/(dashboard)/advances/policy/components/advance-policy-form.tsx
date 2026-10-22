"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  advanceAPI,
  AdvancePolicy,
  AdvancePolicySettings,
  DisbursementMethod,
  DEFAULT_ADVANCE_POLICY_SETTINGS,
  METHOD_LABELS,
} from "@/services/api/advance";
import { useAuth } from "@/lib/AuthContext";

// ─── Layout helpers ────────────────────────────────────────────────────────────

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-xs text-gray-500 mt-0.5 mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

const ALL_METHODS: DisbursementMethod[] = ["payroll", "mpesa", "bank_transfer", "cash", "cheque"];
const WORKFLOW_STEPS: { value: string; label: string }[] = [
  { value: "manager", label: "Line Manager" },
  { value: "hr", label: "HR" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function AdvancePolicyForm() {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? 0;

  const [policy, setPolicy] = useState<AdvancePolicy | null>(null);
  const [original, setOriginal] = useState<AdvancePolicySettings | null>(null);
  const [s, setS] = useState<AdvancePolicySettings>(DEFAULT_ADVANCE_POLICY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const res = await advanceAPI.getPolicy(orgId);
    if (res.success && res.data) {
      // Fill gaps so a partial policy still renders every field.
      const merged = { ...DEFAULT_ADVANCE_POLICY_SETTINGS, ...(res.data.settings ?? {}) };
      setPolicy(res.data);
      setOriginal(merged);
      setS(merged);
    } else {
      setError(res.error ?? "Failed to load the advance policy");
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof AdvancePolicySettings>(key: K, value: AdvancePolicySettings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const num = (v: string) => (v === "" ? 0 : Number(v));

  const toggleIn = <T extends string>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const dirty = useMemo(
    () => !!original && JSON.stringify(original) !== JSON.stringify(s),
    [original, s]
  );

  const validate = (): string | null => {
    if (s.max_percentage_of_basic < 1 || s.max_percentage_of_basic > 100)
      return "Maximum % of basic pay must be between 1 and 100.";
    if (s.max_percentage_of_net && (s.max_percentage_of_net < 1 || s.max_percentage_of_net > 100))
      return "Maximum % of net pay must be between 1 and 100 (leave blank for no net-pay limit).";
    if (s.minimum_amount <= 0) return "Minimum amount must be greater than 0.";
    if (s.maximum_amount < s.minimum_amount)
      return "Maximum amount can't be lower than the minimum amount.";
    if (s.max_active_advances < 1) return "Allow at least 1 active advance per employee.";
    if (s.max_recovery_periods < 1) return "Maximum recovery periods must be at least 1.";
    if (s.default_recovery_periods < 1 || s.default_recovery_periods > s.max_recovery_periods)
      return "Default recovery periods must be between 1 and the maximum.";
    if (s.request_cutoff_day < 1 || s.request_cutoff_day > 31)
      return "Request cut-off day must be between 1 and 31.";
    if (s.disbursement_methods.length === 0) return "Select at least one disbursement method.";
    if (s.finance_approval_threshold != null && s.finance_approval_threshold < 0)
      return "Finance threshold can't be negative.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const res = await advanceAPI.updatePolicy(orgId, { settings: s });
    setSaving(false);

    if (res.success) {
      toast.success(res.message ?? "Advance policy saved");
      await load();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to save policy");
    }
  };

  // ── States ───────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading policy…</div>;
  }
  if (error || !policy) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load the advance policy</p>
        <p className="text-xs text-gray-500 mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {policy.status === "pending" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A policy change is awaiting approval. The values below are the ones currently being
          reviewed.
        </div>
      )}

      {/* Eligibility */}
      <Card
        title="Eligibility limits"
        description="How much an employee can request, and how often."
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="p_net">Max % of net pay (optional)</Label>
            <Input
              id="p_net"
              type="number"
              min={1}
              max={100}
              value={s.max_percentage_of_net ?? ""}
              onChange={(e) => set("max_percentage_of_net", num(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_basic">Max % of basic pay</Label>
            <Input
              id="p_basic"
              type="number"
              min={1}
              max={100}
              value={s.max_percentage_of_basic}
              onChange={(e) => set("max_percentage_of_basic", num(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_active">Max active advances</Label>
            <Input
              id="p_active"
              type="number"
              min={1}
              value={s.max_active_advances}
              onChange={(e) => set("max_active_advances", num(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_min">Minimum amount (KES)</Label>
            <Input
              id="p_min"
              type="number"
              min={1}
              value={s.minimum_amount}
              onChange={(e) => set("minimum_amount", num(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_max">Maximum amount (KES)</Label>
            <Input
              id="p_max"
              type="number"
              min={1}
              value={s.maximum_amount}
              onChange={(e) => set("maximum_amount", num(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_cutoff">Request cut-off day</Label>
            <Input
              id="p_cutoff"
              type="number"
              min={1}
              max={31}
              value={s.request_cutoff_day}
              onChange={(e) => set("request_cutoff_day", num(e.target.value))}
            />
            <p className="text-[11px] text-gray-400">Day of the month requests close.</p>
          </div>
        </div>
      </Card>

      {/* Recovery */}
      <Card title="Recovery" description="How advances are deducted from payroll.">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="space-y-1.5">
            <Label htmlFor="p_def_rec">Default recovery periods</Label>
            <Input
              id="p_def_rec"
              type="number"
              min={1}
              value={s.default_recovery_periods}
              onChange={(e) => set("default_recovery_periods", num(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_max_rec">Maximum recovery periods</Label>
            <Input
              id="p_max_rec"
              type="number"
              min={1}
              value={s.max_recovery_periods}
              onChange={(e) => set("max_recovery_periods", num(e.target.value))}
            />
          </div>
        </div>
        <ToggleRow
          label="Allow partial recovery"
          hint="Let payroll deduct less than the scheduled amount when net pay is short."
          checked={s.allow_partial_recovery}
          onChange={(v) => set("allow_partial_recovery", v)}
        />
        <div className="space-y-1.5 max-w-xs mt-4">
          <Label htmlFor="p_minnet">Minimum net pay after recovery (KES)</Label>
          <Input
            id="p_minnet"
            type="number"
            min={0}
            step="0.01"
            value={s.minimum_net_pay_after_recovery ?? 0}
            onChange={(e) => set("minimum_net_pay_after_recovery", Number(e.target.value) || 0)}
          />
          <p className="text-[11px] text-gray-400">
            Payroll never deducts more than would leave the employee below this amount.
          </p>
        </div>
      </Card>

      {/* Approval */}
      <Card
        title="Approval workflow"
        description="Version 1 uses a single admin approval step. These settings are saved for a future multi-step workflow but are not used yet."
      >
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          {WORKFLOW_STEPS.map((step) => (
            <label key={step.value} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={s.approval_workflow.includes(step.value)}
                disabled
                onChange={() => set("approval_workflow", toggleIn(s.approval_workflow, step.value))}
              />
              {step.label}
            </label>
          ))}
        </div>
        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="p_fin">Finance approval threshold (KES)</Label>
          <Input
            id="p_fin"
            type="number"
            min={0}
            placeholder="No finance step"
            disabled
            value={s.finance_approval_threshold ?? ""}
            onChange={(e) =>
              set("finance_approval_threshold", e.target.value === "" ? null : Number(e.target.value))
            }
          />
          <p className="text-[11px] text-gray-400">
            Not used in v1 — every advance needs admin approval only.
          </p>
        </div>
      </Card>

      {/* Requests + disbursement */}
      <Card title="Requests & disbursement">
        <p className="text-sm font-medium text-gray-800 mb-2">Allowed disbursement methods</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          {ALL_METHODS.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={s.disbursement_methods.includes(m)}
                onChange={() => set("disbursement_methods", toggleIn(s.disbursement_methods, m))}
              />
              {METHOD_LABELS[m]}
            </label>
          ))}
        </div>

        <div className="divide-y">
          <ToggleRow
            label="Allow employees to request"
            hint="When off, only admins can create advances."
            checked={s.allow_employee_request}
            onChange={(v) => set("allow_employee_request", v)}
          />
          <ToggleRow
            label="Require a reason"
            hint="Employees must explain why they need the advance."
            checked={s.require_reason}
            onChange={(v) => set("require_reason", v)}
          />
          <ToggleRow
            label="Require supporting document"
            hint="Document upload isn't available in the request form yet, so this isn't enforced."
            checked={s.require_supporting_document}
            onChange={(v) => set("require_supporting_document", v)}
            disabled
          />
        </div>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" disabled={!dirty || saving} onClick={() => original && setS(original)}>
          Reset
        </Button>
        <Button disabled={!dirty || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Policy"}
        </Button>
      </div>
    </div>
  );
}