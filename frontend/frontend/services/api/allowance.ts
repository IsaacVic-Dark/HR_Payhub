type AllowanceCategory =
  | "housing"
  | "transport"
  | "meal"
  | "medical"
  | "travel"
  | "responsibility";

type PaymentNature = "cash" | "non_cash";

type AllowanceFrequency =
  | "one_time"
  | "monthly"
  | "weekly"
  | "daily"
  | "per_pay_run"
  | "per_event";

// Full enum as stored in the DB. Only FIXED_AMOUNT / PERCENTAGE_OF_BASIC /
// PERCENTAGE_OF_GROSS are accepted by the backend at create/update time —
// the rest exist for forward-compatibility (phase 2) and are only ever
// something you'd *see* on an existing row, never something the create/edit
// form lets you pick.
type CalculationMethod =
  | "FIXED_AMOUNT"
  | "PERCENTAGE_OF_BASIC"
  | "PERCENTAGE_OF_GROSS"
  | "PER_DAY"
  | "PER_UNIT"
  | "FORMULA"
  | "ACTUAL_EXPENSE";

type SupportedCalculationMethod =
  | "FIXED_AMOUNT"
  | "PERCENTAGE_OF_BASIC"
  | "PERCENTAGE_OF_GROSS";

type AllowanceTypeStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

type EmployeeAllowanceStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED"
  | "EXPIRED"
  | "CANCELLED";

// Shape returned by AllowanceTypeController::index()/show()/store()/update()
type AllowanceTypeType = {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  description: string | null;
  category: AllowanceCategory;
  payment_nature: PaymentNature;
  frequency: AllowanceFrequency;
  calculation_method: CalculationMethod;
  amount: string | null;
  percentage: string | null;
  formula_expression: string | null;
  unit_name: string | null;
  is_recurring: number;
  requires_receipt: number;
  taxable_income: number;
  taxable_limit: string | null;
  effective_from: string | null;
  effective_to: string | null;
  status: AllowanceTypeStatus;
  created_by: number | null;
  created_at: string;
  updated_by: number | null;
  updated_at: string;
};

// Shape returned by EmployeeAllowanceController::index()/show() — joins in
// allowance_types + employees columns (see findOrFail() on the backend).
type EmployeeAllowanceType = {
  id: number;
  organization_id: number;
  employee_id: number;
  allowance_type_id: number;
  amount: string | null;
  percentage: string | null;
  formula_override: string | null;
  start_date: string;
  end_date: string | null;
  eligibility_reason: string | null;
  status: EmployeeAllowanceStatus;
  requested_by: number | null;
  requested_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  rejected_by: number | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  supporting_document_id: number | null;
  created_at: string;
  updated_at: string;
  // joined columns
  allowance_name: string;
  allowance_code: string;
  category: AllowanceCategory;
  calculation_method: CalculationMethod;
  taxable_income: number;
  taxable_limit: string | null;
  type_default_amount?: string | null;
  type_default_percentage?: string | null;
  employee_name?: string;
  employee_number?: string;
};

// employee_allowance_payrun_lines row, as returned by
// EmployeeAllowanceController::indexForPayrun()
type AttachedAllowanceLineType = {
  attach_line_id: number;
  attached_at: string;
  employee_allowance_id: number;
  employee_id: number;
  amount: string | null;
  percentage: string | null;
  allowance_name: string;
  calculation_method: CalculationMethod;
  taxable_income: number;
  taxable_limit: string | null;
  employee_name: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface AllowanceTypeFilters {
  category?: AllowanceCategory;
  status?: AllowanceTypeStatus;
  search?: string;
  page?: number;
  per_page?: number;
}

interface EmployeeAllowanceFilters {
  employee_id?: string | number;
  allowance_type_id?: string | number;
  status?: EmployeeAllowanceStatus;
  page?: number;
  per_page?: number;
}

interface CreateAllowanceTypePayload {
  name: string;
  code: string;
  description?: string | null;
  category: AllowanceCategory;
  payment_nature?: PaymentNature;
  frequency?: AllowanceFrequency;
  calculation_method: SupportedCalculationMethod;
  amount?: number | null;
  percentage?: number | null;
  is_recurring?: boolean;
  requires_receipt?: boolean;
  taxable_income?: boolean;
  taxable_limit?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status?: AllowanceTypeStatus;
}

interface CreateEmployeeAllowancePayload {
  employee_id: number;
  allowance_type_id: number;
  amount?: number | null;
  percentage?: number | null;
  start_date: string;
  end_date?: string | null;
  eligibility_reason?: string | null;
  supporting_document_id?: number | null;
  submit?: boolean;
}

class AllowanceAPI {
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

  private buildAllowanceTypeQueryParams(filters: AllowanceTypeFilters): string {
    const params = new URLSearchParams();
    if (filters.category) params.append("category", filters.category);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.per_page) params.append("per_page", filters.per_page.toString());
    return params.toString();
  }

  private buildEmployeeAllowanceQueryParams(filters: EmployeeAllowanceFilters): string {
    const params = new URLSearchParams();
    if (filters.employee_id) params.append("employee_id", filters.employee_id.toString());
    if (filters.allowance_type_id)
      params.append("allowance_type_id", filters.allowance_type_id.toString());
    if (filters.status) params.append("status", filters.status);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.per_page) params.append("per_page", filters.per_page.toString());
    return params.toString();
  }

  private base(organizationId: number): string {
    return `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}`;
  }

  private async get<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
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

  private async put(url: string, body?: Record<string, any>): Promise<ApiResponse> {
    try {
      const response = await fetch(url, {
        method: "PUT",
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

  private async delete(url: string): Promise<ApiResponse> {
    try {
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
  }

  // =========================================================================
  // Allowance Types (org catalogue)
  // =========================================================================

  getAllowanceTypes(
    organizationId: number,
    filters: AllowanceTypeFilters = {}
  ): Promise<ApiResponse<AllowanceTypeType[]>> {
    const queryParams = this.buildAllowanceTypeQueryParams(filters);
    const url = `${this.base(organizationId)}/allowance-types${queryParams ? `?${queryParams}` : ""}`;
    return this.get<AllowanceTypeType[]>(url);
  }

  getAllowanceType(organizationId: number, id: number): Promise<ApiResponse<AllowanceTypeType>> {
    return this.get<AllowanceTypeType>(`${this.base(organizationId)}/allowance-types/${id}`);
  }

  createAllowanceType(
    organizationId: number,
    payload: CreateAllowanceTypePayload
  ): Promise<ApiResponse<AllowanceTypeType>> {
    return this.post(`${this.base(organizationId)}/allowance-types`, payload) as Promise<
      ApiResponse<AllowanceTypeType>
    >;
  }

  updateAllowanceType(
    organizationId: number,
    id: number,
    payload: Partial<CreateAllowanceTypePayload>
  ): Promise<ApiResponse<AllowanceTypeType>> {
    return this.put(`${this.base(organizationId)}/allowance-types/${id}`, payload) as Promise<
      ApiResponse<AllowanceTypeType>
    >;
  }

  archiveAllowanceType(organizationId: number, id: number): Promise<ApiResponse> {
    return this.delete(`${this.base(organizationId)}/allowance-types/${id}`);
  }

  // =========================================================================
  // Employee Allowances (grants + approval workflow)
  // =========================================================================

  getEmployeeAllowances(
    organizationId: number,
    filters: EmployeeAllowanceFilters = {}
  ): Promise<ApiResponse<EmployeeAllowanceType[]>> {
    const queryParams = this.buildEmployeeAllowanceQueryParams(filters);
    const url = `${this.base(organizationId)}/employee-allowances${queryParams ? `?${queryParams}` : ""}`;
    return this.get<EmployeeAllowanceType[]>(url);
  }

  getEmployeeAllowance(
    organizationId: number,
    id: number
  ): Promise<ApiResponse<EmployeeAllowanceType>> {
    return this.get<EmployeeAllowanceType>(
      `${this.base(organizationId)}/employee-allowances/${id}`
    );
  }

  getAllowancesForPayrun(
    organizationId: number,
    payrunId: number
  ): Promise<ApiResponse<AttachedAllowanceLineType[]>> {
    return this.get<AttachedAllowanceLineType[]>(
      `${this.base(organizationId)}/employee-allowances/payrun/${payrunId}`
    );
  }

  createEmployeeAllowance(
    organizationId: number,
    payload: CreateEmployeeAllowancePayload
  ): Promise<ApiResponse<EmployeeAllowanceType>> {
    return this.post(`${this.base(organizationId)}/employee-allowances`, payload) as Promise<
      ApiResponse<EmployeeAllowanceType>
    >;
  }

  updateEmployeeAllowance(
    organizationId: number,
    id: number,
    payload: Partial<
      Pick<
        CreateEmployeeAllowancePayload,
        "amount" | "percentage" | "start_date" | "end_date" | "eligibility_reason" | "supporting_document_id"
      >
    >
  ): Promise<ApiResponse<EmployeeAllowanceType>> {
    return this.put(
      `${this.base(organizationId)}/employee-allowances/${id}`,
      payload
    ) as Promise<ApiResponse<EmployeeAllowanceType>>;
  }

  deleteEmployeeAllowance(organizationId: number, id: number): Promise<ApiResponse> {
    return this.delete(`${this.base(organizationId)}/employee-allowances/${id}`);
  }

  // ---- Workflow -------------------------------------------------------------

  submitEmployeeAllowance(organizationId: number, id: number) {
    return this.post(`${this.base(organizationId)}/employee-allowances/${id}/submit`);
  }

  approveEmployeeAllowance(organizationId: number, id: number) {
    return this.post(`${this.base(organizationId)}/employee-allowances/${id}/approve`);
  }

  rejectEmployeeAllowance(organizationId: number, id: number, rejection_reason: string) {
    return this.post(`${this.base(organizationId)}/employee-allowances/${id}/reject`, {
      rejection_reason,
    });
  }

  suspendEmployeeAllowance(organizationId: number, id: number) {
    return this.post(`${this.base(organizationId)}/employee-allowances/${id}/suspend`);
  }

  cancelEmployeeAllowance(organizationId: number, id: number) {
    return this.post(`${this.base(organizationId)}/employee-allowances/${id}/cancel`);
  }

  // ---- Payrun attach / detach -------------------------------------------------
  // payrun_id is optional on both — the backend auto-resolves the org's
  // current draft payrun when omitted (see
  // EmployeeAllowanceController::resolvePayrunId()).

  attachToPayrun(organizationId: number, id: number, payrunId?: number) {
    return this.post(`${this.base(organizationId)}/employee-allowances/${id}/attach-payrun`, {
      payrun_id: payrunId,
    });
  }

  detachFromPayrun(organizationId: number, id: number, payrunId?: number) {
    return this.post(`${this.base(organizationId)}/employee-allowances/${id}/detach-payrun`, {
      payrun_id: payrunId,
    });
  }
}

export const allowanceAPI = new AllowanceAPI();
export type {
  AllowanceTypeType,
  EmployeeAllowanceType,
  AttachedAllowanceLineType,
  AllowanceCategory,
  PaymentNature,
  AllowanceFrequency,
  CalculationMethod,
  SupportedCalculationMethod,
  AllowanceTypeStatus,
  EmployeeAllowanceStatus,
  AllowanceTypeFilters,
  EmployeeAllowanceFilters,
  CreateAllowanceTypePayload,
  CreateEmployeeAllowancePayload,
  ApiResponse,
};