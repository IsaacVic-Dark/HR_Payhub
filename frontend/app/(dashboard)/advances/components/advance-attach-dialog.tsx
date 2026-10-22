"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  advanceAPI,
  AdvanceType,
  PayrunLine,
  PayrunOption,
  formatDate,
  formatKES,
} from "@/services/api/advance";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

interface AdvanceAttachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advance: AdvanceType | null;
  /** Called after a payrun is attached or detached. */
  onChanged?: () => void;
}

const LINE_COLOR: Record<PayrunLine["status"], string> = {
  attached: "bg-blue-100 text-blue-800",
  processed: "bg-green-100 text-green-800",
  detached: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-800",
};

const selectClass =
  "w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Recovery schedule: attach a disbursed advance to draft payruns
 * (advance_payrun_lines). Payroll processing then deducts it automatically.
 */
export function AdvanceAttachDialog({
  open,
  onOpenChange,
  advance,
  onChanged,
}: AdvanceAttachDialogProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? 0;

  const [lines, setLines] = useState<PayrunLine[]>([]);
  const [payruns, setPayruns] = useState<PayrunOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [payrunId, setPayrunId] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    if (!advance) return;
    setLoading(true);
    const [l, p] = await Promise.all([
      advanceAPI.getPayrunLines(orgId, advance.advance_id),
      advanceAPI.getDraftPayruns(orgId),
    ]);
    if (l.success && l.data) {
      setLines(l.data as PayrunLine[]);
    } else {
      setLines([]);
    }
    setPayruns(p.success && Array.isArray(p.data) ? p.data : []);
    setLoading(false);
  }, [advance, orgId]);

  useEffect(() => {
    if (!open) return;
    setPayrunId("");
    setAmount("");
    setMode("equal");
    load();
  }, [open, load]);

  if (!advance) return null;

  const balance = Number(advance.balance_remaining);
  const taken = new Set(
    lines.filter((l) => l.status === "attached" || l.status === "processed").map((l) => l.payrun_id)
  );
  const available = payruns.filter((p) => !taken.has(p.id));
  const scheduledTotal = lines
    .filter((l) => l.status === "attached")
    .reduce((sum, l) => sum + l.scheduled_amount, 0);
  const equalInstalment = Math.min(
    balance,
    Math.round((Number(advance.amount_approved ?? 0) / Math.max(1, advance.number_of_recoveries)) * 100) / 100
  );

  const canAttach =
    !busy &&
    !!payrunId &&
    (mode === "equal" || (Number(amount) > 0 && Number(amount) <= balance - scheduledTotal + 0.0001));

  const attach = async () => {
    setBusy(true);
    const res = await advanceAPI.attachPayrun(orgId, advance.advance_id, {
      payrun_id: Number(payrunId),
      recovery_mode: mode,
      ...(mode === "custom" ? { scheduled_amount: Number(amount) } : {}),
    });
    setBusy(false);
    if (res.success) {
      toast.success(res.message ?? "Recovery attached to payrun");
      setPayrunId("");
      setAmount("");
      await load();
      onChanged?.();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to attach payrun");
    }
  };

  const detach = async (line: PayrunLine) => {
    setBusy(true);
    const res = await advanceAPI.detachPayrun(orgId, advance.advance_id, line.payrun_id);
    setBusy(false);
    if (res.success) {
      toast.success(res.message ?? "Recovery detached");
      await load();
      onChanged?.();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to detach payrun");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Recovery schedule — {advance.advance_number}</DialogTitle>
          <DialogDescription>
            Attach this advance to draft payruns. Payroll deducts it automatically when the
            payrun is processed. Balance remaining:{" "}
            <strong>{formatKES(balance)}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Existing lines */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-800">Attached payruns</p>
          {loading ? (
            <div className="h-10 bg-muted rounded animate-pulse" />
          ) : lines.length === 0 ? (
            <p className="text-sm text-gray-500">Not attached to any payrun yet.</p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.payrun_name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(l.pay_period_start)} – {formatDate(l.pay_period_end)} ·{" "}
                      {formatKES(l.scheduled_amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                        LINE_COLOR[l.status]
                      )}
                    >
                      {l.status}
                    </span>
                    {l.status === "attached" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={busy}
                        onClick={() => detach(l)}
                      >
                        Detach
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Attach form */}
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium text-gray-800">Attach to a draft payrun</p>

          <div className="space-y-1.5">
            <Label htmlFor="att_payrun">Payrun</Label>
            <select
              id="att_payrun"
              className={selectClass}
              value={payrunId}
              onChange={(e) => setPayrunId(e.target.value)}
              disabled={busy || loading}
            >
              <option value="">
                {available.length ? "Select a draft payrun…" : "No draft payruns available"}
              </option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.payrun_name} ({formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-6 text-sm">
            {(["equal", "custom"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="att_mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  disabled={busy}
                />
                {m === "equal" ? "Equal instalments" : "Custom amount"}
              </label>
            ))}
          </div>

          {mode === "equal" ? (
            <p className="text-xs text-muted-foreground">
              Each payroll recovers about <span className="font-medium">{formatKES(equalInstalment)}</span>{" "}
              ({advance.number_of_recoveries} recoveries planned); the last one clears any remainder.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="att_amount">Amount to recover in this payrun (KES)</Label>
              <Input
                id="att_amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Up to {formatKES(Math.max(0, balance - scheduledTotal))} still unscheduled.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={attach} disabled={!canAttach}>
              {busy ? "Working…" : "Attach payrun"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
