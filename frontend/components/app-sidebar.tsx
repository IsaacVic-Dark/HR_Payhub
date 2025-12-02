"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import * as React from "react";
import {
  IconChartBar,
  IconDashboard,
  IconUsers,
  IconBuilding,
  IconCash,
  IconCalendar,
  IconInnerShadowTop,
  IconSettings,
  IconHelp,
  IconFileText,
  IconReceipt,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/../../../images/profile.jpg",
  },
  // Core navigation items
  coreNav: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
      roles: ['super_admin', 'admin', 'employee'],
    },
  ],
  // Payroll Management section
  payrollSection: [
    {
      title: "Payrun",
      url: "/payrun",
      icon: IconChartBar,
      roles: ['super_admin', 'admin'],
      hasDropdown: true,
      items: [
        {
          title: "Active Payruns",
          url: "/payrun/active",
        },
        {
          title: "Payrun History",
          url: "/payrun/history",
        },
      ],
    },
    {
      title: "Payments",
      url: "/payments",
      icon: IconCash,
      roles: ['super_admin', 'admin'],
      hasDropdown: true,
      items: [
        {
          title: "Payment Records",
          url: "/payments/records",
        },
        {
          title: "Pending Payments",
          url: "/payments/pending",
        },
      ],
    },
    {
      title: "P9 Forms",
      url: "/p9-forms",
      icon: IconFileText,
      roles: ['super_admin', 'admin'],
    },
    {
      title: "Tax Reports",
      url: "/tax-reports",
      icon: IconReceipt,
      roles: ['super_admin', 'admin'],
    },
  ],
  // Employee Management section
  employeeSection: [
    {
      title: "Employees",
      url: "/employees",
      icon: IconUsers,
      roles: ['super_admin', 'admin'],
      hasDropdown: true,
      items: [
        {
          title: "Employee List",
          url: "/employees/list",
        },
        {
          title: "Departments",
          url: "/employees/departments",
        },
      ],
    },
    {
      title: "Leaves",
      url: "/leaves",
      icon: IconCalendar,
      roles: ['super_admin', 'admin', 'employee'],
    },
  ],
  // System section
  systemSection: [
    {
      title: "Organization",
      url: "/organization",
      icon: IconBuilding,
      roles: ['super_admin'],
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
      roles: ['super_admin', 'admin'],
    },
  ],
  // Others section
  othersSection: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
      roles: ['super_admin'],
    },
    {
      title: "Get Help",
      url: "/help",
      icon: IconHelp,
      roles: ['super_admin', 'admin', 'employee'],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { hasRole } = usePermissions();
  const [openDropdowns, setOpenDropdowns] = React.useState<string[]>([]);

  const toggleDropdown = (title: string) => {
    setOpenDropdowns((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  // Filter navigation items based on user role
  const filteredCoreNav = data.coreNav.filter((item) => hasRole(item.roles));
  const filteredPayrollSection = data.payrollSection.filter((item) =>
    hasRole(item.roles)
  );
  const filteredEmployeeSection = data.employeeSection.filter((item) =>
    hasRole(item.roles)
  );
  const filteredSystemSection = data.systemSection.filter((item) =>
    hasRole(item.roles)
  );
  const filteredOthersSection = data.othersSection.filter((item) =>
    hasRole(item.roles)
  );

  const renderNavItem = (item: any) => {
    const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
    const isOpen = openDropdowns.includes(item.title);

    if (item.hasDropdown && item.items) {
      return (
        <Collapsible key={item.title} open={isOpen} onOpenChange={() => toggleDropdown(item.title)}>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                isActive={isActive}
                className="hover:bg-[#be2ed6] data-[active=true]:bg-[#be2ed6] data-[active=true]:text-[#ffffff]"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
                {isOpen ? (
                  <IconChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <IconChevronRight className="ml-auto h-4 w-4" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 pl-2 mt-1">
                <SidebarMenuSub>
                  {item.items.map((subItem: any) => {
                    const isSubActive = pathname === subItem.url;
                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isSubActive}
                          className="hover:bg-[#be2ed6] data-[active=true]:bg-[#be2ed6] data-[active=true]:text-[#ffffff]"
                        >
                          <Link href={subItem.url}>{subItem.title}</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </div>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className="hover:bg-[#be2ed6] data-[active=true]:bg-[#be2ed6] data-[active=true]:text-[#ffffff]"
        >
          <Link href={item.url}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Pay hub.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto overflow-x-hidden scrollbar-hide">
        {/* Core Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredCoreNav.map((item) => renderNavItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Payroll Management */}
        {filteredPayrollSection.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase text-gray-500 px-2 mb-1">
              Payroll Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredPayrollSection.map((item) => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Employee Management */}
        {filteredEmployeeSection.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase text-gray-500 px-2 mb-1">
              Employee Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredEmployeeSection.map((item) => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System */}
        {filteredSystemSection.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase text-gray-500 px-2 mb-1">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSystemSection.map((item) => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Others */}
        {filteredOthersSection.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase text-gray-500 px-2 mb-1">
              Others
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredOthersSection.map((item) => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}