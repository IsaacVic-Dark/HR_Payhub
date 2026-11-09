// Document templates (Payslip Templates) API client.
// Mirrors the fetch/cookie-token pattern used by services/api/allowance.ts.

export type TemplateStatus = "draft" | "active" | "archived";
export type LayoutKey = "modern" | "classic" | "minimal";

export type LogoValue =
  | { mode: "none" }
  | { mode: "organization" }
  | { mode: "uploaded"; token: string };

export interface TemplateConfig {
  layout: LayoutKey;
  documentTitle: string;
  showCompanyHeader: boolean;
  showEmployeeDetails: boolean;
  showPaymentSummary: boolean;
  showEarnings: boolean;
  showDeductions: boolean;
  showStatutoryDeductions: boolean;
  showAllowances: boolean;
  showReimbursements: boolean;
  showAdvances: boolean;
  showLoanDeductions: boolean;
  showLeaveSummary: boolean;
  showBankDetails: boolean;
  showPaymentDate: boolean;
  showFooter: boolean;
  footerText: string;
  labels: Record<string, string>;
  sections: Record<"earnings" | "deductions", { visible: boolean; order: number }>;
}

export interface DocumentTemplate {
  id: number;
  organization_id: number;
  template_type: string;
  name: string;
  layout_key: LayoutKey;
  config: TemplateConfig;
  logo: LogoValue;
  primary_color: string | null;
  accent_color: string | null;
  resolved_colors: { primary: string; accent: string };
  footer_text: string | null;
  is_default: boolean;
  status: TemplateStatus;
  active_version_id: number | null;
  active_version: number | null;
  latest_version: number | null;
  has_pending_changes: boolean;
  created_at: string;
  updated_at: string;
  activation?: { changed: boolean };
}

export interface DocumentTemplateVersion {
  id: number;
  template_id: number;
  version: number;
  is_active: boolean;
  config: TemplateConfig;
  logo: LogoValue;
  primary_color: string | null;
  accent_color: string | null;
  footer_text: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface TemplateMeta {
  layouts: { key: LayoutKey; label: string; description: string; colors: { primary: string; accent: string } }[];
  default_config: TemplateConfig;
  label_defaults: Record<string, string>;
  boolean_keys: string[];
  mandatory_keys: string[];
  section_keys: string[];
  limits: { name: number; document_title: number; footer_text: number; label: number; logo_bytes: number };
}

/** Editable payload sent to create / update / preview(draft). */
export interface TemplateDraftPayload {
  name: string;
  layout_key: LayoutKey;
  primary_color: string | null;
  accent_color: string | null;
  logo: LogoValue;
  config: TemplateConfig;
}

export interface PreviewOptions {
  payruns: { id: number; payrun_name: string; pay_period_start: string; pay_period_end: string; status: string }[];
  employees: { id: number; employee_number: string; full_name: string }[];
}

export interface PreviewRequest {
  payrun_id?: number;
  employee_id?: number;
  draft?: Partial<TemplateDraftPayload>;
  live?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  /** field → message, e.g. { "config.labels.netPay": "Label cannot be empty" } */
  errors?: Record<string, string>;
  metadata?: any;
  status?: number;
  retryAfter?: number;
}

class TemplateAPI {
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  }

  private authHeaders(json = true): HeadersInit {
    const token = this.getCookie("access_token");
    const headers: Record<string, string> = {};
    if (json) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private base(organizationId: number): string {
    return `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/templates`;
  }

  private async handle<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: data.message || `HTTP error! status: ${response.status}`,
          errors: normaliseErrors(data.errors),
          data: data.data,
          message: data.message,
          retryAfter: data?.data?.retry_after,
        };
      }
      return { success: true, status: response.status, data: data.data, message: data.message, metadata: data.metadata || {} };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" };
    }
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: this.authHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return this.handle<T>(response);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Request failed" };
    }
  }

  getMeta(orgId: number) {
    return this.request<TemplateMeta>("GET", `${this.base(orgId)}/meta`);
  }

  list(orgId: number, filters: { status?: TemplateStatus } = {}) {
    const qs = new URLSearchParams({ template_type: "payslip" });
    if (filters.status) qs.set("status", filters.status);
    return this.request<DocumentTemplate[]>("GET", `${this.base(orgId)}?${qs}`);
  }

  get(orgId: number, id: number) {
    return this.request<DocumentTemplate>("GET", `${this.base(orgId)}/${id}`);
  }

  create(orgId: number, payload: TemplateDraftPayload) {
    return this.request<DocumentTemplate>("POST", this.base(orgId), { ...payload, template_type: "payslip" });
  }

  update(orgId: number, id: number, payload: TemplateDraftPayload) {
    return this.request<DocumentTemplate>("PUT", `${this.base(orgId)}/${id}`, payload);
  }

  activate(orgId: number, id: number) {
    return this.request<DocumentTemplate>("POST", `${this.base(orgId)}/${id}/activate`, {});
  }

  archive(orgId: number, id: number) {
    return this.request<DocumentTemplate>("POST", `${this.base(orgId)}/${id}/archive`, {});
  }

  versions(orgId: number, id: number) {
    return this.request<DocumentTemplateVersion[]>("GET", `${this.base(orgId)}/${id}/versions`);
  }

  previewOptions(orgId: number, payrunId?: number) {
    const qs = payrunId ? `?payrun_id=${payrunId}` : "";
    return this.request<PreviewOptions>("GET", `${this.base(orgId)}/preview-options${qs}`);
  }

  /** HTML preview — never persists anything. */
  previewHtml(orgId: number, id: number, body: PreviewRequest) {
    return this.request<{ format: "html"; sample: boolean; html: string }>(
      "POST",
      `${this.base(orgId)}/${id}/preview`,
      { ...body, format: "html" }
    );
  }

  /** Real PDF preview, returned as a Blob. */
  async previewPdf(orgId: number, id: number, body: PreviewRequest): Promise<ApiResponse<Blob>> {
    try {
      const response = await fetch(`${this.base(orgId)}/${id}/preview`, {
        method: "POST",
        credentials: "include",
        headers: this.authHeaders(),
        body: JSON.stringify({ ...body, format: "pdf", live: false }),
      });
      if (!response.ok) return this.handle<Blob>(response);
      return { success: true, data: await response.blob(), status: response.status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Request failed" };
    }
  }

  async uploadLogo(orgId: number, file: File): Promise<ApiResponse<{ logo: LogoValue }>> {
    try {
      const form = new FormData();
      form.append("logo", file);
      const response = await fetch(`${this.base(orgId)}/logo`, {
        method: "POST",
        credentials: "include",
        headers: this.authHeaders(false), // let the browser set the multipart boundary
        body: form,
      });
      return this.handle(response);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Upload failed" };
    }
  }
}

function normaliseErrors(errors: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (errors && typeof errors === "object") {
    for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
      out[k] = Array.isArray(v) ? String(v[0]) : String(v);
    }
  }
  return out;
}

export const templateAPI = new TemplateAPI();
