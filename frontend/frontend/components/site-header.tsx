'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  BellDot,
  Bell,
  ExternalLink,
  Plus,
  UserPlus,
  CalendarPlus,
  HandCoins,
  Banknote,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationModal } from "@/components/NotificationModal";
import { notificationService } from "@/services/api/notification";
import { useAuth } from "@/lib/AuthContext";

// Quick-add menu. Roles match who can actually use each create form, so a user
// is never sent to a page where the form wouldn't open.
// Navigation opens the create form via ?drawer=add (employees) or
// ?modal=create (handled by hooks/use-url-modal.ts). Both are shareable URLs.
type QuickAdd = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
};

const QUICK_ADD_ITEMS: QuickAdd[] = [
  {
    label: "New Employee",
    description: "Add a team member",
    href: "/employees?drawer=add",
    icon: UserPlus,
    roles: ["admin", "hr_manager", "payroll_manager", "department_manager"],
  },
  {
    label: "Apply Leave",
    description: "Record a leave request",
    href: "/leaves?modal=create",
    icon: CalendarPlus,
    roles: ["admin", "hr_manager", "department_manager"],
  },
  {
    label: "New Loan",
    description: "Create an employee loan",
    href: "/loans?modal=create",
    icon: HandCoins,
    roles: ["admin", "hr_manager", "payroll_manager"],
  },
  {
    label: "New Advance",
    description: "Salary advance for an employee",
    href: "/advances?modal=create",
    icon: Banknote,
    roles: ["admin"],
  },
  {
    label: "New Reimbursement",
    description: "Submit an expense claim",
    href: "/reimbursements?modal=create",
    icon: ReceiptText,
    roles: ["admin", "hr_manager", "finance_manager"],
  },
];

export function SiteHeader() {

  const { user } = useAuth();
  const isSuperAdmin = user?.user_type === 'super_admin';

  const pathname = usePathname();
  const endpoint = pathname.split("/").filter(Boolean).pop() || "Dashboard";
  const path = endpoint.charAt(0).toUpperCase() + endpoint.slice(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Function to fetch notification count
  const fetchUnreadCount = async () => {
    if (loading || !user?.organization_id) return;

    setLoading(true);
    try {
      const response = await notificationService.getNotifications(user.organization_id);
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error('Error fetching notification count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count on component mount — skipped for super_admin, since
  // notifications are organization-scoped and super_admin has no org
  // context (OrganizationAuthorizationMiddleware rejects it by design).
  useEffect(() => {
    if (isSuperAdmin) return;
    fetchUnreadCount();
  }, [isSuperAdmin]);

  // Handle notification read event
  const handleNotificationRead = () => {
    fetchUnreadCount();
  };

  // Handle button click
  const handleButtonClick = () => {
    setIsModalOpen(true);
  };

  const hasUnreadNotifications = unreadCount > 0;

  const quickAddItems = QUICK_ADD_ITEMS.filter((item) =>
    item.roles.includes(user?.user_type ?? ""),
  );


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

            {/* Quick add (+) — hidden when the user's role can't create anything */}
            {quickAddItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quick add"
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 data-[state=open]:bg-gray-100"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Quick add
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {quickAddItems.map(({ label, description, href, icon: Icon }) => (
                    <DropdownMenuItem key={href} asChild className="cursor-pointer gap-3 py-2">
                      <Link href={href}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium leading-tight">{label}</span>
                          <span className="text-xs text-muted-foreground">{description}</span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Notification bell — hidden for super_admin (no org-scoped notifications to show) */}
            {!isSuperAdmin && (
              <>
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
                </Button>

                <NotificationModal
                  open={isModalOpen}
                  onOpenChange={setIsModalOpen}
                  onNotificationRead={handleNotificationRead}
                />
              </>
            )}

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
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}