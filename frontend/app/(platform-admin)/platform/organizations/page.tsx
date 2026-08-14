"use client";

import OrganizationsTable from "@/app/(platform-admin)/platform/organizations/components/data-table-organizations";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 space-y-2">
          <h1 className="text-2xl font-medium">Organizations</h1>
          <p className="text-base text-muted-foreground">
            Every tenant organization on PayHub.
          </p>
        </div>
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <OrganizationsTable />
        </div>
      </div>
    </div>
  );
}