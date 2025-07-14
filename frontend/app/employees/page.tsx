"use client";

import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTableEmployees } from "@/components/data-table-employees"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { SectionCardList } from "@/components/SectionCardList";
import data from "./data.json"
import { useEffect } from "react"

const cardData = [
  {
    title: "Total employees",
    price: "2,000",
    description: "Employee growth this month",
    rate: "+10%",
    footer: "Up from last month",
    subFooter: "Compared to June",
    rateIcon: <IconTrendingUp className="text-green-500" />,
    footerIcon: <IconTrendingUp className="size-4 text-green-500" />,
  },
  {
    title: "Total salary",
    price: "20000000",
    description: "Employees left this month",
    rate: "-2%",
    footer: "Down from last month",
    subFooter: "Compared to June",
    rateIcon: <IconTrendingDown className="text-red-500" />,
    footerIcon: <IconTrendingDown className="size-4 text-red-500" />,
  },
];

useEffect(() => {
  const fetchEmployeesData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/employees');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const employees = await response.json();
      if (employees && employees.length > 0) {
        console.log("Employees data fetched successfully:", employees);
      }else {
        console.warn("No employees data found");
      }
    } catch (error) {
      console.error("Failed to fetch employees data:", error);
    }
  }

  fetchEmployeesData();
}, []);

export default function Page() {
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
              <SectionCardList cards={cardData} count={2} />
              {/* <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div> */}
              {/* <DataTable data={data} /> */}
              <DataTableEmployees />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
