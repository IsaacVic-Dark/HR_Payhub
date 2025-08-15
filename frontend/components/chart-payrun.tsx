// import React from "react";

// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
//   CardFooter,
// } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";
// import { MoreHorizontal, Calendar, TrendingUp } from "lucide-react";
import { DataTablePayroll } from "@/components/data-table-payroll";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import { DateRange } from "react-day-picker";
// import { Bar, BarChart, , XAxis, ResponsiveContainer } from "recharts"

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const PayrollDashboard = () => {
  const chartData = [
    { date: "2024-01-01", month: "Jan", payroll: 1250000 },
    { date: "2024-02-01", month: "Feb", payroll: 980000 },
    { date: "2024-03-01", month: "Mar", payroll: 1340000 },
    { date: "2024-04-01", month: "Apr", payroll: 1180000 },
    { date: "2024-05-01", month: "May", payroll: 1420000 },
    { date: "2024-06-01", month: "Jun", payroll: 1100000 },
    { date: "2024-07-01", month: "Jul", payroll: 1380000 },
    { date: "2024-08-01", month: "Aug", payroll: 1290000 },
    { date: "2024-09-01", month: "Sep", payroll: 1510000 },
    { date: "2024-10-01", month: "Oct", payroll: 1350000 },
    { date: "2024-11-01", month: "Nov", payroll: 1480000 },
    { date: "2024-12-01", month: "Dec", payroll: 1620000 },
  ];
  const chartConfig = {
    payroll: {
      label: "Payroll",
      color: "#895bf5",
    },
  } satisfies ChartConfig;

  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date(2024, 2, 1), // March
    to: new Date(2024, 8, 1), // September
  });

  const filteredData = React.useMemo(() => {
    if (!range?.from && !range?.to) {
      return chartData;
    }

    return chartData.filter((item) => {
      const date = new Date(item.date);
      const fromMonth = new Date(
        range.from!.getFullYear(),
        range.from!.getMonth(),
        1
      );
      const toMonth = new Date(
        range.to!.getFullYear(),
        range.to!.getMonth(),
        1
      );
      return date >= fromMonth && date <= toMonth;
    });
  }, [range]);

  const total = filteredData.reduce((acc, curr) => acc + curr.payroll, 0);
  return (
    <>
      <div className="min-h-48">
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pay Runs Card */}
          <Card className="bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">
                Pay Runs
              </CardTitle>
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="sm:col-span-1 md:col-span-2 border border-gray-200 rounded-lg py-3 px-3">
                  <p className="text-xs text-gray-500 mb-1">Payroll Period</p>
                  <p className="text-sm font-medium text-gray-900">
                    Oct 4, 2025 - Nov 3, 2025
                  </p>
                </div>

                <div className="sm:col-span-1 md:col-span-1 border border-gray-200 rounded-lg py-3 px-3">
                  <p className="text-xs text-gray-500 mb-1">Employees</p>
                  <p className="text-xl font-bold text-gray-900">100</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 border border-gray-200 rounded-lg py-3 px-3">
                  <p className="text-xs text-gray-500 mb-1">Pay Day</p>
                  <p className="text-sm font-medium text-gray-900">
                    Nov 3, 2025
                  </p>
                </div>

                <div className="col-span-2 border border-gray-200 rounded-lg py-3 px-3">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs border-0">
                    • Scheduled
                  </Badge>
                </div>
              </div>

              {/* Circular Progress */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 flex items-center space-x-3 pt-3">
                  <div className="relative w-16 h-16">
                    <svg
                      className="w-16 h-16 transform -rotate-90"
                      viewBox="0 0 36 36"
                    >
                      <path
                        d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                        fill="none"
                        stroke="#E5E7EB"
                        strokeWidth="4"
                      />
                      <path
                        d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="4"
                        strokeDasharray="75, 100"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="flex item-center text-xs text-gray-500">
                        Gross Pay
                      </span>
                    </div>
                    <p className="text-base font-bold text-gray-900">
                      $11,270,000
                    </p>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-purple-200 rounded-full"></div>
                      <span className="flex item-center text-xs text-gray-500">
                        Deduction
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      $84,200
                    </p>
                  </div>
                </div>

                <div className="col-span-1 flex items-center pt-3">
                  <div className="text-center">
                    <p className="text-xs">Total Pay</p>
                    <p className="text-sm font-bold">$11,354,200</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payroll History Card */}
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900 mb-2">
                    Payroll History
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-bold text-gray-900">
                      ${total.toLocaleString()}
                    </span>
                    <span className="text-sm text-red-500">-5%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Current year-on-year payroll
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-center space-x-1 text-xs text-gray-600 mb-3">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {range?.from && range?.to
                            ? `${range.from.toLocaleDateString("en-US", {
                                month: "short",
                                year: "numeric",
                              })} - ${range.to.toLocaleDateString("en-US", {
                                month: "short",
                                year: "numeric",
                              })}`
                            : "Select Range"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="end"
                      >
                        <Calendar
                          className="w-full"
                          mode="range"
                          selected={range}
                          onSelect={setRange}
                          defaultMonth={range?.from || new Date(2024, 0, 1)}
                          showOutsideDays
                          disabled={{
                            after: new Date(2024, 11, 31),
                            before: new Date(2024, 0, 1),
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Chart */}
              <div className="h-48">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        opacity={0.3}
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#6B7280" }}
                        dy={10}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            className="w-[180px]"
                            nameKey="payroll"
                            labelFormatter={(value, payload) => {
                              if (payload && payload[0]) {
                                const data = payload[0].payload;
                                return `${data.month} 2024`;
                              }
                              return value;
                            }}
                            formatter={(value) => [
                              `$${Number(value).toLocaleString()}`,
                              "Payroll",
                            ]}
                          />
                        }
                      />
                      <Bar
                        dataKey="payroll"
                        fill="var(--color-payroll)"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>

              <div className="flex items-center justify-center space-x-2 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span>Trending up by 5.2% this month</span>
                <span className="text-gray-400">•</span>
                <span>Showing total payroll for selected months</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

// export default PayrollDashboard;
