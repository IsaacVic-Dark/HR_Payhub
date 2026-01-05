type PayrunType = {
  id: number;
  organization_id: number;
  payrun_name: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_frequency: string;
  status: string;
  total_gross_pay: number;
  total_deductions: number;
  total_net_pay: number;
  employee_count: number;
  created_by: number;
  reviewed_by: number | null;
  finalized_by: number | null;
  deleted_by: number | null;
  deleted_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  finalized_at: string | null;
  updated_at: string;
  creator_first_name: string;
  creator_surname: string;
  creator_email: string;
  creator_full_name: string;
  reviewer_first_name: string | null;
  reviewer_surname: string | null;
  reviewer_email: string | null;
  reviewer_full_name: string | null;
  finalizer_first_name: string | null;
  finalizer_surname: string | null;
  finalizer_email: string | null;
  finalizer_full_name: string | null;
  deleter_first_name: string | null;
  deleter_surname: string | null;
  deleter_email: string | null;
  deleter_full_name: string | null;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface PayrunsResponseData {
  payruns: PayrunType[];
  statistics?: {
    total_payruns: number;
    draft: number;
    reviewed: number;
    finalized: number;
    total_gross_pay: number;
    total_net_pay: number;
    total_employees: number;
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

interface PayrunFilters {
  status?: string;
  pay_frequency?: string;
  include_deleted?: boolean;
  page?: number;
  per_page?: number;
}

class PayrunAPI {
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

  private buildQueryParams(filters: PayrunFilters): string {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.pay_frequency) {
      params.append("pay_frequency", filters.pay_frequency);
    }
    if (filters.include_deleted) {
      params.append("include_deleted", "true");
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

  async getPayruns(
    organizationId: number,
    filters: PayrunFilters = {}
  ): Promise<ApiResponse<PayrunsResponseData>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/payruns${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PayrunsResponseData>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch payruns",
      };
    }
  }

  async getPayrunById(
    organizationId: number,
    payrunId: number
  ): Promise<ApiResponse<PayrunType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payrun/${payrunId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PayrunType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch payrun",
      };
    }
  }

  async createPayrun(
    organizationId: number,
    payrunData: {
      payrun_name: string;
      pay_period_start: string;
      pay_period_end: string;
      pay_frequency?: string;
      status?: string;
      total_gross_pay?: number;
      total_deductions?: number;
      total_net_pay?: number;
      employee_count?: number;
    }
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payruns`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payrunData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payrun",
      };
    }
  }

  async updatePayrun(
    organizationId: number,
    payrunId: number,
    payrunData: {
      payrun_name?: string;
      pay_period_start?: string;
      pay_period_end?: string;
      pay_frequency?: string;
      status?: string;
      total_gross_pay?: number;
      total_deductions?: number;
      total_net_pay?: number;
      employee_count?: number;
    }
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payrun/${payrunId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payrunData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update payrun",
      };
    }
  }

  async deletePayrun(
    organizationId: number,
    payrunId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payrun/${payrunId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete payrun",
      };
    }
  }
}

export const payrunAPI = new PayrunAPI();
export type { PayrunType, PayrunFilters, ApiResponse, PayrunsResponseData };
