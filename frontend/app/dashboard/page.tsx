// app/dashboard/page.tsx - Fixed version
"use client";
import { AppSidebar } from "@/components/app-sidebar";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  IconTrendingDown,
  IconTrendingUp,
  IconBuilding,
  IconUsers,
  IconCash,
  IconCalendar,
} from "@tabler/icons-react";
import { PayrollDashboard } from "@/components/chart-payrun";
import PayrollTable from "@/components/payruntable";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

export default function Page() {
  const { user, isLoading } = useAuth();

  const getUserName = () => {
    if (!user) return "";
    if (user.first_name && user.surname) {
      return `${user.first_name} ${user.surname}`;
    }
    return user.email || "";
  };

  const getUserInitials = () => {
    if (!user) return "U";
    if (user.first_name && user.surname) {
      return `${user.first_name[0]}${user.surname[0]}`.toUpperCase();
    }
    return user.email ? user.email[0].toUpperCase() : "U";
  };

  const { isSuperAdmin, isAdmin, canViewReports } = usePermissions();

  console.log("Dashboard auth state:", {
    user,
    isLoading,
    getUserName: getUserName(),
  });

  const cardDetails: CardDetail[] = [
    {
      title: "Company expenses",
      value: "Kshs 1,250.00",
      change: "+12.5%",
      changeIcon: <IconTrendingUp className="text-green-500 size-3" />,
      description: "Trending up this month",
      footerText: "Visitors for the last 6 months",
    },
    {
      title: "Monthly Payroll",
      value: "Kshs 45,678",
      change: "+12.5%",
      changeIcon: <IconTrendingUp className="text-green-500 size-3" />,
      description: "Strong user retention",
      footerText: "Engagement exceed targets",
    },
    {
      title: "Total Employees",
      value: "1,234",
      change: "-20%",
      changeIcon: <IconTrendingDown className="size-4 text-red-500" />,
      description: "Down 20% this period",
      footerText: "Acquisition needs attention",
    },
    {
      title: "Total Leaves",
      value: "230",
      change: "+4.5%",
      changeIcon: <IconTrendingUp className="size-4 text-green-500" />,
      description: "Steady performance increase",
      footerText: "Meets growth projections",
    },
  ];

  const adminCards: CardDetail[] = [
    {
      title: "Organization Stats",
      value: "5 Departments",
      change: "+2",
      changeIcon: <IconBuilding className="text-blue-500 size-3" />,
      description: "Active departments",
      footerText: "Last updated today",
    },
    {
      title: "Team Performance",
      value: "94%",
      change: "+5%",
      changeIcon: <IconUsers className="text-green-500 size-3" />,
      description: "Overall team efficiency",
      footerText: "Compared to last month",
    },
  ];

  // Helper function to check if user has role
  const hasRole = (roles: string[]) => {
    return user && roles.includes(user.user_type);
  };

  return (
    <ProtectedLayout
      requiredRoles={[
        "super_admin",
        "admin",
        "hr_manager",
        "hr_officer",
        "payroll_manager",
        "payroll_officer",
        "finance_manager",
        "auditor",
        "department_manager",
        "employee",
      ]}
    >
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="mt-4 mx-6 space-y-2">
                <p className="text-base text-muted-foreground">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "2-digit",
                  })}
                </p>
                <h1 className="text-4xl font-medium">
                  Good morning, {getUserName()}!
                </h1>
                <p className="text-base text-muted-foreground">
                  Here's what's happening with your team today:
                </p>

                {/* Role-based welcome message */}
                <div className="flex gap-2 items-center text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full capitalize">
                    {isSuperAdmin
                      ? "Super Administrator"
                      : isAdmin
                      ? "Administrator"
                      : "Employee"}
                  </span>
                  {isSuperAdmin && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                      Full System Access
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <SectionCards details={cardDetails} />

                {(isSuperAdmin || isAdmin) && (
                  <SectionCards details={adminCards} />
                )}

                {/* Reports section - only for admins and super_admins */}
                {hasRole(["super_admin", "admin"]) && (
                  <>
                    <div className="px-4 lg:px-6">
                      <PayrollDashboard />
                    </div>
                    <PayrollTable />
                  </>
                )}

                {/* Employee-specific content - Use conditional rendering */}
                {hasRole(["employee"]) && (
                  <div className="px-4 lg:px-6">
                    <div className="bg-white p-6 rounded-lg border">
                      <h3 className="text-lg font-semibold mb-4">
                        Your Quick Actions
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button className="p-4 border rounded-lg hover:bg-gray-50 text-left">
                          <IconCalendar className="size-6 text-blue-500 mb-2" />
                          <h4 className="font-medium">Apply Leave</h4>
                          <p className="text-sm text-gray-600">
                            Request time off
                          </p>
                        </button>
                        <button className="p-4 border rounded-lg hover:bg-gray-50 text-left">
                          <IconCash className="size-6 text-green-500 mb-2" />
                          <h4 className="font-medium">View Payslip</h4>
                          <p className="text-sm text-gray-600">
                            Check your salary
                          </p>
                        </button>
                        <button className="p-4 border rounded-lg hover:bg-gray-50 text-left">
                          <IconUsers className="size-6 text-purple-500 mb-2" />
                          <h4 className="font-medium">Team Directory</h4>
                          <p className="text-sm text-gray-600">
                            Find colleagues
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedLayout>
  );
}