import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Clock3,
  ListChecks,
  Users,
} from "lucide-react";
import type { KpiDelta, KpiSummary } from "../lib/types";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function DeltaBadge({ delta, invertColor = false }: { delta: KpiDelta; invertColor?: boolean }) {
  if (delta.direction === "flat") {
    return <span className="text-xs text-muted-foreground">No change</span>;
  }
  const isUp = delta.direction === "up";
  const isPositive = invertColor ? !isUp : isUp;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {delta.value}% vs last period
    </span>
  );
}

interface KpiSummaryCardsProps {
  kpis: KpiSummary | null;
}

export function KpiSummaryCards({ kpis }: KpiSummaryCardsProps) {
  if (!kpis) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="mt-2 h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total payroll cost",
      value: formatCurrency(kpis.totalPayrollCost, kpis.currency),
      delta: kpis.deltas.totalPayrollCost,
      invertColor: true,
      icon: Banknote,
    },
    {
      label: "Active employees",
      value: `${kpis.activeEmployees} / ${kpis.totalEmployees}`,
      delta: kpis.deltas.activeEmployees,
      invertColor: false,
      icon: Users,
    },
    {
      label: "Attendance rate",
      value: `${kpis.attendanceRate.toFixed(1)}%`,
      delta: kpis.deltas.attendanceRate,
      invertColor: false,
      icon: ListChecks,
    },
    {
      label: "Overtime hours",
      value: `${kpis.totalOvertimeHours} hrs`,
      delta: kpis.deltas.totalOvertimeHours,
      invertColor: true,
      icon: Clock3,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{card.value}</div>
            <div className="mt-1">
              <DeltaBadge delta={card.delta} invertColor={card.invertColor} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}