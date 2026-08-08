"use client";

import { usePathname } from "next/navigation";
import DataTableReimbursements from "@/app/(dashboard)/reimbursements/components/data-table-reimbursements";

export default function ReimbursementsPage() {
  const pathname = usePathname();
  const path = pathname.split("/").filter(Boolean).pop() || "Reimbursements";

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 space-y-2">
          <h1 className="text-2xl font-medium">Reimbursements</h1>
          <p className="text-base text-muted-foreground">
            Review, approve, and process employee reimbursement claims
          </p>
        </div>
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <DataTableReimbursements />
        </div>
      </div>
    </div>
  );
}