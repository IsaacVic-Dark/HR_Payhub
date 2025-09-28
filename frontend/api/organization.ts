// api/organization.ts

export interface Organization {
  id: number;
  tenant_id: number | null;
  name: string;
  payroll_number_prefix: string;
  kra_pin: string | null;
  nssf_number: string | null;
  nhif_number: string | null;
  legal_type: string | null;
  registration_number: string | null;
  physical_address: string | null;
  postal_address: string | null;
  postal_code_id: number | null;
  county_id: number | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  official_email: string | null;
  location: string;
  logo_url: string | null;
  currency: string;
  payroll_schedule: string;
  payroll_lock_date: string | null;
  default_payday: number | null;
  bank_id: number | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  swift_code: string | null;
  nssf_branch_code: string | null;
  nhif_branch_code: string | null;
  primary_administrator_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  domain: string | null;
}

export interface OrganizationFilters {
  page?: number;
  limit?: number;
  name?: string;
  location?: string;
  status?: string;
}

export interface OrganizationResponse {
  success: boolean;
  data?: Organization | Organization[];
  error?: string;
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
    filters_applied?: any;
    dev_mode?: boolean;
  };
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
      if (filters.name) queryParams.append('name', filters.name);
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.status) queryParams.append('status', filters.status);

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
        data: data.data,
        metadata: data.metadata
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
        data: data.data
      };
    } catch (error) {
      console.error('Error fetching organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization'
      };
    }
  }

  async createOrganization(organization: Partial<Organization>): Promise<OrganizationResponse> {
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
        data: data.data
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
        data: data.data
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

      const data = await response.json();

      return {
        success: true,
        data: data.data
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