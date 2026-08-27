import type {
  AnalyticsFilters,
  AnalyticsResponse,
  Department,
  EmployeeOption,
} from "./types";

export const DEPARTMENTS: Department[] = [
  { id: "eng", name: "Engineering" },
  { id: "sales", name: "Sales" },
  { id: "ops", name: "Operations" },
  { id: "finance", name: "Finance" },
  { id: "support", name: "Customer Support" },
];

export const EMPLOYEES: EmployeeOption[] = [
  { id: "e1", name: "Amina Hassan", departmentId: "eng" },
  { id: "e2", name: "Brian Otieno", departmentId: "eng" },
  { id: "e3", name: "Cynthia Wafula", departmentId: "sales" },
  { id: "e4", name: "David Mwangi", departmentId: "ops" },
  { id: "e5", name: "Esther Njoroge", departmentId: "finance" },
  { id: "e6", name: "Farid Abdi", departmentId: "support" },
  { id: "e7", name: "Grace Kimani", departmentId: "sales" },
  { id: "e8", name: "Hassan Ali", departmentId: "ops" },
];

const MONTH_LABELS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const BASE_RESPONSE: AnalyticsResponse = {
  period: { from: "2026-03-01", to: "2026-08-31", label: "Last 6 months" },
  kpis: {
    currency: "KES",
    totalPayrollCost: 18_420_500,
    totalNetPay: 14_236_800,
    activeEmployees: 128,
    totalEmployees: 134,
    attendanceRate: 94.2,
    totalOvertimeHours: 612,
    pendingApprovals: 7,
    deltas: {
      totalPayrollCost: { value: 5.4, direction: "up" },
      attendanceRate: { value: 1.1, direction: "up" },
      totalOvertimeHours: { value: 8.3, direction: "down" },
      activeEmployees: { value: 2.4, direction: "up" },
    },
  },
  payrollCostTrend: [
    { period: "Mar", gross: 2_650_000, deductions: 640_000, net: 2_010_000 },
    { period: "Apr", gross: 2_780_000, deductions: 668_000, net: 2_112_000 },
    { period: "May", gross: 2_910_000, deductions: 702_000, net: 2_208_000 },
    { period: "Jun", gross: 3_040_000, deductions: 731_000, net: 2_309_000 },
    { period: "Jul", gross: 3_120_000, deductions: 748_000, net: 2_372_000 },
    { period: "Aug", gross: 3_220_500, deductions: 774_500, net: 2_446_000 },
  ],
  attendanceOvertimeTrend: [
    { period: "Mar", attendanceRate: 92.1, overtimeHours: 118 },
    { period: "Apr", attendanceRate: 92.8, overtimeHours: 104 },
    { period: "May", attendanceRate: 93.4, overtimeHours: 96 },
    { period: "Jun", attendanceRate: 93.9, overtimeHours: 108 },
    { period: "Jul", attendanceRate: 94.0, overtimeHours: 92 },
    { period: "Aug", attendanceRate: 94.2, overtimeHours: 94 },
  ],
  departmentBreakdown: [
    { id: "eng", name: "Engineering", headcount: 42, attendanceRate: 95.6, overtimeHours: 210, payrollCost: 7_120_000 },
    { id: "sales", name: "Sales", headcount: 28, attendanceRate: 91.8, overtimeHours: 96, payrollCost: 4_380_000 },
    { id: "ops", name: "Operations", headcount: 31, attendanceRate: 93.2, overtimeHours: 188, payrollCost: 3_960_000 },
    { id: "finance", name: "Finance", headcount: 14, attendanceRate: 96.9, overtimeHours: 42, payrollCost: 1_860_000 },
    { id: "support", name: "Customer Support", headcount: 19, attendanceRate: 94.4, overtimeHours: 76, payrollCost: 1_100_500 },
  ],
  recentPayruns: [
    { id: "pr-2026-08", periodLabel: "August 2026", runDate: "2026-08-28", employeeCount: 134, grossPay: 3_220_500, netPay: 2_446_000, status: "processing" },
    { id: "pr-2026-07", periodLabel: "July 2026", runDate: "2026-07-28", employeeCount: 131, grossPay: 3_120_000, netPay: 2_372_000, status: "completed" },
    { id: "pr-2026-06", periodLabel: "June 2026", runDate: "2026-06-28", employeeCount: 129, grossPay: 3_040_000, netPay: 2_309_000, status: "completed" },
    { id: "pr-2026-05", periodLabel: "May 2026", runDate: "2026-05-28", employeeCount: 127, grossPay: 2_910_000, netPay: 2_208_000, status: "completed" },
  ],
};

/**
 * Deterministic pseudo-filtering so the UI reacts visibly to filter changes
 * even though the source is static. Replace this whole function with a
 * fetch() to the real endpoint later — the return shape stays identical.
 */
function scaleForFilters(filters: AnalyticsFilters): AnalyticsResponse {
  const dept = filters.departmentId !== "all"
    ? BASE_RESPONSE.departmentBreakdown.find((d) => d.id === filters.departmentId)
    : undefined;

  const scale = filters.employeeId !== "all" ? 1 / 24 : dept
    ? dept.headcount / BASE_RESPONSE.kpis.activeEmployees
    : 1;

  const departmentBreakdown = filters.departmentId === "all"
    ? BASE_RESPONSE.departmentBreakdown
    : BASE_RESPONSE.departmentBreakdown.filter((d) => d.id === filters.departmentId);

  return {
    ...BASE_RESPONSE,
    period: { ...BASE_RESPONSE.period, label: periodLabelFor(filters) },
    kpis: {
      ...BASE_RESPONSE.kpis,
      totalPayrollCost: Math.round(BASE_RESPONSE.kpis.totalPayrollCost * scale),
      totalNetPay: Math.round(BASE_RESPONSE.kpis.totalNetPay * scale),
      activeEmployees: dept ? dept.headcount : filters.employeeId !== "all" ? 1 : BASE_RESPONSE.kpis.activeEmployees,
      totalOvertimeHours: Math.round(BASE_RESPONSE.kpis.totalOvertimeHours * scale),
    },
    payrollCostTrend: BASE_RESPONSE.payrollCostTrend.map((p) => ({
      ...p,
      gross: Math.round(p.gross * scale),
      deductions: Math.round(p.deductions * scale),
      net: Math.round(p.net * scale),
    })),
    attendanceOvertimeTrend: BASE_RESPONSE.attendanceOvertimeTrend.map((p) => ({
      ...p,
      overtimeHours: Math.round(p.overtimeHours * scale),
    })),
    departmentBreakdown,
  };
}

function periodLabelFor(filters: AnalyticsFilters): string {
  switch (filters.period) {
    case "this_month":
      return "This month";
    case "last_month":
      return "Last month";
    case "this_quarter":
      return "This quarter";
    case "this_year":
      return "This year";
    default:
      return `${filters.from} – ${filters.to}`;
  }
}

/**
 * Mirrors the eventual `GET /api/analytics/overview` call.
 * Swap the body of this function for a real `apiClient.get(...)` call
 * (see services/api/employee.ts for the existing pattern) once the
 * backend endpoint is ready — no caller needs to change.
 */
export async function fetchAnalytics(
  filters: AnalyticsFilters
): Promise<AnalyticsResponse> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return scaleForFilters(filters);
}

export { MONTH_LABELS };