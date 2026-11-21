"use client";

import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname } from "next/navigation";
import UserTable, {
  MOCK_USERS,
} from "@/app/(dashboard)/users/components/data-table-users";

// -----------------------------------------------------------------------
// TODO(backend): once a users endpoint exists, replace the static
// `MOCK_USERS` stat computation below with a fetch, the same way the
// leaves page pulls `response.metadata?.statistics` from `leaveAPI.getLeaves`.
// Keep this as the org's single call for summary stats so this page and
// UserTable don't have to be kept in sync by hand.
// -----------------------------------------------------------------------

export default function Page() {
  const pathname = usePathname();

  const totalUsers = MOCK_USERS.length;
  const activeUsers = MOCK_USERS.filter((u) => u.status === "active").length;
  const inactiveUsers = totalUsers - activeUsers;
  const adminCount = MOCK_USERS.filter(
    (u) => u.role === "admin" || u.role === "super_admin"
  ).length;

  const cardDetails: CardDetail[] = [
    {
      title: "Total Users",
      value: totalUsers.toString(),
      change: "",
      changeIcon: null,
      description: "All user accounts in this organization.",
      footerText: "Includes active and inactive accounts",
    },
    {
      title: "Active Users",
      value: activeUsers.toString(),
      change: `${totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0}%`,
      changeIcon: null,
      description: "Users who currently have system access.",
      footerText: "Can log in and use the platform",
    },
    {
      title: "Inactive Users",
      value: inactiveUsers.toString(),
      change: `${totalUsers ? Math.round((inactiveUsers / totalUsers) * 100) : 0}%`,
      changeIcon: null,
      description: "Users whose access has been suspended.",
      footerText: "Deactivated accounts, kept for records",
    },
    {
      title: "Admins",
      value: adminCount.toString(),
      change: "",
      changeIcon: null,
      description: "Users with admin or super admin access.",
      footerText: "Have elevated system permissions",
    },
  ];

  const path = pathname.split("/").filter(Boolean).pop() || "Dashboard";

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="mt-4 mx-6 space-y-2">
            <h1 className="text-2xl font-medium">User Management</h1>
            <p className="text-base text-muted-foreground">
              This page shows all user accounts in your organization:
            </p>
          </div>
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
              <SectionCards details={cardDetails} />
            </div>
            <UserTable />
          </div>
        </div>
      </div>
    </>
  );
}