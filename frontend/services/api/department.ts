type DepartmentType = {
  id: number;
  organization_id: number;
  name: string;
  code: string | null;
  description: string | null;
  head_employee_id: number | null;
  is_active: number;
  created_at: string;
  updated_at?: string | null;
  // Joined fields
  head_full_name: string | null;
  head_first_name: string | null;
  head_surname: string | null;
  head_email: string | null;
  head_employee_number: string | null;
  employee_count: number;
};

type DepartmentEmployeeType = {
  id: number;
  first_name: string;
  surname: string;
  email: string;
  employee_number: string;
  job_title: string | null;
  department_id: number;
  status: string;
  employment_type: string | null;
  created_at: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface DepartmentFilters {
  page?: number;
  per_page?: number;
  is_active?: 0 | 1;
  search?: string;
}

interface DepartmentEmployeeFilters {
  page?: number;
  per_page?: number;
}

interface CreateDepartmentPayload {
  name: string;
  code?: string;
  description?: string;
  head_employee_id?: number;
  is_active?: 0 | 1;
}

interface UpdateDepartmentPayload {
  name?: string;
  code?: string;
  description?: string;
  head_employee_id?: number;
  is_active?: 0 | 1;
}

class DepartmentAPI {
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

  private buildQueryParams(filters: DepartmentFilters | DepartmentEmployeeFilters): string {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });
    return params.toString();
  }

  // GET /organizations/{org_id}/departments
  async getDepartments(
    organizationId: number,
    filters: DepartmentFilters = {}
  ): Promise<ApiResponse<DepartmentType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/departments${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<DepartmentType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch departments",
      };
    }
  }

  // GET /organizations/{org_id}/departments/{id}
  async getDepartment(
    organizationId: number,
    departmentId: number
  ): Promise<ApiResponse<DepartmentType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/departments/${departmentId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<DepartmentType>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch department",
      };
    }
  }

  // POST /organizations/{org_id}/departments
  async createDepartment(
    organizationId: number,
    payload: CreateDepartmentPayload
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/departments`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<{ id: number }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create department",
      };
    }
  }

  // PUT /organizations/{org_id}/departments/{id}
  async updateDepartment(
    organizationId: number,
    departmentId: number,
    payload: UpdateDepartmentPayload
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/departments/${departmentId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<{ id: number }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update department",
      };
    }
  }

  // DELETE /organizations/{org_id}/departments/{id}  (soft-deactivate)
  async deactivateDepartment(
    organizationId: number,
    departmentId: number
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/departments/${departmentId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<{ id: number }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to deactivate department",
      };
    }
  }

  // POST /organizations/{org_id}/departments/{id}/assign-head
  async assignHead(
    organizationId: number,
    departmentId: number,
    headEmployeeId: number
  ): Promise<ApiResponse<{ department_id: number; head_employee_id: number; head_full_name: string }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/departments/${departmentId}/assign-head`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ head_employee_id: headEmployeeId }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to assign department head",
      };
    }
  }

  // GET /organizations/{org_id}/departments/{id}/employees
  async getDepartmentEmployees(
    organizationId: number,
    departmentId: number,
    filters: DepartmentEmployeeFilters = {}
  ): Promise<ApiResponse<DepartmentEmployeeType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/departments/${departmentId}/employees${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<DepartmentEmployeeType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch department employees",
      };
    }
  }
}

export const departmentAPI = new DepartmentAPI();
export type {
  DepartmentType,
  DepartmentEmployeeType,
  DepartmentFilters,
  DepartmentEmployeeFilters,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
  ApiResponse,
};