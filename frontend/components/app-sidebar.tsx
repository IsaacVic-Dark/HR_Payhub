"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import * as React from "react";
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconBuilding,
  IconCash,
  IconCalendar,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/../../../images/profile.jpg",
  },
  // Updated navMain with proper icons and role permissions
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
      roles: ['super_admin', 'admin', 'employee'], // ✅ All roles can access dashboard
    },
    {
      title: "Employees",
      url: "/employees",
      icon: IconUsers,
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
    },
    {
      title: "Leaves",
      url: "/leaves",
      icon: IconCalendar, // ✅ Better icon for leaves
      roles: ['super_admin', 'admin', 'employee'], // ✅ All roles can access leaves
    },
    {
      title: "Organization",
      url: "/organization",
      icon: IconBuilding, // ✅ Better icon for organization
      roles: ['super_admin'], // ✅ Only super_admin can access organization
    },
    {
      title: "Payments",
      url: "/payments",
      icon: IconCash, // ✅ Better icon for payments
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
    },
    {
      title: "Payrun",
      url: "/payrun",
      icon: IconChartBar,
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
    },
    {
      title: "Analytics",
      url: "#",
      icon: IconChartBar,
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
    },
    {
      title: "Projects",
      url: "#",
      icon: IconFolder,
      roles: ['super_admin', 'admin', 'employee'], // ✅ All roles can access projects
    },
    {
      title: "Team",
      url: "#",
      icon: IconUsers,
      roles: ['super_admin', 'admin', 'employee'], // ✅ All roles can access team
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
      roles: ['super_admin'], // ✅ Only super_admin can access settings
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
      roles: ['super_admin', 'admin', 'employee'], // ✅ All roles can get help
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
      roles: ['super_admin', 'admin', 'employee'], // ✅ All roles can search
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
      roles: ['super_admin', 'admin'], // ✅ Only admins and super_admins
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
      roles: ['super_admin', 'admin', 'employee'], // ✅ All roles can use word assistant
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { hasRole } = usePermissions(); // ✅ Get permission check function

  // ✅ Filter navigation items based on user role
  const filteredNavMain = data.navMain.filter(item => 
    hasRole(item.roles)
  );

  const filteredNavSecondary = data.navSecondary.filter(item =>
    hasRole(item.roles)
  );

  const filteredDocuments = data.documents.filter(item =>
    hasRole(item.roles)
  );

  const filteredNavClouds = data.navClouds.filter(item =>
    hasRole(item.roles)
  );

  return (
    <Sidebar collapsible="offcanvas" {...props}>
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
      <SidebarContent>
        <SidebarMenu>
          {filteredNavMain.map((item) => {
            const isActive = pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive}>
                  <Link href={item.url}>
                    <item.icon className="mr-2" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        
        {/* Render other navigation sections only if they have items */}
        {filteredNavClouds.length > 0 && (
          <NavMain items={filteredNavClouds} />
        )}
        
        {filteredDocuments.length > 0 && (
          <NavDocuments items={filteredDocuments} />
        )}
        
        {filteredNavSecondary.length > 0 && (
          <NavSecondary items={filteredNavSecondary} className="mt-auto" />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}