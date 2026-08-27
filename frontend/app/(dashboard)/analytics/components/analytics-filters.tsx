"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnalyticsFilters, Department, EmployeeOption, PeriodPreset } from "../lib/types";

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
];

interface AnalyticsFiltersBarProps {
  filters: AnalyticsFilters;
  departments: Department[];
  employees: EmployeeOption[];
  onChange: (next: AnalyticsFilters) => void;
}

export function AnalyticsFiltersBar({
  filters,
  departments,
  employees,
  onChange,
}: AnalyticsFiltersBarProps) {
  const visibleEmployees = filters.departmentId === "all"
    ? employees
    : employees.filter((e) => e.departmentId === filters.departmentId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      <Select
        value={filters.period}
        onValueChange={(value: PeriodPreset) =>
          onChange({ ...filters, period: value })
        }
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.departmentId}
        onValueChange={(value: string) =>
          onChange({ ...filters, departmentId: value, employeeId: "all" })
        }
      >
        <SelectTrigger className="w-full sm:w-[190px]">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All departments</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.employeeId}
        onValueChange={(value: string) =>
          onChange({ ...filters, employeeId: value })
        }
      >
        <SelectTrigger className="w-full sm:w-[190px]">
          <SelectValue placeholder="Employee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All employees</SelectItem>
          {visibleEmployees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}