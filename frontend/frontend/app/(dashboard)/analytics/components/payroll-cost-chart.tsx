"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { PayrollCostPoint } from "../lib/types";

const chartConfig = {
  gross: { label: "Gross pay", color: "hsl(var(--chart-1))" },
  net: { label: "Net pay", color: "hsl(var(--chart-2))" },
  deductions: { label: "Deductions", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-KE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

interface PayrollCostChartProps {
  data: PayrollCostPoint[] | null;
}

export function PayrollCostChart({ data }: PayrollCostChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll cost trend</CardTitle>
        <CardDescription>Gross pay, deductions, and net pay over time</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <AreaChart data={data} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatCompact}
                width={48}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="gross"
                type="monotone"
                fill="var(--color-gross)"
                fillOpacity={0.15}
                stroke="var(--color-gross)"
                strokeWidth={2}
              />
              <Area
                dataKey="net"
                type="monotone"
                fill="var(--color-net)"
                fillOpacity={0.15}
                stroke="var(--color-net)"
                strokeWidth={2}
              />
              <Area
                dataKey="deductions"
                type="monotone"
                fill="var(--color-deductions)"
                fillOpacity={0.1}
                stroke="var(--color-deductions)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}