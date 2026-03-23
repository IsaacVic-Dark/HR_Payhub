type LeaveType = {
  leave_id: number;
  employee_id: number;
  first_name: string;
  middle_name: string | null;
  surname: string;
  approver_id: number | null;
  reliever_id: number | null;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  leave_type_is_paid: number;
  leave_type_requires_approval: number;
  duration_days: string;
  is_half_day: number;
  half_day_period: string | null;
  rejection_reason: string | null;
  document_path: string | null;
  approved_at: string | null;
  rejected_at: string | null;
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
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  leave_type_is_paid: number;
  leave_type_requires_approval: number;
  duration_days: string;
  is_half_day: number;
  half_day_period: string | null;
  rejection_reason: string | null;
  document_path: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  start_date: string;
  end_date: string;
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

// Minimal leave type returned when with_minimal=1
type MinimalLeaveType = {
  id: number;
  name: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface LeavesResponseData {
  leaves: LeaveType[];
  statistics?: {
    total_leaves: number;
    sick: number;
    casual: number;
    annual: number;
    maternity: number;
    paternity: number;
    other: number;
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
  leave_type_id?: string;
  name?: string;
  month?: string;
  year?: string;
  approver_id?: string;
  reliever_id?: string;
  page?: number;
  per_page?: number;
}

// Payload for creating a leave request
interface CreateLeavePayload {
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string | null;
  document_path?: string | null;
  is_half_day?: number;
  approver_id?: number | null;
  reliever_id?: number | null;
}

class LeaveAPI {
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

  private buildQueryParams(filters: LeaveFilters): string {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.leave_type) {
      params.append("leave_type", filters.leave_type);
    }
    if (filters.leave_type_id) {
      params.append("leave_type_id", filters.leave_type_id);
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
    const token = this.getCookie("access_token");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

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
        credentials: "include",
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

      if (apiResponse.success && apiResponse.data) {
        let leaves = [];
        let metadata = {};

        if (Array.isArray(apiResponse.data)) {
          leaves = apiResponse.data;
          metadata = apiResponse.metadata || {};
        } else {
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
    leaveData: CreateLeavePayload
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

  async cancelLeave(
    organizationId: number,
    leaveId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/${leaveId}/cancel`;
      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel leave",
      };
    }
  }

  async updateLeave(
    organizationId: number,
    leaveId: number,
    leaveData: Partial<{
      reason: string;
      approver_id: number | null;
      reliever_id: number | null;
      document_path: string | null;
      start_date: string;
      end_date: string;
      is_half_day: boolean;
      half_day_period: string | null;
      leave_type_id: number;
    }>
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/${leaveId}`;
      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(leaveData),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update leave",
      };
    }
  }

  async assignReliever(
    organizationId: number,
    leaveId: number,
    relieverId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/${leaveId}/assign-reliever`;
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reliever_id: relieverId }),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to assign reliever",
      };
    }
  }

  async getPendingApprovals(
    organizationId: number,
    approverId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leaves/pending-approvals?approver_id=${approverId}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch pending approvals",
      };
    }
  }

  // Pass with_minimal=true to get id+name only (used for dropdowns).
  // Omit or pass false to get full leave type data.
  async getLeaveTypes(
    organizationId: number,
    with_minimal?: boolean
  ): Promise<ApiResponse<MinimalLeaveType[]>> {
    try {
      const params = new URLSearchParams();
      if (with_minimal) {
        params.append("with_minimal", "1");
      }
      const query = params.toString();
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leave-types${
        query ? `?${query}` : ""
      }`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<MinimalLeaveType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch leave types",
      };
    }
  }

  async createLeaveType(
    organizationId: number,
    data: {
      name: string;
      code: string;
      description?: string;
      days_per_year?: number;
      is_paid?: number;
      requires_approval?: number;
      [key: string]: any;
    }
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leave-types`;
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create leave type",
      };
    }
  }

  async updateLeaveType(
    organizationId: number,
    typeId: number,
    data: Record<string, any>
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leave-types/${typeId}`;
      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update leave type",
      };
    }
  }

  async deleteLeaveType(
    organizationId: number,
    typeId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/leave-types/${typeId}`;
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete leave type",
      };
    }
  }
}

export const leaveAPI = new LeaveAPI();
export type {
  LeaveType,
  EmployeeLeaveType,
  MinimalLeaveType,
  LeaveFilters,
  ApiResponse,
  LeavesResponseData,
  EmployeeLeavesResponseData,
  CreateLeavePayload,
};