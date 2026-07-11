"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loanAPI, type MinimalLoanType } from "@/services/api/loan";

interface LoanApplyFormProps {
  onSuccess: () => void;
}

export function LoanApplyForm({ onSuccess }: LoanApplyFormProps) {
  const { user } = useAuth();
  const orgId     = user?.organization_id ?? 0;
  const employeeId = user?.employee?.id ?? 0;

  const [loanTypes, setLoanTypes]   = useState<MinimalLoanType[]>([]);
  const [loading, setLoading]       = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<MinimalLoanType | null>(null);

  const [form, setForm] = useState({
    config_id:         "",
    amount:            "",
    start_date:        "",
    end_date:          "",
    monthly_deduction: "",
    purpose:           "",
  });

  useEffect(() => {
    if (!orgId) return;
    loanAPI.getLoanTypes(orgId).then((res) => {
      if (res.success && res.data) setLoanTypes(res.data as MinimalLoanType[]);
    }).finally(() => setTypesLoading(false));
  }, [orgId]);

  const handleTypeChange = (id: string) => {
    const t = loanTypes.find((lt) => lt.id === Number(id)) ?? null;
    setSelectedType(t);
    setForm((f) => ({ ...f, config_id: id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.config_id || !form.amount || !form.start_date) {
        toast.error("Loan type, amount, and start date are required.");      return;
    }
    setLoading(true);
    const res = await loanAPI.applyLoan(orgId, employeeId, {
      config_id:         Number(form.config_id),
      amount:            Number(form.amount),
      start_date:        form.start_date,
      end_date:          form.end_date || null,
      monthly_deduction: form.monthly_deduction ? Number(form.monthly_deduction) : null,
      purpose:           form.purpose || null,
    });
    setLoading(false);

    if (res.success) {
      toast.success(
        res.message ??
            "Your loan application has been submitted for review."
        );
      setForm({ config_id: "", amount: "", start_date: "", end_date: "", monthly_deduction: "", purpose: "" });
      setSelectedType(null);
      onSuccess();
    } else {
      toast.error(res.error ?? res.message ?? "Failed to submit loan application.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Loan type */}
      <div className="space-y-1.5">
        <Label htmlFor="lt_select">Loan Type *</Label>
        {typesLoading ? (
          <div className="h-9 bg-muted rounded animate-pulse" />
        ) : (
          <select
            id="lt_select"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.config_id}
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a loan type…</option>
            {loanTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name}
                {lt.max_amount ? ` — max KES ${Number(lt.max_amount).toLocaleString()}` : ""}
                {lt.interest_rate ? ` · ${lt.interest_rate}% p.a.` : ""}
              </option>
            ))}
          </select>
        )}
        {selectedType && (
          <p className="text-xs text-muted-foreground">
            {selectedType.max_amount && `Maximum: KES ${Number(selectedType.max_amount).toLocaleString()}`}
            {selectedType.interest_rate && ` · Interest: ${selectedType.interest_rate}% p.a.`}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="apply_amount">
          Amount (KES) *
          {selectedType?.max_amount && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              Max: KES {Number(selectedType.max_amount).toLocaleString()}
            </span>
          )}
        </Label>
        <Input
          id="apply_amount"
          type="number"
          min={1}
          max={selectedType?.max_amount ?? undefined}
          placeholder="e.g. 50000"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          disabled={loading}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="apply_start">Start Date *</Label>
          <Input
            id="apply_start"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apply_end">End Date</Label>
          <Input
            id="apply_end"
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            disabled={loading}
          />
        </div>
      </div>

      {/* Monthly deduction */}
      <div className="space-y-1.5">
        <Label htmlFor="apply_monthly">Preferred Monthly Deduction (KES)</Label>
        <Input
          id="apply_monthly"
          type="number"
          min={1}
          placeholder="Optional — leave blank to let payroll set this"
          value={form.monthly_deduction}
          onChange={(e) => setForm((f) => ({ ...f, monthly_deduction: e.target.value }))}
          disabled={loading}
        />
      </div>

      {/* Purpose */}
      <div className="space-y-1.5">
        <Label htmlFor="apply_purpose">Purpose</Label>
        <textarea
          id="apply_purpose"
          rows={3}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          placeholder="Briefly describe why you need this loan…"
          value={form.purpose}
          onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading || !form.config_id || !form.amount || !form.start_date}>
        {loading ? "Submitting…" : "Submit Application"}
      </Button>
    </form>
  );
}