"use client";

import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTableEmployees } from "@/app/employees/components/data-table-employees"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import { IconTrendingUp, IconTrendingDown, IconUser, IconCurrencyDollar, IconUsersGroup } from "@tabler/icons-react";
import { SectionCardList } from "@/components/SectionCardList";
import { useEffect, useState } from "react"
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency } from "@/lib/utils";

interface Statistics {
  total: number;
  by_department: Record<string, number>;
  by_job_title: Record<string, number>;
  salary_summary?: {
    average: number;
    min: number;
    max: number;
    total_monthly: number;
    total_yearly: number;
  };
  tenure_summary: Record<string, number>;
  status_summary?: Record<string, number>;
}

export default function Page() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchStatistics = async () => {
      if (!user.organization_id) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/organizations/${user.organization_id}/employees`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.metadata?.statistics) {
            setStatistics(data.metadata.statistics);
          }
        }
      } catch (error) {
        console.error("Failed to fetch statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [user.organization_id]);

  // Calculate trends (you can replace with actual comparison logic)
  const calculateTrend = (current: number, previous?: number) => {
    if (!previous || previous === 0) return { rate: "+0%", icon: <IconTrendingUp className="text-gray-500" /> };
    
    const change = ((current - previous) / previous) * 100;
    const isPositive = change >= 0;
    
    return {
      rate: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
      icon: isPositive 
        ? <IconTrendingUp className="text-green-500" />
        : <IconTrendingDown className="text-red-500" />
    };
  };

  // Prepare card data from statistics
  const cardData = statistics ? [
    {
      title: "Total Employees",
      price: statistics.total.toString(),
      description: "Active employees in organization",
      rate: calculateTrend(statistics.total).rate,
      footer: "All departments",
      subFooter: "Across all job titles",
      rateIcon: calculateTrend(statistics.total).icon,
      footerIcon: <IconUsersGroup className="size-4 text-blue-500" />,
      mainIcon: <IconUser className="h-8 w-8 text-blue-500" />,
    },
    {
      title: "Total Monthly Salary",
      price: statistics.salary_summary 
        ? formatCurrency(statistics.salary_summary.total_monthly)
        : "N/A",
      description: "Sum of all base salaries",
      rate: statistics.salary_summary 
        ? calculateTrend(statistics.salary_summary.total_monthly).rate
        : "+0%",
      footer: `Avg: ${statistics.salary_summary ? formatCurrency(statistics.salary_summary.average) : 'N/A'}`,
      subFooter: `Range: ${statistics.salary_summary 
        ? `${formatCurrency(statistics.salary_summary.min)} - ${formatCurrency(statistics.salary_summary.max)}`
        : 'N/A'}`,
      rateIcon: statistics.salary_summary 
        ? calculateTrend(statistics.salary_summary.total_monthly).icon
        : <IconTrendingUp className="text-gray-500" />,
      footerIcon: <IconCurrencyDollar className="size-4 text-green-500" />,
      mainIcon: <IconCurrencyDollar className="h-8 w-8 text-green-500" />,
    },
    ...(statistics.status_summary ? Object.entries(statistics.status_summary).map(([status, count]) => ({
      title: `${status.charAt(0).toUpperCase() + status.slice(1)} Employees`,
      price: count.toString(),
      description: `Employees with ${status} status`,
      rate: calculateTrend(count).rate,
      footer: `${((count / statistics.total) * 100).toFixed(1)}% of total`,
      subFooter: status === 'active' ? "Currently working" : "Not active",
      rateIcon: calculateTrend(count).icon,
      footerIcon: status === 'active' 
        ? <IconTrendingUp className="size-4 text-green-500" />
        : <IconTrendingDown className="size-4 text-amber-500" />,
      mainIcon: <IconUser className={`h-8 w-8 ${status === 'active' ? 'text-green-500' : 'text-amber-500'}`} />,
    })) : []),
  ] : [];

  // Fallback to hardcoded data if statistics are loading or unavailable
  const displayCards = loading || !statistics ? [
    {
      title: "Total Employees",
      price: "Loading...",
      description: "Fetching employee data",
      rate: "+0%",
      footer: "Please wait",
      subFooter: "Data is loading",
      rateIcon: <IconTrendingUp className="text-gray-300" />,
      footerIcon: <IconUser className="size-4 text-gray-300" />,
      mainIcon: <IconUser className="h-8 w-8 text-gray-300" />,
    },
    {
      title: "Total Monthly Salary",
      price: "Loading...",
      description: "Fetching salary data",
      rate: "+0%",
      footer: "Please wait",
      subFooter: "Data is loading",
      rateIcon: <IconTrendingUp className="text-gray-300" />,
      footerIcon: <IconCurrencyDollar className="size-4 text-gray-300" />,
      mainIcon: <IconCurrencyDollar className="h-8 w-8 text-gray-300" />,
    },
  ] : cardData;

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
                count={displayCards.length} 
                loading={loading}
              />
              <DataTableEmployees statistics={statistics} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}