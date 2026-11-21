"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
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
import type { AttendanceOvertimePoint } from "../lib/types";

const chartConfig = {
  attendanceRate: { label: "Attendance rate (%)", color: "hsl(var(--chart-2))" },
  overtimeHours: { label: "Overtime (hrs)", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

interface AttendanceOvertimeChartProps {
  data: AttendanceOvertimePoint[] | null;
}

export function AttendanceOvertimeChart({ data }: AttendanceOvertimeChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance & overtime</CardTitle>
        <CardDescription>Attendance rate against overtime hours logged</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
                domain={[80, 100]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                yAxisId="right"
                dataKey="overtimeHours"
                fill="var(--color-overtimeHours)"
                radius={4}
                barSize={28}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="attendanceRate"
                stroke="var(--color-attendanceRate)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}