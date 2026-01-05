"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Filter,
  Search,
  Eye,
  Trash2,
  ChevronDownIcon,
} from "lucide-react";
import { payrunAPI, PayrunType, PayrunFilters } from "@/services/api/payrun";
import { Button } from "@/components/ui/button";
import { PayrunViewDrawer } from "@/app/payrun/components/payrun-view-drawer";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

const PayrunTable: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [payruns, setPayruns] = useState<PayrunType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewPayrun, setViewPayrun] = useState<PayrunType | null>(null);

  // Filter states
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPayFrequency, setSelectedPayFrequency] = useState<string>("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<PayrunFilters>({
    page: 1,
    per_page: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchPayruns = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const apiFilters: PayrunFilters = {
        ...filters,
        status: selectedStatus || undefined,
        pay_frequency: selectedPayFrequency || undefined,
        include_deleted: includeDeleted,
      };

      const response = await payrunAPI.getPayruns(
        user.organization_id,
        apiFilters
      );

      if (response.success && response.data) {
        const payrunsData = Array.isArray(response.data)
          ? response.data
          : response.data.payruns || [];

        const paginationData = response.metadata?.pagination;

        setPayruns(payrunsData);
        setTotalItems(paginationData?.total || 0);
        setTotalPages(paginationData?.total_pages || 0);
      } else {
        if (response.message?.includes("No payruns found")) {
          setPayruns([]);
          setTotalItems(0);
          setTotalPages(0);
          setError(response.message);
        } else {
          setError(response.error || "Failed to fetch payruns");
          setPayruns([]);
          setTotalItems(0);
          setTotalPages(0);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setPayruns([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [
    filters,
    selectedStatus,
    selectedPayFrequency,
    includeDeleted,
    user?.organization_id,
  ]);

  useEffect(() => {
    if (user?.organization_id) {
      fetchPayruns();
    }
  }, [fetchPayruns, user?.organization_id]);

  const formatDateRange = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const startFormatted = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const endFormatted = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return `${startFormatted} — ${endFormatted}`;
    } catch (error) {
      return "Invalid date";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      draft: {
        color: "bg-yellow-100 text-yellow-800",
        label: "Draft",
      },
      reviewed: {
        color: "bg-blue-100 text-blue-800",
        label: "Reviewed",
      },
      finalized: {
        color: "bg-green-100 text-green-800",
        label: "Finalized",
      },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const handleViewClick = (payrun: PayrunType) => {
    setViewPayrun(payrun);
    setDrawerOpen(true);
  };

  const handleDeleteClick = async (payrun: PayrunType) => {
    if (!user?.organization_id) return;

    if (
      !confirm(
        `Are you sure you want to delete "${payrun.payrun_name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await payrunAPI.deletePayrun(
        user.organization_id,
        payrun.id
      );

      if (response.success) {
        toast.success("Payrun deleted successfully");
        fetchPayruns();
      } else {
        toast.error(response.error || "Failed to delete payrun");
      }
    } catch (err) {
      toast.error("An error occurred while deleting payrun");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleViewDetails = (payrun: PayrunType) => {
    router.push(`/payrun/employees?payrun_id=${payrun.id}`);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, per_page: newLimit, page: 1 }));
  };

  const clearFilters = () => {
    setSelectedStatus("");
    setSelectedPayFrequency("");
    setIncludeDeleted(false);
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters =
    selectedStatus || selectedPayFrequency || includeDeleted;

  if (!user) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading user information...</div>
          </div>
        </div>
      </div>
    );
  }

  const columns: ColumnDef<PayrunType>[] = [
    {
      key: "payrun_name",
      header: "Payrun Name",
      cell: (payrun) => payrun.payrun_name,
    },
    {
      key: "period",
      header: "Pay Period",
      cell: (payrun) =>
        formatDateRange(payrun.pay_period_start, payrun.pay_period_end),
    },
    {
      key: "pay_frequency",
      header: "Frequency",
      cell: (payrun) => (
        <span className="capitalize">{payrun.pay_frequency}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (payrun) => getStatusBadge(payrun.status),
    },
    {
      key: "total_net_pay",
      header: "Total Net Pay",
      cell: (payrun) =>
        `Kshs ${payrun.total_net_pay.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
    {
      key: "employee_count",
      header: "Employees",
      cell: (payrun) => payrun.employee_count,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (payrun) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(payrun)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewDetails(payrun)}
            className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            View Details
          </Button>
          {payrun.status === "draft" && !payrun.deleted_at && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteClick(payrun)}
              disabled={deleteLoading}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Payruns</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <option value="draft">Draft</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="finalized">Finalized</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pay Frequency
                  </label>
                  <select
                    value={selectedPayFrequency}
                    onChange={(e) => setSelectedPayFrequency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Frequencies</option>
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Include Deleted
                  </label>
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          <DataTable
            data={payruns}
            columns={columns}
            pagination={{
              page: filters.page || 1,
              limit: filters.per_page || 10,
              totalItems,
              totalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            error={error}
            emptyMessage={
              hasActiveFilters
                ? "No payruns match your filters"
                : "No payruns found"
            }
          />
        </div>
      </div>

      <PayrunViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        payrun={viewPayrun}
        onViewDetails={handleViewDetails}
      />
    </>
  );
};

export default PayrunTable;

