// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfigType =
  | "tax"
  | "deduction"
  | "loan"
  | "benefit"
  | "per_diem"
  | "advance"
  | "refund"
  | "leave"
  | "attendance";

// Shape returned by the PHP backend for a single config row
type RawConfigItem = {
  id: number;
  organization_id: number;
  config_type: ConfigType;
  name: string;
  percentage: number | null;
  fixed_amount: number | null;
  value_text: string | null;
  is_active: 0 | 1;
  created_at?: string;
  updated_at?: string;
};

// Shape the UI works with (is_active normalized to boolean)
type UIConfigItem = {
  id: number;
  organization_id: number;
  config_type: ConfigType;
  name: string;
  percentage: number | null;
  fixed_amount: number | null;
  value_text: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ConfigsByType = Record<ConfigType, UIConfigItem[]>;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

// Payload for creating a config
interface CreateConfigPayload {
  config_type: ConfigType;
  name: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  value_text?: string | null;
  is_active?: number;
}

// Payload for updating a config
interface UpdateConfigPayload {
  name?: string;
  percentage?: number | null;
  fixed_amount?: number | null;
  value_text?: string | null;
  is_active?: number;
}

const CONFIG_TYPES: ConfigType[] = [
  "tax",
  "deduction",
  "loan",
  "benefit",
  "per_diem",
  "advance",
  "refund",
  "leave",
  "attendance",
];

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

  async getOrganizationConfigs(
    organizationId: number
  ): Promise<ApiResponse<RawConfigItem[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<RawConfigItem[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch configurations",
      };
    }
  }

  // Groups a flat list of raw config rows into a ConfigsByType map,
  // normalizing is_active (0/1) to boolean along the way.
  transformToUIConfig(data: RawConfigItem[]): ConfigsByType {
    const grouped = CONFIG_TYPES.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as ConfigsByType);

    for (const raw of data) {
      const uiItem: UIConfigItem = { ...raw, is_active: Boolean(raw.is_active) };
      if (!grouped[uiItem.config_type]) {
        grouped[uiItem.config_type] = [];
      }
      grouped[uiItem.config_type].push(uiItem);
    }

    return grouped;
  }

  async createConfig(
    organizationId: number,
    configData: CreateConfigPayload
  ): Promise<ApiResponse<RawConfigItem>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(configData),
      });

      return this.handleResponse<RawConfigItem>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create configuration",
      };
    }
  }

  async updateConfig(
    organizationId: number,
    configId: number,
    configData: UpdateConfigPayload
  ): Promise<ApiResponse<RawConfigItem>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/configs/${configId}`;

      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(configData),
      });

      return this.handleResponse<RawConfigItem>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update configuration",
      };
    }
  }

  async deleteConfig(
    organizationId: number,
    configId: number
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
          error instanceof Error ? error.message : "Failed to delete configuration",
      };
    }
  }
}

export const organizationConfigAPI = new OrganizationConfigAPI();
export type {
  ConfigType,
  RawConfigItem,
  UIConfigItem,
  ConfigsByType,
  ApiResponse,
  CreateConfigPayload,
  UpdateConfigPayload,
};