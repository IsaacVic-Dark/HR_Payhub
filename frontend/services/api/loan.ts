// ============================================================
// Loan API Service
// Supports the 6-step approval workflow:
//   Step 1/2 — submit + system validation (applyLoan / createLoan)
//   Step 3   — Line Manager (managerApproveLoan / managerRejectLoan)
//   Step 4   — HR Manager (hrApproveLoan / hrRejectLoan / hrFlagCompliance)
//   Step 5   — Finance Manager (financeApproveLoan / financeRejectLoan)
//   Step 6   — Disbursement (disburseLoan)
//   Appeal   — submitAppeal / reviewAppeal
//   Repayments — recordRepayment / repaymentHistory
// ============================================================

// ─── Status ────────────────────────────────────────────────────────────────

type LoanStatus =
  | "pending"
  | "validated"
  | "system_rejected"
  | "manager_approved"
  | "manager_rejected"
  | "hr_approved"
  | "hr_rejected"
  | "compliance_review"
  | "finance_approved"
  | "finance_rejected"
  | "approved"
  | "active"
  | "rejected"
  | "repaid"
  | "appealed";

// ─── Core loan record ──────────────────────────────────────────────────────

type LoanType = {
  loan_id: number;
  organization_id: number;
  employee_id: number;
  config_id: number;

  amount: number;
  interest_rate: number | null;
  monthly_deduction: number | null;
  balance_remaining: number | null;
  total_repaid: number;

  start_date: string;
  end_date: string | null;
  purpose: string | null;
  status: LoanStatus;

  // Rejection reasons
  rejection_reason: string | null;
  system_rejection_reason: string | null;
  manager_rejection_reason: string | null;
  hr_rejection_reason: string | null;
  finance_rejection_reason: string | null;

  // Legacy approver (used after fast-track or disbursement)
  approved_by: number | null;
  rejected_by: number | null;
  approved_at: string | null;
  rejected_at: string | null;

  // Step 3 — Line Manager
  manager_approved_by: number | null;
  manager_approved_at: string | null;
  manager_rejected_by: number | null;
  manager_rejected_at: string | null;

  // Step 4 — HR Manager
  hr_approved_by: number | null;
  hr_approved_at: string | null;
  hr_rejected_by: number | null;
  hr_rejected_at: string | null;

  // Step 5 — Finance Manager
  finance_approved_by: number | null;
  finance_approved_at: string | null;
  finance_rejected_by: number | null;
  finance_rejected_at: string | null;

  // Step 6 — Disbursement
  disbursed_by: number | null;
  disbursed_at: string | null;
  disbursement_date: string | null;

  created_at: string;
  updated_at: string;

  // Formatted relations
  employee: {
    id: number;
    full_name: string;
    employee_number: string;
    email: string | null;
  };
  loan_type: {
    id: number;
    name: string;
    interest_rate: number | null;
    max_amount: number | null;
    finance_threshold: number | null;
    settings: Record<string, unknown> | null;
  };
  approver: { id: number; full_name: string; email: string | null } | null;
  rejecter: { id: number; full_name: string; email: string | null } | null;
};

// Minimal loan type returned for dropdowns
type MinimalLoanType = {
  id: number;
  name: string;
  interest_rate: number | null;
  max_amount: number | null;
  finance_threshold: number | null;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface LoansResponseData {
  loans: LoanType[];
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  statistics?: {
    total_loans: number;
    total_loaned: number;
    total_repaid: number;
    total_outstanding: number;
    by_status: {
      in_progress: number;
      approved: number;
      rejected: number;
      repaid: number;
    };
  };
}

interface EmployeeLoansResponseData {
  loans: LoanType[];
  metadata: {
    pagination: {
      current_page: number;
      per_page: number;
      total: number;
      total_pages: number;
      has_next: boolean;
      has_prev: boolean;
    };
    summary: {
      total_loans: number;
      total_loaned: number;
      total_repaid: number;
      total_outstanding: number;
    };
    employee_info: {
      employee_id: number;
      employee_name: string;
      email?: string | null;
    };
  };
}

interface LoanFilters {
  status?: string;
  config_id?: string;
  employee_id?: string;
  name?: string;
  month?: string;
  year?: string;
  page?: number;
  per_page?: number;
}

// ─── Payloads ────────────────────────────────────────────────────────────────

interface CreateLoanPayload {
  employee_id: number;
  config_id: number;
  amount: number;
  start_date: string;
  end_date?: string | null;
  interest_rate?: number | null;
  monthly_deduction?: number | null;
  purpose?: string | null;
}

interface ApplyLoanPayload {
  config_id: number;
  amount: number;
  start_date: string;
  end_date?: string | null;
  monthly_deduction?: number | null;
  purpose?: string | null;
}

interface RejectLoanPayload {
  rejection_reason: string;
}

interface DisbursePayload {
  disbursement_date?: string;
  monthly_deduction?: number;
  end_date?: string;
}

interface AppealPayload {
  appeal_reason: string;
  supporting_docs?: string | null;
}

interface ReviewAppealPayload {
  decision: "upheld" | "overturned";
  reason: string;
}

interface RecordRepaymentPayload {
  amount: number;
  repayment_date: string;
  method?: "manual" | "payroll_deduction";
  notes?: string | null;
  payrun_id?: number | null;
}

interface RepaymentRecord {
  id: number;
  loan_id: number;
  amount: number;
  balance_after: number;
  repayment_date: string;
  method: "manual" | "payroll_deduction";
  notes: string | null;
  payrun_id: number | null;
  created_at: string;
  recorded_by_name: string | null;
}

interface LoanAppeal {
  id: number;
  loan_id: number;
  employee_id: number;
  appeal_reason: string;
  supporting_docs: string | null;
  status: "pending" | "upheld" | "overturned";
  reviewed_by: number | null;
  reviewed_at: string | null;
  hr_decision: "upheld" | "overturned" | null;
  hr_decision_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Payload shape used by LoanActionDialog's onConfirm callback
interface ActionPayload {
  reason?: string;
  disbursement_date?: string;
  monthly_deduction?: string;
}

// ─── Role-based action helpers (used by UI components) ───────────────────────

/**
 * Returns the label and key for the primary workflow action available to a
 * given role on a loan at its current status.
 * Returns an empty array if no workflow action is available (view-only).
 */
type WorkflowAction =
  | "manager_approve"
  | "manager_reject"
  | "hr_approve"
  | "hr_reject"
  | "hr_flag_compliance"
  | "finance_approve"
  | "finance_reject"
  | "disburse"
  | "approve" // admin fast-track
  | "reject" // admin fast-track
  | "repayment"
  | "appeal"
  | "delete";

function getAvailableActions(
  loan: Pick<LoanType, "status" | "loan_id">,
  userType: string
): WorkflowAction[] {
  const { status } = loan;
  const actions: WorkflowAction[] = [];

  switch (userType) {
    case "admin":
      if (status === "validated")
        actions.push("manager_approve", "manager_reject");
      if (status === "manager_approved")
        actions.push("hr_approve", "hr_reject", "hr_flag_compliance");
      if (status === "hr_approved")
        actions.push("finance_approve", "finance_reject");
      if (status === "finance_approved") actions.push("disburse");
      if (["approved", "active"].includes(status)) actions.push("repayment");
      if (["pending", "validated"].includes(status)) actions.push("delete");
      break;

    case "department_manager":
      if (status === "validated")
        actions.push("manager_approve", "manager_reject");
      break;

    case "hr_manager":
      if (status === "validated")
        actions.push("manager_approve", "manager_reject");
      if (status === "manager_approved")
        actions.push("hr_approve", "hr_reject", "hr_flag_compliance");
      if (status === "appealed")
        actions.push("hr_approve"); // reviewing appeal re-enters at hr step
      break;

    case "finance_manager":
      if (status === "hr_approved")
        actions.push("finance_approve", "finance_reject");
      if (status === "finance_approved") actions.push("disburse");
      if (["approved", "active"].includes(status)) actions.push("repayment");
      break;

    case "payroll_manager":
      if (status === "finance_approved") actions.push("disburse");
      if (["approved", "active"].includes(status)) actions.push("repayment");
      break;

    case "payroll_officer":
      if (["approved", "active"].includes(status)) actions.push("repayment");
      break;

    case "employee":
      if (
        [
          "manager_rejected",
          "hr_rejected",
          "finance_rejected",
          "system_rejected",
          "rejected",
        ].includes(status)
      )
        actions.push("appeal");
      break;
  }

  return actions;
}

/** Human-readable label for a workflow action button */
const ACTION_LABELS: Record<WorkflowAction, string> = {
  manager_approve: "Approve",
  manager_reject: "Reject",
  hr_approve: "HR Approve",
  hr_reject: "HR Reject",
  hr_flag_compliance: "Flag for Compliance",
  finance_approve: "Finance Approve",
  finance_reject: "Finance Reject",
  disburse: "Set Up Disbursement",
  approve: "Approve",
  reject: "Reject",
  repayment: "Record Repayment",
  appeal: "Submit Appeal",
  delete: "Delete",
};

/** Status label + color config for badges */
const STATUS_CONFIG: Record<LoanStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  validated: { label: "Awaiting Manager", color: "bg-amber-100 text-amber-800" },
  system_rejected: { label: "System Rejected", color: "bg-red-100 text-red-800" },
  manager_approved: { label: "Awaiting HR", color: "bg-blue-100 text-blue-800" },
  manager_rejected: { label: "Manager Rejected", color: "bg-red-100 text-red-800" },
  hr_approved: { label: "Awaiting Finance", color: "bg-indigo-100 text-indigo-800" },
  hr_rejected: { label: "HR Rejected", color: "bg-red-100 text-red-800" },
  compliance_review: { label: "Compliance Review", color: "bg-purple-100 text-purple-800" },
  finance_approved: { label: "Awaiting Disburse", color: "bg-teal-100 text-teal-800" },
  finance_rejected: { label: "Finance Rejected", color: "bg-red-100 text-red-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  active: { label: "Active", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  repaid: { label: "Fully Repaid", color: "bg-gray-100 text-gray-600" },
  appealed: { label: "Under Appeal", color: "bg-orange-100 text-orange-800" },
};

/** Statuses where the loan is in an active approval pipeline */
const IN_PROGRESS_STATUSES: LoanStatus[] = [
  "pending",
  "validated",
  "manager_approved",
  "hr_approved",
  "finance_approved",
];

/** Statuses where the loan was rejected in some way */
const REJECTED_STATUSES: LoanStatus[] = [
  "system_rejected",
  "manager_rejected",
  "hr_rejected",
  "finance_rejected",
  "rejected",
];

// ─── API class ─────────────────────────────────────────────────────────────────

class LoanAPI {
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
        error: error instanceof Error ? error.message : "Unknown error occurred",
        errors: {},
      };
    }
  }

  private getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  }

  private buildQueryParams(filters: LoanFilters): string {
    const params = new URLSearchParams();

    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.config_id) {
      params.append("config_id", filters.config_id);
    }
    if (filters.employee_id) {
      params.append("employee_id", filters.employee_id);
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

  // ── Collection ────────────────────────────────────────────────────────────

  async getLoans(
    organizationId: number,
    filters: LoanFilters = {}
  ): Promise<ApiResponse<LoanType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/loans${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<LoanType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch loans",
      };
    }
  }

  async getLoanById(
    organizationId: number,
    loanId: number
  ): Promise<ApiResponse<LoanType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<LoanType>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch loan",
      };
    }
  }

  async getLoanTypes(
    organizationId: number
  ): Promise<ApiResponse<MinimalLoanType[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loan-types`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<MinimalLoanType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch loan types",
      };
    }
  }

  async getEmployeeLoans(
    organizationId: number,
    employeeId: number,
    filters: LoanFilters = {}
  ): Promise<ApiResponse<EmployeeLoansResponseData>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/employees/${employeeId}/loans${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      const apiResponse = await this.handleResponse<any>(response);

      if (apiResponse.success && apiResponse.data) {
        let loans = [];
        let metadata = {};

        if (Array.isArray(apiResponse.data)) {
          loans = apiResponse.data;
          metadata = apiResponse.metadata || {};
        } else {
          loans = apiResponse.data.loans || [];
          metadata = apiResponse.data.metadata || apiResponse.metadata || {};
        }

        return {
          success: true,
          data: {
            loans: loans,
            metadata: metadata,
          },
          message: apiResponse.message,
        };
      }

      return apiResponse;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch employee loans",
        errors: {},
      };
    }
  }

  // ── Create / Apply ─────────────────────────────────────────────────────────

  async createLoan(
    organizationId: number,
    loanData: CreateLoanPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(loanData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create loan",
      };
    }
  }

  async applyLoan(
    organizationId: number,
    employeeId: number,
    loanData: ApplyLoanPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/loans`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(loanData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit loan application",
      };
    }
  }

  // ── Update / Delete ────────────────────────────────────────────────────────

  async updateLoan(
    organizationId: number,
    loanId: number,
    loanData: Partial<CreateLoanPayload>
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(loanData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update loan",
      };
    }
  }

  async deleteLoan(
    organizationId: number,
    loanId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete loan",
      };
    }
  }

  // ── Step 3: Line Manager ───────────────────────────────────────────────────

  async managerApproveLoan(
    organizationId: number,
    loanId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/manager-approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve loan",
      };
    }
  }

  async managerRejectLoan(
    organizationId: number,
    loanId: number,
    rejectionReason: string
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/manager-reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason || "" }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject loan",
      };
    }
  }

  // ── Step 4: HR Manager ─────────────────────────────────────────────────────

  async hrApproveLoan(
    organizationId: number,
    loanId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/hr-approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve loan",
      };
    }
  }

  async hrRejectLoan(
    organizationId: number,
    loanId: number,
    rejectionReason: string
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/hr-reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason || "" }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject loan",
      };
    }
  }

  async hrFlagCompliance(
    organizationId: number,
    loanId: number,
    reason?: string
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/hr-flag-compliance`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason: reason ?? "" }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to flag loan for compliance review",
      };
    }
  }

  // ── Step 5: Finance Manager ────────────────────────────────────────────────

  async financeApproveLoan(
    organizationId: number,
    loanId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/finance-approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve loan",
      };
    }
  }

  async financeRejectLoan(
    organizationId: number,
    loanId: number,
    rejectionReason: string
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/finance-reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason || "" }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject loan",
      };
    }
  }

  // ── Step 6: Disbursement ───────────────────────────────────────────────────

  async disburseLoan(
    organizationId: number,
    loanId: number,
    payload: DisbursePayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/disburse`;

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
        error: error instanceof Error ? error.message : "Failed to set up disbursement",
      };
    }
  }

  // ── Admin fast-track ───────────────────────────────────────────────────────

  async approveLoan(
    organizationId: number,
    loanId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve loan",
      };
    }
  }

  async rejectLoan(
    organizationId: number,
    loanId: number,
    rejectionReason?: string
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason ?? "" }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reject loan",
      };
    }
  }

  // ── Appeal ─────────────────────────────────────────────────────────────────

  async submitAppeal(
    organizationId: number,
    loanId: number,
    payload: AppealPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/appeal`;

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
        error: error instanceof Error ? error.message : "Failed to submit appeal",
      };
    }
  }

  async reviewAppeal(
    organizationId: number,
    loanId: number,
    payload: ReviewAppealPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/appeal/review`;

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
        error: error instanceof Error ? error.message : "Failed to review appeal",
      };
    }
  }

  // ── Repayments ─────────────────────────────────────────────────────────────

  async recordRepayment(
    organizationId: number,
    loanId: number,
    payload: RecordRepaymentPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/repayments`;

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
        error: error instanceof Error ? error.message : "Failed to record repayment",
      };
    }
  }

  async repaymentHistory(
    organizationId: number,
    loanId: number
  ): Promise<ApiResponse<RepaymentRecord[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans/${loanId}/repayments`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<RepaymentRecord[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch repayment history",
      };
    }
  }
}

export const loanAPI = new LoanAPI();

export { getAvailableActions, ACTION_LABELS, STATUS_CONFIG, IN_PROGRESS_STATUSES, REJECTED_STATUSES };

export type {
  LoanStatus,
  LoanType,
  MinimalLoanType,
  LoanFilters,
  LoansResponseData,
  EmployeeLoansResponseData,
  ApiResponse,
  CreateLoanPayload,
  ApplyLoanPayload,
  RejectLoanPayload,
  DisbursePayload,
  AppealPayload,
  ReviewAppealPayload,
  RecordRepaymentPayload,
  RepaymentRecord,
  LoanAppeal,
  ActionPayload,
  WorkflowAction,
};