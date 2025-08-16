"use client";
import { AppSidebar } from "@/components/app-sidebar";
import { SectionCards, type CardDetail } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { PayrollDashboard } from "@/components/chart-payrun";
import PayrollTable from "@/components/payruntable";

export default function Page() {

  const cardDetails: CardDetail[] = [
    {
      title: "Company expenses",
      value: "Kshs 1,250.00",
      change: "+12.5%",
      changeIcon: <IconTrendingUp className="text-green-500 size-3" />,
      description: "Trending up this month",
      footerText: "Visitors for the last 6 months",
    },
    {
      title: "Monthly Payroll",
      value: "Kshs 45,678",
      change: "+12.5%",
      changeIcon: <IconTrendingUp className="text-green-500 size-3" />,
      description: "Strong user retention",
      footerText: "Engagement exceed targets",
    },
    {
      title: "Total Employees",
      value: "1,234",
      change: "-20%",
      changeIcon: <IconTrendingDown className="size-4 text-red-500" />,
      description: "Down 20% this period",
      footerText: "Acquisition needs attention",
    },
    {
      title: "Total Leaves",
      value: "230",
      change: "+4.5%",
      changeIcon: <IconTrendingUp className="size-4 text-green-500" />,
      description: "Steady performance increase",
      footerText: "Meets growth projections",
    }
  ];

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
              <p className="text-base text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "2-digit",
                })}
              </p>
              <h1 className="text-4xl font-medium">Good morning, Isaac!</h1>
              <p className="text-base text-muted-foreground">
                Here’s what’s happening with your team today:
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards details={cardDetails} />
              <div className="px-4 lg:px-6">
                <PayrollDashboard />
              </div>
              <PayrollTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
