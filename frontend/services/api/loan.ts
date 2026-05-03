// ============================================================
// Loan API Service  — mirrors /services/api/leave.ts structure
// ============================================================

// --------------- Types -----------------------------------

export type LoanType = {
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
  status: "pending" | "approved" | "rejected" | "repaid";
  rejection_reason: string | null;
  approved_by: number | null;
  rejected_by: number | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
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
    settings: Record<string, unknown> | null;
  };
  approver: {
    id: number;
    full_name: string;
    email: string | null;
  } | null;
  rejecter: {
    id: number;
    full_name: string;
    email: string | null;
  } | null;
};

// Minimal loan type returned for dropdowns
export type MinimalLoanType = {
  id: number;
  name: string;
  interest_rate: number | null;
  max_amount: number | null;
};

export interface LoanFilters {
  status?: string;
  config_id?: string;
  employee_id?: string;
  name?: string;
  month?: string;
  year?: string;
  page?: number;
  per_page?: number;
}

export interface LoansResponseData {
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
      pending: number;
      approved: number;
      rejected: number;
      repaid: number;
    };
    by_type: Array<{
      loan_type_name: string;
      count: number;
      total_amount: string;
      total_outstanding: string;
    }>;
  };
}

export interface RecordRepaymentPayload {
  amount: number;
  repayment_date: string;          // "YYYY-MM-DD"
  method?: "manual" | "payroll_deduction";
  notes?: string | null;
  payrun_id?: number | null;
}

export interface RepaymentRecord {
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

export interface CreateLoanPayload {
  employee_id: number;
  config_id: number;
  amount: number;
  start_date: string;
  end_date?: string | null;
  interest_rate?: number | null;
  monthly_deduction?: number | null;
  purpose?: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

// --------------- API Class ------------------------------

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

  private buildQueryParams(filters: LoanFilters): string {
    const params = new URLSearchParams();
    if (filters.status)      params.append("status",      filters.status);
    if (filters.config_id)   params.append("config_id",   filters.config_id);
    if (filters.employee_id) params.append("employee_id", filters.employee_id);
    if (filters.name)        params.append("name",        filters.name);
    if (filters.month)       params.append("month",       filters.month);
    if (filters.year)        params.append("year",        filters.year);
    if (filters.page)        params.append("page",        filters.page.toString());
    if (filters.per_page)    params.append("per_page",    filters.per_page.toString());
    return params.toString();
  }

  // GET /organizations/{org_id}/loans
  async getLoans(
    organizationId: number,
    filters: LoanFilters = {}
  ): Promise<ApiResponse<LoansResponseData>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/loans${
        queryParams ? `?${queryParams}` : ""
      }`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<LoansResponseData>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch loans",
      };
    }
  }

  // GET /organizations/{org_id}/loans/{loan_id}
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

  // POST /organizations/{org_id}/loans  (HR/Admin creates on behalf of employee)
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

  // POST /organizations/{org_id}/employees/{emp_id}/loans  (employee self-service)
  async applyLoan(
    organizationId: number,
    employeeId: number,
    loanData: Omit<CreateLoanPayload, "employee_id">
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
        error: error instanceof Error ? error.message : "Failed to apply for loan",
      };
    }
  }

  // POST /organizations/{org_id}/loans/{loan_id}/approve
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

  // POST /organizations/{org_id}/loans/{loan_id}/reject
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

  // DELETE /organizations/{org_id}/loans/{loan_id}
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

  // GET /organizations/{org_id}/loan-types
  async getLoanTypes(organizationId: number): Promise<ApiResponse<MinimalLoanType[]>> {
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
  // POST /organizations/{org_id}/loans/{loan_id}/repayments
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

  // GET /organizations/{org_id}/loans/{loan_id}/repayments
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