"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import {
  IconTrendingDown,
  IconTrendingUp,
  IconBuilding,
  IconMapPin,
  IconCurrency,
  IconCalendarPlus,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import OrganizationTable from "@/components/data-table-organizations";

export default function Page() {
  const pathname = usePathname();

  const cardDetails: CardDetail[] = [
    {
      title: "Total Organizations",
      value: "24",
      change: "+12%",
      changeIcon: null,
      description: "Active organizations in the system.",
      footerText: "3 new organizations added this month",
    },
    {
      title: "Active Locations",
      value: "8",
      change: "+2",
      changeIcon: null,
      description: "Cities with organizational presence.",
      footerText: "Expanded to 2 new cities this quarter",
    },
    {
      title: "Currency Types",
      value: "5",
      change: "",
      changeIcon: null,
      description: "Different currencies in use.",
      footerText: "Multi-currency support enabled",
    },
    {
      title: "Avg. Setup Time",
      value: "3.2 days",
      change: "-15%",
      changeIcon: null,
      description: "Average organization onboarding time.",
      footerText: "Improved setup process efficiency",
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
              <div className="mx-6">
                <h1 className="text-xl font-semibold text-gray-900">
                  Organizations
                </h1>
                <p className="text-sm text-gray-500">
                  Manage and monitor all organizations
                </p>
              </div>
              <SectionCards details={cardDetails} />
              <OrganizationTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
