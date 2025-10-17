"use client";

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SectionCards, type CardDetail } from "@/components/section-cards"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import LeaveTable from "@/components/data-table-leaves";

export default function Page() {
  const pathname = usePathname();

  const cardDetails: CardDetail[] = [
    {
      title: "Sick Leave",
      value: "12",
      change: "",
      changeIcon: null,
      description: "Number of sick leave requests submitted.",
      footerText: "Track employee health-related absences",
    },
    {
      title: "Casual Leave",
      value: "8",
      change: "",
      changeIcon: null,
      description: "Casual leaves taken for short-term needs.",
      footerText: "Covers brief personal time off",
    },
    {
      title: "Annual Leave",
      value: "20",
      change: "",
      changeIcon: null,
      description: "Total annual leave applications.",
      footerText: "Reflects planned vacations and holidays",
    },
    {
      title: "Paternity Leave",
      value: "3",
      change: "",
      changeIcon: null,
      description: "Paternity leave taken for new fathers.",
      footerText: "Supports work-life balance for families",
    },
  ];

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
              <h1 className="text-4xl font-medium">Leaves Managment</h1>
              <p className="text-base text-muted-foreground">
                This page shows all leaves requests made by employees:
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards details={cardDetails} />
              <LeaveTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}