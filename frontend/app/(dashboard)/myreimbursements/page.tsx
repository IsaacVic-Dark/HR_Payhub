"use client";

import { usePathname } from "next/navigation";
import EmployeeReimbursementTable from "@/app/(dashboard)/myreimbursements/components/employee-reimbursement-table";

export default function MyReimbursementsPage() {
  const pathname = usePathname();
  const path = pathname.split("/").filter(Boolean).pop() || "My Reimbursements";

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 space-y-2">
          <h1 className="text-2xl font-medium">My Reimbursements</h1>
          <p className="text-base text-muted-foreground">
            Submit expense claims and track their approval and payment status
          </p>
        </div>
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <EmployeeReimbursementTable />
        </div>
      </div>
    </div>
  );
}