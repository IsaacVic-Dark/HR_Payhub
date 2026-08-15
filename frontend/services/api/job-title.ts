type JobTitleType = {
  id: number;
  organization_id: number;
  department_id: number | null;
  department_name?: string | null;
  title: string;
  grade: string | null;
  created_at: string;
  // Joined fields (paginated / non-minimal responses only)
  employee_count?: number;
};

type MinimalJobTitleType = {
  id: number;
  title: string;
  grade: string | null;
  department_id: number | null;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string>;
  metadata?: any;
}

interface JobTitleFilters {
  page?: number;
  per_page?: number;
  department_id?: number;
  search?: string;
  with_minimal?: 0 | 1;
}

interface CreateJobTitlePayload {
  title: string;
  department_id: number;
  grade?: string;
}

interface UpdateJobTitlePayload {
  title?: string;
  department_id?: number;
  grade?: string;
}

class JobTitleAPI {
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

  private buildQueryParams(filters: JobTitleFilters): string {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });
    return params.toString();
  }

  // GET /organizations/{org_id}/job-titles
  async getJobTitles(
    organizationId: number,
    filters: JobTitleFilters = {}
  ): Promise<ApiResponse<JobTitleType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/job-titles${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<JobTitleType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch job titles",
      };
    }
  }

  // Lightweight job title list for pickers/dropdowns — { id, title, grade, department_id }
  // GET /organizations/{org_id}/job-titles?department_id=X&with_minimal=1
  async getJobTitlesMinimal(
    organizationId: number,
    filters: Omit<JobTitleFilters, "with_minimal" | "page" | "per_page"> = {}
  ): Promise<ApiResponse<MinimalJobTitleType[]>> {
    try {
      const queryParams = this.buildQueryParams({ ...filters, with_minimal: 1 });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/job-titles${queryParams ? `?${queryParams}` : ""}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<MinimalJobTitleType[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch job titles",
      };
    }
  }

  // GET /organizations/{org_id}/job-titles/{id}
  async getJobTitle(
    organizationId: number,
    jobTitleId: number
  ): Promise<ApiResponse<JobTitleType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/job-titles/${jobTitleId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<JobTitleType>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch job title",
      };
    }
  }

  // POST /organizations/{org_id}/job-titles
  // department_id is required — also used for the employee drawer's inline quick-add.
  async createJobTitle(
    organizationId: number,
    payload: CreateJobTitlePayload
  ): Promise<ApiResponse<{ id: number; title: string; grade: string | null; department_id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/job-titles`;

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
        error: error instanceof Error ? error.message : "Failed to create job title",
      };
    }
  }

  // PUT /organizations/{org_id}/job-titles/{id}
  async updateJobTitle(
    organizationId: number,
    jobTitleId: number,
    payload: UpdateJobTitlePayload
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/job-titles/${jobTitleId}`;

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
        error: error instanceof Error ? error.message : "Failed to update job title",
      };
    }
  }

  // DELETE /organizations/{org_id}/job-titles/{id}  (hard delete)
  async deleteJobTitle(
    organizationId: number,
    jobTitleId: number
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/job-titles/${jobTitleId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<{ id: number }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete job title",
      };
    }
  }
}

export const jobTitleAPI = new JobTitleAPI();
export type {
  JobTitleType,
  MinimalJobTitleType,
  JobTitleFilters,
  CreateJobTitlePayload,
  UpdateJobTitlePayload,
  ApiResponse,
};