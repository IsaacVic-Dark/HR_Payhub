type LeaveType = {
  leave_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  employee_email: string | null;
  first_name: string;
  last_name: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface LeaveApiResponse {
  data: LeaveType[];
  message: string;
  metadata: any | null;
}

interface LeaveFilters {
  status?: string;
  leave_type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

class LeaveAPI {
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

  private buildQueryParams(filters: LeaveFilters): string {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.leave_type) {
      params.append("leave_type", filters.leave_type);
    }
    if (filters.search) {
      params.append("search", filters.search);
    }
    if (filters.page) {
      params.append("page", filters.page.toString());
    }
    if (filters.limit) {
      params.append("limit", filters.limit.toString());
    }

    return params.toString();
  }

  async getLeaves(filters: LeaveFilters = {}): Promise<ApiResponse<LeaveApiResponse>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/leaves${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
      });

      return this.handleResponse<LeaveApiResponse>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch leaves",
      };
    }
  }
}

export const leaveAPI = new LeaveAPI();
export type { LeaveType, LeaveApiResponse, LeaveFilters, ApiResponse };
