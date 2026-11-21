type PayrollType = {
  payroll_id: number;
  employee_id: number;
  employee_first_name: string;
  employee_middle_name: string | null;
  employee_surname: string;
  employee_full_name: string;
  employee_email: string | null;
  pay_period_month: number;
  pay_period_year: number;
  basic_salary: number;
  overtime_amount: number;
  bonus_amount: number;
  commission_amount: number;
  gross_pay: number;
  nssf: number;
  shif: number;
  housing_levy: number;
  taxable_income: number;
  tax_before_relief: number;
  personal_relief: number;
  paye: number;
  total_deductions: number;
  net_pay: number;
  status: 'pending' | 'approved' | 'paid';
  approved_by: number | null;
  approved_at: string | null;
  approver_full_name: string | null;
  paid_by: number | null;
  paid_at: string | null;
  paid_by_full_name: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface PayrollsResponseData {
  payrolls: PayrollType[];
  statistics?: {
    total_payrolls: number;
    pending: number;
    approved: number;
    paid: number;
  };
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

interface PayrollFilters {
  status?: string;
  month?: string;
  year?: string;
  name?: string;
  employee_id?: string;
  page?: number;
  per_page?: number;
}

interface GeneratePayrollPayload {
  employee_id: number;
  pay_period_month: number;
  pay_period_year: number;
  basic_salary?: number;
  overtime_amount?: number;
  bonus_amount?: number;
  commission_amount?: number;
}

class PayrollAPI {
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

  private buildQueryParams(filters: PayrollFilters): string {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.month) {
      params.append("month", filters.month);
    }
    if (filters.year) {
      params.append("year", filters.year);
    }
    if (filters.name) {
      params.append("name", filters.name);
    }
    if (filters.employee_id) {
      params.append("employee_id", filters.employee_id);
    }
    if (filters.page) {
      params.append("page", filters.page.toString());
    }
    if (filters.per_page) {
      params.append("per_page", filters.per_page.toString());
    }

    return params.toString();
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

  async getPayrolls(
    organizationId: number,
    filters: PayrollFilters = {}
  ): Promise<ApiResponse<PayrollType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/payrolls${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PayrollType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch payrolls",
      };
    }
  }

  async getPayrollById(
    organizationId: number,
    payrollId: number
  ): Promise<ApiResponse<PayrollType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payrolls/${payrollId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PayrollType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch payroll",
      };
    }
  }

  async generatePayroll(
    organizationId: number,
    payload: GeneratePayrollPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payrolls`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate payroll",
      };
    }
  }

  async approvePayroll(
    organizationId: number,
    payrollId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payrolls/${payrollId}/approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to approve payroll",
      };
    }
  }

  async markPayrollAsPaid(
    organizationId: number,
    payrollId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payrolls/${payrollId}/pay`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to mark payroll as paid",
      };
    }
  }
}

export const payrollAPI = new PayrollAPI();
export type {
  PayrollType,
  PayrollFilters,
  ApiResponse,
  PayrollsResponseData,
  GeneratePayrollPayload,
};

