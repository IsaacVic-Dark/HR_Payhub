"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import AuditLogTable from "@/app/(dashboard)/audit-logs/components/data-table-audit-logs";

export default function Page() {
  const router = useRouter();
  const { user } = useAuth();
  const { canViewAuditLogs } = usePermissions();

  // Backend only serves admins; this keeps everyone else off the page.
  useEffect(() => {
    if (user && !canViewAuditLogs) router.replace("/unauthorized");
  }, [user, canViewAuditLogs, router]);

  if (!user || !canViewAuditLogs) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 space-y-2">
          <h1 className="text-2xl font-medium">Audit Logs</h1>
          <p className="text-base text-muted-foreground">
            A record of who changed what, and when, across your organization:
          </p>
        </div>
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <AuditLogTable />
        </div>
      </div>
    </div>
  );
}
