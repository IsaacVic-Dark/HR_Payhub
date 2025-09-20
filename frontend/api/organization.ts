// api/organization.ts

export interface Organization {
  id: number;
  name: string;
  location: string;
  logo_url: string;
  currency: string;
  created_at: string;
  updated_at: string;
  domain: string;
}

export interface OrganizationFilters {
  page?: number;
  limit?: number;
  search?: string;
  location?: string;
  currency?: string;
}

export interface OrganizationResponse {
  success: boolean;
  data?: {
    data: Organization[];
    metadata?: {
      total?: number;
      totalPages?: number;
      currentPage?: number;
      dev_mode?: boolean;
    };
  };
  error?: string;
}

class OrganizationAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';
  }

  async getOrganizations(filters: OrganizationFilters = {}): Promise<OrganizationResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (filters.page) queryParams.append('page', filters.page.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.currency) queryParams.append('currency', filters.currency);

      // Fix: Actually append the query parameters to the URL
      const url = `${this.baseURL}/organizations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          data: data.data,
          metadata: data.metadata
        }
      };
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organizations'
      };
    }
  }

  async getOrganizationById(id: number): Promise<OrganizationResponse> {
    try {
      const response = await fetch(`${this.baseURL}/organizations/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          data: [data.data]
        }
      };
    } catch (error) {
      console.error('Error fetching organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization'
      };
    }
  }

  async createOrganization(organization: Omit<Organization, 'id' | 'created_at' | 'updated_at'>): Promise<OrganizationResponse> {
    try {
      const response = await fetch(`${this.baseURL}/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(organization),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          data: [data.data]
        }
      };
    } catch (error) {
      console.error('Error creating organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create organization'
      };
    }
  }

  async updateOrganization(id: number, updates: Partial<Organization>): Promise<OrganizationResponse> {
    try {
      const response = await fetch(`${this.baseURL}/organizations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          data: [data.data]
        }
      };
    } catch (error) {
      console.error('Error updating organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update organization'
      };
    }
  }

  async deleteOrganization(id: number): Promise<OrganizationResponse> {
    try {
      const response = await fetch(`${this.baseURL}/organizations/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return {
        success: true,
        data: {
          data: []
        }
      };
    } catch (error) {
      console.error('Error deleting organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete organization'
      };
    }
  }
}

export const organizationAPI = new OrganizationAPI();