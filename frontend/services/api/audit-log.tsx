type AuditLogType = {
  id: number;
  organization_id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: any;
  created_at: string;
  user_first_name: string;
  user_surname: string;
  user_email: string;
  user_full_name: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface AuditLogFilters {
  entity_type?: string;
  entity_id?: number;
  action?: string;
  user_id?: number;
  page?: number;
  per_page?: number;
}

class AuditLogAPI {
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

  private buildQueryParams(filters: AuditLogFilters): string {
    const params = new URLSearchParams();

    if (filters.entity_type) {
      params.append("entity_type", filters.entity_type);
    }
    if (filters.entity_id) {
      params.append("entity_id", filters.entity_id.toString());
    }
    if (filters.action) {
      params.append("action", filters.action);
    }
    if (filters.user_id) {
      params.append("user_id", filters.user_id.toString());
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

  async getAuditLogs(
    organizationId: number,
    filters: AuditLogFilters = {}
  ): Promise<ApiResponse<AuditLogType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/audit-logs${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<AuditLogType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch audit logs",
      };
    }
  }

  async getAuditLogById(
    organizationId: number,
    auditLogId: number
  ): Promise<ApiResponse<AuditLogType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/audit-logs/${auditLogId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<AuditLogType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch audit log",
      };
    }
  }
}

export const auditLogAPI = new AuditLogAPI();
export type { AuditLogType, AuditLogFilters, ApiResponse };

