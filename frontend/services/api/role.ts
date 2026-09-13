// Scope a permission can be granted at on a role.
// own = self only, team = direct reports, department = same department_id, all = whole org
type PermissionScope = "own" | "team" | "department" | "all";

type RolePermission = {
  name: string;
  module: string;
  scope: PermissionScope;
};

type RoleUser = {
  id: number;
  username: string;
  email: string;
};

// Shape returned by GET /organizations/{org_id}/roles (list)
type RoleType = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  permissions: RolePermission[];
  user_count: number;
};

// Shape returned by GET /organizations/{org_id}/roles/{id} (detail) — has
// `users` instead of `user_count`, and no organization_id/slug omitted.
type RoleDetailType = {
  id: number;
  organization_id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  permissions: RolePermission[];
  users: RoleUser[];
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

// Input for a single permission grant when creating/updating a role
interface RolePermissionInput {
  name: string;
  scope: PermissionScope;
}

interface CreateRolePayload {
  name: string;
  description?: string;
  permissions?: RolePermissionInput[];
}

interface UpdateRolePayload {
  name?: string;
  description?: string;
  permissions?: RolePermissionInput[];
}

class RoleAPI {
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

  // GET /organizations/{org_id}/roles
  async getRoles(organizationId: number): Promise<ApiResponse<RoleType[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/roles`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<RoleType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch roles",
      };
    }
  }

  // GET /organizations/{org_id}/roles/{id}
  async getRole(
    organizationId: number,
    roleId: number
  ): Promise<ApiResponse<RoleDetailType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/roles/${roleId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<RoleDetailType>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch role",
      };
    }
  }

  // POST /organizations/{org_id}/roles
  async createRole(
    organizationId: number,
    payload: CreateRolePayload
  ): Promise<ApiResponse<{ id: number; name: string; slug: string; permissions: RolePermission[] }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/roles`;

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
        error: error instanceof Error ? error.message : "Failed to create role",
      };
    }
  }

  // PUT /organizations/{org_id}/roles/{id}
  async updateRole(
    organizationId: number,
    roleId: number,
    payload: UpdateRolePayload
  ): Promise<ApiResponse<{ id: number; permissions: RolePermission[] }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/roles/${roleId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update role",
      };
    }
  }

  // DELETE /organizations/{org_id}/roles/{id}
  // Backend blocks this for is_system roles and for roles with assigned users.
  async deleteRole(
    organizationId: number,
    roleId: number
  ): Promise<ApiResponse<null>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/roles/${roleId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<null>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete role",
      };
    }
  }

  // POST /organizations/{org_id}/roles/{id}/assign
  async assignToUser(
    organizationId: number,
    roleId: number,
    userId: number
  ): Promise<ApiResponse<null>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/roles/${roleId}/assign`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ user_id: userId }),
      });

      return this.handleResponse<null>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to assign role",
      };
    }
  }

  // DELETE /organizations/{org_id}/roles/{id}/assign/{user_id}
  async unassignFromUser(
    organizationId: number,
    roleId: number,
    userId: number
  ): Promise<ApiResponse<null>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/roles/${roleId}/assign/${userId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<null>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to unassign role",
      };
    }
  }
}

export const roleAPI = new RoleAPI();
export type {
  PermissionScope,
  RolePermission,
  RoleUser,
  RoleType,
  RoleDetailType,
  RolePermissionInput,
  CreateRolePayload,
  UpdateRolePayload,
  ApiResponse,
};