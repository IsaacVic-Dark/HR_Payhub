"use client";

import { SectionCards, type CardDetail } from "@/components/section-cards";
import { useEffect, useState } from "react";
import LoanTable from "@/app/(dashboard)/loans/components/data-table-loans";
import { loanAPI } from "@/services/api/loan";
import { useAuth } from "@/lib/AuthContext";

export default function LoansPage() {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    if (!user?.organization_id) return;
    loanAPI.getLoans(user.organization_id, { page: 1, per_page: 1 }).then((res) => {
      if (res.success) setStatistics(res.metadata?.statistics ?? null);
    });
  }, [user?.organization_id]);

  const cardDetails: CardDetail[] = statistics
    ? [
        {
          title: "Total Loans",
          value: statistics.total_loans?.toString() ?? "0",
          change: statistics.total_loaned
            ? `KES ${Number(statistics.total_loaned).toLocaleString()}`
            : "—",
          changeIcon: null,
          description: "All loan applications in the system.",
          footerText: "Across all statuses",
        },
        {
          title: "Outstanding Balance",
          value: statistics.total_outstanding
            ? `KES ${Number(statistics.total_outstanding).toLocaleString()}`
            : "KES 0",
          change: statistics.total_repaid
            ? `KES ${Number(statistics.total_repaid).toLocaleString()} repaid`
            : "—",
          changeIcon: null,
          description: "Total amount yet to be repaid.",
          footerText: "Sum of all active loan balances",
        },
        {
          title: "In Progress",
          value: statistics.by_status?.in_progress?.toString() ?? "0",
          change: "Awaiting decision",
          changeIcon: null,
          description: "Loans currently moving through the approval pipeline.",
          footerText: "Manager → HR → Finance → Disburse",
        },
        {
          title: "Approved",
          value: statistics.by_status?.approved?.toString() ?? "0",
          change: "Active & disbursed",
          changeIcon: null,
          description: "Loans that have been fully approved and disbursed.",
          footerText: "Currently active",
        },
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 space-y-1">
          <h1 className="text-2xl font-medium">Loans Management</h1>
          <p className="text-sm text-muted-foreground">
            Review and action loan applications across the full approval workflow.
          </p>
        </div>
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards details={cardDetails} />
          <LoanTable />
        </div>
      </div>
    </div>
  );
}