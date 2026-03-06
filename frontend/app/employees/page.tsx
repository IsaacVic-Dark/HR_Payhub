"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DataTableEmployees } from "@/app/employees/components/data-table-employees";
import { employeeAPI } from "@/services/api/employee";
import { useAuth } from "@/lib/AuthContext";
import { formatCurrency } from "@/lib/utils";

interface Statistics {
  total: number;
  by_department: Record<string, number>;
  by_job_title: Record<string, number>;
  salary_summary?: {
    average: number;
    min: string;
    max: string;
    total_monthly: number;
    total_yearly: number;
  };
  tenure_summary: Record<string, number>;
  status_summary?: Record<string, number>;
}

export default function Page() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchStatistics = async () => {
    if (!user?.organization_id) {
      setIsLoading(false);
      setError("No organization ID found");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await employeeAPI.getEmployees(user.organization_id);

      if (!response.success) {
        throw new Error(
          `Failed to fetch: ${response.error || response.message || "Unknown error"}`
        );
      }

      // Check for metadata at the top level of the response
      if (response.metadata?.statistics) {
        setStatistics(response.metadata.statistics);
      } else {
        // If no statistics in metadata, you might need to calculate them from the employees data
        console.log("No statistics found in metadata");
        setStatistics(null);
      }
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch statistics"
      );
    } finally {
      setIsLoading(false);
    }
  };

  fetchStatistics();
}, [user?.organization_id]);

  // Generate card details dynamically from statistics
  const cardDetails: CardDetail[] = [];

  if (statistics) {
    // Total Employees Card
    cardDetails.push({
      title: "Total Employees",
      value: statistics.total.toString(),
      change: "",
      changeIcon: null,
      description: "Active employees in organization",
      footerText: `${Object.keys(statistics.by_department).length} departments`,
    });

    // Total Monthly Salary Card
    if (statistics.salary_summary) {
      cardDetails.push({
        title: "Total Monthly Salary",
        value: formatCurrency(statistics.salary_summary.total_monthly),
        change: "",
        changeIcon: null,
        description: "Sum of all base salaries",
        footerText: `Avg: ${formatCurrency(statistics.salary_summary.average)}`,
      });
    }

    // Status Summary Cards
    if (statistics.status_summary) {
      Object.entries(statistics.status_summary).forEach(([status, count]) => {
        cardDetails.push({
          title: `${status.charAt(0).toUpperCase() + status.slice(1)} Employees`,
          value: count.toString(),
          change: `${((count / statistics.total) * 100).toFixed(1)}%`,
          changeIcon: null,
          description: `Employees with ${status} status`,
          footerText: status === "active" ? "Currently working" : "Not active",
        });
      });
    }
  }

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
              <h1 className="text-2xl font-medium">Employees Management</h1>
              <p className="text-base text-muted-foreground">
                This page shows all employees in your organization:
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards 
                  details={cardDetails} 
                  loading={isLoading}
                  error={error}
                />
              </div>
              <DataTableEmployees statistics={statistics} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
// [file content end]