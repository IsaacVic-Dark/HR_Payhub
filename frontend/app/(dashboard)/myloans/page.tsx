"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import MyLoansTable from "@/app/(dashboard)/myloans/components/my-loans-table";
import { LoanApplyForm } from "@/app/(dashboard)/myloans/components/loan-apply-form";
import { loanAPI, LoanType, IN_PROGRESS_STATUSES } from "@/services/api/loan";
import { useAuth } from "@/lib/AuthContext";

export default function MyLoansPage() {
  const { user } = useAuth();
  const orgId = user?.organization_id ?? 0;
  const employeeId = user?.employee?.id ?? 0;

  const [loans, setLoans] = useState<LoanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  // ── Fetch the employee's loans ────────────────────────────────────────────
  const fetchLoans = useCallback(async () => {
    if (!orgId || !employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await loanAPI.getEmployeeLoans(orgId, employeeId, { page: 1, per_page: 100 });
    if (res.success && res.data) {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).loans ?? [];
      setLoans(data);
    } else {
      setLoans([]);
      if (!res.message?.toLowerCase().includes("no loans")) {
        setError(res.error ?? "Failed to fetch your loans");
      }
    }
    setLoading(false);
  }, [orgId, employeeId]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  // ── Summary stats (derived client-side from the employee's loans) ────────
  const totalLoans = loans.length;
  const totalLoaned = loans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const totalOutstanding = loans.reduce((sum, l) => sum + (Number(l.balance_remaining) || 0), 0);
  const totalRepaid = loans.reduce((sum, l) => sum + (Number(l.total_repaid) || 0), 0);
  const inProgressCount = loans.filter((l) => IN_PROGRESS_STATUSES.includes(l.status)).length;
  const activeCount = loans.filter((l) => ["approved", "active"].includes(l.status)).length;

  const cardDetails: CardDetail[] = [
    {
      title: "My Loans",
      value: totalLoans.toString(),
      change: totalLoaned ? `KES ${totalLoaned.toLocaleString()}` : "—",
      changeIcon: null,
      description: "All loan applications you've submitted.",
      footerText: "Across all statuses",
    },
    {
      title: "Outstanding Balance",
      value: `KES ${totalOutstanding.toLocaleString()}`,
      change: totalRepaid ? `KES ${totalRepaid.toLocaleString()} repaid` : "—",
      changeIcon: null,
      description: "Total amount you still owe.",
      footerText: "Sum of active loan balances",
    },
    {
      title: "In Progress",
      value: inProgressCount.toString(),
      change: "Awaiting decision",
      changeIcon: null,
      description: "Applications moving through approval.",
      footerText: "Manager → HR → Finance → Disburse",
    },
    {
      title: "Active Loans",
      value: activeCount.toString(),
      change: "Approved & disbursed",
      changeIcon: null,
      description: "Loans currently being repaid.",
      footerText: "Active repayment schedules",
    },
  ];

  const handleApplySuccess = () => {
    setApplyOpen(false);
    fetchLoans();
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">My Loans</h1>
            <p className="text-sm text-muted-foreground">
              View your loan applications, track approval progress, and apply for a new loan.
            </p>
          </div>
          <Button onClick={() => setApplyOpen(true)} className="flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            Apply for Loan
          </Button>
        </div>

        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards details={cardDetails} />
          <MyLoansTable loans={loans} loading={loading} error={error} onRefresh={fetchLoans} />
        </div>
      </div>

      {/* Apply for Loan dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply for a Loan</DialogTitle>
            <DialogDescription>
              Submit your loan application for review. It will be checked automatically, then
              routed to your line manager for approval.
            </DialogDescription>
          </DialogHeader>
          <LoanApplyForm onSuccess={handleApplySuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
}