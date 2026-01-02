"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import LeaveTable from "@/app/leaves/components/data-table-leaves";
import { leaveAPI, type LeavesResponseData } from "@/services/api/leave";
import { useAuth } from "@/lib/AuthContext";

export default function Page() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<
    LeavesResponseData["statistics"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaveStatistics = async () => {
      if (!user?.organization_id) return;

      try {
        const response = await leaveAPI.getLeaves(user.organization_id);

      if (response.success && response.data) {
        setStatistics(response.metadata?.statistics);
      }
      } catch (error) {
        console.error("Failed to fetch leave statistics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaveStatistics();
  }, [user?.organization_id]);

  // Map of leave type keys to their display configurations
  const leaveTypeConfig: Record<
    string,
    { description: string; footerText: string }
  > = {
    sick: {
      description: "Number of sick leave requests submitted.",
      footerText: "Track employee health-related absences",
    },
    casual: {
      description: "Casual leaves taken for short-term needs.",
      footerText: "Covers brief personal time off",
    },
    annual: {
      description: "Total annual leave applications.",
      footerText: "Reflects planned vacations and holidays",
    },
    maternity: {
      description: "Maternity leave taken for new mothers.",
      footerText: "Supports maternal health and childcare",
    },
    paternity: {
      description: "Paternity leave taken for new fathers.",
      footerText: "Supports work-life balance for families",
    },
    other: {
      description: "Other types of leave requests.",
      footerText: "Includes special circumstances",
    },
  };

  // Generate card details dynamically from statistics
  const cardDetails: CardDetail[] = statistics
    ? Object.keys(statistics)
        .filter((key) => key !== "total_leaves") // Exclude total_leaves
        .map((key) => {
          const leaveType = key as keyof typeof statistics;
          const config = leaveTypeConfig[leaveType] || {
            description: `${leaveType} leave requests.`,
            footerText: "",
          };

          return {
            title:
              leaveType.charAt(0).toUpperCase() + leaveType.slice(1) + " Leave",
            value: statistics[leaveType]?.toString() || "0",
            change: "",
            changeIcon: null,
            description: config.description,
            footerText: config.footerText,
          };
        })
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
              <h1 className="text-2xl font-medium">Leaves Management</h1>
              <p className="text-base text-muted-foreground">
                This page shows all leaves requests made by employees:
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards details={cardDetails} />
              </div>
              <LeaveTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
