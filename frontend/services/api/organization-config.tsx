"use client";
export interface OrganizationConfig {
  id: number;
  organization_id: number;
  config_type:
    | "tax"
    | "deduction"
    | "loan"
    | "benefit"
    | "per_diem"
    | "advance"
    | "refund";
  name: string;
  percentage: string | null;
  fixed_amount: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  status: "pending" | "approved" | "rejected" | "deleted_pending";
  created_by: number | null;
  approved_by: number | null;
  rejected_by: number | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

export interface OrganizationConfigResponse {
  success: boolean;
  data: OrganizationConfig[];
  message?: string;
  code: number;
  timestamp: number;
  metadata?: {
    statistics: {
      total: number;
      by_type: {
        tax: number;
        deduction: number;
        loan: number;
        benefit: number;
        per_diem: number;
        advance: number;
        refund: number;
      };
      active_configs: number;
      inactive_configs: number;
    };
  };
}

export interface OrganizationConfigCreateData {
  config_type: OrganizationConfig["config_type"];
  name: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  is_active?: number;
}

export interface OrganizationConfigUpdateData {
  config_type?: OrganizationConfig["config_type"];
  name?: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  is_active?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

export interface OrganizationConfigFilters {
  config_type?: OrganizationConfig["config_type"];
  is_active?: number;
  search?: string;
}

export interface UIConfigItem {
  id: number;
  name: string;
  percentage: number | null;
  fixed_amount: number | null;
  is_active: boolean;
  config_type: OrganizationConfig["config_type"];
}

export interface ConfigsByType {
  tax: UIConfigItem[];
  deduction: UIConfigItem[];
  loan: UIConfigItem[];
  benefit: UIConfigItem[];
  per_diem: UIConfigItem[];
  advance: UIConfigItem[];
  refund: UIConfigItem[];
}

export interface ApprovalData {
  rejection_reason?: string;
}

// API Service
class OrganizationConfigAPI {
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

  private buildQueryParams(filters: OrganizationConfigFilters): string {
    const params = new URLSearchParams();

    if (filters.config_type) {
      params.append("config_type", filters.config_type);
    }
    if (filters.is_active !== undefined) {
      params.append("is_active", filters.is_active.toString());
    }
    if (filters.search) {
      params.append("search", filters.search);
    }

    return params.toString();
  }

  // Get all configurations for an organization
  async getOrganizationConfigs(
    organizationId: number,
    filters: OrganizationConfigFilters = {},
  ): Promise<ApiResponse<OrganizationConfig[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${
        process.env.NEXT_PUBLIC_BACKEND_API_URL
      }/organizations/${organizationId}/configs${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      const result = await this.handleResponse<OrganizationConfig[]>(response);

      // Transform the data to match your expected structure
      if (result.success && result.data) {
        return {
          ...result,
          data: Array.isArray(result.data) ? result.data : [result.data],
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch organization configurations",
        errors: {},
      };
    }
  }

  // Get a single configuration
  async getConfigById(
    organizationId: number,
    configId: number,
  ): Promise<ApiResponse<OrganizationConfig>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs/${configId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<OrganizationConfig>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch configuration",
        errors: {},
      };
    }
  }

  // Create a new configuration
  async createConfig(
    organizationId: number,
    configData: OrganizationConfigCreateData,
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      // Validate that either percentage OR fixed_amount is provided, but not both
      if (configData.percentage !== null && configData.fixed_amount !== null) {
        return {
          success: false,
          error: "Cannot set both percentage and fixed amount",
          errors: {},
        };
      }

      // Validate that at least one of percentage or fixed_amount is provided
      if (configData.percentage === null && configData.fixed_amount === null) {
        return {
          success: false,
          error: "Either percentage or fixed amount must be provided",
          errors: {},
        };
      }

      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(configData),
      });

      return this.handleResponse<{ id: number }>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create configuration",
        errors: {},
      };
    }
  }

  // Update a configuration
  async updateConfig(
    organizationId: number,
    configId: number,
    configData: OrganizationConfigUpdateData,
  ): Promise<ApiResponse> {
    try {
      // Validate that either percentage OR fixed_amount is provided, but not both
      if (
        configData.percentage !== undefined &&
        configData.fixed_amount !== undefined
      ) {
        return {
          success: false,
          error: "Cannot set both percentage and fixed amount",
          errors: {},
        };
      }

      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs/${configId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(configData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update configuration",
        errors: {},
      };
    }
  }

  // Delete a configuration
  async deleteConfig(
    organizationId: number,
    configId: number,
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs/${configId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete configuration",
        errors: {},
      };
    }
  }

  // Approve a configuration
  async approveConfig(
    organizationId: number,
    configId: number,
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs/${configId}/approve`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to approve configuration",
        errors: {},
      };
    }
  }

  // Reject a configuration
  async rejectConfig(
    organizationId: number,
    configId: number,
    rejectionData?: ApprovalData,
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs/${configId}/reject`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(rejectionData || {}),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reject configuration",
        errors: {},
      };
    }
  }

  // Get pending approvals
  async getPendingApprovals(
    organizationId: number,
  ): Promise<ApiResponse<OrganizationConfig[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs/pending`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<OrganizationConfig[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch pending approvals",
        errors: {},
      };
    }
  }

  // In organization-config.tsx, update the transformToUIConfig function:
  transformToUIConfig(configs: OrganizationConfig[]): ConfigsByType {
    const result: ConfigsByType = {
      tax: [],
      deduction: [],
      loan: [],
      benefit: [],
      per_diem: [],
      advance: [],
      refund: [],
    };

    configs.forEach((config) => {
      const uiConfig: UIConfigItem = {
        id: config.id,
        name: config.name,
        percentage: config.percentage ? parseFloat(config.percentage) : null,
        fixed_amount: config.fixed_amount
          ? parseFloat(config.fixed_amount)
          : null,
        is_active: config.is_active === 1,
        config_type: config.config_type,
      };

      // REMOVE this filter - show ALL configurations
      // if (config.status === 'approved') {
      result[config.config_type].push(uiConfig);
      // }
    });

    return result;
  }
}

export const organizationConfigAPI = new OrganizationConfigAPI();
export type {
  OrganizationConfig,
  OrganizationConfigCreateData,
  OrganizationConfigUpdateData,
  ApiResponse,
  OrganizationConfigFilters,
  UIConfigItem,
  ConfigsByType,
  ApprovalData,
};
