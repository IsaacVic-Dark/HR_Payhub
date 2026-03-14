// ── p9forms table column types ────────────────────────────────────────────────
// Maps directly to p9forms schema:
// id, organizationid, employeeid, year, p9number, employee_pin,
// total_basic_salary, total_gross_pay, total_taxable_pay, total_paye,
// monthly_data (JSON), pdfpath, status ENUM('generated','sent','filed'), generatedat

type P9MonthlyDataType = {
  month: number;
  month_name: string;
  year: number;
  payrun_id: number | null;
  payrun_detail_id: number | null;
  // Earnings
  basic_salary: number;
  overtime_amount: number;
  bonus_amount: number;
  commission_amount: number;
  gross_pay: number;
  // Statutory deductions
  nssf: number;
  shif: number;
  housing_levy: number;
  // Tax computation
  taxable_pay: number;
  tax_before_relief: number;
  personal_relief: number;
  insurance_relief: number;
  paye: number;
  // Net
  net_pay: number;
};

type P9FormType = {
  id: number;
  organizationid: number;
  employeeid: number;
  year: number;
  p9number: string;
  employee_pin: string | null;
  total_basic_salary: number;
  total_gross_pay: number;
  total_taxable_pay: number;
  total_paye: number;
  monthly_data: P9MonthlyDataType[] | null;
  pdfpath: string | null;
  status: "generated" | "sent" | "filed";
  generatedat: string;
  // Joined fields (present on index / show responses)
  employee_number?: string;
  employee_name?: string;
  department_name?: string;
  organization_name?: string;
  employer_pin?: string;
};

// Returned by show() — p9_form header + decoded monthly_data array
type P9FormDetailType = {
  p9_form: Omit<P9FormType, "monthly_data">;
  monthly_data: P9MonthlyDataType[] | null;
};

// Summary rows returned by statistics()
type P9StatisticRowType = {
  year: number;
  status: "generated" | "sent" | "filed";
  form_count: number;
  sum_basic_salary: number;
  sum_gross_pay: number;
  sum_taxable_pay: number;
  sum_paye: number;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface PaginatedResponse<T> {
  p9_forms: T[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

// ── Filter / body interfaces ──────────────────────────────────────────────────

interface P9FormFilters {
  year?: number;
  employee_id?: number;
  department_id?: number;
  status?: "generated" | "sent" | "filed";
  page?: number;
  per_page?: number;
}

interface GenerateP9Body {
  year: number;
  employee_ids?: number[];
  regenerate?: boolean;
}

interface BulkSendBody {
  year: number;
}

interface MarkFiledBody {
  pdfpath?: string;
}

interface UpdatePdfPathBody {
  pdfpath: string;
}

// ── API class ─────────────────────────────────────────────────────────────────

class P9FormAPI {
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
          metadata: data.metadata || {},
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
        metadata: data.metadata || {},
        error: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        errors: {},
      };
    }
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getCookie("access_token");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private buildQueryParams(filters: P9FormFilters): string {
    const params = new URLSearchParams();

    if (filters.year) {
      params.append("year", filters.year.toString());
    }
    if (filters.employee_id) {
      params.append("employee_id", filters.employee_id.toString());
    }
    if (filters.department_id) {
      params.append("department_id", filters.department_id.toString());
    }
    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.page) {
      params.append("page", filters.page.toString());
    }
    if (filters.per_page) {
      params.append("per_page", filters.per_page.toString());
    }

    return params.toString();
  }

  // ── GET /organizations/{org_id}/p9-forms ────────────────────────────────────
  // Paginated list. Employees are automatically scoped to their own records
  // by the backend middleware — no extra filter needed on the frontend.
  async getP9Forms(
    organizationId: number,
    filters: P9FormFilters = {}
  ): Promise<ApiResponse<PaginatedResponse<P9FormType>>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/p9-forms${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PaginatedResponse<P9FormType>>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch P9 forms",
      };
    }
  }

  // ── GET /organizations/{org_id}/p9-forms/{id} ───────────────────────────────
  // Returns { p9_form, monthly_data } — monthly_data is the decoded 12-month
  // JSON array, separated from the header for easier rendering.
  async getP9FormById(
    organizationId: number,
    p9Id: number
  ): Promise<ApiResponse<P9FormDetailType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/p9-forms/${p9Id}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<P9FormDetailType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch P9 form",
      };
    }
  }

  // ── POST /organizations/{org_id}/p9-forms/generate ──────────────────────────
  // Generates P9 forms from finalized payrun_details for a given year.
  // Pass employee_ids to target specific employees; omit to include all active.
  // Pass regenerate: true to overwrite existing 'generated' records.
  async generateP9Forms(
    organizationId: number,
    body: GenerateP9Body
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/p9-forms/generate`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate P9 forms",
      };
    }
  }

  // ── POST /organizations/{org_id}/p9-forms/bulk-send ─────────────────────────
  // Marks all 'generated' P9 forms for a year as 'sent' in one call.
  // Returns { year, sent_count }.
  async bulkSendP9Forms(
    organizationId: number,
    body: BulkSendBody
  ): Promise<ApiResponse<{ year: number; sent_count: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/p9-forms/bulk-send`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });

      return this.handleResponse<{ year: number; sent_count: number }>(
        response
      );
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to bulk send P9 forms",
      };
    }
  }

  // ── POST /organizations/{org_id}/p9-forms/{id}/send ─────────────────────────
  // Advances a single P9: 'generated' → 'sent'.
  // Returns { p9_id, p9number, status }.
  async markP9Sent(
    organizationId: number,
    p9Id: number
  ): Promise<ApiResponse<{ p9_id: number; p9number: string; status: string }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/p9-forms/${p9Id}/send`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<{
        p9_id: number;
        p9number: string;
        status: string;
      }>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark P9 as sent",
      };
    }
  }

  // ── POST /organizations/{org_id}/p9-forms/{id}/file ─────────────────────────
  // Advances a single P9: 'sent' → 'filed'.
  // Optionally accepts a pdfpath to store alongside the status change.
  // Returns { p9_id, p9number, status, pdfpath }.
  async markP9Filed(
    organizationId: number,
    p9Id: number,
    body: MarkFiledBody = {}
  ): Promise<
    ApiResponse<{
      p9_id: number;
      p9number: string;
      status: string;
      pdfpath: string | null;
    }>
  > {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/p9-forms/${p9Id}/file`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });

      return this.handleResponse<{
        p9_id: number;
        p9number: string;
        status: string;
        pdfpath: string | null;
      }>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark P9 as filed",
      };
    }
  }

  // ── PATCH /organizations/{org_id}/p9-forms/{id}/pdf-path ────────────────────
  // Stores the server-side PDF path after PDF generation.
  // Works on any status. Returns { p9_id, pdfpath }.
  async updateP9PdfPath(
    organizationId: number,
    p9Id: number,
    body: UpdatePdfPathBody
  ): Promise<ApiResponse<{ p9_id: number; pdfpath: string }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/p9-forms/${p9Id}/pdf-path`;

      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });

      return this.handleResponse<{ p9_id: number; pdfpath: string }>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update PDF path",
      };
    }
  }

  // ── GET /organizations/{org_id}/p9-forms/statistics ─────────────────────────
  // Aggregate totals grouped by year and status.
  // Optional filter: ?year=2024
  async getP9Statistics(
    organizationId: number,
    year?: number
  ): Promise<ApiResponse<P9StatisticRowType[]>> {
    try {
      const params = year ? `?year=${year}` : "";
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/p9-forms/statistics${params}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<P9StatisticRowType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch P9 statistics",
      };
    }
  }

  // ── GET /organizations/{org_id}/employees/{id}/p9-forms ─────────────────────
  // All P9 forms for one employee across all years.
  // monthly_data is excluded from this list — use getP9FormById for full detail.
  async getEmployeeP9Forms(
    organizationId: number,
    employeeId: number
  ): Promise<ApiResponse<P9FormType[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/p9-forms`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<P9FormType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch employee P9 forms",
      };
    }
  }
}

export const p9FormAPI = new P9FormAPI();
export type {
  P9FormType,
  P9FormDetailType,
  P9MonthlyDataType,
  P9StatisticRowType,
  P9FormFilters,
  GenerateP9Body,
  BulkSendBody,
  MarkFiledBody,
  UpdatePdfPathBody,
  ApiResponse,
  PaginatedResponse,
};