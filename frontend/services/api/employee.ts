// Employee Types
type EmployeeStatus = "active" | "inactive" | "on_leave" | "terminated" | "resigned" | "suspended" | "probation";
type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
type WorkLocation = "on-site" | "remote" | "hybrid";

type EmployeeType = {
  id: number;
  organization_id: number;
  user_id: number;
  email: string;
  phone: string;
  hire_date: string;
  job_title: string;
  department: string;
  reports_to: number | null;
  base_salary: string;
  bank_account_number: string | null;
  tax_id: string | null;
  created_at: string;
  updated_at: string;
  status: EmployeeStatus;
  employment_type: EmploymentType;
  work_location: WorkLocation;
  username: string;
  personal_email: string | null;
  first_name: string;
  middle_name: string | null;
  surname: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: any;
}

interface EmployeesResponseData {
  employees: EmployeeType[];
  metadata?: {
    dev_mode?: boolean;
    filters?: any;
    total?: number;
    duration?: number;
  };
}

interface EmployeeFilters {
  department?: string;
  job_title?: string;
  status?: string;
  employment_type?: string;
  work_location?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

interface CreateEmployeeData {
  user_id: number;
  email: string;
  phone: string;
  hire_date: string;
  job_title: string;
  department: string;
  reports_to?: number;
  base_salary: string;
  bank_account_number?: string;
  tax_id?: string;
  status?: EmployeeStatus;
  employment_type: EmploymentType;
  work_location: WorkLocation;
  username: string;
  personal_email?: string;
  first_name: string;
  middle_name?: string;
  surname: string;
}

interface UpdateEmployeeData {
  email?: string;
  phone?: string;
  hire_date?: string;
  job_title?: string;
  department?: string;
  reports_to?: number;
  base_salary?: string;
  bank_account_number?: string;
  tax_id?: string;
  status?: EmployeeStatus;
  employment_type?: EmploymentType;
  work_location?: WorkLocation;
  username?: string;
  personal_email?: string;
  first_name?: string;
  middle_name?: string;
  surname?: string;
}

class EmployeeAPI {
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP error! status: ${response.status}`,
        };
      }

      // Return the entire response data structure
      return {
        success: true,
        data: data,
        message: data.message,
        metadata: data.metadata,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  }

  private buildQueryParams(filters: EmployeeFilters): string {
    const params = new URLSearchParams();

    if (filters.department) {
      params.append("department", filters.department);
    }
    if (filters.job_title) {
      params.append("job_title", filters.job_title);
    }
    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.employment_type) {
      params.append("employment_type", filters.employment_type);
    }
    if (filters.work_location) {
      params.append("work_location", filters.work_location);
    }
    if (filters.sort_by) {
      params.append("sort_by", filters.sort_by);
    }
    if (filters.sort_order) {
      params.append("sort_order", filters.sort_order);
    }

    return params.toString();
  }

  private getAuthHeaders(): HeadersInit {
    // Get token from cookie
    const token = this.getCookie("access_token");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async getEmployees(
    organizationId: number,
    filters: EmployeeFilters = {}
  ): Promise<ApiResponse<EmployeeType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include", // Send cookies with request
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<EmployeeType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch employees",
      };
    }
  }

  async getEmployeeById(
    organizationId: number,
    employeeId: number
  ): Promise<ApiResponse<EmployeeType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<EmployeeType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch employee",
      };
    }
  }

  async createEmployee(
    organizationId: number,
    employeeData: CreateEmployeeData
  ): Promise<ApiResponse<EmployeeType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(employeeData),
      });

      return this.handleResponse<EmployeeType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create employee",
      };
    }
  }

  async updateEmployee(
    organizationId: number,
    employeeId: number,
    employeeData: UpdateEmployeeData
  ): Promise<ApiResponse<EmployeeType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(employeeData),
      });

      return this.handleResponse<EmployeeType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update employee",
      };
    }
  }

  async deleteEmployee(
    organizationId: number,
    employeeId: number
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}`;

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
          error instanceof Error ? error.message : "Failed to delete employee",
      };
    }
  }

  async updateEmployeeStatus(
    organizationId: number,
    employeeId: number,
    status: EmployeeStatus
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/employees/${employeeId}/status`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update employee status",
      };
    }
  }
}

export const employeeAPI = new EmployeeAPI();
export type {
  EmployeeType,
  EmployeeFilters,
  ApiResponse,
  EmployeesResponseData,
  CreateEmployeeData,
  UpdateEmployeeData,
  EmployeeStatus,
  EmploymentType,
  WorkLocation,
};