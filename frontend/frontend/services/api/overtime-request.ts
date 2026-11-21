import type { OvertimeApprovalType } from "@/services/api/overtime-approval";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[] | string>;
  metadata?: any;
}

/** Date window the request modal should allow (current pay period start → today). */
type OvertimeRequestMeta = {
  today: string; // YYYY-MM-DD
  min_date: string; // YYYY-MM-DD — start of the current pay period
  period_label: string;
  period_source: "payrun" | "schedule";
  employee_id: number | null; // the logged-in user's own employee id (null if none)
};

type SubmitOvertimeRequestPayload = {
  /** Omit to request for yourself. admin / hr_manager may pass any employee id. */
  employee_id?: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  reason: string;
};

class OvertimeRequestAPI {
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (!response.ok) {
        // Surface the first field error when the backend sends one.
        const firstFieldError = data.errors
          ? Object.values(data.errors as Record<string, string | string[]>)
              .flat()
              .find(Boolean)
          : undefined;
        return {
          success: false,
          error:
            (firstFieldError as string | undefined) ||
            data.message ||
            `HTTP error! status: ${response.status}`,
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
        error: error instanceof Error ? error.message : "Unknown error occurred",
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
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private base(organizationId: number) {
    return `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}`;
  }

  async getMeta(organizationId: number): Promise<ApiResponse<OvertimeRequestMeta>> {
    try {
      const response = await fetch(`${this.base(organizationId)}/overtime-requests/meta`, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<OvertimeRequestMeta>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load overtime request window",
      };
    }
  }

  /** The logged-in user's own overtime (auto-detected + manual). */
  async getMyRequests(organizationId: number): Promise<ApiResponse<OvertimeApprovalType[]>> {
    try {
      const response = await fetch(`${this.base(organizationId)}/my-overtime-requests`, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<OvertimeApprovalType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch your overtime",
      };
    }
  }

  async submitRequest(
    organizationId: number,
    payload: SubmitOvertimeRequestPayload,
  ): Promise<ApiResponse<OvertimeApprovalType>> {
    try {
      const response = await fetch(`${this.base(organizationId)}/overtime-requests`, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      return this.handleResponse<OvertimeApprovalType>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit overtime request",
      };
    }
  }

  /** Withdraw a still-pending manual request. */
  async withdrawRequest(organizationId: number, id: number): Promise<ApiResponse<null>> {
    try {
      const response = await fetch(`${this.base(organizationId)}/overtime-requests/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<null>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to withdraw overtime request",
      };
    }
  }
}

export const overtimeRequestAPI = new OvertimeRequestAPI();
export type { OvertimeRequestMeta, SubmitOvertimeRequestPayload };
