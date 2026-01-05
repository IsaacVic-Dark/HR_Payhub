"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import PayrunTable from "@/app/payrun/components/data-table-payruns";
import { payrunAPI, type PayrunsResponseData } from "@/services/api/payrun";
import { useAuth } from "@/lib/AuthContext";

export default function Page() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<
    PayrunsResponseData["statistics"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayrunStatistics = async () => {
      if (!user?.organization_id) return;

      try {
        const response = await payrunAPI.getPayruns(user.organization_id);

        if (response.success && response.metadata?.statistics) {
          setStatistics(response.metadata.statistics);
        }
      } catch (error) {
        console.error("Failed to fetch payrun statistics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayrunStatistics();
  }, [user?.organization_id]);

  // Generate card details from statistics
  const cardDetails: CardDetail[] = statistics
    ? [
        {
          title: "Total Payruns",
          value: statistics.total_payruns.toString(),
          change: "",
          changeIcon: null,
          description: "Total number of payruns created.",
          footerText: "Includes all payrun statuses",
        },
        {
          title: "Draft Payruns",
          value: statistics.draft.toString(),
          change: "",
          changeIcon: null,
          description: "Payruns in draft status.",
          footerText: "Pending review and finalization",
        },
        {
          title: "Reviewed Payruns",
          value: statistics.reviewed.toString(),
          change: "",
          changeIcon: null,
          description: "Payruns that have been reviewed.",
          footerText: "Awaiting finalization",
        },
        {
          title: "Finalized Payruns",
          value: statistics.finalized.toString(),
          change: "",
          changeIcon: null,
          description: "Payruns that have been finalized.",
          footerText: "Ready for payment processing",
        },
        {
          title: "Total Gross Pay",
          value: `Kshs ${statistics.total_gross_pay.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          change: "",
          changeIcon: null,
          description: "Total gross pay across all payruns.",
          footerText: "Before deductions",
        },
        {
          title: "Total Net Pay",
          value: `Kshs ${statistics.total_net_pay.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          change: "",
          changeIcon: null,
          description: "Total net pay across all payruns.",
          footerText: "After deductions",
        },
      ]
    : [];

  const path = pathname.split("/").filter(Boolean).pop() || "Dashboard";

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
              <h1 className="text-2xl font-medium">Payrun History</h1>
              <p className="text-base text-muted-foreground">
                This page shows all payruns and upcoming payruns:
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards details={cardDetails} />
              </div>
              <PayrunTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

