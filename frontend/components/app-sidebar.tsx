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
  IconClipboardList,
  IconBriefcase,
  IconShieldCheck,
  IconReportMoney,
  IconUsersGroup,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from '@/lib/AuthContext';

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
      roles: [
        "super_admin",
        "admin",
        "hr_manager",
        "payroll_manager",
        "payroll_officer",
        "department_manager",
        "finance_manager",
        "auditor",
        "employee",
      ],
    },
  ],

  // Payroll Management section
  payrollSection: [
    {
      title: "Payrun",
      url: "/payrun",
      icon: IconChartBar,
      roles: ["super_admin", "admin", "payroll_manager", "payroll_officer"],
      hasDropdown: true,
      items: [
        {
          title: "Active Payruns",
          url: "/payrun/active",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
        {
          title: "Payrun History",
          url: "/payrun/history",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
      ],
    },
    {
      title: "Payroll",
      url: "/payroll",
      icon: IconReportMoney,
      roles: ["super_admin", "admin", "payroll_manager", "payroll_officer"],
      hasDropdown: true,
      items: [
        {
          title: "Run Payroll",
          url: "/payroll/run",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
        {
          title: "Data Entry",
          url: "/payroll/data-entry",
          roles: ["payroll_officer"],
        },
        {
          title: "Review & Approve",
          url: "/payroll/review",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
        {
          title: "Adjustments",
          url: "/payroll/adjustments",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
        {
          title: "Payroll History",
          url: "/payroll/history",
          roles: ["super_admin", "admin", "payroll_manager", "auditor"],
        },
      ],
    },
    {
      title: "Payments",
      url: "/payments",
      icon: IconCash,
      roles: ["super_admin", "admin", "finance_manager"],
      hasDropdown: true,
      items: [
        {
          title: "Payment Records",
          url: "/payments/records",
          roles: ["super_admin", "admin", "finance_manager"],
        },
        {
          title: "Pending Payments",
          url: "/payments/pending",
          roles: ["super_admin", "admin", "finance_manager"],
        },
        {
          title: "Process Payments",
          url: "/payments/process",
          roles: ["super_admin", "finance_manager"],
        },
      ],
    },
    {
      title: "Payslips",
      url: "/payslips",
      icon: IconReceipt,
      roles: ["super_admin", "admin", "payroll_manager"],
      hasDropdown: true,
      items: [
        {
          title: "Generate Payslips",
          url: "/payslips/generate",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
        {
          title: "Distribute Payslips",
          url: "/payslips/distribute",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
      ],
    },
    {
      title: "P9 Forms",
      url: "/p9-forms",
      icon: IconFileText,
      roles: ["super_admin", "admin", "payroll_manager"],
    },
    {
      title: "Tax Reports",
      url: "/tax-reports",
      icon: IconFileText,
      roles: ["super_admin", "admin", "payroll_manager"],
    },
  ],

  // Employee Management section
  employeeSection: [
    {
      title: "Employees",
      url: "/employees",
      icon: IconUsers,
      roles: [
        "super_admin",
        "admin",
        "hr_manager",
        "payroll_manager",
        "department_manager",
      ],
      hasDropdown: true,
      items: [
        {
          title: "Employee List",
          url: "/employees",
          roles: [
            "super_admin",
            "admin",
            "hr_manager",
            "payroll_manager",
            "department_manager",
          ],
        },
        {
          title: "Add Employee",
          url: "/employees/create",
          roles: ["super_admin", "admin", "hr_manager"],
        },
        {
          title: "Departments",
          url: "/employees/departments",
          roles: ["super_admin", "admin", "hr_manager"],
        },
        {
          title: "Onboarding",
          url: "/onboarding",
          roles: ["super_admin", "admin", "hr_manager"],
        },
        {
          title: "Offboarding",
          url: "/offboarding",
          roles: ["super_admin", "admin", "hr_manager"],
        },
      ],
    },
    {
      title: "Leaves",
      url: "/leaves",
      icon: IconCalendar,
      roles: [
        "super_admin",
        "admin",
        "hr_manager",
        "department_manager",
        "employee",
      ],
      hasDropdown: true,
      items: [
        {
          title: "Leave",
          url: "/leaves",
          roles: ["super_admin", "admin", "hr_manager", "department_manager"],
        },
        {
          title: "Leave Requests",
          url: "/leave-requests",
          roles: ["super_admin", "admin", "hr_manager", "department_manager"],
        },
        {
          title: "Leave Approvals",
          url: "/leave-approvals",
          roles: ["super_admin", "admin", "hr_manager", "department_manager"],
        },
        {
          title: "Leave Balances",
          url: "/leave-balances",
          roles: ["super_admin", "admin", "hr_manager"],
        },
        {
          title: "Leave Policies",
          url: "/leave-policies",
          roles: ["super_admin", "admin", "hr_manager"],
        },
        {
          title: "My Leaves",
          url: "/my-leave",
          roles: ["employee"],
        },
      ],
    },
    {
      title: "Attendance",
      url: "/attendance",
      icon: IconClipboardList,
      roles: ["super_admin", "admin", "hr_manager", "department_manager"],
    },
    {
      title: "My Team",
      url: "/team",
      icon: IconUsersGroup,
      roles: ["department_manager"],
      hasDropdown: true,
      items: [
        {
          title: "Team Members",
          url: "/team/members",
          roles: ["department_manager"],
        },
        {
          title: "Leave Approvals",
          url: "/team/leave-approvals",
          roles: ["department_manager"],
        },
        {
          title: "Overtime Approvals",
          url: "/team/overtime-approvals",
          roles: ["department_manager"],
        },
        {
          title: "Expense Claims",
          url: "/team/expense-claims",
          roles: ["department_manager"],
        },
      ],
    },
  ],

  // Self-Service section (for employees)
  selfServiceSection: [
    {
      title: "My Payslips",
      url: "/my-payslips",
      icon: IconReceipt,
      roles: ["employee"],
    },
    {
      title: "My Profile",
      url: "/my-profile",
      icon: IconUsers,
      roles: ["employee"],
    },
    {
      title: "My Documents",
      url: "/my-documents",
      icon: IconFileText,
      roles: ["employee"],
    },
    {
      title: "My Requests",
      url: "/my-requests",
      icon: IconClipboardList,
      roles: ["employee"],
    },
  ],

  // Configuration section
  configSection: [
    {
      title: "Company Settings",
      url: "/company-settings",
      icon: IconSettings,
      roles: ["super_admin", "admin"],
      hasDropdown: true,
      items: [
        {
          title: "Company Profile",
          url: "/company-profile",
          roles: ["super_admin", "admin"],
        },
        {
          title: "Departments",
          url: "/departments",
          roles: ["super_admin", "admin"],
        },
        {
          title: "Salary Structures",
          url: "/salary-structures",
          roles: ["super_admin", "admin"],
        },
        {
          title: "Allowances & Deductions",
          url: "/allowances",
          roles: ["super_admin", "admin"],
        },
        {
          title: "Payroll Cycles",
          url: "/payroll-cycles",
          roles: ["super_admin", "admin"],
        },
      ],
    },
    {
      title: "User Management",
      url: "/users",
      icon: IconUsers,
      roles: ["super_admin", "admin"],
    },
  ],

  // System section
  systemSection: [
    {
      title: "Organizations",
      url: "/organizations",
      icon: IconBuilding,
      roles: ["super_admin"],
    },
    {
      title: "System Settings",
      url: "/system-settings",
      icon: IconSettings,
      roles: ["super_admin"],
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
      roles: [
        "super_admin",
        "admin",
        "hr_manager",
        "payroll_manager",
        "finance_manager",
      ],
    },
    {
      title: "Reports",
      url: "/reports",
      icon: IconFileText,
      roles: [
        "super_admin",
        "admin",
        "hr_manager",
        "payroll_manager",
        "finance_manager",
        "auditor",
      ],
      hasDropdown: true,
      items: [
        {
          title: "Payroll Reports",
          url: "/payroll-reports",
          roles: ["super_admin", "admin", "payroll_manager"],
        },
        {
          title: "HR Reports",
          url: "/hr-reports",
          roles: ["super_admin", "admin", "hr_manager"],
        },
        {
          title: "Financial Reports",
          url: "/financial-reports",
          roles: ["super_admin", "admin", "finance_manager"],
        },
        {
          title: "Audit Reports",
          url: "/audit/reports",
          roles: ["super_admin", "auditor"],
        },
      ],
    },
    {
      title: "Audit",
      url: "/audit/payroll-records",
      icon: IconShieldCheck,
      roles: ["super_admin", "auditor"],
      hasDropdown: true,
      items: [
        {
          title: "Payroll Records",
          url: "/audit/payroll-records",
          roles: ["super_admin", "auditor"],
        },
        {
          title: "User Activity",
          url: "/audit/user-activity",
          roles: ["super_admin", "auditor"],
        },
        {
          title: "Audit Trails",
          url: "/audit/audit-trails",
          roles: ["super_admin", "auditor"],
        },
        {
          title: "Compliance",
          url: "/audit/statutory-compliance",
          roles: ["super_admin", "auditor"],
        },
      ],
    },
  ],

  // Others section
  othersSection: [
    {
      title: "Get Help",
      url: "/help",
      icon: IconHelp,
      roles: [
        "super_admin",
        "admin",
        "hr_manager",
        "payroll_manager",
        "payroll_officer",
        "department_manager",
        "finance_manager",
        "auditor",
        "employee",
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { canAccessPage, userRole, currentUser } = usePermissions();
  const [openDropdowns, setOpenDropdowns] = React.useState<string[]>([]);
  const { isLoading } = useAuth(); // Add this

  // Show minimal sidebar while loading
  if (isLoading) {
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
        <SidebarFooter>
          <div className="p-4 text-center text-sm text-gray-500">
            Loading...
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  // If no user, don't show sidebar
  if (!currentUser) {
    return null;
  }

  const toggleDropdown = (title: string) => {
    setOpenDropdowns((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  // Filter function to check if user has access based on roles OR page path
  const hasAccess = (item: any) => {
    if (!userRole) return false;

    // Check if user role is in the allowed roles list
    if (item.roles && item.roles.includes(userRole)) {
      return true;
    }

    // Additionally check if user can access the page path
    return canAccessPage(item.url);
  };

  // Filter navigation items based on user role and permissions
  const filterNavItems = (items: any[]) => {
    return items.filter((item) => {
      if (!hasAccess(item)) return false;

      // If item has dropdown, filter sub-items
      if (item.hasDropdown && item.items) {
        item.items = item.items.filter((subItem: any) => {
          // Check sub-item roles
          if (subItem.roles && userRole) {
            return subItem.roles.includes(userRole);
          }
          // Check sub-item path access
          return canAccessPage(subItem.url);
        });

        // Only show parent if it has accessible sub-items
        return item.items.length > 0;
      }

      return true;
    });
  };

  const filteredCoreNav = filterNavItems(data.coreNav);
  const filteredPayrollSection = filterNavItems(data.payrollSection);
  const filteredEmployeeSection = filterNavItems(data.employeeSection);
  const filteredSelfServiceSection = filterNavItems(data.selfServiceSection);
  const filteredConfigSection = filterNavItems(data.configSection);
  const filteredSystemSection = filterNavItems(data.systemSection);
  const filteredOthersSection = filterNavItems(data.othersSection);

  const renderNavItem = (item: any) => {
    const isActive =
      pathname === item.url || pathname.startsWith(item.url + "/");
    const isOpen = openDropdowns.includes(item.title);

    if (item.hasDropdown && item.items) {
      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleDropdown(item.title)}
        >
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
        {filteredCoreNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredCoreNav.map((item) => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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

        {/* Self-Service (for employees) */}
        {filteredSelfServiceSection.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase text-gray-500 px-2 mb-1">
              Self Service
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSelfServiceSection.map((item) => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Configuration */}
        {filteredConfigSection.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase text-gray-500 px-2 mb-1">
              Configuration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredConfigSection.map((item) => renderNavItem(item))}
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
