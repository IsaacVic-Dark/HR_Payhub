import type { PermissionScope } from "./role";

// One entry in the platform-wide permission catalog (module-grouped)
type PermissionCatalogItem = {
  name: string;
  description: string | null;
};

// GET /organizations/{org_id}/permissions returns this grouped-by-module shape
type PermissionCatalog = Record<string, PermissionCatalogItem[]>;

// A direct grant/revoke override on a user, from model_has_permissions
type UserPermissionOverride = {
  name: string;
  type: "grant" | "revoke";
  scope: PermissionScope | null; // null when type = 'revoke'
};

// NOTE: the exact shape of an effective permission comes from
// PermissionService::allPermissionsFor(), which wasn't in the files shared.
// This assumes { name, scope, source } — confirm against that service and
// adjust before relying on `source`/`scope` in the UI.
type EffectivePermission = {
  name: string;
  scope?: PermissionScope;
  source?: string;
};

type UserPermissionsResponse = {
  effective_permissions: EffectivePermission[];
  direct_overrides: UserPermissionOverride[];
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface SetOverridePayload {
  permission: string;
  type: "grant" | "revoke";
  scope?: PermissionScope; // only meaningful when type = 'grant'; defaults to 'all' server-side
}

class PermissionAPI {
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

  // GET /organizations/{org_id}/permissions — full catalog, grouped by module
  async getCatalog(organizationId: number): Promise<ApiResponse<PermissionCatalog>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/permissions`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<PermissionCatalog>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch permission catalog",
      };
    }
  }

  // GET /organizations/{org_id}/users/{user_id}/permissions
  async getUserPermissions(
    organizationId: number,
    userId: number
  ): Promise<ApiResponse<UserPermissionsResponse>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/users/${userId}/permissions`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<UserPermissionsResponse>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch user permissions",
      };
    }
  }

  // POST /organizations/{org_id}/users/{user_id}/permissions
  // A direct grant/revoke always overrides whatever the user's role(s) say.
  async setOverride(
    organizationId: number,
    userId: number,
    payload: SetOverridePayload
  ): Promise<ApiResponse<null>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/users/${userId}/permissions`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<null>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save permission override",
      };
    }
  }

  // DELETE /organizations/{org_id}/users/{user_id}/permissions/{permission_name}
  async clearOverride(
    organizationId: number,
    userId: number,
    permissionName: string
  ): Promise<ApiResponse<null>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/users/${userId}/permissions/${encodeURIComponent(
        permissionName
      )}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<null>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear override",
      };
    }
  }
}

export const permissionAPI = new PermissionAPI();
export type {
  PermissionCatalogItem,
  PermissionCatalog,
  UserPermissionOverride,
  EffectivePermission,
  UserPermissionsResponse,
  SetOverridePayload,
  ApiResponse,
};