"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { DataTableEmployees } from "@/app/employees/components/data-table-employees";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { employeeAPI, EmployeeType } from "@/services/api/employee";
import {
  IconTrendingUp,
  IconUser,
  IconCurrencyDollar,
  IconUsersGroup,
} from "@tabler/icons-react";
import { SectionCardList } from "@/components/SectionCardList";
import { useEffect, useState } from "react";
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
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchStatistics = async () => {
      if (!user?.organization_id) {
        setLoading(false);
        setError("No organization ID found");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // This returns the parsed JSON directly, not a Response object
        const data = await employeeAPI.getEmployees(user.organization_id);

        console.log("API Response data:", data);

        // Check if data is successful
        if (!data.success) {
          throw new Error(
            `Failed to fetch: ${data.message || "Unknown error"}`
          );
        }

        // The statistics is at data.metadata.statistics
        if (data.metadata?.statistics) {
          setStatistics(data.metadata.statistics);
        } else {
          // Alternative path: check data.data.metadata?.statistics
          if (data.data?.metadata?.statistics) {
            setStatistics(data.data.metadata.statistics);
          } else {
            throw new Error("Statistics data not found in response");
          }
        }
      } catch (error) {
        console.error("Failed to fetch statistics:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch statistics"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [user?.organization_id]);

  // Prepare card data from statistics
  const getCardData = () => {
    if (error) {
      return [
        {
          title: "Total Employees",
          price: "Error",
          description: error,
          rate: "—",
          footer: "Failed to load",
          subFooter: "Please try again",
          rateIcon: <IconTrendingUp className="text-red-500" />,
          footerIcon: <IconUsersGroup className="size-4 text-red-500" />,
          mainIcon: <IconUser className="h-8 w-8 text-red-500" />,
        },
        {
          title: "Total Monthly Salary",
          price: "Error",
          description: error,
          rate: "—",
          footer: "Failed to load",
          subFooter: "Please try again",
          rateIcon: <IconTrendingUp className="text-red-500" />,
          footerIcon: <IconCurrencyDollar className="size-4 text-red-500" />,
          mainIcon: <IconCurrencyDollar className="h-8 w-8 text-red-500" />,
        },
      ];
    }

    if (!statistics) {
      return [];
    }

    const cards = [
      {
        title: "Total Employees",
        price: statistics.total.toString(),
        description: "Active employees in organization",
        rate: "—",
        footer: "All departments",
        subFooter: `${
          Object.keys(statistics.by_department).length
        } departments`,
        rateIcon: <IconTrendingUp className="text-blue-500" />,
        footerIcon: <IconUsersGroup className="size-4 text-blue-500" />,
        mainIcon: <IconUser className="h-8 w-8 text-blue-500" />,
      },
      {
        title: "Total Monthly Salary",
        price: statistics.salary_summary
          ? formatCurrency(statistics.salary_summary.total_monthly)
          : "N/A",
        description: "Sum of all base salaries",
        rate: "—",
        footer: `Avg: ${
          statistics.salary_summary
            ? formatCurrency(statistics.salary_summary.average)
            : "N/A"
        }`,
        subFooter: `Range: ${
          statistics.salary_summary
            ? `${formatCurrency(
                parseFloat(statistics.salary_summary.min)
              )} - ${formatCurrency(parseFloat(statistics.salary_summary.max))}`
            : "N/A"
        }`,
        rateIcon: <IconTrendingUp className="text-green-500" />,
        footerIcon: <IconCurrencyDollar className="size-4 text-green-500" />,
        mainIcon: <IconCurrencyDollar className="h-8 w-8 text-green-500" />,
      },
    ];

    // Add status summary cards
    if (statistics.status_summary) {
      Object.entries(statistics.status_summary).forEach(([status, count]) => {
        cards.push({
          title: `${
            status.charAt(0).toUpperCase() + status.slice(1)
          } Employees`,
          price: count.toString(),
          description: `Employees with ${status} status`,
          rate: `${((count / statistics.total) * 100).toFixed(1)}%`,
          footer: `${count} of ${statistics.total} employees`,
          subFooter: status === "active" ? "Currently working" : "Not active",
          rateIcon:
            status === "active" ? (
              <IconTrendingUp className="text-green-500" />
            ) : (
              <IconTrendingUp className="text-amber-500" />
            ),
          footerIcon:
            status === "active" ? (
              <IconUsersGroup className="size-4 text-green-500" />
            ) : (
              <IconUsersGroup className="size-4 text-amber-500" />
            ),
          mainIcon: (
            <IconUser
              className={`h-8 w-8 ${
                status === "active" ? "text-green-500" : "text-amber-500"
              }`}
            />
          ),
        });
      });
    }

    return cards;
  };

  const displayCards = getCardData();

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
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCardList
                cards={displayCards}
                count={loading ? 3 : displayCards.length}
                loading={loading}
              />
              <DataTableEmployees statistics={statistics} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
