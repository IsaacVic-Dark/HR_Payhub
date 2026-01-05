type PayrunDetailType = {
  id: number;
  payrun_id: number;
  employee_id: number;
  basic_salary: number;
  overtime_amount: number;
  bonus_amount: number;
  commission_amount: number;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  employee_number: string;
  job_title: string;
  department: string;
  employee_first_name: string;
  employee_middle_name: string | null;
  employee_surname: string;
  employee_email: string;
  employee_full_name: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface PayrunDetailFilters {
  employee_id?: number;
  page?: number;
  per_page?: number;
}

class PayrunDetailAPI {
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

  private buildQueryParams(filters: PayrunDetailFilters): string {
    const params = new URLSearchParams();

    if (filters.employee_id) {
      params.append("employee_id", filters.employee_id.toString());
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

  async getPayrunEmployees(
    organizationId: number,
    payrunId: number,
    filters: PayrunDetailFilters = {}
  ): Promise<ApiResponse<PayrunDetailType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/payrun/${payrunId}/employees${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PayrunDetailType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch payrun employees",
      };
    }
  }

  async getPayrunDetailById(
    payrunId: number,
    detailId: number
  ): Promise<ApiResponse<PayrunDetailType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/payruns/${payrunId}/details/${detailId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PayrunDetailType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch payrun detail",
      };
    }
  }

  async createPayrunDetail(
    payrunId: number,
    detailData: {
      employee_id: number;
      basic_salary: number;
      overtime_amount?: number;
      bonus_amount?: number;
      commission_amount?: number;
      gross_pay: number;
      total_deductions: number;
      net_pay: number;
    }
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/payruns/${payrunId}/details`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(detailData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create payrun detail",
      };
    }
  }

  async updatePayrunDetail(
    payrunId: number,
    detailId: number,
    detailData: {
      employee_id?: number;
      basic_salary?: number;
      overtime_amount?: number;
      bonus_amount?: number;
      commission_amount?: number;
      gross_pay?: number;
      total_deductions?: number;
      net_pay?: number;
    }
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/payruns/${payrunId}/details/${detailId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(detailData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update payrun detail",
      };
    }
  }

  async deletePayrunDetail(
    payrunId: number,
    detailId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/payruns/${payrunId}/details/${detailId}`;

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
          error instanceof Error
            ? error.message
            : "Failed to delete payrun detail",
      };
    }
  }
}

export const payrunDetailAPI = new PayrunDetailAPI();
export type { PayrunDetailType, PayrunDetailFilters, ApiResponse };

