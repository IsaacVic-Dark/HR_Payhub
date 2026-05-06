"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, FileText, Filter } from "lucide-react";
import { payslipAPI, PayslipType, PayslipFilters } from "@/services/api/payslip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { generatePayslipPDF } from "@/app/(dashboard)/mypayslips/utils/payslip-pdf-generator";

const EmployeePayslipTable: React.FC = () => {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<PayslipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Pagination
  const [filters, setFilters] = useState<PayslipFilters>({
    page: 1,
    per_page: 12,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const hasActiveFilters =
    !!selectedYear || !!selectedMonth || !!selectedStatus;

  const clearFilters = () => {
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedStatus("");
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const fetchPayslips = useCallback(async () => {
    if (!user?.organization_id || !user?.employee?.id) {
      setError("No organization or employee ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const apiFilters: PayslipFilters = {
        ...filters,
        year: selectedYear || undefined,
        month: selectedMonth || undefined,
        status: selectedStatus || undefined,
      };

      const response = await payslipAPI.getEmployeePayslips(
        user.organization_id,
        user.employee.id,
        apiFilters,
      );

      if (response.success && response.data) {
        const payslipsData = Array.isArray(response.data) ? response.data : [];
        const pagination = response.metadata?.pagination;

        setPayslips(payslipsData);
        setTotalItems(pagination?.total || 0);
        setTotalPages(pagination?.total_pages || 0);
      } else {
        setError(response.error || "Failed to fetch payslips");
        setPayslips([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setPayslips([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [
    filters,
    selectedYear,
    selectedMonth,
    selectedStatus,
    user?.organization_id,
    user?.employee?.id,
  ]);

  useEffect(() => {
    if (user?.organization_id && user?.employee?.id) {
      fetchPayslips();
    }
  }, [fetchPayslips, user?.organization_id, user?.employee?.id]);

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleLimitChange = (limit: number) => {
    setFilters((prev) => ({ ...prev, per_page: limit, page: 1 }));
  };

  const handleDownload = async (payslip: PayslipType) => {
    setDownloadingId(payslip.payslip_id);
    try {
      if (payslip.pdf_path) {
        window.open(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}${payslip.pdf_path}`,
          "_blank",
        );
        return;
      }
      generatePayslipPDF(payslip);
    } finally {
      setTimeout(() => setDownloadingId(null), 800);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(value);

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      sent: "bg-green-100 text-green-800",
      draft: "bg-gray-100 text-gray-700",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return (
      <Badge className={config[status] ?? "bg-gray-100 text-gray-700"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const columns: ColumnDef<PayslipType>[] = [
    {
      key: "payslip_number",
      header: "Payslip No.",
      cell: (payslip: PayslipType) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-mono text-sm font-medium">
            {payslip.payslip_number}
          </span>
        </div>
      ),
    },
    {
      key: "payrun",
      header: "Pay Period",
      cell: (payslip: PayslipType) => {
        const { pay_period_start, pay_period_end, payrun_name } = payslip.payrun;
        const start = new Date(pay_period_start).toLocaleDateString("en-KE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const end = new Date(pay_period_end).toLocaleDateString("en-KE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        return (
          <div>
            <p className="text-sm font-medium">{payrun_name}</p>
            <p className="text-xs text-muted-foreground">
              {start} – {end}
            </p>
          </div>
        );
      },
    },
    {
      key: "gross_pay",
      header: "Gross Pay",
      cell: (payslip: PayslipType) => (
        <span className="tabular-nums text-sm">
          {formatCurrency(payslip.earnings.gross_pay)}
        </span>
      ),
    },
    {
      key: "total_deductions",
      header: "Total Deductions",
      cell: (payslip: PayslipType) => (
        <span className="tabular-nums text-sm text-red-600">
          -{formatCurrency(payslip.deductions.total_deductions)}
        </span>
      ),
    },
    {
      key: "net_pay",
      header: "Net Pay",
      cell: (payslip: PayslipType) => (
        <span className="tabular-nums text-sm font-semibold text-green-700">
          {formatCurrency(payslip.net_pay)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (payslip: PayslipType) => getStatusBadge(payslip.status),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (payslip: PayslipType) => {
        const isDownloading = downloadingId === payslip.payslip_id;
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDownload(payslip)}
            disabled={isDownloading}
            className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
          >
            <Download
              className={`h-3.5 w-3.5 ${isDownloading ? "animate-bounce" : ""}`}
            />
            {isDownloading ? "Preparing..." : "Download PDF"}
          </Button>
        );
      },
    },
  ];

  // Build year options: current year back to 5 years
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) =>
    (currentYear - i).toString(),
  );

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      {/* Table header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Payslips</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your monthly payslips and salary breakdowns
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters((prev) => !prev)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 h-2 w-2 rounded-full bg-blue-500 inline-block" />
          )}
        </Button>
      </div>

      <div className="px-6 pb-4">
        {/* Filter panel */}
        {showFilters && (
          <div className="my-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-3 gap-4">
              {/* Year */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setFilters((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Years</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setFilters((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Months</option>
                  {months.map((month, i) => (
                    <option
                      key={month}
                      value={(i + 1).toString().padStart(2, "0")}
                    >
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setFilters((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="sent">Sent</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        <DataTable
          data={payslips}
          columns={columns}
          pagination={{
            page: filters.page || 1,
            limit: filters.per_page || 12,
            totalItems,
            totalPages,
          }}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          loading={loading}
          error={error}
          emptyMessage={
            hasActiveFilters
              ? "No payslips match your filters"
              : "No payslips found"
          }
        />
      </div>
    </div>
  );
};

export default EmployeePayslipTable;