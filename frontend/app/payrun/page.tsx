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
import PayrunTable from "@/components/data-table-payrun";
import {} from "@/services/api/payrun";

export default function Page() {
  const pathname = usePathname();

  const cardDetails: CardDetail[] = [
    {
      title: "Gross Pay",
      value: "Kshs 50,000.00",
      change: "",
      changeIcon: null,
      description: "Total amount before deductions.",
      footerText: "Covers all employees in this payrun",
    },
    {
      title: "Deductions",
      value: "Kshs 5,000.00",
      change: "",
      changeIcon: null,
      description: "Statutory & company deductions applied.",
      footerText: "Includes taxes and other withholdings",
    },
    {
      title: "Net Pay",
      value: "Kshs 45,000.00",
      change: "",
      changeIcon: null,
      description: "Final payout after deductions.",
      footerText: "Net salary disbursed to employees",
    },
    {
      title: "Upcoming Payrun",
      value: "September 2025",
      change: "",
      changeIcon: null,
      description: "Scheduled payroll for the next period.",
      footerText: "Prepare in advance to avoid delays",
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
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards details={cardDetails} />
              <PayrunTable organizationId="51" />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
