type CountryType = {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  phone_code: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  timezone: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

// Returned only on GET /countries/{id} — adds a derived county_count
type CountryDetailType = CountryType & {
  county_count: number;
};

// Minimal country returned when with_minimal=1 (id, name, iso2 only)
type MinimalCountryType = {
  id: number;
  name: string;
  iso2: string;
};

type CountyType = {
  id: number;
  country_id: number;
  name: string;
  code: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

// Returned only on GET /counties/{id} — joined with parent country
type CountyDetailType = CountyType & {
  country_name: string;
  country_iso2: string;
};

// Minimal county returned when with_minimal=1 (id, country_id, name, code only)
type MinimalCountyType = {
  id: number;
  country_id: number;
  name: string;
  code: string | null;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface CountryFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

interface CountyFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

// Payload for creating/updating a country
interface CreateCountryPayload {
  name: string;
  iso2: string;
  iso3: string;
  phone_code?: string | null;
  currency_code?: string | null;
  currency_symbol?: string | null;
  timezone?: string | null;
  is_active?: number;
}

type UpdateCountryPayload = Partial<CreateCountryPayload>;

// Payload for creating/updating a county
interface CreateCountyPayload {
  name: string;
  code?: string | null;
  is_active?: number;
}

type UpdateCountyPayload = Partial<CreateCountyPayload>;

class CountryAPI {
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

  private buildQueryParams(
    filters: CountryFilters & { with_minimal?: boolean }
  ): string {
    const params = new URLSearchParams();

    if (filters.search) {
      params.append("search", filters.search);
    }
    if (filters.is_active !== undefined) {
      params.append("is_active", filters.is_active ? "1" : "0");
    }
    if (filters.page) {
      params.append("page", filters.page.toString());
    }
    if (filters.per_page) {
      params.append("per_page", filters.per_page.toString());
    }
    if (filters.with_minimal) {
      params.append("with_minimal", "1");
    }

    return params.toString();
  }

  // Public — no authentication required (used pre-login during registration too).
  // Pass with_minimal=true to get id+name+iso2 only (used for dropdowns) —
  // response is a flat array, no pagination metadata.
  // Omit or pass false for the full paginated list.
  async getCountries(
    filters: CountryFilters = {},
    with_minimal?: boolean
  ): Promise<ApiResponse<CountryType[] | MinimalCountryType[]>> {
    try {
      const queryParams = this.buildQueryParams({ ...filters, with_minimal });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<CountryType[] | MinimalCountryType[]>(
        response
      );
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch countries",
      };
    }
  }

  // Public — no authentication required (used pre-login during registration too).
  async getCountryById(
    countryId: number
  ): Promise<ApiResponse<CountryDetailType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries/${countryId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<CountryDetailType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch country",
      };
    }
  }

  // Roles: super_admin only.
  async createCountry(
    countryData: CreateCountryPayload
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(countryData),
      });

      return this.handleResponse<{ id: number }>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create country",
      };
    }
  }

  // Roles: super_admin only.
  async updateCountry(
    countryId: number,
    countryData: UpdateCountryPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries/${countryId}`;

      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(countryData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update country",
      };
    }
  }

  // Roles: super_admin only. Soft-delete (deactivates) — see CountryController::destroy().
  async deleteCountry(countryId: number): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries/${countryId}`;

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
          error instanceof Error ? error.message : "Failed to delete country",
      };
    }
  }
}

class CountyAPI {
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

  private buildQueryParams(
    filters: CountyFilters & { with_minimal?: boolean }
  ): string {
    const params = new URLSearchParams();

    if (filters.search) {
      params.append("search", filters.search);
    }
    if (filters.is_active !== undefined) {
      params.append("is_active", filters.is_active ? "1" : "0");
    }
    if (filters.page) {
      params.append("page", filters.page.toString());
    }
    if (filters.per_page) {
      params.append("per_page", filters.per_page.toString());
    }
    if (filters.with_minimal) {
      params.append("with_minimal", "1");
    }

    return params.toString();
  }

  // Public — no authentication required (used pre-login during registration too).
  // Pass with_minimal=true to get id+country_id+name+code only (used for
  // dropdowns) — response is a flat array, no pagination metadata.
  // Omit or pass false for the full paginated list.
  async getCounties(
    countryId: number,
    filters: CountyFilters = {},
    with_minimal?: boolean
  ): Promise<ApiResponse<CountyType[] | MinimalCountyType[]>> {
    try {
      const queryParams = this.buildQueryParams({ ...filters, with_minimal });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries/${countryId}/counties${
        queryParams ? `?${queryParams}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<CountyType[] | MinimalCountyType[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch counties",
      };
    }
  }

  // Public — no authentication required (used pre-login during registration too).
  async getCountyById(countyId: number): Promise<ApiResponse<CountyDetailType>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/counties/${countyId}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<CountyDetailType>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch county",
      };
    }
  }

  // Roles: super_admin only.
  async createCounty(
    countryId: number,
    countyData: CreateCountyPayload
  ): Promise<ApiResponse<{ id: number }>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/countries/${countryId}/counties`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(countyData),
      });

      return this.handleResponse<{ id: number }>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create county",
      };
    }
  }

  // Roles: super_admin only. Note: country_id is immutable via this endpoint.
  async updateCounty(
    countyId: number,
    countyData: UpdateCountyPayload
  ): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/counties/${countyId}`;

      const response = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(countyData),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update county",
      };
    }
  }

  // Roles: super_admin only. Soft-delete (deactivates) — see CountyController::destroy().
  async deleteCounty(countyId: number): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/counties/${countyId}`;

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
          error instanceof Error ? error.message : "Failed to delete county",
      };
    }
  }
}

export const countryAPI = new CountryAPI();
export const countyAPI = new CountyAPI();
export type {
  CountryType,
  CountryDetailType,
  MinimalCountryType,
  CountyType,
  CountyDetailType,
  MinimalCountyType,
  ApiResponse,
  PaginationMeta,
  CountryFilters,
  CountyFilters,
  CreateCountryPayload,
  UpdateCountryPayload,
  CreateCountyPayload,
  UpdateCountyPayload,
};