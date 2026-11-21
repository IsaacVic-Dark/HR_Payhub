// Shared analytics types.
// These interfaces are written to mirror the shape the backend endpoint
// (e.g. GET /api/analytics/overview) is expected to return. When the real
// endpoint is wired up, only `services/api/analytics.ts` needs to change —
// every component below already consumes this shape.

export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface AnalyticsFilters {
  from: string; // ISO date, e.g. "2026-06-01"
  to: string; // ISO date, e.g. "2026-08-31"
  period: PeriodPreset;
  departmentId: string | "all";
  employeeId: string | "all";
}

export interface Department {
  id: string;
  name: string;
}

export interface EmployeeOption {
  id: string;
  name: string;
  departmentId: string;
}

export interface KpiDelta {
  /** percentage change vs. the previous equivalent period, e.g. 4.2 or -1.8 */
  value: number;
  direction: "up" | "down" | "flat";
}

export interface KpiSummary {
  currency: string;
  totalPayrollCost: number;
  totalNetPay: number;
  activeEmployees: number;
  totalEmployees: number;
  attendanceRate: number; // 0-100
  totalOvertimeHours: number;
  pendingApprovals: number;
  deltas: {
    totalPayrollCost: KpiDelta;
    attendanceRate: KpiDelta;
    totalOvertimeHours: KpiDelta;
    activeEmployees: KpiDelta;
  };
}

export interface PayrollCostPoint {
  period: string; // display label, e.g. "Jan", "Wk 1"
  gross: number;
  deductions: number;
  net: number;
}

export interface AttendanceOvertimePoint {
  period: string;
  attendanceRate: number; // 0-100
  overtimeHours: number;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  headcount: number;
  attendanceRate: number; // 0-100
  overtimeHours: number;
  payrollCost: number;
}

export type PayrunStatus = "completed" | "processing" | "pending_approval" | "failed";

export interface PayrunRecord {
  id: string;
  periodLabel: string; // e.g. "August 2026"
  runDate: string; // ISO date
  employeeCount: number;
  grossPay: number;
  netPay: number;
  status: PayrunStatus;
}

export interface AnalyticsResponse {
  period: {
    from: string;
    to: string;
    label: string;
  };
  kpis: KpiSummary;
  payrollCostTrend: PayrollCostPoint[];
  attendanceOvertimeTrend: AttendanceOvertimePoint[];
  departmentBreakdown: DepartmentSummary[];
  recentPayruns: PayrunRecord[];
}