"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Plus, Pencil, Archive } from "lucide-react";
import {
  allowanceAPI,
  type AllowanceTypeType,
  type AllowanceTypeFilters,
  type CreateAllowanceTypePayload,
} from "@/services/api/allowance";
import { Button } from "@/components/ui/button";
import { AllowanceTypeFormDialog } from "./allowance-type-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";

const CATEGORY_OPTIONS = [
  { value: "housing", label: "Housing" },
  { value: "transport", label: "Transport" },
  { value: "meal", label: "Meal" },
  { value: "medical", label: "Medical" },
  { value: "travel", label: "Travel" },
  { value: "responsibility", label: "Responsibility" },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT: { color: "bg-gray-100 text-gray-800", label: "Draft" },
  ACTIVE: { color: "bg-green-100 text-green-800", label: "Active" },
  INACTIVE: { color: "bg-yellow-100 text-yellow-800", label: "Inactive" },
  ARCHIVED: { color: "bg-gray-100 text-gray-500", label: "Archived" },
};

const getStatusBadge = (status: string) => {
  const config = STATUS_CONFIG[status] || { color: "bg-gray-100 text-gray-800", label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const formatCalculation = (row: AllowanceTypeType) => {
  switch (row.calculation_method) {
    case "FIXED_AMOUNT":
      return row.amount ? `${Number(row.amount).toLocaleString()} KES` : "—";
    case "PERCENTAGE_OF_BASIC":
      return row.percentage ? `${Number(row.percentage)}% of basic` : "—";
    case "PERCENTAGE_OF_GROSS":
      return row.percentage ? `${Number(row.percentage)}% of gross` : "—";
    default:
      return row.calculation_method;
  }
};

const DataTableAllowanceTypes: React.FC = () => {
  const { user } = useAuth();
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceTypeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState<AllowanceTypeFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<AllowanceTypeType | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<AllowanceTypeType | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchAllowanceTypes = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const apiFilters: AllowanceTypeFilters = {
        ...filters,
        category: (selectedCategory as any) || undefined,
        status: (selectedStatus as any) || undefined,
        search: search || undefined,
      };

      const response = await allowanceAPI.getAllowanceTypes(user.organization_id, apiFilters);

      if (response.success && response.data) {
        setAllowanceTypes(Array.isArray(response.data) ? response.data : []);
        const pagination = response.metadata?.pagination;
        setTotalItems(pagination?.total || 0);
        setTotalPages(pagination?.total_pages || 0);
      } else {
        setError(response.error || "Failed to fetch allowance types");
        setAllowanceTypes([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setAllowanceTypes([]);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedCategory, selectedStatus, search, user?.organization_id]);

  useEffect(() => {
    if (user?.organization_id) fetchAllowanceTypes();
  }, [fetchAllowanceTypes, user?.organization_id]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, per_page: newLimit, page: 1 }));
  };

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedStatus("ACTIVE");
    setSearch("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters = selectedCategory || selectedStatus !== "ACTIVE" || search;

  const openCreate = () => {
    setEditingType(null);
    setFormOpen(true);
  };

  const openEdit = (row: AllowanceTypeType) => {
    setEditingType(row);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload: CreateAllowanceTypePayload) => {
    if (!user?.organization_id) return;
    setFormLoading(true);
    try {
      const response = editingType
        ? await allowanceAPI.updateAllowanceType(user.organization_id, editingType.id, payload)
        : await allowanceAPI.createAllowanceType(user.organization_id, payload);

      if (response.success) {
        toast.success(response.message || (editingType ? "Allowance type updated" : "Allowance type created"));
        setFormOpen(false);
        fetchAllowanceTypes();
      } else {
        toast.error(response.error || "Failed to save allowance type");
      }
    } finally {
      setFormLoading(false);
    }
  };

  const confirmArchive = async () => {
    if (!user?.organization_id || !archiveTarget) return;
    setArchiveLoading(true);
    try {
      const response = await allowanceAPI.archiveAllowanceType(
        user.organization_id,
        archiveTarget.id
      );
      if (response.success) {
        toast.success(response.message || "Allowance type archived");
        setArchiveTarget(null);
        fetchAllowanceTypes();
      } else {
        toast.error(response.error || "Failed to archive allowance type");
      }
    } finally {
      setArchiveLoading(false);
    }
  };

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

  const columns: ColumnDef<AllowanceTypeType>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-gray-500 font-mono">{r.code}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (r) => <span className="capitalize">{r.category}</span>,
    },
    {
      key: "payment_nature",
      header: "Nature",
      cell: (r) => <span className="capitalize">{r.payment_nature.replace("_", " ")}</span>,
    },
    {
      key: "calculation",
      header: "Calculation",
      cell: (r) => formatCalculation(r),
    },
    {
      key: "taxable",
      header: "Tax Treatment",
      cell: (r) =>
        !r.taxable_income ? (
          <span className="text-xs text-green-700">Exempt</span>
        ) : r.taxable_limit ? (
          <span className="text-xs text-gray-700">
            Exempt up to {Number(r.taxable_limit).toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-gray-700">Fully taxable</span>
        ),
    },
    {
      key: "frequency",
      header: "Frequency",
      cell: (r) => <span className="capitalize">{r.frequency.replace(/_/g, " ")}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => getStatusBadge(r.status),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openEdit(r)}
            className="h-8 w-8 p-0"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {r.status !== "ARCHIVED" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setArchiveTarget(r)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
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
            <h2 className="text-lg font-semibold text-gray-900">Allowance Types</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <Button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Allowance Type
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Categories</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                      <option key={value} value={value}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or code..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end">
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
            data={allowanceTypes}
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
                ? "No allowance types match your filters"
                : "No allowance types configured yet"
            }
          />
        </div>
      </div>

      <AllowanceTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        allowanceType={editingType}
        onSubmit={handleFormSubmit}
        loading={formLoading}
      />

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Allowance Type</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.name} will no longer be selectable for new employee grants. Existing
              grants are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              disabled={archiveLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {archiveLoading ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DataTableAllowanceTypes;