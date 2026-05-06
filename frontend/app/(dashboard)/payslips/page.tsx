"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import PayslipTable from "@/app/(dashboard)/payslips/components/data-table-payslips";
import { payslipAPI, type PayslipStatistics } from "@/services/api/payslip";
import { useAuth } from "@/lib/AuthContext";

// ─── Format KES currency for stat cards ─────────────────────────────────────
const fmtKES = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export default function Page() {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<PayslipStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatistics = async () => {
      if (!user?.organization_id) return;
      try {
        // Piggyback on the index endpoint which returns metadata.statistics
        const response = await payslipAPI.getPayslips(user.organization_id, {
          per_page: 1,
        });
        if (response.success && response.metadata?.statistics) {
          setStatistics(response.metadata.statistics as PayslipStatistics);
        }
      } catch (error) {
        console.error("Failed to fetch payslip statistics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatistics();
  }, [user?.organization_id]);

  // ── Build stat cards ──────────────────────────────────────────────────────
  const cardDetails: CardDetail[] = statistics
    ? [
        {
          title: "Total Payslips",
          value: statistics.total_payslips.toString(),
          change: `${statistics.by_status.generated} generated`,
          changeIcon: null,
          description: "All payslips across every payrun in this organisation.",
          footerText: "Includes generated, sent, and acknowledged",
        },
        {
          title: "Total Gross Pay",
          value: fmtKES(statistics.total_gross_pay),
          change: `KES ${statistics.total_gross_pay.toLocaleString("en-KE")}`,
          changeIcon: null,
          description: "Cumulative gross pay across all payslips.",
          footerText: "Before deductions",
        },
        {
          title: "Total Net Pay",
          value: fmtKES(statistics.total_net_pay),
          change: `KES ${statistics.total_net_pay.toLocaleString("en-KE")}`,
          changeIcon: null,
          description: "Cumulative net pay disbursed to employees.",
          footerText: "After all statutory deductions",
        },
        {
          title: "Generated",
          value: statistics.by_status.generated.toString(),
          change: "Awaiting send",
          changeIcon: null,
          description: "Payslips generated but not yet sent to employees.",
          footerText: "Action required",
        },
        {
          title: "Sent",
          value: statistics.by_status.sent.toString(),
          change: "Pending acknowledgement",
          changeIcon: null,
          description: "Payslips already sent to employees.",
          footerText: "Awaiting employee acknowledgement",
        },
        {
          title: "Acknowledged",
          value: statistics.by_status.acknowledged.toString(),
          change: "Confirmed by employees",
          changeIcon: null,
          description: "Payslips acknowledged by their respective employees.",
          footerText: "Fully completed",
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
              <h1 className="text-2xl font-medium">Payslips Management</h1>
              <p className="text-base text-muted-foreground">
                View, send, and manage employee payslips across all payruns.
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards details={cardDetails} />
              </div>
              <PayslipTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}