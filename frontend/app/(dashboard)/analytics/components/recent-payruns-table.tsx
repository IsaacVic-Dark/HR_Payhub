import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PayrunRecord, PayrunStatus } from "../lib/types";

const STATUS_STYLES: Record<PayrunStatus, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  pending_approval: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const STATUS_LABELS: Record<PayrunStatus, string> = {
  completed: "Completed",
  processing: "Processing",
  pending_approval: "Pending approval",
  failed: "Failed",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface RecentPayrunsTableProps {
  data: PayrunRecord[] | null;
}

export function RecentPayrunsTable({ data }: RecentPayrunsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent payruns</CardTitle>
        <CardDescription>Latest payroll runs across the organization</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Run date</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Gross pay</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{run.periodLabel}</TableCell>
                  <TableCell>
                    {new Date(run.runDate).toLocaleDateString("en-KE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">{run.employeeCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(run.grossPay)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(run.netPay)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_STYLES[run.status]}>
                      {STATUS_LABELS[run.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}