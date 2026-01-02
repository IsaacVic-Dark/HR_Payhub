"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import EmployeeLeaveTable from "@/app/myleave/components/employee-leave-table";
import { leaveAPI, type EmployeeLeavesResponseData } from "@/services/api/leave";
import { useAuth } from "@/lib/AuthContext";
import { IconCalendar, IconCheck, IconX, IconClock } from "@tabler/icons-react";

export default function MyLeavePage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<
    EmployeeLeavesResponseData["metadata"]["statistics"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [daysSummary, setDaysSummary] = useState<{
    total_days_taken: number;
    days_taken_current_year: number;
  } | null>(null);

  useEffect(() => {
    const fetchEmployeeLeaveStatistics = async () => {
      if (!user?.organization_id || !user?.employee?.id) return;

      try {
        const response = await leaveAPI.getEmployeeLeaves(user.organization_id, user.employee.id);

        console.log("Employee Leaves statistics API Response:", response);
        
        if (response.success && response.data) {
          setStatistics(response.metadata.statistics);
          setDaysSummary(response.metadata.statistics.days_summary);
        }
      } catch (error) {
        console.error("Failed to fetch employee leave statistics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployeeLeaveStatistics();
  }, [user?.organization_id, user?.employee?.id]);

  console.log("Leave Statistics:", statistics);

  // Statistics cards for employee
  const cardDetails: CardDetail[] = statistics
    ? [
        {
          title: "Total Leaves",
          value: statistics.total_leaves.toString(),
          change: "",
          changeIcon: null,
          description: "Total number of leaves you've taken",
          footerText: "All time record",
          icon: IconCalendar,
        },
        {
          title: "Approved",
          value: statistics.by_status.approved.toString(),
          change: "",
          changeIcon: null,
          description: "Leaves that have been approved",
          footerText: "Ready for use",
          icon: IconCheck,
        },
        {
          title: "Pending",
          value: statistics.by_status.pending.toString(),
          change: "",
          changeIcon: null,
          description: "Leaves awaiting approval",
          footerText: "Under review",
          icon: IconClock,
        },
        {
          title: "Rejected",
          value: statistics.by_status.rejected.toString(),
          change: "",
          changeIcon: null,
          description: "Leaves that were not approved",
          footerText: "Review reasons",
          icon: IconX,
        },
      ]
    : [];

  // Days summary cards
  const daysCards: CardDetail[] = daysSummary
    ? [
        {
          title: "Total Days Taken",
          value: daysSummary.total_days_taken.toString(),
          change: "",
          changeIcon: null,
          description: "All days taken throughout your employment",
          footerText: "Cumulative total",
          icon: IconCalendar,
        },
        {
          title: "This Year",
          value: daysSummary.days_taken_current_year.toString(),
          change: "",
          changeIcon: null,
          description: "Days taken in the current year",
          footerText: "Year-to-date",
          icon: IconCalendar,
        },
      ]
    : [];

  const path = pathname.split("/").filter(Boolean).pop() || "My Leaves";

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
              <h1 className="text-2xl font-medium">My Leaves</h1>
              <p className="text-base text-muted-foreground">
                View your leave history and apply for new leaves
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {/* Leave Statistics */}
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards details={cardDetails} />
              </div>
              
              {/* Days Summary */}
              {daysCards.length > 0 && (
                <div className="peer-data-[state=expanded]:xl:grid-cols-2 peer-data-[state=collapsed]:xl:grid-cols-3">
                  <SectionCards details={daysCards} />
                </div>
              )}
              
              {/* Leave Type Breakdown (if available) */}
              {statistics && (
                <div className="mt-4">
                  <h2 className="text-lg font-medium mb-4 mx-6">Leave Type Breakdown</h2>
                  <div className="peer-data-[state=expanded]:xl:grid-cols-6 peer-data-[state=collapsed]:xl:grid-cols-6">
                    <SectionCards details={[
                      {
                        title: "Sick",
                        value: statistics.by_type.sick.toString(),
                        change: "",
                        changeIcon: null,
                        description: "Sick leaves taken",
                        footerText: "Health related",
                      },
                      {
                        title: "Casual",
                        value: statistics.by_type.casual.toString(),
                        change: "",
                        changeIcon: null,
                        description: "Casual leaves taken",
                        footerText: "Personal time",
                      },
                      {
                        title: "Annual",
                        value: statistics.by_type.annual.toString(),
                        change: "",
                        changeIcon: null,
                        description: "Annual leaves taken",
                        footerText: "Vacation time",
                      },
                      {
                        title: "Maternity",
                        value: statistics.by_type.maternity.toString(),
                        change: "",
                        changeIcon: null,
                        description: "Maternity leaves taken",
                        footerText: "Family planning",
                      },
                      {
                        title: "Paternity",
                        value: statistics.by_type.paternity.toString(),
                        change: "",
                        changeIcon: null,
                        description: "Paternity leaves taken",
                        footerText: "Family support",
                      },
                      {
                        title: "Other",
                        value: statistics.by_type.other.toString(),
                        change: "",
                        changeIcon: null,
                        description: "Other leaves taken",
                        footerText: "Special cases",
                      },
                    ]} />
                  </div>
                </div>
              )}
              
              {/* Leave Table */}
              <EmployeeLeaveTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}