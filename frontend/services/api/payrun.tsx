type PayrunType = {
  id: number;
  organization_id: number;
  payrun_name: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_frequency: string; 
  status: string; 
  total_gross_pay: string;
  total_deductions: string;
  total_net_pay: string;
  employee_count: number;
  created_by: number;
  reviewed_by: number | null;
  finalized_by: number | null;
  updated_at: string;  
  created_at: string;
  reviewed_at: string | null;
  finalized_at: string | null;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface PayrunApiResponse {
  data: PayrunType[];
  message: string;
  metadata: {
    dev_mode: boolean;
  };
}

interface PayrunFilters {
  status?: string;
  search?: string;
  pay_frequency?: string;
  page?: number;
  limit?: number;
}

class PayrunAPI {
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP error! status: ${response.status}`,
        };
      }

      return {
        success: true,
        data: data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  private buildQueryParams(filters: PayrunFilters): string {
    const params = new URLSearchParams();
    
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.pay_frequency) {
      params.append('pay_frequency', filters.pay_frequency);
    }
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }

    return params.toString();
  }

  async getPayruns(organizationId: string, filters: PayrunFilters = {}): Promise<ApiResponse<PayrunApiResponse>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/payruns${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url, {
        method: "GET",
      });

      return this.handleResponse<PayrunApiResponse>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch payruns",
      };
    }
  }
}

export const payrunAPI = new PayrunAPI();
export type {
  PayrunType,
  ApiResponse,
  PayrunApiResponse,
  PayrunFilters,
};