// Mirrors services/api/leave.tsx conventions (ApiResponse shape, cookie auth,
// buildQueryParams, handleResponse). Route note: list/create use the plural
// `reimbursements` path; every other action is scoped under the singular
// `reimbursement/{id}` path (see backend/routes.php).

type ReimbursementStatus =
  | "draft"
  | "pending"
  | "managerapproved"
  | "hrapproved"
  | "financeapproved"
  | "rejected"
  | "scheduled"
  | "paid"
  | "partpaid"
  | "cancelled"
  | "failed"
  | "reversed";

type ReimbursementCategory =
  | "expense"
  | "travel"
  | "medical"
  | "training"
  | "transport"
  | "other";

type PayoutMethod =
  | "payroll"
  | "banktransfer"
  | "mpesa"
  | "cash"
  | "check"
  | "wallet";

// Shape returned by ReimbursementController::index()/show() — same columns
// for both admin and employee callers, scoping happens server-side.
type ReimbursementType = {
  id: number;
  organization_id: number;
  employee_id: number;
  payrun_id: number | null;
  payment_transaction_id: number | null;
  reimbursement_number: string;
  reimbursement_type: ReimbursementCategory;
  payout_method: PayoutMethod;
  amount_requested: string;
  amount_approved: string;
  amount_paid: string;
  currency: string;
  request_date: string;
  expense_date: string | null;
  approver_id: number | null;
  approved_at: string | null;
  paid_at: string | null;
  status: ReimbursementStatus;
  description: string | null;
  rejection_reason: string | null;
  payment_reference: string | null;
  external_reference: string | null;
  metadata: Record<string, any> | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  policy_config_id: number | null;
  original_currency: string;
  currency_rate: string;
  scheduled_payment_date: string | null;
  policy_validated: number;
  policy_validation_errors: string[] | null;
  receipt_count: number;
  receipts_validated: number;
  is_taxable: number;
  payslip_inclusion: "current" | "next" | "none";
  partial_approval_amount: string | null;
  is_disputed: number;
  disputed_reason: string | null;
  disputed_at: string | null;
  // joined columns
  employee_number?: string;
  employee_first_name?: string;
  employee_surname?: string;
  employee_full_name?: string;
  approver_first_name?: string | null;
  approver_surname?: string | null;
};

type ReimbursementItemType = {
  id: number;
  reimbursement_id: number;
  expense_category: string;
  expense_item: string | null;
  receipt_number: string | null;
  amount: string;
  tax_amount: string | null;
  currency: string;
  expense_date: string;
  vendor_name: string | null;
  notes: string | null;
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
};

type AuditLogType = {
  id: number;
  organization_id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
  firstname?: string | null;
  surname?: string | null;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface ReimbursementsResponseData {
  reimbursements: ReimbursementType[];
}

interface ReimbursementShowResponseData {
  reimbursement: ReimbursementType;
  items: ReimbursementItemType[];
  audit_trail: AuditLogType[];
}

interface ReimbursementFilters {
  status?: string;
  employee_id?: string;
  reimbursement_type?: string;
  payout_method?: string;
  is_disputed?: boolean;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}

// Items are built up client-side before the claim exists, then sent as a
// batch on create — matches ReimbursementController::store()'s expected
// `items: [...]` payload. file_hash is intentionally omitted: the
// reimbursementitems table has no such column (see chat write-up).
interface ReimbursementItemInput {
  expense_category: string;
  expense_item?: string | null;
  receipt_number?: string | null;
  amount: number;
  tax_amount?: number;
  currency?: string;
  expense_date: string;
  vendor_name?: string | null;
  notes?: string | null;
  receipt_path?: string | null;
}

interface CreateReimbursementPayload {
  employee_id?: number;
  reimbursement_type?: ReimbursementCategory;
  payout_method?: PayoutMethod;
  amount_requested?: number;
  currency?: string;
  original_currency?: string;
  currency_rate?: number;
  request_date?: string;
  expense_date?: string;
  description?: string | null;
  items: ReimbursementItemInput[];
}

class ReimbursementAPI {
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

  private buildQueryParams(filters: ReimbursementFilters): string {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.employee_id) params.append("employee_id", filters.employee_id);
    if (filters.reimbursement_type)
      params.append("reimbursement_type", filters.reimbursement_type);
    if (filters.payout_method) params.append("payout_method", filters.payout_method);
    if (filters.is_disputed) params.append("is_disputed", "1");
    if (filters.from_date) params.append("from_date", filters.from_date);
    if (filters.to_date) params.append("to_date", filters.to_date);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.per_page) params.append("per_page", filters.per_page.toString());
    return params.toString();
  }

  private base(organizationId: number): string {
    return `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}`;
  }

  private async post(url: string, body?: Record<string, any>): Promise<ApiResponse> {
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body ?? {}),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
  }

  // ---- Listing / detail --------------------------------------------------

  async getReimbursements(
    organizationId: number,
    filters: ReimbursementFilters = {}
  ): Promise<ApiResponse<ReimbursementsResponseData>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${this.base(organizationId)}/reimbursements${
        queryParams ? `?${queryParams}` : ""
      }`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<ReimbursementsResponseData>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch reimbursements",
      };
    }
  }

  async getReimbursement(
    organizationId: number,
    id: number
  ): Promise<ApiResponse<ReimbursementShowResponseData>> {
    try {
      const url = `${this.base(organizationId)}/reimbursement/${id}`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<ReimbursementShowResponseData>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch reimbursement",
      };
    }
  }

  // ---- Submission / edit / cancel ----------------------------------------

  async createReimbursement(
    organizationId: number,
    payload: CreateReimbursementPayload
  ): Promise<ApiResponse<{ id: number; reimbursement_number: string; status: string }>> {
    try {
      const url = `${this.base(organizationId)}/reimbursements`;
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
        error: error instanceof Error ? error.message : "Failed to submit reimbursement",
      };
    }
  }

  async updateReimbursement(
    organizationId: number,
    id: number,
    data: Partial<{
      reimbursement_type: ReimbursementCategory;
      payout_method: PayoutMethod;
      description: string | null;
      expense_date: string;
      currency: string;
      original_currency: string;
      currency_rate: number;
    }>
  ): Promise<ApiResponse> {
    try {
      const url = `${this.base(organizationId)}/reimbursement/${id}`;
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update reimbursement",
      };
    }
  }

  cancelReimbursement(organizationId: number, id: number, reason?: string) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/cancel`, { reason });
  }

  // ---- Approval workflow --------------------------------------------------

  approveReimbursement(
    organizationId: number,
    id: number,
    data: { approved_amount?: number; comments?: string } = {}
  ) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/approve`, data);
  }

  rejectReimbursement(organizationId: number, id: number, reason?: string) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/reject`, { reason });
  }

  requestClarification(organizationId: number, id: number, notes: string) {
    return this.post(
      `${this.base(organizationId)}/reimbursement/${id}/request-clarification`,
      { notes }
    );
  }

  // ---- Dispute --------------------------------------------------------------

  disputeReimbursement(organizationId: number, id: number, reason: string) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/dispute`, { reason });
  }

  resolveDispute(
    organizationId: number,
    id: number,
    data: { decision: "confirm" | "increase" | "reject"; new_amount?: number; comments?: string }
  ) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/resolve-dispute`, data);
  }

  // ---- Payment --------------------------------------------------------------

  processPayment(
    organizationId: number,
    id: number,
    data: { phone?: string; reference?: string } = {}
  ) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/process-payment`, data);
  }

  confirmPayment(
    organizationId: number,
    id: number,
    data: { amount_paid?: number; payment_reference?: string } = {}
  ) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/confirm-payment`, data);
  }

  failPayment(organizationId: number, id: number, reason?: string) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/fail-payment`, { reason });
  }

  reverseReimbursement(organizationId: number, id: number, reason?: string) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/reverse`, { reason });
  }

  attachToPayrun(organizationId: number, id: number, payrunId?: number) {
    return this.post(`${this.base(organizationId)}/reimbursement/${id}/attach-payrun`, {
      payrun_id: payrunId,
    });
  }

  markPayrollReimbursementsPaid(organizationId: number, payrunId: number) {
    return this.post(
      `${this.base(organizationId)}/reimbursement/payrun/${payrunId}/mark-paid`
    );
  }

  // ---- Items ---------------------------------------------------------------

  async getReimbursementItems(
    organizationId: number,
    reimbursementId: number
  ): Promise<ApiResponse<ReimbursementItemType[]>> {
    try {
      const url = `${this.base(organizationId)}/reimbursement/${reimbursementId}/items`;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<ReimbursementItemType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch items",
      };
    }
  }

  async addReimbursementItem(
    organizationId: number,
    reimbursementId: number,
    item: ReimbursementItemInput
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${this.base(organizationId)}/reimbursement/${reimbursementId}/items`;
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(item),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add item",
      };
    }
  }

  async updateReimbursementItem(
    organizationId: number,
    reimbursementId: number,
    itemId: number,
    item: Partial<ReimbursementItemInput>
  ): Promise<ApiResponse> {
    try {
      const url = `${this.base(organizationId)}/reimbursement/${reimbursementId}/items/${itemId}`;
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(item),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update item",
      };
    }
  }

  async deleteReimbursementItem(
    organizationId: number,
    reimbursementId: number,
    itemId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${this.base(organizationId)}/reimbursement/${reimbursementId}/items/${itemId}`;
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete item",
      };
    }
  }
}

export const reimbursementAPI = new ReimbursementAPI();
export type {
  ReimbursementType,
  ReimbursementItemType,
  AuditLogType,
  ReimbursementStatus,
  ReimbursementCategory,
  PayoutMethod,
  ReimbursementFilters,
  ReimbursementItemInput,
  CreateReimbursementPayload,
  ReimbursementsResponseData,
  ReimbursementShowResponseData,
  ApiResponse,
};