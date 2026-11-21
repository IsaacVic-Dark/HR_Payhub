"use client";

import { useEffect, useState } from "react";
import { AnalyticsFiltersBar } from "./components/analytics-filters";
import { KpiSummaryCards } from "./components/kpi-summary-cards";
import { PayrollCostChart } from "./components/payroll-cost-chart";
import { AttendanceOvertimeChart } from "./components/attendance-overtime-chart";
import { DepartmentBreakdown } from "./components/department-breakdown";
import { RecentPayrunsTable } from "./components/recent-payruns-table";
import { DEPARTMENTS, EMPLOYEES, fetchAnalytics } from "./lib/mock-data";
import type { AnalyticsFilters, AnalyticsResponse } from "./lib/types";

const DEFAULT_FILTERS: AnalyticsFilters = {
  from: "2026-03-01",
  to: "2026-08-31",
  period: "this_quarter",
  departmentId: "all",
  employeeId: "all",
};

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);

    fetchAnalytics(filters).then((response) => {
      if (!cancelled) setData(response);
    });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {data?.period.label ?? "Loading period…"} · company-wide overview
          </p>
        </div>
        <AnalyticsFiltersBar
          filters={filters}
          departments={DEPARTMENTS}
          employees={EMPLOYEES}
          onChange={setFilters}
        />
      </div>

      <KpiSummaryCards kpis={data?.kpis ?? null} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PayrollCostChart data={data?.payrollCostTrend ?? null} />
        <AttendanceOvertimeChart data={data?.attendanceOvertimeTrend ?? null} />
      </div>

      <DepartmentBreakdown data={data?.departmentBreakdown ?? null} />

      <RecentPayrunsTable data={data?.recentPayruns ?? null} />
    </div>
  );
}