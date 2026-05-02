"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import EmployeePayslipTable from "@/app/mypayslips/components/employee-payslip-table";

export default function MyPayslipsPage() {
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
              <h1 className="text-2xl font-medium">My Payslips</h1>
              <p className="text-base text-muted-foreground">
                View and download your monthly payslips
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 mx-6">
              <EmployeePayslipTable />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}