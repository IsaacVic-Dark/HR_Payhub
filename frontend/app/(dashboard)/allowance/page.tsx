"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTableAllowanceTypes from "./components/data-table-allowance-types";
import DataTableEmployeeAllowances from "./components/data-table-employee-allowances";

export default function AllowancesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 space-y-2">
          <h1 className="text-2xl font-medium">Allowances</h1>
          <p className="text-base text-muted-foreground">
            Manage the allowance catalogue and employee grants, and attach approved allowances to
            payruns
          </p>
        </div>
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <Tabs defaultValue="employee-allowances" className="mx-6">
            <TabsList>
              <TabsTrigger value="employee-allowances">Employee Allowances</TabsTrigger>
              <TabsTrigger value="allowance-types">Allowance Types</TabsTrigger>
            </TabsList>
            <TabsContent value="employee-allowances">
              <DataTableEmployeeAllowances />
            </TabsContent>
            <TabsContent value="allowance-types">
              <DataTableAllowanceTypes />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}