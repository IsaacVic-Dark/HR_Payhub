"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Search, Eye, Send, SendHorizonal } from "lucide-react";
import {
  payslipAPI,
  PayslipType,
  PayslipFilters,
  PayslipStatistics,
} from "@/services/api/payslip";
import { Button } from "@/components/ui/button";
import { PayslipSendDialog } from "@/app/(dashboard)/payslips/components/payslip-send-dialog";
import { PayslipViewDrawer } from "@/app/(dashboard)/payslips/components/payslip-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";

// ─── Helper: format KES currency ────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(amount);

// ─── Helper: format pay period ──────────────────────────────────────────────
const formatPeriod = (start: string, end: string) => {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} — ${fmt(end)}`;
};

// ─── Status badge ────────────────────────────────────────────────────────────
const getStatusBadge = (status: string) => {
  const cfg: Record<string, { color: string; label: string }> = {
    generated: { color: "bg-blue-100 text-blue-800", label: "Generated" },
    sent: { color: "bg-yellow-100 text-yellow-800", label: "Sent" },
    acknowledged: { color: "bg-green-100 text-green-800", label: "Acknowledged" },
  };
  const { color, label } = cfg[status] ?? { color: "bg-gray-100 text-gray-800", label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
const PayslipTable: React.FC = () => {
  const { user } = useAuth();

  // Table data
  const [payslips, setPayslips] = useState<PayslipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination
  const [filters, setFilters] = useState<PayslipFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filter panel state
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewPayslip, setViewPayslip] = useState<PayslipType | null>(null);

  // Single send dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipType | null>(null);

  // Bulk send dialog — tracks which payrun_id to bulk-send
  const [bulkSendDialogOpen, setBulkSendDialogOpen] = useState(false);
  const [bulkPayrunId, setBulkPayrunId] = useState<number | null>(null);
  const [bulkPayrunName, setBulkPayrunName] = useState<string>("");
  const [bulkPendingCount, setBulkPendingCount] = useState(0);

  // ── Statistics from metadata ─────────────────────────────────────────────
  const [statistics, setStatistics] = useState<PayslipStatistics | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchPayslips = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const apiFilters: PayslipFilters = {
        ...filters,
        status: selectedStatus || undefined,
        month: selectedMonth || undefined,
        year: selectedYear || undefined,
      };

      const response = await payslipAPI.getPayslips(user.organization_id, apiFilters);

      if (response.success && response.data) {
        const raw = Array.isArray(response.data) ? response.data : [];

        // Client-side employee name search (server doesn't support name filter)
        const filtered = searchTerm
          ? raw.filter((p) =>
              p.employee.full_name
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
            )
          : raw;

        setPayslips(filtered);
        setTotalItems(response.metadata?.pagination?.total ?? 0);
        setTotalPages(response.metadata?.pagination?.total_pages ?? 0);
        if (response.metadata?.statistics) {
          setStatistics(response.metadata.statistics as PayslipStatistics);
        }
      } else {
        setPayslips([]);
        setTotalItems(0);
        setTotalPages(0);
        setError(response.message?.includes("No payslips") ? response.message! : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, selectedStatus, selectedMonth, selectedYear, user?.organization_id]);

  useEffect(() => {
    if (user?.organization_id) fetchPayslips();
  }, [fetchPayslips, user?.organization_id]);

  console.log("Payslips:", payslips);
  console.log("Statistics:", statistics);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleViewClick = (payslip: PayslipType) => {
    setViewPayslip(payslip);
    setDrawerOpen(true);
  };

  const handleSendClick = (payslip: PayslipType) => {
    setSelectedPayslip(payslip);
    setSendDialogOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!selectedPayslip || !user?.organization_id) return;
    setActionLoading(true);
    try {
      const response = await payslipAPI.sendPayslip(
        user.organization_id,
        selectedPayslip.payrun_id,
        selectedPayslip.payslip_id
      );
      if (response.success) {
        toast.success("Payslip sent successfully");
        setSendDialogOpen(false);
        fetchPayslips();
      } else {
        toast.error(response.error ?? "Failed to send payslip");
      }
    } catch {
      toast.error("An error occurred while sending the payslip");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkSendClick = (payrunId: number, payrunName: string) => {
    const count = payslips.filter(
      (p) => p.payrun_id === payrunId && p.status === "generated"
    ).length;
    setBulkPayrunId(payrunId);
    setBulkPayrunName(payrunName);
    setBulkPendingCount(count);
    setBulkSendDialogOpen(true);
  };

  const handleConfirmBulkSend = async () => {
    if (!bulkPayrunId || !user?.organization_id) return;
    setActionLoading(true);
    try {
      const response = await payslipAPI.bulkSendPayslips(
        user.organization_id,
        bulkPayrunId
      );
      if (response.success) {
        toast.success(response.message ?? "Payslips sent successfully");
        setBulkSendDialogOpen(false);
        fetchPayslips();
      } else {
        toast.error(response.error ?? "Failed to bulk-send payslips");
      }
    } catch {
      toast.error("An error occurred during bulk send");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Pagination ───────────────────────────────────────────────────────────
  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, per_page: newLimit, page: 1 }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("");
    setSelectedMonth("");
    setSelectedYear("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters = searchTerm || selectedStatus || selectedMonth || selectedYear;

  // ── Build unique payruns for bulk-send button ────────────────────────────
  const uniquePayruns = Array.from(
    new Map(
      payslips.map((p) => [p.payrun_id, { id: p.payrun_id, name: p.payrun.payrun_name }])
    ).values()
  );

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: ColumnDef<PayslipType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (p) => (
        <div>
          <p className="font-medium text-sm">{p.employee.full_name}</p>
          <p className="text-xs text-gray-500">{p.employee.employee_number}</p>
        </div>
      ),
    },
    {
      key: "payslip_number",
      header: "Payslip #",
      cell: (p) => (
        <span className="text-xs font-mono text-gray-700">{p.payslip_number}</span>
      ),
    },
    {
      key: "payrun",
      header: "Pay Period",
      cell: (p) =>
        formatPeriod(p.payrun.pay_period_start, p.payrun.pay_period_end),
    },
    {
      key: "gross_pay",
      header: "Gross Pay",
      cell: (p) => (
        <span className="text-green-700 font-medium">
          {formatCurrency(p.earnings.gross_pay)}
        </span>
      ),
    },
    {
      key: "net_pay",
      header: "Net Pay",
      cell: (p) => (
        <span className="text-blue-700 font-semibold">
          {formatCurrency(p.net_pay)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => getStatusBadge(p.status),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(p)}
            className="h-8 w-8 p-0"
            title="View payslip"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {p.status === "generated" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSendClick(p)}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="Send payslip"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading user information…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Payslips</h1>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by employee name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>

              {/* Bulk-send buttons — one per distinct payrun visible in current page */}
              {uniquePayruns.map((pr) => {
                const generatedCount = payslips.filter(
                  (p) => p.payrun_id === pr.id && p.status === "generated"
                ).length;
                if (generatedCount === 0) return null;
                return (
                  <Button
                    key={pr.id}
                    onClick={() => handleBulkSendClick(pr.id, pr.name)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <SendHorizonal className="w-4 h-4" />
                    Bulk Send ({generatedCount})
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Status</option>
                    <option value="generated">Generated</option>
                    <option value="sent">Sent</option>
                    <option value="acknowledged">Acknowledged</option>
                  </select>
                </div>

                {/* Month */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Month
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1;
                      return (
                        <option key={m} value={m.toString().padStart(2, "0")}>
                          {new Date(2000, i).toLocaleString("default", { month: "long" })}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 2025"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
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

          {/* Table */}
          <DataTable
            data={payslips}
            columns={columns}
            pagination={{
              page: filters.page ?? 1,
              limit: filters.per_page ?? 10,
              totalItems,
              totalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            error={error}
            emptyMessage={
              hasActiveFilters ? "No payslips match your filters" : "No payslips found"
            }
          />
        </div>
      </div>

      {/* Single send dialog */}
      <PayslipSendDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        action="send"
        employeeName={selectedPayslip?.employee.full_name}
        payslipNumber={selectedPayslip?.payslip_number}
        onConfirm={handleConfirmSend}
        loading={actionLoading}
      />

      {/* Bulk send dialog */}
      <PayslipSendDialog
        open={bulkSendDialogOpen}
        onOpenChange={setBulkSendDialogOpen}
        action="bulk-send"
        payrunName={bulkPayrunName}
        pendingCount={bulkPendingCount}
        onConfirm={handleConfirmBulkSend}
        loading={actionLoading}
      />

      {/* View drawer */}
      <PayslipViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        payslip={viewPayslip}
      />
    </>
  );
};

export default PayslipTable;