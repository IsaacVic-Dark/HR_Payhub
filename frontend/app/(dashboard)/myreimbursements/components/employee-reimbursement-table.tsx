"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Filter, Plus, Eye, Ban, Scale } from "lucide-react";
import {
  reimbursementAPI,
  type ReimbursementType,
  type ReimbursementFilters,
  type ReimbursementItemInput,
} from "@/services/api/reimbursement";
import { Button } from "@/components/ui/button";
import {
  ReimbursementActionDialog,
  type ReimbursementActionType,
} from "@/app/(dashboard)/reimbursements/components/reimbursement-action-dialog";
import { EmployeeReimbursementViewDrawer } from "@/app/(dashboard)/myreimbursements/components/employee-reimbursement-view-drawer";
import {
  ReimbursementItemFields,
  validateReimbursementItems,
} from "@/app/(dashboard)/reimbursements/components/reimbursement-item-fields";
import { toast } from "sonner";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";

const CATEGORY_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "travel", label: "Travel" },
  { value: "medical", label: "Medical" },
  { value: "training", label: "Training" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const PAYOUT_OPTIONS = [
  { value: "payroll", label: "Payroll" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "banktransfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "wallet", label: "Wallet" },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-800", label: "Draft" },
  pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
  managerapproved: { color: "bg-blue-100 text-blue-800", label: "Manager Approved" },
  hrapproved: { color: "bg-blue-100 text-blue-800", label: "HR Approved" },
  financeapproved: { color: "bg-blue-100 text-blue-800", label: "Finance Approved" },
  rejected: { color: "bg-red-100 text-red-800", label: "Rejected" },
  scheduled: { color: "bg-purple-100 text-purple-800", label: "Scheduled" },
  paid: { color: "bg-green-100 text-green-800", label: "Paid" },
  partpaid: { color: "bg-green-100 text-green-800", label: "Partly Paid" },
  cancelled: { color: "bg-gray-100 text-gray-800", label: "Cancelled" },
  failed: { color: "bg-red-100 text-red-800", label: "Failed" },
  reversed: { color: "bg-red-100 text-red-800", label: "Reversed" },
};

const getStatusBadge = (status: string) => {
  const config = STATUS_CONFIG[status] || { color: "bg-gray-100 text-gray-800", label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const CANCELLABLE = ["draft", "pending", "managerapproved", "hrapproved", "financeapproved", "scheduled"];

const emptyItem = (): ReimbursementItemInput => ({
  expense_category: "expense",
  expense_item: "",
  receipt_number: "",
  amount: 0,
  tax_amount: 0,
  expense_date: "",
  vendor_name: "",
  notes: "",
});

const EmployeeReimbursementTable: React.FC = () => {
  const { user } = useAuth();
  const [reimbursements, setReimbursements] = useState<ReimbursementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<ReimbursementType | null>(null);
  const [actionType, setActionType] = useState<ReimbursementActionType>("cancel");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewReimbursement, setViewReimbursement] = useState<ReimbursementType | null>(null);

  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<ReimbursementFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [formData, setFormData] = useState({
    reimbursement_type: "expense",
    payout_method: "payroll",
    currency: "KES",
    description: "",
  });
  const [claimItems, setClaimItems] = useState<ReimbursementItemInput[]>([emptyItem()]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchReimbursements = useCallback(async () => {
    if (!user?.organization_id) {
      setError("No organization ID found. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const apiFilters: ReimbursementFilters = {
        ...filters,
        status: selectedStatus || undefined,
        reimbursement_type: selectedCategory || undefined,
      };

      const response = await reimbursementAPI.getReimbursements(
        user.organization_id,
        apiFilters
      );

      if (response.success && response.data) {
        setReimbursements(response.data.reimbursements || []);
        const pagination = response.metadata?.pagination;
        setTotalItems(pagination?.total || 0);
        setTotalPages(pagination?.total_pages || 0);
      } else {
        setError(response.error || "Failed to fetch reimbursements");
        setReimbursements([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setReimbursements([]);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedStatus, selectedCategory, user?.organization_id]);

  useEffect(() => {
    if (user?.organization_id) fetchReimbursements();
  }, [fetchReimbursements, user?.organization_id]);

  useEffect(() => {
    if (!applyDialogOpen) {
      setFormData({
        reimbursement_type: "expense",
        payout_method: "payroll",
        currency: "KES",
        description: "",
      });
      setClaimItems([emptyItem()]);
      setFormErrors({});
    }
  }, [applyDialogOpen]);

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
    setSelectedCategory("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters = selectedStatus || selectedCategory;

  const openAction = (reimbursement: ReimbursementType, action: ReimbursementActionType) => {
    setSelected(reimbursement);
    setActionType(action);
    setDialogOpen(true);
  };

  const handleViewClick = (reimbursement: ReimbursementType) => {
    setViewReimbursement(reimbursement);
    setDrawerOpen(true);
  };

  const handleConfirmAction = async (payload: Record<string, any>) => {
    if (!selected || !user?.organization_id) return;
    setActionLoading(true);
    try {
      let response;
      if (actionType === "cancel") {
        response = await reimbursementAPI.cancelReimbursement(
          user.organization_id,
          selected.id,
          payload.reason
        );
      } else if (actionType === "dispute") {
        response = await reimbursementAPI.disputeReimbursement(
          user.organization_id,
          selected.id,
          payload.reason
        );
      } else {
        return;
      }

      if (response.success) {
        toast.success(response.message || "Action completed successfully");
        setDialogOpen(false);
        fetchReimbursements();
      } else {
        toast.error(response.error || "Action failed");
      }
    } catch {
      toast.error("An error occurred while processing this action");
    } finally {
      setActionLoading(false);
    }
  };

  const validateClaimForm = (): boolean => {
    const errors = validateReimbursementItems(claimItems);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitClaim = async () => {
    if (!validateClaimForm() || !user?.organization_id) return;
    setApplyLoading(true);
    try {
      const response = await reimbursementAPI.createReimbursement(user.organization_id, {
        reimbursement_type: formData.reimbursement_type as any,
        payout_method: formData.payout_method as any,
        currency: formData.currency,
        description: formData.description || null,
        items: claimItems,
      });

      if (response.success) {
        toast.success(response.message || "Reimbursement submitted successfully");
        setApplyDialogOpen(false);
        fetchReimbursements();
      } else {
        toast.error(response.error || "Failed to submit reimbursement");
      }
    } finally {
      setApplyLoading(false);
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

  const columns: ColumnDef<ReimbursementType>[] = [
    {
      key: "number",
      header: "Claim #",
      cell: (r) => <span className="font-mono text-xs">{r.reimbursement_number}</span>,
    },
    {
      key: "category",
      header: "Category",
      cell: (r) => <span className="capitalize">{r.reimbursement_type}</span>,
    },
    {
      key: "amount",
      header: "Requested",
      cell: (r) => `${Number(r.amount_requested).toLocaleString()} ${r.currency}`,
    },
    {
      key: "approved",
      header: "Approved",
      cell: (r) => `${Number(r.amount_approved).toLocaleString()} ${r.currency}`,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex items-center gap-1">
          {getStatusBadge(r.status)}
          {!!r.is_disputed && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              Disputed
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(r)}
            className="h-8 w-8 p-0"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {CANCELLABLE.includes(r.status) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openAction(r, "cancel")}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Cancel claim"
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
          {(r.status === "rejected" || !!r.partial_approval_amount) && !r.is_disputed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openAction(r, "dispute")}
              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              title="Dispute decision"
            >
              <Scale className="h-4 w-4" />
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
            <h1 className="text-xl font-semibold text-gray-900">My Reimbursements</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <Button
                onClick={() => setApplyDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Claim
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Status</option>
                    {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                      <option key={value} value={value}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
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
            data={reimbursements}
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
                ? "No reimbursements match your filters"
                : "No reimbursements found"
            }
          />
        </div>
      </div>

      <ReimbursementActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={actionType}
        reimbursement={selected}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />

      <ReimbursementActionDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        action="apply"
        onConfirm={handleSubmitClaim}
        loading={applyLoading}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <select
                value={formData.reimbursement_type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, reimbursement_type: e.target.value }))
                }
                disabled={applyLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Payout Method</label>
              <select
                value={formData.payout_method}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, payout_method: e.target.value }))
                }
                disabled={applyLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {PAYOUT_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              disabled={applyLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Expense Items <span className="text-red-500">*</span>
            </label>
            <ReimbursementItemFields
              items={claimItems}
              onChange={setClaimItems}
              errors={formErrors}
              disabled={applyLoading}
            />
          </div>
        </div>
      </ReimbursementActionDialog>

      <EmployeeReimbursementViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        reimbursement={viewReimbursement}
        onItemsChanged={fetchReimbursements}
      />
    </>
  );
};

export default EmployeeReimbursementTable;