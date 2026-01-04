type OrganizationType = {
  id: number;
  tenant_id: number | null;
  name: string;
  payroll_number_prefix: string;
  kra_pin: string | null;
  nssf_number: string | null;
  nhif_number: string | null;
  legal_type: string | null;
  registration_number: string | null;
  physical_address: string | null;
  postal_address: string | null;
  postal_code_id: number | null;
  county_id: number | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  official_email: string | null;
  location: string | null;
  logo_url: string | null;
  currency: string;
  payroll_schedule: string;
  payroll_lock_date: string | null;
  default_payday: number | null;
  bank_id: number | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  swift_code: string | null;
  nssf_branch_code: string | null;
  nhif_branch_code: string | null;
  primary_administrator_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  domain: string | null;
};

interface OrganizationStatistics {
  total_employees: number;
  pending_leaves: number;
  current_month_payrolls: number;
}

interface OrganizationMetadata {
  statistics: OrganizationStatistics;
  user_role: string;
  can_edit: boolean;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface OrganizationResponseData {
  organization: OrganizationType;
  metadata: OrganizationMetadata;
}

interface UpdateOrganizationData {
  name?: string;
  payroll_number_prefix?: string;
  kra_pin?: string;
  nssf_number?: string;
  nhif_number?: string;
  legal_type?: string;
  registration_number?: string;
  physical_address?: string;
  postal_address?: string;
  postal_code_id?: number;
  county_id?: number;
  primary_phone?: string;
  secondary_phone?: string;
  official_email?: string;
  location?: string;
  logo_url?: string;
  currency?: string;
  payroll_schedule?: string;
  payroll_lock_date?: string;
  default_payday?: number;
  bank_id?: number;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_branch?: string;
  swift_code?: string;
  nssf_branch_code?: string;
  nhif_branch_code?: string;
  domain?: string;
}

class OrganizationAPI {
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

  async getOrganizationDetails(
    organizationId: number
  ): Promise<ApiResponse<OrganizationType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/details`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<OrganizationType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch organization details",
      };
    }
  }

  async updateOrganization(
    organizationId: number,
    updateData: UpdateOrganizationData
  ): Promise<ApiResponse<OrganizationType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateData),
      });

      return this.handleResponse<OrganizationType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update organization",
      };
    }
  }
}

export const organizationAPI = new OrganizationAPI();
export type {
  OrganizationType,
  OrganizationStatistics,
  OrganizationMetadata,
  OrganizationResponseData,
  UpdateOrganizationData,
  ApiResponse,
};