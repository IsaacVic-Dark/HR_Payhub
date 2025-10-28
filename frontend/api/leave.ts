// Add this interface if not already present
export interface LeaveType {
  leave_id: string;
  employee_id: string;
  first_name: string;
  surname: string;
  employee_full_name?: string;
  employee_first_name?: string;
  employee_surname?: string;
  employee_email?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveFilters {
  page?: number;
  per_page?: number;
  status?: string;
  approver_id?: string;
  reliever_id?: string;
  month?: string;
  year?: string;
  leave_type?: string;
  name?: string;
}

export interface LeaveStatistics {
  sick_leave: number;
  casual_leave: number;
  annual_leave: number;
  paternity_leave: number;
  maternity_leave?: number;
  other?: number;
}

// Add this method to your leaveAPI object
export const leaveAPI = {
  // Get all leaves with filters
  getLeaves: async (filters?: LeaveFilters) => {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }

      const response = await fetch(`/api/leaves?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to fetch leaves',
        };
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  },

  // Get leave statistics
  getStatistics: async (): Promise<{ 
    success: boolean; 
    error?: string; 
    data?: LeaveStatistics 
  }> => {
    try {
      const response = await fetch('/api/leaves/statistics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to fetch statistics',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  },

  // Approve leave - Fixed endpoint
  approveLeave: async (
    leaveId: string
  ): Promise<{ success: boolean; error?: string; data?: LeaveType }> => {
    try {
      const response = await fetch(`/api/leaves/${leaveId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to approve leave',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  },

  // Reject leave - Fixed endpoint
  rejectLeave: async (
    leaveId: string
  ): Promise<{ success: boolean; error?: string; data?: LeaveType }> => {
    try {
      const response = await fetch(`/api/leaves/${leaveId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to reject leave',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  },

  // Legacy method - keeping for backwards compatibility
  updateLeaveStatus: async (
    leaveId: string,
    status: 'approved' | 'rejected'
  ): Promise<{ success: boolean; error?: string; data?: LeaveType }> => {
    // Route to appropriate endpoint
    if (status === 'approved') {
      return leaveAPI.approveLeave(leaveId);
    } else {
      return leaveAPI.rejectLeave(leaveId);
    }
  },
};