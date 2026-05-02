// services/api/payslip.ts

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PayslipStatus = "generated" | "sent" | "acknowledged";

export interface PayslipEarnings {
  basic_salary: number;
  overtime_amount: number;
  bonus_amount: number;
  commission_amount: number;
  gross_pay: number;
}

export interface PayslipDeductions {
  nssf: number;
  shif: number;
  housing_levy: number;
  taxable_income: number;
  tax_before_relief: number;
  personal_relief: number;
  paye: number;
  total_deductions: number;
}

export interface PayslipEmployee {
  id: number;
  full_name: string;
  employee_number: string;
  email: string | null;
}

export interface PayslipPayrun {
  id: number;
  payrun_name: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_frequency: string;
  status: string;
}

export interface PayslipType {
  payslip_id: number;
  organization_id: number;
  payrun_id: number;
  payrun_detail_id: number;
  employee_id: number;
  payslip_number: string;
  status: PayslipStatus;
  generated_at: string | null;
  sent_at: string | null;
  pdf_path: string | null;
  net_pay: number;
  payrun: PayslipPayrun;
  employee: PayslipEmployee;
  earnings: PayslipEarnings;
  deductions: PayslipDeductions;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PayslipPagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ─── Statistics (admin index metadata + dedicated statistics endpoint) ─────────

export interface PayslipStatistics {
  total_payslips: number;
  total_gross_pay: number;
  total_net_pay: number;
  total_deductions: number;
  by_status: {
    generated: number;
    sent: number;
    acknowledged: number;
  };
}

export interface StatisticsYearRow {
  year: number;
  total_payslips: number;
  generated_count: number;
  sent_count: number;
  acknowledged_count: number;
  total_gross_pay: string;
  total_net_pay: string;
  total_deductions: string;
  total_paye: string;
  total_nssf: string;
  total_shif: string;
  total_housing_levy: string;
}

// ─── Shared API response wrapper ──────────────────────────────────────────────
// Generic so both the employee page (ApiResponse<PayslipType[]>) and admin page
// (ApiResponse<PayslipType[]> with metadata.statistics) use the same shape.

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: {
    pagination?: PayslipPagination;
    statistics?: PayslipStatistics;
    employee_info?: {
      employee_id: number;
      employee_name: string;
      email: string | null;
    };
    payrun?: Partial<PayslipPayrun>;
    count?: number;
    [key: string]: unknown;
  };
}

// ─── Backward-compat alias kept for employee page ─────────────────────────────

export interface PayslipsResponseData {
  payslips: PayslipType[];
  metadata: {
    pagination: PayslipPagination;
    employee_info: {
      employee_id: number;
      employee_name: string;
      email: string | null;
    };
  };
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface PayslipFilters {
  page?: number;
  per_page?: number;
  status?: PayslipStatus | string;
  payrun_id?: number | string;   // admin: filter table by payrun
  employee_id?: number | string; // admin: filter table by employee
  month?: string;
  year?: string;
}

// ─── Action-specific response shapes ─────────────────────────────────────────

export interface GeneratePayslipsResponse {
  success: boolean;
  data?: { generated: number; skipped: number; errors: string[] } | null;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface BulkSendResponse {
  success: boolean;
  data?: { sent_count: number; payslip_ids: number[] } | null;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PayslipAPI class
//
// Auth strategy (employee file pattern, extended for admin):
//   1. Reads `access_token` cookie  → works for employee cookie-auth sessions
//   2. Falls back to localStorage `token` → works for admin SPA sessions
//
// Base URL (employee file pattern, extended for admin):
//   NEXT_PUBLIC_BACKEND_API_URL → NEXT_PUBLIC_API_URL → localhost fallback
//
// HTTP handling:
//   Centralised handleResponse() checks response.ok, extracts errors — keeps
//   the same behaviour the employee file relied on.
// ─────────────────────────────────────────────────────────────────────────────

class PayslipAPI {
  private get baseUrl(): string {
    return (
      process.env.NEXT_PUBLIC_BACKEND_API_URL ||
      "http://localhost:8000/api/v1"
    );
  }

  /** Cookie first (employee), localStorage fallback (admin) */
  private getToken(): string | null {
    if (typeof document !== "undefined") {
      const value = `; ${document.cookie}`;
      const parts = value.split("; access_token=");
      if (parts.length === 2) {
        const token = parts.pop()?.split(";").shift() ?? null;
        if (token) return token;
      }
    }
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private buildQueryParams(filters: PayslipFilters): string {
    const params = new URLSearchParams();
    const append = (key: string, val: unknown) => {
      if (val !== undefined && val !== null && val !== "") {
        params.append(key, String(val));
      }
    };
    append("page", filters.page);
    append("per_page", filters.per_page);
    append("status", filters.status);
    append("payrun_id", filters.payrun_id);
    append("employee_id", filters.employee_id);
    append("month", filters.month);
    append("year", filters.year);
    const str = params.toString();
    return str ? `?${str}` : "";
  }

  /** Centralised HTTP-status check + JSON parse — employee file pattern */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP error! status: ${response.status}`,
          errors: data.errors || {},
          data: data.data,
          message: data.message,
          metadata: data.metadata ?? {},
        };
      }
      return {
        success: true,
        data: data.data,
        message: data.message,
        metadata: data.metadata ?? {},
        error: undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
        errors: {},
      };
    }
  }

  // ─── GET /organizations/{org_id}/payslips ────────────────────────────────
  // Admin page — returns metadata.statistics alongside paginated payslips.
  async getPayslips(
    organizationId: number,
    filters: PayslipFilters = {}
  ): Promise<ApiResponse<PayslipType[]>> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payslips${this.buildQueryParams(filters)}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<PayslipType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payslips",
      };
    }
  }

  // ─── GET /organizations/{org_id}/payslips/{id} ───────────────────────────
  async getPayslip(
    organizationId: number,
    payslipId: number
  ): Promise<ApiResponse<PayslipType>> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payslips/${payslipId}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<PayslipType>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payslip",
      };
    }
  }

  // ─── GET /organizations/{org_id}/payslips/statistics ─────────────────────
  // Admin page stat cards.
  async getStatistics(
    organizationId: number,
    year?: number
  ): Promise<ApiResponse<StatisticsYearRow[]>> {
    try {
      const qs = year ? `?year=${year}` : "";
      const url = `${this.baseUrl}/organizations/${organizationId}/payslips/statistics${qs}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<StatisticsYearRow[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch statistics",
      };
    }
  }

  // ─── GET /organizations/{org_id}/employees/{emp_id}/payslips ─────────────
  // Employee page — signature identical to existing file; no changes needed there.
  async getEmployeePayslips(
    organizationId: number,
    employeeId: number,
    filters: PayslipFilters = {}
  ): Promise<ApiResponse<PayslipType[]>> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/employees/${employeeId}/payslips${this.buildQueryParams(filters)}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<PayslipType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payslips",
      };
    }
  }

  // ─── GET /organizations/{org_id}/payruns/{payrun_id}/payslips ────────────
  async getPayrunPayslips(
    organizationId: number,
    payrunId: number,
    filters: PayslipFilters = {}
  ): Promise<ApiResponse<PayslipType[]>> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payruns/${payrunId}/payslips${this.buildQueryParams(filters)}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<PayslipType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payrun payslips",
      };
    }
  }

  // ─── POST /organizations/{org_id}/payruns/{payrun_id}/payslips/generate ──
  async generatePayslips(
    organizationId: number,
    payrunId: number,
    payload: { employee_ids?: number[]; regenerate?: boolean } = {}
  ): Promise<GeneratePayslipsResponse> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payruns/${payrunId}/payslips/generate`;
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      return this.handleResponse<{ generated: number; skipped: number; errors: string[] }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate payslips",
      };
    }
  }

  // ─── POST /organizations/{org_id}/payruns/{payrun_id}/payslips/bulk-send ─
  async bulkSendPayslips(
    organizationId: number,
    payrunId: number
  ): Promise<BulkSendResponse> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payruns/${payrunId}/payslips/bulk-send`;
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<{ sent_count: number; payslip_ids: number[] }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to bulk send payslips",
      };
    }
  }

  // ─── POST /organizations/{org_id}/payruns/{payrun_id}/payslips/{id}/send ─
  async sendPayslip(
    organizationId: number,
    payrunId: number,
    payslipId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payruns/${payrunId}/payslips/${payslipId}/send`;
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send payslip",
      };
    }
  }

  // ─── POST /organizations/{org_id}/payslips/{id}/acknowledge ──────────────
  // Employee page — marks their own payslip as acknowledged.
  async acknowledgePayslip(
    organizationId: number,
    payslipId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payslips/${payslipId}/acknowledge`;
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to acknowledge payslip",
      };
    }
  }

  // ─── PATCH /organizations/{org_id}/payslips/{id}/pdf-path ────────────────
  async updatePdfPath(
    organizationId: number,
    payslipId: number,
    pdfPath: string
  ): Promise<ApiResponse> {
    try {
      const url = `${this.baseUrl}/organizations/${organizationId}/payslips/${payslipId}/pdf-path`;
      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ pdf_path: pdfPath }),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update PDF path",
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton — drop-in for both pages:
//   import { payslipAPI } from "@/services/api/payslip"
// ─────────────────────────────────────────────────────────────────────────────

export const payslipAPI = new PayslipAPI();