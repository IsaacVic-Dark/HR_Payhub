type BillingCycle = "monthly" | "annual";

type SubscriptionPlan = {
  id: number;
  code: string;
  name: string;
  billing_cycle: BillingCycle;
  base_price: number;
  price_per_employee: number | null;
  trial_days: number | null;
  max_employees: number | null;
  requires_card: boolean;
  features: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

// Payload for creating a plan
interface CreatePlanPayload {
  code: string;
  name: string;
  billing_cycle: BillingCycle;
  base_price: number;
  price_per_employee?: number | null;
  trial_days?: number;
  requires_card?: boolean;
  max_employees?: number | null;
  features?: string[];
  is_active?: boolean;
}

// Payload for updating a plan — every field optional, only send what changed
type UpdatePlanPayload = Partial<CreatePlanPayload>;

class SubscriptionPlanAPI {
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
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
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

  // GET /api/v1/subscription-plans — admin listing, includes inactive plans
  async getAllPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription-plans`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      return this.handleResponse<SubscriptionPlan[]>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch plans",
      };
    }
  }

  // POST /api/v1/subscription-plans
  async createPlan(
    planData: CreatePlanPayload
  ): Promise<ApiResponse<SubscriptionPlan>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription-plans`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(planData),
      });

      return this.handleResponse<SubscriptionPlan>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create plan",
      };
    }
  }

  // PUT /api/v1/subscription-plans/{id}
  async updatePlan(
    planId: number,
    planData: UpdatePlanPayload
  ): Promise<ApiResponse<SubscriptionPlan>> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription-plans/${planId}`;

      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(planData),
      });

      return this.handleResponse<SubscriptionPlan>(response);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update plan",
      };
    }
  }

  // DELETE /api/v1/subscription-plans/{id} — soft delete (is_active = 0)
  async deactivatePlan(planId: number): Promise<ApiResponse> {
    try {
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription-plans/${planId}`;

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
          error instanceof Error ? error.message : "Failed to deactivate plan",
      };
    }
  }

  // Convenience — reactivate a plan by sending is_active: true through updatePlan
  async reactivatePlan(planId: number): Promise<ApiResponse<SubscriptionPlan>> {
    return this.updatePlan(planId, { is_active: true });
  }
}

export const subscriptionPlanAPI = new SubscriptionPlanAPI();
export type {
  SubscriptionPlan,
  BillingCycle,
  ApiResponse,
  CreatePlanPayload,
  UpdatePlanPayload,
};