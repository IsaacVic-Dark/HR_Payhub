"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Receipt, History, Plus, Trash2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  reimbursementAPI,
  type ReimbursementType,
  type ReimbursementItemType,
  type AuditLogType,
  type ReimbursementItemInput,
} from "@/services/api/reimbursement";

interface EmployeeReimbursementViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reimbursement: ReimbursementType | null;
  onItemsChanged?: () => void;
}

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
  return <Badge className={config.color}>{config.label}</Badge>;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function EmployeeReimbursementViewDrawer({
  open,
  onOpenChange,
  reimbursement,
  onItemsChanged,
}: EmployeeReimbursementViewDrawerProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ReimbursementItemType[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditLogType[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<ReimbursementItemInput | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  const canEditItems = reimbursement && ["draft", "pending"].includes(reimbursement.status);

  useEffect(() => {
    const loadDetail = async () => {
      if (!open || !reimbursement || !user?.organization_id) return;
      setLoadingDetail(true);
      try {
        const response = await reimbursementAPI.getReimbursement(
          user.organization_id,
          reimbursement.id
        );
        if (response.success && response.data) {
          setItems(response.data.items || []);
          setAuditTrail(response.data.audit_trail || []);
        }
      } finally {
        setLoadingDetail(false);
      }
    };
    loadDetail();
  }, [open, reimbursement, user?.organization_id]);

  if (!reimbursement) return null;

  const refreshItems = async () => {
    if (!user?.organization_id) return;
    const response = await reimbursementAPI.getReimbursementItems(
      user.organization_id,
      reimbursement.id
    );
    if (response.success && response.data) {
      setItems(response.data);
      onItemsChanged?.();
    }
  };

  const startEditItem = (item: ReimbursementItemType) => {
    setEditingItemId(item.id);
    setItemForm({
      expense_category: item.expense_category,
      expense_item: item.expense_item ?? "",
      receipt_number: item.receipt_number ?? "",
      amount: Number(item.amount),
      tax_amount: Number(item.tax_amount ?? 0),
      expense_date: item.expense_date,
      vendor_name: item.vendor_name ?? "",
      notes: item.notes ?? "",
    });
  };

  const startAddItem = () => {
    setEditingItemId(0);
    setItemForm({
      expense_category: "expense",
      expense_item: "",
      receipt_number: "",
      amount: 0,
      tax_amount: 0,
      expense_date: "",
      vendor_name: "",
      notes: "",
    });
  };

  const cancelItemEdit = () => {
    setEditingItemId(null);
    setItemForm(null);
  };

  const saveItem = async () => {
    if (!user?.organization_id || !itemForm) return;
    if (!itemForm.amount || itemForm.amount <= 0 || !itemForm.expense_date) {
      toast.error("Amount and expense date are required");
      return;
    }
    setSavingItem(true);
    try {
      const response =
        editingItemId === 0
          ? await reimbursementAPI.addReimbursementItem(
              user.organization_id,
              reimbursement.id,
              itemForm
            )
          : await reimbursementAPI.updateReimbursementItem(
              user.organization_id,
              reimbursement.id,
              editingItemId!,
              itemForm
            );

      if (response.success) {
        toast.success(editingItemId === 0 ? "Item added" : "Item updated");
        cancelItemEdit();
        refreshItems();
      } else {
        toast.error(response.error || "Failed to save item");
      }
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (itemId: number) => {
    if (!user?.organization_id) return;
    const response = await reimbursementAPI.deleteReimbursementItem(
      user.organization_id,
      reimbursement.id,
      itemId
    );
    if (response.success) {
      toast.success("Item removed");
      refreshItems();
    } else {
      toast.error(response.error || "Failed to remove item");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DrawerHeader className="border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                Reimbursement Details
              </DrawerTitle>
              <DrawerDescription>{reimbursement.reimbursement_number}</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Claim Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(reimbursement.status)}</div>
              </div>
              <div>
                <span className="text-gray-600">Category</span>
                <p className="font-medium capitalize">{reimbursement.reimbursement_type}</p>
              </div>
              <div>
                <span className="text-gray-600">Payout Method</span>
                <p className="font-medium capitalize">{reimbursement.payout_method}</p>
              </div>
              <div>
                <span className="text-gray-600">Requested</span>
                <p className="font-medium">
                  {Number(reimbursement.amount_requested).toLocaleString()} {reimbursement.currency}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Approved</span>
                <p className="font-medium">
                  {Number(reimbursement.amount_approved).toLocaleString()} {reimbursement.currency}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Paid</span>
                <p className="font-medium">
                  {Number(reimbursement.amount_paid).toLocaleString()} {reimbursement.currency}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Request Date</span>
                <p className="font-medium">{formatDate(reimbursement.request_date)}</p>
              </div>
              <div>
                <span className="text-gray-600">Approver</span>
                <p className="font-medium">
                  {reimbursement.approver_first_name
                    ? `${reimbursement.approver_first_name} ${reimbursement.approver_surname ?? ""}`
                    : "Not yet assigned"}
                </p>
              </div>
            </div>
          </div>

          {reimbursement.description && (
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Description
              </h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                {reimbursement.description}
              </p>
            </div>
          )}

          {reimbursement.rejection_reason && (
            <div>
              <h3 className="font-semibold mb-2 text-red-700">Rejection Reason</h3>
              <p className="text-sm text-red-700 bg-red-50 p-3 rounded-md">
                {reimbursement.rejection_reason}
              </p>
            </div>
          )}

          {!!reimbursement.is_disputed && (
            <div>
              <h3 className="font-semibold mb-2 text-amber-700">Your Dispute</h3>
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md">
                {reimbursement.disputed_reason}
                <br />
                <span className="text-xs text-amber-600">
                  Submitted {formatDateTime(reimbursement.disputed_at)}
                </span>
              </p>
            </div>
          )}

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center">
                <Receipt className="h-4 w-4 mr-2" />
                Items ({items.length})
              </h3>
              {canEditItems && editingItemId === null && (
                <Button size="sm" variant="outline" onClick={startAddItem} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              )}
            </div>

            {loadingDetail ? (
              <p className="text-sm text-gray-500">Loading items...</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-3 text-sm flex items-start justify-between"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {item.expense_item || item.expense_category}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.vendor_name || "—"} · {formatDate(item.expense_date)}
                        {item.receipt_number ? ` · #${item.receipt_number}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {Number(item.amount).toLocaleString()} {item.currency}
                      </span>
                      {canEditItems && (
                        <>
                          <button
                            onClick={() => startEditItem(item)}
                            className="text-gray-400 hover:text-blue-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={items.length <= 1}
                            className="text-gray-400 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-gray-500">No items recorded.</p>
                )}
              </div>
            )}

            {editingItemId !== null && itemForm && (
              <div className="mt-3 border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={itemForm.amount || ""}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, amount: Number(e.target.value) })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <input
                    type="date"
                    value={itemForm.expense_date}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, expense_date: e.target.value })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Vendor"
                    value={itemForm.vendor_name ?? ""}
                    onChange={(e) => setItemForm({ ...itemForm, vendor_name: e.target.value })}
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Receipt #"
                    value={itemForm.receipt_number ?? ""}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, receipt_number: e.target.value })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={cancelItemEdit} className="text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveItem} disabled={savingItem} className="text-xs">
                    {savingItem ? "Saving..." : "Save Item"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Audit trail */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center">
              <History className="h-4 w-4 mr-2" />
              Activity
            </h3>
            <div className="space-y-2">
              {auditTrail.map((log) => (
                <div key={log.id} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                  <p className="font-medium capitalize">{log.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(log.created_at)}</p>
                </div>
              ))}
              {auditTrail.length === 0 && !loadingDetail && (
                <p className="text-sm text-gray-500">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <DrawerClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}