"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import AdvanceTable from "@/app/(dashboard)/advances/components/data-table-advances";
import { advanceAPI, AdvanceStatistics, isAdminUser } from "@/services/api/advance";
import { useAuth } from "@/lib/AuthContext";

const kes = (v: number | null | undefined) => `KES ${Number(v ?? 0).toLocaleString()}`;

export default function AdvancesPage() {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<AdvanceStatistics | null>(null);

  const fetchStats = useCallback(() => {
    if (!user?.organization_id) return;
    advanceAPI
      .getAdvances(user.organization_id, { page: 1, per_page: 1 })
      .then((res) => {
        if (res.success) setStatistics(res.metadata?.statistics ?? null);
      });
  }, [user?.organization_id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cardDetails: CardDetail[] = statistics
    ? [
        {
          title: "Total Advances",
          value: statistics.total_advances?.toString() ?? "0",
          change: statistics.total_requested ? kes(statistics.total_requested) : "—",
          changeIcon: null,
          description: "All advance requests in the system.",
          footerText: "Across all statuses",
        },
        {
          title: "Outstanding Balance",
          value: kes(statistics.total_outstanding),
          change: statistics.total_recovered ? `${kes(statistics.total_recovered)} recovered` : "—",
          changeIcon: null,
          description: "Total amount yet to be recovered.",
          footerText: "Sum of active advance balances",
        },
        {
          title: "In Approval",
          value: statistics.by_status?.in_approval?.toString() ?? "0",
          change: "Awaiting decision",
          changeIcon: null,
          description: "Requests waiting for an admin decision.",
          footerText: "Single admin approval step",
        },
        {
          title: "Active",
          value: statistics.by_status?.active?.toString() ?? "0",
          change: statistics.total_disbursed ? `${kes(statistics.total_disbursed)} disbursed` : "—",
          changeIcon: null,
          description: "Advances disbursed and being recovered.",
          footerText: `${statistics.by_status?.approved ?? 0} awaiting disbursement`,
        },
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Advances Management</h1>
            <p className="text-sm text-muted-foreground">
              Review salary advance requests, approve, disburse and track recoveries.
            </p>
          </div>
          {isAdminUser(user?.user_type ?? "") && (
            <Button asChild variant="outline" className="flex items-center gap-1.5 shrink-0">
              <Link href="/advances/policy">
                <Settings2 className="w-4 h-4" />
                Policy Settings
              </Link>
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards details={cardDetails} />
          <AdvanceTable onChanged={fetchStats} />
        </div>
      </div>
    </div>
  );
}