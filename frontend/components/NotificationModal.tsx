// frontend/components/NotificationModal.tsx

"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  X, 
  Briefcase, 
  DollarSign, 
  FileText, 
  Calendar, 
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Notification, notificationService } from "@/services/api/notification";
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface NotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotificationRead?: () => void;
}

const getNotificationIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'salary':
    case 'payment':
      return <DollarSign className="h-4 w-4" />;
    case 'document':
    case 'approval':
      return <FileText className="h-4 w-4" />;
    case 'meeting':
    case 'calendar':
      return <Calendar className="h-4 w-4" />;
    case 'leave':
    case 'time_off':
      return <Clock className="h-4 w-4" />;
    case 'performance':
    case 'review':
      return <CheckCircle2 className="h-4 w-4" />;
    default:
      return <Briefcase className="h-4 w-4" />;
  }
};

const getNotificationColor = (type: string, isRead: boolean) => {
  const baseColors = {
    'salary': 'bg-green-100 text-green-800',
    'payment': 'bg-green-100 text-green-800',
    'document': 'bg-blue-100 text-blue-800',
    'approval': 'bg-blue-100 text-blue-800',
    'meeting': 'bg-orange-100 text-orange-800',
    'calendar': 'bg-orange-100 text-orange-800',
    'leave': 'bg-purple-100 text-purple-800',
    'time_off': 'bg-purple-100 text-purple-800',
    'performance': 'bg-emerald-100 text-emerald-800',
    'review': 'bg-emerald-100 text-emerald-800',
    'default': 'bg-gray-100 text-gray-800'
  };
  
  return baseColors[type.toLowerCase() as keyof typeof baseColors] || baseColors.default;
};

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkAsRead: (id: number) => void;
}> = ({ notification, onMarkAsRead }) => {
  const isUnread = notification.is_read === 0;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div 
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
        isUnread ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${getNotificationColor(notification.type, !isUnread)}`}>
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-medium ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
              {notification.title}
            </h4>
            {isUnread && (
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
            )}
          </div>
          
          <p className={`text-sm ${isUnread ? 'text-gray-700' : 'text-gray-500'} mb-2`}>
            {notification.message}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {timeAgo}
            </span>
            
            <Badge variant="outline" className="text-xs">
              {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotificationModal: React.FC<NotificationModalProps> = ({
  open,
  onOpenChange,
  onNotificationRead
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // console.log("User in NotificationModal: ", user);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await notificationService.getNotifications(user.organization_id);
      console.log("The notifications expected: ", response)
      setNotifications(response.notifications);
    } catch (err) {
      setError('Failed to load notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await notificationService.markAsRead(user.organization_id, notificationId);
      
      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, is_read: 1 }
            : notification
        )
      );
      
      // Notify parent component
      onNotificationRead?.();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(user.organization_id);
      
      // Update local state
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, is_read: 1 }))
      );
      
      // Notify parent component
      onNotificationRead?.();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const unreadNotifications = notifications.filter(n => n.is_read === 0);
  const readNotifications = notifications.filter(n => n.is_read === 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[80vh] p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Notification
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-4">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all" className="text-sm">
                  All notification
                  {notifications.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                      {notifications.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-sm">
                  Unread
                  {unreadNotifications.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                      {unreadNotifications.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <TabsContent value="all" className="mt-0 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-500">Loading notifications...</div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-sm text-gray-500">No notifications found</div>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="unread" className="mt-0 space-y-3">
                {unreadNotifications.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-sm text-gray-500">No unread notifications</div>
                  </div>
                ) : (
                  unreadNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {unreadNotifications.length > 0 && (
          <>
            <Separator />
            <div className="p-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="w-full"
              >
                Mark all as read
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};