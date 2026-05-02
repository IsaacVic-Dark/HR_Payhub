"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import P9Table from "@/app/myp9/components/p9-table";

export default function MyP9Page() {
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
              <h1 className="text-2xl font-medium">My P9 Forms</h1>
              <p className="text-base text-muted-foreground">
                View and download your annual tax deduction cards (P9)
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 mx-6">
              <P9Table />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}