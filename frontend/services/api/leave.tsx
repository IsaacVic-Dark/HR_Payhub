type LeaveType = {
  leave_id: number;
  employee_id: number;
  first_name: string;
  middle_name: string | null;
  surname: string;
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

type EmployeeLeaveType = {
  leave_id: number;
  employee_id: number;
  approver_id: number | null;
  reliever_id: number | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
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
  errors?: Record<string, string[]>; // Add errors field
  metadata?: any; // This now comes from response.meta
}

interface LeavesResponseData {
  leaves: LeaveType[];
  statistics?: {
    // Make optional since it's now in meta
    total_leaves: number;
    sick: number;
    casual: number;
    annual: number;
    maternity: number;
    paternity: number;
    other: number;
  };
  pagination?: {
    // Make optional since it's now in meta
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

interface EmployeeLeavesResponseData {
  leaves: EmployeeLeaveType[];
  metadata: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      total_pages: number;
      has_next: boolean;
      has_prev: boolean;
    };
    statistics: {
      total_leaves: number;
      by_status: {
        pending: number;
        approved: number;
        rejected: number;
        expired: number;
      };
      by_type: {
        sick: number;
        casual: number;
        annual: number;
        maternity: number;
        paternity: number;
        other: number;
      };
      days_summary: {
        total_days_taken: number;
        days_taken_current_year: number;
      };
    };
    filters: {
      status: string | null;
      leave_type: string | null;
      year: string;
      employee_id: string;
    };
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
        // New error format
        return {
          success: false,
          error: data.message || `HTTP error! status: ${response.status}`,
          errors: data.errors || {}, // Add errors field
          data: data.data, // Keep data if present
          message: data.message,
          metadata: data.metadata || {},
        };
      }

      // New success format
      return {
        success: true,
        data: data.data, // Data from response
        message: data.message,
        metadata: data.metadata || {}, // Changed from data.metadata to data.meta
        error: undefined, // Ensure error is undefined
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        errors: {}, // Add empty errors object
      };
    }
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
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

  private getAuthHeaders(): HeadersInit {
    // Get token from cookie
    const token = this.getCookie("access_token");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async getLeaves(
    organizationId: number,
    filters: LeaveFilters = {}
  ): Promise<ApiResponse<LeavesResponseData>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/leaves${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include", // Send cookies with request
        headers: this.getAuthHeaders(),
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

  async getEmployeeLeaves(
    organizationId: number,
    employeeId: number,
    filters: LeaveFilters = {}
  ): Promise<ApiResponse<EmployeeLeavesResponseData>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/employees/${employeeId}/leaves${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      const apiResponse = await this.handleResponse<any>(response);

      // Transform the response to match the expected structure
      if (apiResponse.success && apiResponse.data) {
        // Check if apiResponse.data is an array (like in Postman) or an object (like in your frontend)
        let leaves = [];
        let metadata = {};

        if (Array.isArray(apiResponse.data)) {
          // If data is an array (like Postman response)
          leaves = apiResponse.data;
          metadata = apiResponse.metadata || {};
        } else {
          // If data is an object with leaves property (like your frontend response)
          leaves = apiResponse.data.leaves || [];
          metadata = apiResponse.data.metadata || apiResponse.metadata || {};
        }

        return {
          success: true,
          data: {
            leaves: leaves,
            metadata: metadata,
          },
          message: apiResponse.message,
        };
      }

      return apiResponse;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch employee leaves",
        errors: {},
      };
    }
  }

  async approveLeave(
    organizationId: number,
    leaveId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/${leaveId}/approve`;

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
          error instanceof Error ? error.message : "Failed to approve leave",
      };
    }
  }

  async rejectLeave(
    organizationId: number,
    leaveId: number,
    rejectionReason?: string
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/${leaveId}/reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          rejection_reason: rejectionReason || "",
        }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to reject leave",
      };
    }
  }

  async createLeave(
    organizationId: number,
    leaveData: {
      employee_id: number;
      leave_type: string;
      start_date: string;
      end_date: string;
      reason?: string;
      approver_id?: number;
      reliever_id?: number;
    }
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(leaveData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create leave",
      };
    }
  }

  async getLeaveById(
    organizationId: number,
    leaveId: number
  ): Promise<ApiResponse<LeaveType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/${leaveId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<LeaveType>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch leave",
      };
    }
  }

  async deleteLeave(
    organizationId: number,
    leaveId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/${leaveId}`;

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
          error instanceof Error ? error.message : "Failed to delete leave",
      };
    }
  }
}

export const leaveAPI = new LeaveAPI();
export type {
  LeaveType,
  LeaveFilters,
  ApiResponse,
  LeavesResponseData,
  EmployeeLeaveType,
  EmployeeLeavesResponseData,
};
