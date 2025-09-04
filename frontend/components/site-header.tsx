'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { Search, BellDot, Bell, ExternalLink, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NotificationModal } from "@/components/NotificationModal";
import { notificationService } from "@/services/api/notification";

export function SiteHeader() {
  
const pathname = usePathname();
const endpoint = pathname.split("/").filter(Boolean).pop() || "Dashboard";
const path = endpoint.charAt(0).toUpperCase() + endpoint.slice(1);

// const NotificationButton: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Function to fetch notification count
  const fetchUnreadCount = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await notificationService.getNotifications();
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error('Error fetching notification count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };
  // }

  // Fetch unread count on component mount
  useEffect(() => {
    fetchUnreadCount();
  }, []);

  // Handle notification read event
  const handleNotificationRead = () => {
    fetchUnreadCount();
  };

  // Handle button click
  const handleButtonClick = () => {
    setIsModalOpen(true);
  };

  const hasUnreadNotifications = unreadCount > 0;


  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{path}</h1>

        <div className="ml-auto flex items-center gap-2"></div>

        <div className="flex items-center justify-end w-full">
          {/* Right Section */}
          <div className="flex justify-end items-center space-x-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search anything..."
                className="pl-10 pr-4 py-2 w-full bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
              />
            </div>
            {/* BellDot Icon */}
       <Button
        variant="ghost"
        size="icon"
        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 relative"
        onClick={handleButtonClick}
      >
        {hasUnreadNotifications ? (
          <BellDot className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        
        {/* Notification badge for unread count */}
        {hasUnreadNotifications && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center min-w-[20px]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

            <NotificationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onNotificationRead={handleNotificationRead}
      />

            {/* External Link Icon */}
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <ExternalLink className="h-5 w-5" />
            </Button>

            {/* Avatar Stack */}
            <div className="flex items-center -space-x-2">
              <Avatar className="h-8 w-8 border-2 border-white">
                <AvatarImage
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face"
                  alt="User 1"
                />
                <AvatarFallback className="bg-blue-500 text-white text-xs">
                  JD
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-white">
                <AvatarImage
                  src="https://images.unsplash.com/photo-1494790108755-2616b612e0c3?w=32&h=32&fit=crop&crop=face"
                  alt="User 2"
                />
                <AvatarFallback className="bg-purple-500 text-white text-xs">
                  SM
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-white">
                <AvatarImage
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face"
                  alt="User 3"
                />
                <AvatarFallback className="bg-green-500 text-white text-xs">
                  MJ
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-white">
                <AvatarImage
                  src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face"
                  alt="User 4"
                />
                <AvatarFallback className="bg-pink-500 text-white text-xs">
                  AL
                </AvatarFallback>
              </Avatar>
              <Avatar className="h-8 w-8 border-2 border-white">
                <AvatarImage src="#" alt="User 4" />
                <AvatarFallback className="bg-gray-200 text-white text-xs border-1 border-gray-200">
                  +10
                </AvatarFallback>
              </Avatar>

              {/* +10 Badge */}
              {/* <div className="flex items-center justify-center h-8 w-8 bg-gray-100 border-2 border-white ring-1 ring-gray-200 rounded-full ml-1">
                <span className="text-xs font-medium text-gray-600">+10</span>
              </div> */}
            </div>

            {/* Invite Button */}
            <Button variant="ghost" className="border-1 border-gray-300">
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
