// Add this interface if not already present
export interface LeaveType {
  leave_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_email?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  created_at: string;
  updated_at: string;
}

// Add this method to your leaveAPI object
export const leaveAPI = {
  // ... your existing methods ...

  updateLeaveStatus: async (
    leaveId: string,
    status: 'approved' | 'rejected'
  ): Promise<{ success: boolean; error?: string; data?: LeaveType }> => {
    try {
      const response = await fetch(`/api/leaves/${leaveId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Failed to update leave status',
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
};