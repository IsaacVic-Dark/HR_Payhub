import type { CountryType } from "@/services/api/countries-counties";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type HolidayType = "national" | "regional" | "religious" | "bank" | "observance";

export type MasterHolidaySource = "api_mansa" | "manual" | string;

export type MasterHolidayType = {
  id: number;
  country_code: string;
  holiday_date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType | null;
  is_active: number;
  source: MasterHolidaySource;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface MasterHolidayMetadata {
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface MasterHolidayFilters {
  country_code?: string;
  year?: number | string;
  search?: string;
  is_active?: number | string;
  page?: number;
  per_page?: number;
}

interface CreateMasterHolidayPayload {
  country_code: string;
  holiday_date: string;
  name: string;
  type?: HolidayType | null;
  is_active?: boolean | number;
}

interface UpdateMasterHolidayPayload {
  holiday_date?: string;
  name?: string;
  type?: HolidayType | null;
  is_active?: boolean | number;
}

interface ImportHolidaysPayload {
  country_code?: string;
  year?: number;
}

interface ImportHolidaysResultData {
  [key: string]: any;
}

// -----------------------------------------------------------------------
// API client
// -----------------------------------------------------------------------

class PublicHolidayAPI {
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

  private buildQueryParams(filters: MasterHolidayFilters): string {
    const params = new URLSearchParams();

    if (filters.country_code) params.append("country_code", filters.country_code);
    if (filters.year) params.append("year", String(filters.year));
    if (filters.search) params.append("search", filters.search);
    if (filters.is_active !== undefined && filters.is_active !== "") {
      params.append("is_active", String(filters.is_active));
    }
    if (filters.page) params.append("page", String(filters.page));
    if (filters.per_page) params.append("per_page", String(filters.per_page));

    return params.toString();
  }

  // ---------------------------------------------------------------------
  // Master calendar — super_admin only
  // ---------------------------------------------------------------------

  async getMasterHolidays(
    filters: MasterHolidayFilters = {}
  ): Promise<ApiResponse<MasterHolidayType[]>> {
    try {
      const queryParams = this.buildQueryParams(filters);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/holidays/master${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<MasterHolidayType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch master holidays",
      };
    }
  }

  async getMasterHolidayById(id: number): Promise<ApiResponse<MasterHolidayType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/holidays/master/${id}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<MasterHolidayType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch master holiday",
      };
    }
  }

  async createMasterHoliday(
    data: CreateMasterHolidayPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/holidays/master`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create master holiday",
      };
    }
  }

  async updateMasterHoliday(
    id: number,
    data: UpdateMasterHolidayPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/holidays/master/${id}`;

      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update master holiday",
      };
    }
  }

  // Soft-delete (is_active = 0)
  async deactivateMasterHoliday(id: number): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/holidays/master/${id}`;

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
          error instanceof Error ? error.message : "Failed to deactivate master holiday",
      };
    }
  }

  // Same endpoint as update, just flips is_active back on — mirrors how
  // countries handle reactivate (no separate route).
  async reactivateMasterHoliday(id: number): Promise<ApiResponse> {
    return this.updateMasterHoliday(id, { is_active: 1 });
  }

  async importHolidays(
    payload: ImportHolidaysPayload = {}
  ): Promise<ApiResponse<ImportHolidaysResultData>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/holidays/import`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      return this.handleResponse<ImportHolidaysResultData>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to import holidays",
      };
    }
  }

  // Kept here (rather than assuming an export name in countries-counties.ts)
  // so this file is self-contained for the country dropdown.
  async getCountries(): Promise<ApiResponse<CountryType[]>> {
    try {
      const params = new URLSearchParams();
      params.append("is_active", "1");
      params.append("per_page", "300");

      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<CountryType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch countries",
      };
    }
  }
}

export const publicHolidayAPI = new PublicHolidayAPI();
export type {
  ApiResponse,
  MasterHolidayMetadata,
  MasterHolidayFilters,
  CreateMasterHolidayPayload,
  UpdateMasterHolidayPayload,
  ImportHolidaysPayload,
};