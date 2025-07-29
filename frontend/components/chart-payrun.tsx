import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from "recharts";
import { MoreHorizontal, Calendar, TrendingUp } from "lucide-react";
import { DataTablePayroll } from "@/components/data-table-payroll";

export const PayrollDashboard = () => {
  // Updated chart data to match the stacked bars in the image
  const chartData = [
    {
      month: "Jan",
      salary: 150000,
      benefits: 30000,
      incentives: 20000,
      contributions: 15000,
      total: 215000,
    },
    {
      month: "Feb",
      salary: 400000,
      benefits: 80000,
      incentives: 50000,
      contributions: 35000,
      total: 565000,
    },
    {
      month: "Mar",
      salary: 280000,
      benefits: 55000,
      incentives: 35000,
      contributions: 25000,
      total: 395000,
    },
    {
      month: "Apr",
      salary: 320000,
      benefits: 65000,
      incentives: 40000,
      contributions: 30000,
      total: 455000,
    },
    {
      month: "May",
      salary: 180000,
      benefits: 35000,
      incentives: 25000,
      contributions: 18000,
      total: 258000,
    },
    {
      month: "Jun",
      salary: 150000,
      benefits: 30000,
      incentives: 20000,
      contributions: 15000,
      total: 215000,
    },
    {
      month: "Jul",
      salary: 200000,
      benefits: 40000,
      incentives: 28000,
      contributions: 20000,
      total: 288000,
    },
    {
      month: "Aug",
      salary: 350000,
      benefits: 70000,
      incentives: 45000,
      contributions: 32000,
      total: 497000,
    },
    {
      month: "Sep",
      salary: 300000,
      benefits: 60000,
      incentives: 38000,
      contributions: 28000,
      total: 426000,
    },
    {
      month: "Oct",
      salary: 380000,
      benefits: 75000,
      incentives: 48000,
      contributions: 35000,
      total: 538000,
    },
  ];

  // Custom stacked bar component
  const StackedBar = (props) => {
    const { payload, x, y, width, height } = props;
    if (!payload) return null;

    const { salary, benefits, incentives, contributions } = payload;
    const total = salary + benefits + incentives + contributions;

    if (total === 0) return null;

    const salaryHeight = (salary / total) * height;
    const benefitsHeight = (benefits / total) * height;
    const incentivesHeight = (incentives / total) * height;
    const contributionsHeight = (contributions / total) * height;

    let currentY = y;

    return (
      <g>
        {/* Salary - Purple */}
        <rect
          x={x}
          y={currentY}
          width={width}
          height={salaryHeight}
          fill="#8B5CF6"
          rx={2}
        />
        {/* Benefits - Blue */}
        <rect
          x={x}
          y={(currentY += salaryHeight)}
          width={width}
          height={benefitsHeight}
          fill="#3B82F6"
          rx={2}
        />
        {/* Incentives - Cyan */}
        <rect
          x={x}
          y={(currentY += benefitsHeight)}
          width={width}
          height={incentivesHeight}
          fill="#06B6D4"
          rx={2}
        />
        {/* Contributions - Green */}
        <rect
          x={x}
          y={(currentY += incentivesHeight)}
          width={width}
          height={contributionsHeight}
          fill="#10B981"
          rx={2}
        />
      </g>
    );
  };

  return (
    <>
        <div className="min-h-48 p-3">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                    <p className="text-sm font-medium text-gray-900">Nov 3, 2025</p>
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
                    <p className="text-sm font-semibold text-gray-900">$84,200</p>
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
                        $11,354,200
                    </span>
                    <span className="text-sm text-red-500">-5%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                    Current year-on-year payroll
                    </p>
                </div>

                <div className="text-right">
                    <div className="flex items-center space-x-1 text-xs text-gray-600 mb-3">
                    <Calendar className="h-3 w-3" />
                    <span>Jan 2025 - Oct 2025</span>
                    </div>

                    {/* Legend */}
                    {/* <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-gray-600">Salary</span>
                        <span className="font-semibold">$830,000</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                        <span className="text-gray-600">Incentives</span>
                        <span className="font-semibold">$90,000</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-600">Benefits</span>
                        <span className="font-semibold">$20,000</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600">
                        Employer Contributions
                        </span>
                        <span className="font-semibold">$45,000</span>
                    </div>
                    </div> */}
                </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {/* Chart */}
                <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                    >
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#6B7280" }}
                        dy={10}
                    />
                    <Bar
                        dataKey="total"
                        shape={StackedBar}
                        radius={[2, 2, 0, 0]}
                    />
                    </BarChart>
                </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-center space-x-2 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span>Trending up by 5.2% this month</span>
                <span className="text-gray-400">•</span>
                <span>Showing total visitors for the last 6 months</span>
                </div>
            </CardContent>
            </Card>
        </div>
        </div>
    </>
  );
};

// export default PayrollDashboard;
