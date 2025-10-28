type LeaveType = {
  leave_id: number;
  employee_id: number;
  approver_id: number | null;
  reliever_id: number | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
  employee_email: string | null;
  employee_first_name: string;
  employee_middle_name: string | null;
  employee_surname: string;
  employee_full_name: string;
  approver_email: string | null;
  approver_first_name: string | null;
  approver_middle_name: string | null;
  approver_surname: string | null;
  approver_full_name: string | null;
  reliever_email: string | null;
  reliever_first_name: string | null;
  reliever_middle_name: string | null;
  reliever_surname: string | null;
  reliever_full_name: string | null;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: any;
}

interface LeavesResponseData {
  leaves: LeaveType[];
  statistics: {
    total_leaves: number;
    sick: number;
    casual: number;
    annual: number;
    maternity: number;
    paternity: number;
    other: number;
  };
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

interface LeaveFilters {
  status?: string;
  leave_type?: string;
  name?: string;
  month?: string;
  year?: string;
  approver_id?: string;
  reliever_id?: string;
  page?: number;
  per_page?: number;
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

      // Return the entire response data structure
      return {
        success: true,
        data: data, // Return the full response data
        message: data.message,
        metadata: data.metadata,
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
    if (filters.name) {
      params.append("name", filters.name);
    }
    if (filters.month) {
      params.append("month", filters.month);
    }
    if (filters.year) {
      params.append("year", filters.year);
    }
    if (filters.approver_id) {
      params.append("approver_id", filters.approver_id);
    }
    if (filters.reliever_id) {
      params.append("reliever_id", filters.reliever_id);
    }
    if (filters.page) {
      params.append("page", filters.page.toString());
    }
    if (filters.per_page) {
      params.append("per_page", filters.per_page.toString());
    }

    return params.toString();
  }

  async getLeaves(filters: LeaveFilters = {}): Promise<ApiResponse<LeavesResponseData>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/leaves${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
      });

      return this.handleResponse<LeavesResponseData>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch leaves",
      };
    }
  }

  async updateLeaveStatus(leaveId: number, status: string): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/leaves/${leaveId}/status`;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update leave status",
      };
    }
  }
}

export const leaveAPI = new LeaveAPI();
export type { LeaveType, LeaveFilters, ApiResponse, LeavesResponseData };