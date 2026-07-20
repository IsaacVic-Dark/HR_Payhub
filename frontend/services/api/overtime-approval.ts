type OvertimeApprovalStatus = "pending" | "approved" | "rejected" | "deleted_pending";
type OvertimeResolution = "off_cycle" | "carry_forward" | null;

type OvertimeApprovalType = {
  id: number;
  organization_id: number;
  attendance_day_id: number;
  employee_id: number;
  overtime_minutes: number;
  overtime_rate: number | null;
  overtime_amount: number | null;
  requested_by: number | null;
  approved_by: number | null;
  rejected_by: number | null;
  status: OvertimeApprovalStatus;
  approval_notes: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  salary_included: 0 | 1;
  // Locked-period resolution lifecycle (see OvertimeApprovalController::resolve)
  finalized_period_payrun_id: number | null;
  resolution: OvertimeResolution;
  resolved_payrun_id: number | null;
  resolved_by: number | null;
  resolved_at: string | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
  // Joined fields from index()
  employee_number: string;
  firstname: string;
  middlename: string | null;
  surname: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  scheduled_minutes: number;
};

interface MatchedPayrunSummary {
  id: number;
  name: string;
  status: string;
}

// approve() returns the plain row normally, or this shape when the
// attendance date falls inside an already reviewed/finalized payrun.
type OvertimeApproveResult = OvertimeApprovalType & {
  requires_resolution?: boolean;
  matched_payrun?: MatchedPayrunSummary;
  resolution_options?: ("off_cycle" | "carry_forward")[];
};

type ResolveOffCycleResult = {
  off_cycle_payrun_id: number;
  original_payrun_id: number;
  overtime_amount: number;
  delta_total_deductions: number;
  delta_net_pay: number;
  status: string;
  message: string;
};

type ResolveCarryForwardResult = {
  resolution: "carry_forward";
  status: "applied" | "pending";
  target_payrun_id?: number;
  target_payrun_name?: string;
  employee_id?: number;
  overtime_amount: number;
  message: string;
};

type ResolveResult = ResolveOffCycleResult | ResolveCarryForwardResult;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

class OvertimeApprovalAPI {
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

  async getOvertimeApprovals(
    organizationId: number,
    status: OvertimeApprovalStatus = "pending",
  ): Promise<ApiResponse<OvertimeApprovalType[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/overtime-approvals?status=${status}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<OvertimeApprovalType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch overtime approvals",
      };
    }
  }

  async approveOvertime(
    organizationId: number,
    id: number,
    data: { overtime_rate?: number; approval_notes?: string } = {},
  ): Promise<ApiResponse<OvertimeApproveResult>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/overtime-approvals/${id}/approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });

      return this.handleResponse<OvertimeApproveResult>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to approve overtime",
      };
    }
  }

  async rejectOvertime(
    organizationId: number,
    id: number,
    rejectionReason: string,
  ): Promise<ApiResponse<OvertimeApprovalType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/overtime-approvals/${id}/reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });

      return this.handleResponse<OvertimeApprovalType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to reject overtime",
      };
    }
  }

  // resolution: "off_cycle" (only valid once the matched payrun is finalized)
  //           | "carry_forward" (valid from reviewed or finalized)
  async resolveOvertime(
    organizationId: number,
    id: number,
    resolution: "off_cycle" | "carry_forward",
  ): Promise<ApiResponse<ResolveResult>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/overtime-approvals/${id}/resolve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ resolution }),
      });

      return this.handleResponse<ResolveResult>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to resolve overtime",
      };
    }
  }
}

export const overtimeApprovalAPI = new OvertimeApprovalAPI();
export type {
  OvertimeApprovalType,
  OvertimeApprovalStatus,
  OvertimeResolution,
  MatchedPayrunSummary,
  OvertimeApproveResult,
  ResolveOffCycleResult,
  ResolveCarryForwardResult,
  ResolveResult,
  ApiResponse,
};