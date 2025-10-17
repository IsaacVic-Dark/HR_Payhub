// frontend/lib/api/notifications.ts

export interface NotificationMetadata {
  year?: number;
  month?: string;
  [key: string]: any;
}

export interface Notification {
  id: number;
  employee_id: number;
  title: string;
  message: string;
  type: string;
  is_read: number;
  metadata: string | NotificationMetadata;
  created_at: string;
  updated_at: string;
  employee_email: string;
  first_name: string;
  surname: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  unread_count: number;
}

class NotificationService {


  /**
   * Fetch all notifications for the current user
   */
  async getNotifications(): Promise<NotificationResponse> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/notifications`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse metadata if it's a string
    //   const notifications = data.data.notifications?.map((notification: Notification) => ({
    //     ...notification,
    //     metadata: typeof notification.metadata === 'string' 
    //       ? JSON.parse(notification.metadata) 
    //       : notification.metadata
    //   }));

      const notifications = data.data;

      return {
        notifications: notifications || [],
        unread_count: data.unread_count || 0
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: number): Promise<void> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: number): Promise<void> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default NotificationService;