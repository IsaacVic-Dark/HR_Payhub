// ============================================================
// Advance API Service
// Salary-advance lifecycle (backend v1 — single ADMIN approval step):
//   draft → pending (policy-validated, awaiting admin) → approved
//         → disbursed → partially_recovered → repaid
//   exits: system_rejected, rejected, cancelled
//
// The backend never leaves an advance in `validated`; the UI still treats
// it like `pending` in case it's ever persisted.
//
// URLs carry no organisation id — the tenant comes from the JWT. The `orgId`
// arguments on the methods below are kept so existing components don't change.
// All responses are mapped here (strings → numbers, flat → nested employee).
// ============================================================

// ─── Status / stage ────────────────────────────────────────────────────────

type AdvanceStatus =
  | "draft"
  | "pending"
  | "validated"
  | "system_rejected"
  | "approved"
  | "rejected"
  | "scheduled"
  | "disbursed"
  | "partially_recovered"
  | "repaid"
  | "cancelled"
  | "reversed"
  | "failed";

type AdvanceStage = "admin";

type DisbursementMethod =
  | "payroll"
  | "bank_transfer"
  | "mpesa"
  | "cash"
  | "cheque";

// ─── Records ───────────────────────────────────────────────────────────────

/** One row per approval step (sourced from the `approvals` table). */
type AdvanceApproval = {
  stage: AdvanceStage;
  status: "pending" | "approved" | "rejected";
  approver_name: string | null;
  comments: string | null;
  acted_at: string | null;
};

type AdvanceType = {
  advance_id: number;
  organization_id: number;
  employee_id: number;
  policy_config_id: number;
  advance_number: string;

  amount_requested: number;
  amount_approved: number | null;
  amount_disbursed: number;
  amount_recovered: number;
  balance_remaining: number;

  reason: string | null;
  rejection_reason: string | null;
  system_rejection_reason: string | null;
  cancellation_reason: string | null;

  request_date: string;
  requested_payrun_id: number | null;
  recovery_start_date: string | null;
  recovery_end_date: string | null;
  number_of_recoveries: number;

  disbursement_method: DisbursementMethod;
  disbursement_reference: string | null;
  disbursement_date: string | null;

  status: AdvanceStatus;

  /** Stage currently waiting for a decision. null once approval is finished. */
  current_stage: AdvanceStage | null;
  /** Stages that apply to THIS advance (finance is omitted below threshold). */
  workflow_stages: AdvanceStage[];
  approvals: AdvanceApproval[];

  approved_at: string | null;
  rejected_at: string | null;
  disbursed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;

  employee: {
    id: number;
    full_name: string;
    employee_number: string;
    email: string | null;
  };

  /** Only present on GET /advances/{id}. */
  payrun_lines?: PayrunLine[];
};

type RepaymentRecord = {
  id: number;
  advance_id: number;
  amount: number;
  balance_after: number;
  repayment_date: string;
  method: "payroll_deduction" | "manual" | "reversal";
  status: "pending" | "applied" | "failed" | "reversed";
  notes: string | null;
  payrun_id: number | null;
  recorded_by_name: string | null;
  created_at: string;
};

/** advance_payrun_lines row (GET /advances/{id}/payrun-lines). */
type PayrunLine = {
  id: number;
  advance_id: number;
  payrun_id: number;
  payrun_name: string;
  payrun_status: "draft" | "reviewed" | "finalized";
  pay_period_start: string | null;
  pay_period_end: string | null;
  scheduled_amount: number;
  status: "attached" | "processed" | "detached" | "failed";
  processed_at: string | null;
};

/** A draft payrun an advance recovery can be attached to. */
type PayrunOption = {
  id: number;
  payrun_name: string;
  pay_period_start: string;
  pay_period_end: string;
  status: string;
};

// ─── Policy (organization_configs where config_type = 'advance') ───────────

interface AdvancePolicySettings {
  max_percentage_of_basic: number;
  max_percentage_of_net: number | null;
  minimum_amount: number;
  maximum_amount: number;
  max_active_advances: number;
  /** Floor for projected net pay after recovery (KES). */
  minimum_net_pay_after_recovery: number;
  allow_partial_recovery: boolean;
  default_recovery_periods: number;
  max_recovery_periods: number;
  require_reason: boolean;
  require_supporting_document: boolean;
  /** Stored but NOT used in v1 (admin-only approval). */
  approval_workflow: string[];
  /** Stored but NOT used in v1. */
  finance_approval_threshold: number | null;
  disbursement_methods: DisbursementMethod[];
  request_cutoff_day: number;
  allow_employee_request: boolean;
}

interface AdvancePolicy {
  id: number;
  name: string;
  status: "pending" | "approved" | "rejected" | "deleted_pending";
  is_active: boolean;
  settings: AdvancePolicySettings;
}

/** Used when the policy can't be loaded, and to fill gaps in a partial policy. */
const DEFAULT_ADVANCE_POLICY_SETTINGS: AdvancePolicySettings = {
  max_percentage_of_basic: 50,
  max_percentage_of_net: 60,
  minimum_amount: 1000,
  maximum_amount: 150000,
  max_active_advances: 1,
  minimum_net_pay_after_recovery: 0,
  allow_partial_recovery: true,
  default_recovery_periods: 1,
  max_recovery_periods: 3,
  require_reason: true,
  require_supporting_document: false,
  approval_workflow: ["manager", "hr"],
  finance_approval_threshold: 50000,
  disbursement_methods: ["payroll", "mpesa", "bank_transfer"],
  request_cutoff_day: 20,
  allow_employee_request: true,
};

// ─── API envelope / filters / stats ────────────────────────────────────────

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface AdvanceStatistics {
  total_advances: number;
  total_requested: number;
  total_disbursed: number;
  total_recovered: number;
  total_outstanding: number;
  by_status: {
    in_approval: number;
    approved: number; // approved / scheduled, awaiting disbursement
    active: number; // disbursed / partially_recovered
    repaid: number;
    rejected: number;
  };
}

interface AdvanceFilters {
  status?: string;
  employee_id?: string;
  name?: string;
  month?: string;
  year?: string;
  page?: number;
  per_page?: number;
}

// ─── Payloads ──────────────────────────────────────────────────────────────

interface RequestAdvancePayload {
  amount: number;
  reason?: string | null;
  disbursement_method: DisbursementMethod;
  number_of_recoveries: number;
  /** true → status 'draft', false/omitted → submitted for validation. */
  save_as_draft?: boolean;
  recovery_start_date?: string | null;
  recovery_end_date?: string | null;
  /** Reference to a supporting document (required when the policy says so). */
  supporting_document?: string | null;
}

interface CreateAdvancePayload extends RequestAdvancePayload {
  employee_id: number;
}

interface ApprovePayload {
  amount_approved?: number;
  comments?: string;
}

interface DisbursePayload {
  disbursement_method?: DisbursementMethod;
  disbursement_reference?: string;
  disbursement_date?: string;
}

interface RecordRepaymentPayload {
  amount: number;
  repayment_date: string;
  notes?: string | null;
}

/** Payload shape emitted by AdvanceActionDialog's onConfirm. */
interface ActionPayload {
  reason?: string;
  amount_approved?: string;
  disbursement_method?: DisbursementMethod;
  disbursement_reference?: string;
  disbursement_date?: string;
  amount?: string;
  repayment_date?: string;
  notes?: string;
  /** reverse: the manual repayment being reversed. */
  repayment_id?: string;
}

// ─── UI helpers ────────────────────────────────────────────────────────────

type AdvanceAction =
  | "approve"
  | "reject"
  | "disburse"
  | "cancel"
  | "reverse"
  | "repayment"
  | "edit"
  | "submit"
  | "attach";

/** Super admins have no access to organisation data, so only `admin` here. */
const ADMIN_TYPES = ["admin"];

const isAdminUser = (userType: string) => ADMIN_TYPES.includes(userType);

/**
 * Actions available to a role on an advance at its current status.
 *  - admin           : approve / reject / cancel / disburse / repay / reverse / recovery schedule
 *  - payroll_manager
 *    payroll_officer : manage the recovery schedule (attach / detach payruns)
 *  - finance_manager : record and reverse manual repayments
 *  - auditor         : read-only
 *  - employee        : edit/submit drafts, cancel own undecided request
 *                      ("cancel" on a draft / system-rejected request deletes it)
 */
function getAvailableActions(
  advance: Pick<AdvanceType, "status">,
  userType: string
): AdvanceAction[] {
  const { status } = advance;
  const recovering = status === "disbursed" || status === "partially_recovered";

  if (isAdminUser(userType)) {
    switch (status) {
      case "draft":
        return ["cancel"];
      case "pending":
      case "validated":
        return ["approve", "reject", "cancel"];
      case "approved":
      case "scheduled":
        return ["disburse", "cancel"];
      case "disbursed":
      case "partially_recovered":
        return ["attach", "repayment", "reverse"];
      default:
        return [];
    }
  }

  if (userType === "payroll_manager" || userType === "payroll_officer") {
    return recovering ? ["attach"] : [];
  }

  if (userType === "finance_manager") {
    return recovering ? ["repayment", "reverse"] : [];
  }

  if (userType === "employee") {
    if (status === "draft") return ["edit", "submit", "cancel"];
    if (status === "system_rejected") return ["edit", "cancel"];
    if (status === "pending" || status === "validated") return ["cancel"];
  }

  return [];
}

const ACTION_LABELS: Record<AdvanceAction, string> = {
  approve: "Approve",
  reject: "Reject",
  disburse: "Disburse",
  cancel: "Cancel",
  reverse: "Reverse Repayment",
  repayment: "Record Repayment",
  attach: "Recovery Schedule",
  edit: "Edit",
  submit: "Submit",
};

const STAGE_LABELS: Record<AdvanceStage, string> = {
  admin: "Admin",
};

const METHOD_LABELS: Record<DisbursementMethod, string> = {
  payroll: "Payroll",
  bank_transfer: "Bank Transfer",
  mpesa: "M-Pesa",
  cash: "Cash",
  cheque: "Cheque",
};

const STATUS_CONFIG: Record<AdvanceStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  pending: { label: "Awaiting Approval", color: "bg-yellow-100 text-yellow-800" },
  validated: { label: "Awaiting Approval", color: "bg-yellow-100 text-yellow-800" },
  system_rejected: { label: "System Rejected", color: "bg-red-100 text-red-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  scheduled: { label: "Scheduled", color: "bg-teal-100 text-teal-800" },
  disbursed: { label: "Disbursed", color: "bg-blue-100 text-blue-800" },
  partially_recovered: { label: "Recovering", color: "bg-indigo-100 text-indigo-800" },
  repaid: { label: "Fully Repaid", color: "bg-gray-100 text-gray-600" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
  reversed: { label: "Reversed", color: "bg-orange-100 text-orange-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

/** Badge label for an advance's status. */
function getStatusLabel(advance: Pick<AdvanceType, "status">): string {
  return STATUS_CONFIG[advance.status]?.label ?? advance.status;
}

const IN_APPROVAL_STATUSES: AdvanceStatus[] = ["pending", "validated"];
const AWAITING_DISBURSEMENT_STATUSES: AdvanceStatus[] = ["approved", "scheduled"];
const ACTIVE_STATUSES: AdvanceStatus[] = ["disbursed", "partially_recovered"];
const REJECTED_STATUSES: AdvanceStatus[] = ["system_rejected", "rejected"];

const formatKES = (v: number | string | null | undefined) =>
  v == null || v === ""
    ? "—"
    : new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
      }).format(Number(v));

const formatDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const formatDateTime = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

// ─── Response mapping (backend → UI shapes) ────────────────────────────────

/** Backend sends `errors: { field: "message" }`; the UI type is string[]. */
function normaliseErrors(raw: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    out[k] = Array.isArray(v) ? v.map(String) : [String(v)];
  }
  return out;
}

/** "Request failed policy validation: Amount exceeds 50% of basic salary …" */
function composeError(
  message: string | undefined,
  errors: Record<string, string[]>,
  status: number
): string {
  const details = Object.values(errors).flat().filter(Boolean);
  const base = message || `HTTP error! status: ${status}`;
  return details.length ? `${base}: ${details.join("; ")}` : base;
}

const toNum = (v: any): number => (v == null || v === "" ? 0 : Number(v));
const toNumOrNull = (v: any): number | null =>
  v == null || v === "" ? null : Number(v);

function mapAdvance(r: any): AdvanceType {
  const status = r.status as AdvanceStatus;
  const awaiting = status === "pending" || status === "validated";
  const decided =
    !!r.approved_at ||
    !!r.rejected_at ||
    ["approved", "scheduled", "disbursed", "partially_recovered", "repaid", "rejected"].includes(status);

  // v1 has ONE approval step (admin). Derive it so the timeline keeps working.
  const approvals: AdvanceApproval[] =
    awaiting || decided
      ? [
          {
            stage: "admin",
            status:
              status === "rejected" || r.rejected_at
                ? "rejected"
                : r.approved_at || decided
                ? "approved"
                : "pending",
            approver_name: null,
            comments: r.rejection_reason ?? null,
            acted_at: r.rejected_at ?? r.approved_at ?? null,
          },
        ]
      : [];

  return {
    advance_id: Number(r.id),
    organization_id: Number(r.organization_id),
    employee_id: Number(r.employee_id),
    policy_config_id: Number(r.policy_config_id),
    advance_number: r.advance_number,

    amount_requested: toNum(r.amount_requested),
    amount_approved: toNumOrNull(r.amount_approved),
    amount_disbursed: toNum(r.amount_disbursed),
    amount_recovered: toNum(r.amount_recovered),
    balance_remaining: toNum(r.balance_remaining),

    reason: r.reason ?? null,
    rejection_reason: r.rejection_reason ?? null,
    system_rejection_reason: r.system_rejection_reason ?? null,
    cancellation_reason: r.cancellation_reason ?? null,

    request_date: r.request_date,
    requested_payrun_id: r.requested_payrun_id != null ? Number(r.requested_payrun_id) : null,
    recovery_start_date: r.recovery_start_date ?? null,
    recovery_end_date: r.recovery_end_date ?? null,
    number_of_recoveries: Number(r.number_of_recoveries ?? 1),

    disbursement_method: r.disbursement_method,
    disbursement_reference: r.disbursement_reference ?? null,
    disbursement_date: r.disbursement_date ?? null,

    status,
    current_stage: awaiting ? "admin" : null,
    workflow_stages: ["admin"],
    approvals,

    approved_at: r.approved_at ?? null,
    rejected_at: r.rejected_at ?? null,
    disbursed_at: r.disbursed_at ?? null,
    cancelled_at: r.cancelled_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,

    employee: {
      id: Number(r.employee_id),
      full_name: (r.employee_name ?? "").trim(),
      employee_number: r.employee_number ?? "",
      email: r.employee_email ?? null,
    },
  };
}

function mapRepayment(r: any): RepaymentRecord {
  return {
    id: Number(r.id),
    advance_id: Number(r.advance_id),
    amount: toNum(r.amount),
    balance_after: toNum(r.balance_after),
    repayment_date: r.repayment_date,
    method: r.method,
    status: r.status,
    notes: r.notes ?? null,
    payrun_id: r.payrun_id != null ? Number(r.payrun_id) : null,
    recorded_by_name: r.recorded_by_name ?? null,
    created_at: r.created_at,
  };
}

function mapPayrunLine(r: any): PayrunLine {
  return {
    id: Number(r.id),
    advance_id: Number(r.advance_id),
    payrun_id: Number(r.payrun_id),
    payrun_name: r.payrun_name,
    payrun_status: r.payrun_status,
    pay_period_start: r.pay_period_start ?? null,
    pay_period_end: r.pay_period_end ?? null,
    scheduled_amount: toNum(r.scheduled_amount),
    status: r.status,
    processed_at: r.processed_at ?? null,
  };
}

function mapPolicy(r: any): AdvancePolicy {
  return {
    id: Number(r.config_id ?? r.id),
    name: r.name,
    status: r.status ?? "approved",
    is_active: !!Number(r.is_active ?? 1),
    settings: { ...DEFAULT_ADVANCE_POLICY_SETTINGS, ...(r.settings ?? {}) },
  };
}

function mapStatistics(r: any): AdvanceStatistics | null {
  if (!r) return null;
  return {
    total_advances: toNum(r.total_advances),
    total_requested: toNum(r.total_requested),
    total_disbursed: toNum(r.total_disbursed),
    total_recovered: toNum(r.total_recovered),
    total_outstanding: toNum(r.total_outstanding),
    by_status: {
      in_approval: toNum(r.by_status?.in_approval),
      approved: toNum(r.by_status?.approved),
      active: toNum(r.by_status?.active),
      repaid: toNum(r.by_status?.repaid),
      rejected: toNum(r.by_status?.rejected),
    },
  };
}

// ─── API class ─────────────────────────────────────────────────────────────

class AdvanceAPI {
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (!response.ok) {
        const errors = normaliseErrors(data.errors);
        return {
          success: false,
          error: composeError(data.message, errors, response.status),
          errors,
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

  private getAuthHeaders(): HeadersInit {
    const token = this.getCookie("access_token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private buildQueryParams(filters: AdvanceFilters): string {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.employee_id) params.append("employee_id", filters.employee_id);
    if (filters.name) params.append("name", filters.name);
    if (filters.month) params.append("month", filters.month);
    if (filters.year) params.append("year", filters.year);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.per_page) params.append("per_page", filters.per_page.toString());
    return params.toString();
  }

  /** Single fetch wrapper — every endpoint below goes through here. */
  private async request<T = any>(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
    fallbackError = "Request failed"
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}${path}`,
        {
          method,
          credentials: "include",
          headers: this.getAuthHeaders(),
          body: body !== undefined ? JSON.stringify(body) : undefined,
        }
      );
      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : fallbackError,
      };
    }
  }

  /** Backend list → UI list; also maps metadata.statistics. */
  private mapList(res: ApiResponse<any>): ApiResponse<AdvanceType[]> {
    if (!res.success) return res;
    const list = Array.isArray(res.data) ? res.data : res.data?.advances ?? [];
    return {
      ...res,
      data: list.map(mapAdvance),
      metadata: {
        ...(res.metadata ?? {}),
        statistics: mapStatistics(res.metadata?.statistics),
      },
    };
  }

  private mapOne(res: ApiResponse<any>): ApiResponse<AdvanceType> {
    if (!res.success || !res.data) return res;
    // Failed policy validation comes back as { advance, max_allowed } with success=false,
    // so only success responses are mapped here.
    const adv = mapAdvance(res.data);
    if (Array.isArray(res.data.payrun_lines)) adv.payrun_lines = res.data.payrun_lines.map(mapPayrunLine);
    return { ...res, data: adv };
  }

  /** Failed create/submit: map the saved (system_rejected) advance if returned. */
  private mapRejected(res: ApiResponse<any>): ApiResponse<any> {
    if (res.success || !res.data?.advance) return res;
    return { ...res, data: { ...res.data, advance: mapAdvance(res.data.advance) } };
  }

  // ── Collection ─────────────────────────────────────────────────────────

  // GET /advances  (admin / payroll / finance / auditor; employees only see their own)
  async getAdvances(_orgId: number, filters: AdvanceFilters = {}) {
    const qs = this.buildQueryParams(filters);
    const res = await this.request(
      `/advances${qs ? `?${qs}` : ""}`,
      "GET",
      undefined,
      "Failed to fetch advances"
    );
    return this.mapList(res);
  }

  // GET /employees/{emp}/advances
  async getEmployeeAdvances(
    _orgId: number,
    employeeId: number,
    filters: AdvanceFilters = {}
  ) {
    const qs = this.buildQueryParams(filters);
    const res = await this.request(
      `/employees/${employeeId}/advances${qs ? `?${qs}` : ""}`,
      "GET",
      undefined,
      "Failed to fetch your advances"
    );
    return this.mapList(res);
  }

  async getAdvanceById(_orgId: number, advanceId: number) {
    const res = await this.request(
      `/advances/${advanceId}`,
      "GET",
      undefined,
      "Failed to fetch advance"
    );
    return this.mapOne(res);
  }

  // GET /employees/{emp}/advance-balance
  async getEmployeeBalance(_orgId: number, employeeId: number) {
    return this.request(
      `/employees/${employeeId}/advance-balance`,
      "GET",
      undefined,
      "Failed to fetch advance balance"
    );
  }

  // ── Create / update ────────────────────────────────────────────────────

  private toBackendBody(p: Partial<CreateAdvancePayload>) {
    const body: Record<string, unknown> = {};
    if (p.employee_id !== undefined) body.employee_id = p.employee_id;
    if (p.amount !== undefined) body.amount_requested = p.amount;
    if (p.reason !== undefined) body.reason = p.reason;
    if (p.disbursement_method !== undefined) body.disbursement_method = p.disbursement_method;
    if (p.number_of_recoveries !== undefined) body.number_of_recoveries = p.number_of_recoveries;
    if (p.recovery_start_date !== undefined) body.recovery_start_date = p.recovery_start_date || null;
    if (p.recovery_end_date !== undefined) body.recovery_end_date = p.recovery_end_date || null;
    if (p.supporting_document !== undefined) body.supporting_document = p.supporting_document || null;
    return body;
  }

  // POST /advances  (admin, on behalf of an employee)
  async createAdvance(_orgId: number, payload: CreateAdvancePayload) {
    const res = await this.request(
      "/advances",
      "POST",
      { ...this.toBackendBody(payload), submit: !payload.save_as_draft },
      "Failed to create advance"
    );
    return res.success ? this.mapOne(res) : this.mapRejected(res);
  }

  // POST /advances  (employee request — backend uses the logged-in employee)
  async requestAdvance(
    _orgId: number,
    _employeeId: number,
    payload: RequestAdvancePayload
  ) {
    const res = await this.request(
      "/advances",
      "POST",
      { ...this.toBackendBody(payload), submit: !payload.save_as_draft },
      "Failed to submit advance request"
    );
    return res.success ? this.mapOne(res) : this.mapRejected(res);
  }

  // PUT /advances/{id}  (draft / system_rejected only)
  async updateAdvance(
    _orgId: number,
    advanceId: number,
    payload: Partial<RequestAdvancePayload>
  ) {
    const res = await this.request(
      `/advances/${advanceId}`,
      "PUT",
      this.toBackendBody(payload),
      "Failed to update advance"
    );
    return this.mapOne(res);
  }

  // DELETE /advances/{id}  (draft / system_rejected only)
  async deleteAdvance(_orgId: number, advanceId: number) {
    return this.request(
      `/advances/${advanceId}`,
      "DELETE",
      undefined,
      "Failed to delete advance"
    );
  }

  // POST /advances/{id}/submit  (draft → policy validation → pending)
  async submitAdvance(_orgId: number, advanceId: number) {
    const res = await this.request(
      `/advances/${advanceId}/submit`,
      "POST",
      undefined,
      "Failed to submit advance"
    );
    return res.success ? this.mapOne(res) : this.mapRejected(res);
  }

  // ── Workflow ───────────────────────────────────────────────────────────

  async approveAdvance(
    _orgId: number,
    advanceId: number,
    payload: ApprovePayload = {}
  ) {
    return this.request(
      `/advances/${advanceId}/approve`,
      "POST",
      payload.amount_approved !== undefined ? { amount_approved: payload.amount_approved } : {},
      "Failed to approve advance"
    );
  }

  async rejectAdvance(_orgId: number, advanceId: number, reason: string) {
    return this.request(
      `/advances/${advanceId}/reject`,
      "POST",
      { reason },
      "Failed to reject advance"
    );
  }

  async disburseAdvance(
    _orgId: number,
    advanceId: number,
    payload: DisbursePayload
  ) {
    return this.request(
      `/advances/${advanceId}/disburse`,
      "POST",
      payload,
      "Failed to disburse advance"
    );
  }

  async cancelAdvance(_orgId: number, advanceId: number, reason?: string) {
    return this.request(
      `/advances/${advanceId}/cancel`,
      "POST",
      { reason: reason ?? "" },
      "Failed to cancel advance"
    );
  }

  // ── Payrun recovery (advance_payrun_lines) ─────────────────────────────

  // GET /advance-payruns  (draft payruns only; admin / payroll roles)
  async getDraftPayruns(_orgId: number) {
    const res = await this.request<PayrunOption[]>(
      "/advance-payruns",
      "GET",
      undefined,
      "Failed to fetch draft payruns"
    );
    return res;
  }

  async getPayrunLines(_orgId: number, advanceId: number) {
    const res = await this.request(
      `/advances/${advanceId}/payrun-lines`,
      "GET",
      undefined,
      "Failed to fetch recovery schedule"
    );
    return res.success ? { ...res, data: (res.data ?? []).map(mapPayrunLine) as PayrunLine[] } : res;
  }

  async attachPayrun(
    _orgId: number,
    advanceId: number,
    payload: { payrun_id: number; recovery_mode: "equal" | "custom"; scheduled_amount?: number }
  ) {
    return this.request(
      `/advances/${advanceId}/attach-payrun`,
      "POST",
      payload,
      "Failed to attach payrun"
    );
  }

  async detachPayrun(_orgId: number, advanceId: number, payrunId: number) {
    return this.request(
      `/advances/${advanceId}/detach-payrun`,
      "POST",
      { payrun_id: payrunId },
      "Failed to detach payrun"
    );
  }

  // ── Repayments ─────────────────────────────────────────────────────────

  // POST /advances/{id}/manual-repayment
  async recordRepayment(
    _orgId: number,
    advanceId: number,
    payload: RecordRepaymentPayload
  ) {
    return this.request(
      `/advances/${advanceId}/manual-repayment`,
      "POST",
      payload,
      "Failed to record repayment"
    );
  }

  // POST /advances/{id}/repayments/{rid}/reverse  (manual repayments only)
  async reverseRepayment(
    _orgId: number,
    advanceId: number,
    repaymentId: number,
    reason: string
  ) {
    return this.request(
      `/advances/${advanceId}/repayments/${repaymentId}/reverse`,
      "POST",
      { reason },
      "Failed to reverse repayment"
    );
  }

  async repaymentHistory(_orgId: number, advanceId: number) {
    const res = await this.request(
      `/advances/${advanceId}/repayments`,
      "GET",
      undefined,
      "Failed to fetch repayment history"
    );
    return res.success
      ? { ...res, data: (res.data ?? []).map(mapRepayment) as RepaymentRecord[] }
      : (res as ApiResponse<RepaymentRecord[]>);
  }

  // ── Policy ─────────────────────────────────────────────────────────────

  // GET /advance-policy  (readable by employees too)
  async getPolicy(_orgId: number) {
    const res = await this.request(
      "/advance-policy",
      "GET",
      undefined,
      "Failed to fetch advance policy"
    );
    return res.success && res.data ? { ...res, data: mapPolicy(res.data) } : (res as ApiResponse<AdvancePolicy>);
  }

  // PUT /advance-policy  (admin; updates the existing config row in place)
  async updatePolicy(
    _orgId: number,
    payload: { settings: AdvancePolicySettings }
  ) {
    const res = await this.request(
      "/advance-policy",
      "PUT",
      {
        settings: {
          ...payload.settings,
          // 0 / blank means "no net-pay limit"; the backend treats null as unlimited.
          max_percentage_of_net: payload.settings.max_percentage_of_net || null,
        },
      },
      "Failed to update advance policy"
    );
    return res.success && res.data ? { ...res, data: mapPolicy(res.data) } : (res as ApiResponse<AdvancePolicy>);
  }
}

export const advanceAPI = new AdvanceAPI();

export {
  getAvailableActions,
  getStatusLabel,
  isAdminUser,
  formatKES,
  formatDate,
  formatDateTime,
  ACTION_LABELS,
  STAGE_LABELS,
  METHOD_LABELS,
  STATUS_CONFIG,
  IN_APPROVAL_STATUSES,
  AWAITING_DISBURSEMENT_STATUSES,
  ACTIVE_STATUSES,
  REJECTED_STATUSES,
  DEFAULT_ADVANCE_POLICY_SETTINGS,
};

export type {
  AdvanceStatus,
  AdvanceStage,
  AdvanceType,
  AdvanceApproval,
  AdvanceAction,
  AdvanceFilters,
  AdvanceStatistics,
  AdvancePolicy,
  AdvancePolicySettings,
  DisbursementMethod,
  RepaymentRecord,
  PayrunLine,
  PayrunOption,
  RequestAdvancePayload,
  CreateAdvancePayload,
  ApprovePayload,
  DisbursePayload,
  RecordRepaymentPayload,
  ActionPayload,
  ApiResponse,
};