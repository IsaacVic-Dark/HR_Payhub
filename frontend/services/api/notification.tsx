export interface NotificationMetadata {
  year?: number;
  month?: string;
  [key: string]: any;
}

export interface Notification {
  id: number;
  employee_id: number;
  organization_id: number;
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

  /**
   * Fetch all notifications for the current user
   */
  async getNotifications(organizationId: number): Promise<NotificationResponse> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/notifications`,
        {
          method: 'GET',
          credentials: 'include',
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse metadata if it's a string
      const notifications = data.data.notifications?.map((notification: Notification) => ({
        ...notification,
        metadata: typeof notification.metadata === 'string' 
          ? JSON.parse(notification.metadata) 
          : notification.metadata
      }));

      return {
        notifications: notifications || [],
        unread_count: data.data.unread_count || 0
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(organizationId: number, notificationId: number): Promise<void> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
          headers: this.getAuthHeaders(),
          credentials: 'include',
        }
      );

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
  async markAllAsRead(organizationId: number): Promise<void> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/notifications/mark-all-read`,
        {
          method: 'PATCH',
          headers: this.getAuthHeaders(),
          credentials: 'include',
        }
      );

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
  async deleteNotification(organizationId: number, notificationId: number): Promise<void> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/notifications/${notificationId}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(organizationId: number, notificationId: number): Promise<Notification> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${organizationId}/notifications/${notificationId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse metadata if it's a string
      const notification = data.data;
      if (notification && typeof notification.metadata === 'string') {
        notification.metadata = JSON.parse(notification.metadata);
      }

      return notification;
    } catch (error) {
      console.error('Error fetching notification:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default NotificationService;