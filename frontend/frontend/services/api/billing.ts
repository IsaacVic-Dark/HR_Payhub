// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  metadata?: any;
}

interface SubscriptionPlan {
  id: number;
  code: string;
  name: string;
  billing_cycle: 'monthly' | 'annual';
  base_price: number;
  price_per_employee: number | null;
  trial_days: number | null;
  max_employees: number | null;
  features: string[];
  is_active: boolean;
}

interface OrganizationSubscription {
  id: number;
  plan_id: number;
  status: 'trialing' | 'pending_payment' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  employee_limit: number | null;
}

interface BillingData {
  current_subscription: OrganizationSubscription | null;
  current_plan: SubscriptionPlan | null;
  all_plans: SubscriptionPlan[];
}

// ─── API Class ────────────────────────────────────────────────────────────────

class BillingAPI {
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
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errors: {},
      };
    }
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getCookie('access_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async getCurrentSubscription(): Promise<ApiResponse<BillingData>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription/current`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse<BillingData>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load billing data',
      };
    }
  }

  async switchPlan(planId: number): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription/switch`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ plan_id: planId }),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch plan',
      };
    }
  }

  async cancelSubscription(): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription/cancel`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription',
      };
    }
  }
}

export const billingAPI = new BillingAPI();
export type {
  ApiResponse,
  SubscriptionPlan,
  OrganizationSubscription,
  BillingData,
};