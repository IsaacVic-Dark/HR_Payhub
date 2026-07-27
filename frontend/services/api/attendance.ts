// ─── Attendance Types ────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent" | "late" | "on_leave" | "half_day" | string;
type PunchType = "check_in" | "check_out";
type ApprovalStatus = "pending" | "approved" | "rejected";

type AttendanceJobTitle = {
  id: number;
  title: string;
};

// Row from `employee_attendance_days`, joined with basic employee/job-title info.
// Extra columns not enumerated by the controller are still accessible since the
// backend selects `ad.*` — hence the index signature.
type AttendanceDay = {
  id: number;
  organization_id: number;
  employee_id: number;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  scheduled_minutes: number | null;
  worked_minutes: number | null;
  late_minutes: number | null;
  status: AttendanceStatus;
  is_public_holiday: number;
  approval_status: ApprovalStatus | null;
  salary_included: number;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  firstname: string;
  middlename: string | null;
  surname: string;
  employee_number: string;
  job_title: AttendanceJobTitle | null;
  [key: string]: any;
};

// Row from `employee_attendance_punches`
type AttendancePunch = {
  id: number;
  organization_id: number;
  employee_id: number;
  attendance_date: string;
  punch_type: PunchType;
  punch_time: string;
  source: string | null;
  device_id: string | null;
  remarks: string | null;
  created_by: number;
  status: string;
  is_active: number;
  created_at: string;
  [key: string]: any;
};

// Row from `attendance_adjustments`
type AttendanceAdjustment = {
  id: number;
  attendance_day_id: number;
  action: "edit" | "late_entry" | "override" | string;
  old_value: any;
  new_value: any;
  reason: string | null;
  created_by: number;
  created_at: string;
  [key: string]: any;
};

// Row from `overtime_approvals`
type OvertimeApproval = {
  id: number;
  attendance_day_id: number;
  overtime_minutes: number;
  status: ApprovalStatus;
  overtime_rate: number | null;
  approval_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
};

type AttendanceDayDetail = {
  summary: AttendanceDay | null;
  punches: AttendancePunch[];
  adjustments: AttendanceAdjustment[];
  overtime: OvertimeApproval | null;
};

type AttendanceDashboardMetadata = {
  filters: {
    employee_id: string | null;
    department_id: string | null;
    status: string | null;
    date_from: string | null;
    date_to: string | null;
  };
  total: number;
  dashboard_date: string;
  total_employees: number;
  present_count: number;
  on_leave_count: number;
  absent_count: number;
  late_count: number;
};

type PayrollSummaryRow = {
  employee_id: number;
  employee_number: string;
  firstname: string;
  middlename: string | null;
  surname: string;
  total_worked_minutes: number;
  payable_scheduled_minutes: number;
  total_late_minutes: number;
  approved_overtime_minutes: number;
  pending_overtime_minutes: number;
  absent_days: number;
  paid_holiday_work_days: number;
};

type PayrollSummaryMetadata = {
  date_from: string;
  date_to: string;
  total_employees: number;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface AttendanceFilters {
  employee_id?: string | number;
  department_id?: string | number;
  status?: string;
  date_from?: string;
  date_to?: string;
  // Overrides the dashboard tile counts independently of date_from/date_to.
  // Defaults server-side to today.
  date?: string;
}

// Body for POST .../attendance/check-in and .../attendance/check-out
interface CheckPunchPayload {
  source?: string;
  device_id?: string;
  remarks?: string;
}

// Body for POST .../employees/{employee_id}/attendance/manual
interface ManualPunchPayload {
  punch_type: PunchType;
  punch_time: string;
  source?: string;
  device_id?: string;
  remarks?: string;
  reason: string;
}

// Body for PUT .../employees/{employee_id}/attendance/{date}
interface AdjustDayPayload {
  check_in_time?: string;
  check_out_time?: string;
  reason: string;
}

// Body for the holiday-work approve/reject endpoints
interface HolidayWorkDecisionPayload {
  notes?: string;
}

interface OvertimeApprovalFilters {
  status?: ApprovalStatus;
}

// Body for POST .../overtime-approvals/{id}/approve
interface OvertimeApprovalDecisionPayload {
  overtime_rate?: number;
  approval_notes?: string;
}

// Body for POST .../overtime-approvals/{id}/reject
interface OvertimeRejectionPayload {
  rejection_reason: string;
}

class AttendanceAPI {
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

  private buildQueryParams(
    filters: Record<string, string | number | undefined | null>,
  ): string {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });

    return params.toString();
  }

  // ── Employee self-service: check-in / check-out ───────────────────────────

  // POST /organizations/{org_id}/attendance/check-in
  // Employee is derived from the session — no employee_id param needed.
  async checkIn(
    organizationId: number,
    payload: CheckPunchPayload = {},
  ): Promise<ApiResponse<AttendanceDay>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/attendance/check-in`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<AttendanceDay>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check in",
      };
    }
  }

  // POST /organizations/{org_id}/attendance/check-out
  async checkOut(
    organizationId: number,
    payload: CheckPunchPayload = {},
  ): Promise<ApiResponse<AttendanceDay>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/attendance/check-out`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<AttendanceDay>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check out",
      };
    }
  }

  // ── HR manual / biometric-device entry ─────────────────────────────────────

  // POST /organizations/{org_id}/employees/{employee_id}/attendance/manual
  // Used both for HR manual corrections and biometric-device relays.
  async manualPunch(
    organizationId: number,
    employeeId: number,
    payload: ManualPunchPayload,
  ): Promise<ApiResponse<AttendanceDay>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/attendance/manual`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<AttendanceDay>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to record manual punch",
      };
    }
  }

  // ── Listing & detail ───────────────────────────────────────────────────────

  // GET /organizations/{org_id}/attendance
  // Returns the raw list of attendance-day rows; dashboard tile counts and
  // applied filters come back in `metadata`.
  async getAttendance(
    organizationId: number,
    filters: AttendanceFilters = {},
  ): Promise<ApiResponse<AttendanceDay[]> & { metadata?: AttendanceDashboardMetadata }> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/attendance${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<AttendanceDay[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch attendance",
      };
    }
  }

  // GET /organizations/{org_id}/employees/{employee_id}/attendance/{date}
  // Full day detail: computed summary + raw punches + adjustments + overtime.
  // `date` must be "YYYY-MM-DD".
  async getAttendanceDay(
    organizationId: number,
    employeeId: number,
    date: string,
  ): Promise<ApiResponse<AttendanceDayDetail>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/attendance/${date}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<AttendanceDayDetail>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch attendance detail",
      };
    }
  }

  // PUT /organizations/{org_id}/employees/{employee_id}/attendance/{date}
  // HR correction of a day's check-in/check-out. Fully audit-logged server-side.
  async adjustDay(
    organizationId: number,
    employeeId: number,
    date: string,
    payload: AdjustDayPayload,
  ): Promise<ApiResponse<AttendanceDay>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/attendance/${date}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<AttendanceDay>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to correct attendance",
      };
    }
  }

  // ── Holiday-work approval (separate from overtime approval) ───────────────

  // POST /organizations/{org_id}/employees/{employee_id}/attendance/{date}/approve-holiday-work
  async approveHolidayWork(
    organizationId: number,
    employeeId: number,
    date: string,
    payload: HolidayWorkDecisionPayload = {},
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/attendance/${date}/approve-holiday-work`;

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
          error instanceof Error
            ? error.message
            : "Failed to approve holiday work",
      };
    }
  }

  // POST /organizations/{org_id}/employees/{employee_id}/attendance/{date}/reject-holiday-work
  async rejectHolidayWork(
    organizationId: number,
    employeeId: number,
    date: string,
    payload: HolidayWorkDecisionPayload = {},
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/attendance/${date}/reject-holiday-work`;

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
          error instanceof Error
            ? error.message
            : "Failed to reject holiday work",
      };
    }
  }

  // ── Payroll-ready summary ───────────────────────────────────────────────────

  // GET /organizations/{org_id}/attendance/payroll-summary?date_from=&date_to=
  async getPayrollSummary(
    organizationId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<ApiResponse<PayrollSummaryRow[]> & { metadata?: PayrollSummaryMetadata }> {
    try {
      const queryParams = this.buildQueryParams({
        date_from: dateFrom,
        date_to: dateTo,
      });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/attendance/payroll-summary?${queryParams}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PayrollSummaryRow[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch payroll attendance summary",
      };
    }
  }

  // ── Overtime approval workflow ─────────────────────────────────────────────
  // NB: OvertimeApprovalController wasn't available for reference either —
  // same caveat as the public-holiday methods above.

  // GET /organizations/{org_id}/overtime-approvals?status=
  async getOvertimeApprovals(
    organizationId: number,
    filters: OvertimeApprovalFilters = {},
  ): Promise<ApiResponse<OvertimeApproval[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/overtime-approvals${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<OvertimeApproval[]>(response);
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

  // POST /organizations/{org_id}/overtime-approvals/{id}/approve
  async approveOvertime(
    organizationId: number,
    overtimeApprovalId: number,
    payload: OvertimeApprovalDecisionPayload = {},
  ): Promise<ApiResponse<OvertimeApproval>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/overtime-approvals/${overtimeApprovalId}/approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<OvertimeApproval>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to approve overtime",
      };
    }
  }

  // POST /organizations/{org_id}/overtime-approvals/{id}/reject
  async rejectOvertime(
    organizationId: number,
    overtimeApprovalId: number,
    payload: OvertimeRejectionPayload,
  ): Promise<ApiResponse<OvertimeApproval>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/overtime-approvals/${overtimeApprovalId}/reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<OvertimeApproval>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to reject overtime",
      };
    }
  }
}

export const attendanceAPI = new AttendanceAPI();
export type {
  AttendanceStatus,
  PunchType,
  ApprovalStatus,
  AttendanceJobTitle,
  AttendanceDay,
  AttendancePunch,
  AttendanceAdjustment,
  OvertimeApproval,
  AttendanceDayDetail,
  AttendanceDashboardMetadata,
  PayrollSummaryRow,
  PayrollSummaryMetadata,
  PublicHoliday,
  ApiResponse,
  AttendanceFilters,
  CheckPunchPayload,
  ManualPunchPayload,
  AdjustDayPayload,
  HolidayWorkDecisionPayload,
  OvertimeApprovalFilters,
  OvertimeApprovalDecisionPayload,
  OvertimeRejectionPayload,
};