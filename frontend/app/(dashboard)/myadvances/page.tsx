"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, Plus, AlertTriangle } from "lucide-react";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import MyAdvancesTable from "@/app/(dashboard)/myadvances/components/my-advances-table";
import { AdvanceRequestForm } from "@/app/(dashboard)/myadvances/components/advance-request-form";
import {
  advanceAPI,
  AdvanceType,
  AdvancePolicySettings,
  IN_APPROVAL_STATUSES,
  ACTIVE_STATUSES,
} from "@/services/api/advance";
import { useAuth } from "@/lib/AuthContext";

export default function MyAdvancesPage() {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? 0;
  const employeeId = user?.employee?.id ?? 0;

  const [advances, setAdvances] = useState<AdvanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<AdvancePolicySettings | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editAdvance, setEditAdvance] = useState<AdvanceType | null>(null);

  // ── Fetch the employee's advances ────────────────────────────────────────────
  const fetchAdvances = useCallback(async () => {
    if (!orgId || !employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await advanceAPI.getEmployeeAdvances(orgId, employeeId, { page: 1, per_page: 100 });
    if (res.success && res.data) {
      setAdvances(res.data);
    } else {
      setAdvances([]);
      if (!res.message?.toLowerCase().includes("no advances")) {
        setError(res.error ?? "Failed to fetch your advances");
      }
    }
    setLoading(false);
  }, [orgId, employeeId]);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  // ── Policy (drives the top message + the request form) ───────────────────────
  useEffect(() => {
    if (!orgId) return;
    advanceAPI.getPolicy(orgId).then((res) => {
      if (res.success && res.data?.settings) setPolicy(res.data.settings);
    });
  }, [orgId]);

  // ── Summary stats (derived client-side) ──────────────────────────────────────
  const totalRequested = advances.reduce((s, a) => s + (Number(a.amount_requested) || 0), 0);
  const outstanding = advances
    .filter((a) => ACTIVE_STATUSES.includes(a.status))
    .reduce((s, a) => s + (Number(a.balance_remaining) || 0), 0);
  const recovered = advances.reduce((s, a) => s + (Number(a.amount_recovered) || 0), 0);
  const inApproval = advances.filter((a) => IN_APPROVAL_STATUSES.includes(a.status)).length;
  const active = advances.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;

  const cardDetails: CardDetail[] = [
    {
      title: "My Advances",
      value: advances.length.toString(),
      change: totalRequested ? `KES ${totalRequested.toLocaleString()}` : "—",
      changeIcon: null,
      description: "All advance requests you've made.",
      footerText: "Across all statuses",
    },
    {
      title: "Outstanding Balance",
      value: `KES ${outstanding.toLocaleString()}`,
      change: recovered ? `KES ${recovered.toLocaleString()} recovered` : "—",
      changeIcon: null,
      description: "Amount still to be deducted from your pay.",
      footerText: "Sum of active advance balances",
    },
    {
      title: "In Approval",
      value: inApproval.toString(),
      change: "Awaiting decision",
      changeIcon: null,
      description: "Requests moving through approval.",
      footerText: "Manager → HR → Finance (if required)",
    },
    {
      title: "Active Advances",
      value: active.toString(),
      change: "Disbursed",
      changeIcon: null,
      description: "Advances currently being recovered.",
      footerText: "Recovered through payroll",
    },
  ];

  const requestsDisabled = policy?.allow_employee_request === false;

  const openNew = () => {
    setEditAdvance(null);
    setFormOpen(true);
  };

  const openEdit = (advance: AdvanceType) => {
    setEditAdvance(advance);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditAdvance(null);
    fetchAdvances();
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">My Advances</h1>
            <p className="text-sm text-muted-foreground">
              Request a salary advance, track its approval and see how it&apos;s being recovered.
            </p>
          </div>
          <Button
            onClick={openNew}
            disabled={requestsDisabled}
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Request Advance
          </Button>
        </div>

        {/* Policy message */}
        {policy && !requestsDisabled && (
          <div className="mx-6 mt-1 flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
            <p>
              You can request an advance of up to{" "}
              <strong>{Number(policy.max_percentage_of_net)}% of your net pay</strong>.
            </p>
          </div>
        )}
        {requestsDisabled && (
          <div className="mx-6 mt-1 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <p>Salary advance requests are currently turned off for your organisation.</p>
          </div>
        )}

        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards details={cardDetails} />
          <MyAdvancesTable
            advances={advances}
            loading={loading}
            error={error}
            onRefresh={fetchAdvances}
            onEdit={openEdit}
          />
        </div>
      </div>

      {/* Request / edit-draft dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditAdvance(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editAdvance ? "Edit Draft" : "Request a Salary Advance"}</DialogTitle>
            <DialogDescription>
              Your request is checked automatically, then routed for approval. Approved advances are
              recovered from your upcoming payroll.
            </DialogDescription>
          </DialogHeader>
          <AdvanceRequestForm policy={policy} advance={editAdvance} onSuccess={handleFormSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
}