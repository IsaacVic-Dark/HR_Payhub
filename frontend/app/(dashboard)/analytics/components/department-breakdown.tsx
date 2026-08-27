"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DepartmentSummary } from "../lib/types";

const chartConfig = {
  payrollCost: { label: "Payroll cost", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface DepartmentBreakdownProps {
  data: DepartmentSummary[] | null;
}

export function DepartmentBreakdown({ data }: DepartmentBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Department breakdown</CardTitle>
        <CardDescription>Payroll cost, headcount, attendance, and overtime by department</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!data ? (
          <>
            <Skeleton className="h-[220px] w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("en-KE", { notation: "compact" }).format(value)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Bar dataKey="payrollCost" fill="var(--color-payrollCost)" radius={4} />
              </BarChart>
            </ChartContainer>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Headcount</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">Payroll cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-right">{dept.headcount}</TableCell>
                    <TableCell className="text-right">{dept.attendanceRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{dept.overtimeHours} hrs</TableCell>
                    <TableCell className="text-right">{formatCurrency(dept.payrollCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}