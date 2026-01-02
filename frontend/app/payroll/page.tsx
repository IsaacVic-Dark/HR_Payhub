"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import PayrollTable from "@/app/payroll/components/data-table-payroll";
import { payrollAPI } from "@/services/api/payroll";
import { useAuth } from "@/lib/AuthContext";

export default function Page() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<{
    total_payrolls: number;
    pending: number;
    approved: number;
    paid: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayrollStatistics = async () => {
      if (!user?.organization_id) return;

      try {
        const response = await payrollAPI.getPayrolls(user.organization_id);

        if (response.success && response.metadata) {
          setStatistics(response.metadata.statistics);
        }
      } catch (error) {
        console.error("Failed to fetch payroll statistics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayrollStatistics();
  }, [user?.organization_id]);

  // Map of status keys to their display configurations
  const statusConfig: Record<
    string,
    { description: string; footerText: string }
  > = {
    pending: {
      description: "Number of payrolls pending approval.",
      footerText: "Awaiting manager approval",
    },
    approved: {
      description: "Payrolls that have been approved.",
      footerText: "Ready for payment processing",
    },
    paid: {
      description: "Payrolls that have been paid.",
      footerText: "Payment completed",
    },
  };

  // Generate card details dynamically from statistics
  const cardDetails: CardDetail[] = statistics
    ? Object.keys(statusConfig)
        .map((key) => {
          const status = key as keyof typeof statistics;
          const config = statusConfig[status];

          return {
            title: status.charAt(0).toUpperCase() + status.slice(1),
            value: statistics[status]?.toString() || "0",
            change: "",
            changeIcon: null,
            description: config.description,
            footerText: config.footerText,
          };
        })
        .concat([
          {
            title: "Total Payrolls",
            value: statistics.total_payrolls?.toString() || "0",
            change: "",
            changeIcon: null,
            description: "Total number of payroll records.",
            footerText: "All payroll periods",
          },
        ])
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
              <h1 className="text-2xl font-medium">Payroll Management</h1>
              <p className="text-base text-muted-foreground">
                This page shows all payroll records for employees:
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards details={cardDetails} />
              </div>
              <PayrollTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

