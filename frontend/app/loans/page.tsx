"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import LoanTable from "@/app/loans/components/data-table-loans";
import { loanAPI } from "@/services/api/loan";
import { useAuth } from "@/lib/AuthContext";

export default function Page() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLoanStatistics = async () => {
      if (!user?.organization_id) return;

      try {
        const response = await loanAPI.getLoans(user.organization_id, {
          page: 1,
          per_page: 1, // just need metadata / statistics
        });

        if (response.success) {
          setStatistics(response.metadata?.statistics ?? null);
        }
      } catch (error) {
        console.error("Failed to fetch loan statistics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoanStatistics();
  }, [user?.organization_id]);

  // Summary cards: totals + per-status breakdown
  const cardDetails: CardDetail[] = statistics
    ? [
        {
          title: "Total Loans",
          value: statistics.total_loans?.toString() ?? "0",
          change: statistics.total_loaned
            ? `KES ${Number(statistics.total_loaned).toLocaleString()}`
            : "—",
          changeIcon: null,
          description: "Total loan applications in the system.",
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
          title: "Pending",
          value: statistics.by_status?.pending?.toString() ?? "0",
          change: "Awaiting decision",
          changeIcon: null,
          description: "Loan requests pending approval.",
          footerText: "Requires HR / Finance action",
        },
        {
          title: "Approved",
          value: statistics.by_status?.approved?.toString() ?? "0",
          change: "Active loans",
          changeIcon: null,
          description: "Loans that have been approved.",
          footerText: "Currently active and disbursed",
        },
      ]
    : [];

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="mt-4 mx-6 space-y-2">
              <h1 className="text-2xl font-medium">Loans Management</h1>
              <p className="text-base text-muted-foreground">
                This page shows all loan requests made by employees:
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards details={cardDetails} />
              </div>
              <LoanTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}