"use client";

import { useDrawerParams } from "@/hooks/use-drawer-params";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  payrunDetailAPI,
  PayrunDetailType,
} from "@/services/api/payrun-detail";
import { payrunAPI, PayrunType } from "@/services/api/payrun";
import { useAuth } from "@/lib/AuthContext";
import { DataTable, ColumnDef } from "@/components/table";
import { ArrowLeft, Eye, Filter, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PayrollActionDialog } from "@/app/(dashboard)/payrun/components/payroll-action-dialog";
import { PayrunDetailDrawer } from "@/app/(dashboard)/payrun/components/payrun-detail-drawer";
import { formatCurrency } from "@/utils/currency";
import { usePermissions } from "@/hooks/usePermissions";

function PageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { canReviewPayrun, canFinalizePayrun, canReopenPayrun } = usePermissions();
  const [payrunDetails, setPayrunDetails] = useState<PayrunDetailType[]>([]);
  const [payrun, setPayrun] = useState<PayrunType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noPayrunsExist, setNoPayrunsExist] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // Employee search: `searchTerm` is what's typed, `search` is the debounced
  // value actually sent to the API.
  const [searchTerm, setSearchTerm] = useState("");
  const [search, setSearch] = useState("");
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const [dialogAction, setDialogAction] = useState<"review" | "finalize" | "reopen">(
    "review",
  );

  // Detail drawer state — nested drawer, URL-driven: ?payrun_id=5&detail=<detail id>
  const { detailId, openDetail, closeDetail } = useDrawerParams();
  const detailDrawerOpen = !!detailId;
  const setDetailDrawerOpen = (open: boolean) => {
    if (!open) closeDetail();
  };
  const [selectedDetail, setSelectedDetail] = useState<PayrunDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const payrunId = searchParams.get("payrun_id");

  // When there is no payrun_id in the URL, fetch the latest payrun and redirect
  useEffect(() => {
    if (payrunId || !user?.organization_id) return;

    const redirectToLatest = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch payruns sorted by created_at descending, only need the first one
        const response = await payrunAPI.getPayruns(user.organization_id, {
          page: 1,
          per_page: 1,
        });

        if (response.success && response.data) {
          const payruns = Array.isArray(response.data)
            ? response.data
            : response.data.payruns || [];

          if (payruns.length > 0) {
            // Sort by created_at descending in case the API doesn't guarantee order
            const latest = payruns.sort(
              (a: PayrunType, b: PayrunType) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            )[0];

            router.replace(`/payrun/employees?payrun_id=${latest.id}`);
            return;
          }
        }

        // No payruns found
        setNoPayrunsExist(true);
      } catch (err) {
        setError("Failed to load the latest payrun.");
      } finally {
        setLoading(false);
      }
    };

    redirectToLatest();
  }, [payrunId, user?.organization_id, router]);

  // Debounce typing (300ms) and jump back to page 1 whenever the term changes.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchTerm.trim();
      setSearch(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Main data fetch — only runs when payrun_id is present in the URL
  useEffect(() => {
    if (!payrunId) return;
    // Ignore responses that arrive after a newer search / page was requested.
    let cancelled = false;

    const fetchData = async () => {
      if (!user?.organization_id) {
        setError("Missing organization ID or payrun ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch payrun details
        const detailsResponse = await payrunDetailAPI.getPayrunEmployees(
          user.organization_id,
          parseInt(payrunId),
          { page, per_page: perPage, search },
        );
        if (cancelled) return;

        if (detailsResponse.success && detailsResponse.data) {
          const details = Array.isArray(detailsResponse.data)
            ? detailsResponse.data
            : [];

          setPayrunDetails(details);

          const paginationData = detailsResponse.metadata?.pagination;
          setTotalItems(paginationData?.total || 0);
          setTotalPages(paginationData?.total_pages || 0);

          // Fetch payrun info if available in metadata
          if (detailsResponse.metadata?.payrun) {
            setPayrun(detailsResponse.metadata.payrun as any);
          } else {
            // Fetch payrun separately
            const payrunResponse = await payrunAPI.getPayrunById(
              user.organization_id,
              parseInt(payrunId),
            );
            if (cancelled) return;
            if (payrunResponse.success && payrunResponse.data) {
              setPayrun(payrunResponse.data);
            }
          }
        } else {
          setError(detailsResponse.error || "Failed to fetch payrun employees");
          setPayrunDetails([]);
        }
      } catch (err) {
        if (cancelled) return;
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        setPayrunDetails([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id, payrunId, page, perPage, search]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setPerPage(newLimit);
    setPage(1);
  };

  const handleReviewPayrun = async () => {
    if (!user?.organization_id || !payrunId) return;
    setProcessLoading(true);
    try {
      const result = await payrunAPI.reviewPayrun(
        user.organization_id,
        parseInt(payrunId),
      );

      if (result.success) {
        toast.success(result.message || "Payrun reviewed successfully");
        setProcessDialogOpen(false);
        // refresh payrun state so status updates in the UI
        setPayrun((prev) => (prev ? { ...prev, status: "reviewed" } : prev));
      } else {
        toast.error(
          result.error || result.message || "Failed to review payrun",
        );
        // modal stays open
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setProcessLoading(false);
    }
  };

  const handleFinalizePayrun = async () => {
    if (!user?.organization_id || !payrunId) return;
    setProcessLoading(true);
    try {
      const result = await payrunAPI.finalizePayrun(
        user.organization_id,
        parseInt(payrunId),
      );
      if (result.success) {
        toast.success(result.message || "Payrun finalized successfully");
        setProcessDialogOpen(false);
        setPayrun((prev) => (prev ? { ...prev, status: "finalized" } : prev));
      } else {
        toast.error(
          result.error || result.message || "Failed to finalize payrun",
        );
        // modal stays open
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setProcessLoading(false);
    }
  };

  const handleReopenPayrun = async (reason?: string) => {
    if (!user?.organization_id || !payrunId) return;
    setProcessLoading(true);
    try {
      const result = await payrunAPI.reopenPayrun(
        user.organization_id,
        parseInt(payrunId),
        reason,
      );
      if (result.success) {
        toast.success(result.message || "Payrun reopened successfully");
        setProcessDialogOpen(false);
        setPayrun((prev) => (prev ? { ...prev, status: "draft" } : prev));
      } else {
        toast.error(
          result.error || result.message || "Failed to reopen payrun",
        );
        // modal stays open
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setProcessLoading(false);
    }
  };

  const openDialog = (action: "review" | "finalize" | "reopen") => {
    setDialogAction(action);
    setProcessDialogOpen(true);
  };

  const handleViewDetail = (detail: PayrunDetailType) => {
    openDetail(String(detail.id));
  };

  // Load the employee detail whenever ?detail=<id> is present — either from a
  // click above or from a shared link. Unknown / forbidden → /unauthorized.
  useEffect(() => {
    if (!detailId) {
      setSelectedDetail(null);
      return;
    }
    if (!user?.organization_id || !payrunId) return;
    let cancelled = false;
    setSelectedDetail(null);
    setDetailLoading(true);
    payrunDetailAPI
      .getPayrunDetailById(user.organization_id, parseInt(payrunId), Number(detailId))
      .then((response) => {
        if (cancelled) return;
        if (response.success && response.data) setSelectedDetail(response.data);
        else router.replace("/unauthorized");
      })
      .catch(() => {
        if (!cancelled) router.replace("/unauthorized");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId, payrunId, user?.organization_id, router]);

  const columns: ColumnDef<PayrunDetailType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (detail) => (
        <div>
          <p className="font-medium">{detail.employee_full_name}</p>
          <p className="text-xs text-gray-500">{detail.job_title || "—"}</p>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      cell: (detail) => detail.department || "—",
    },
    {
      key: "basic_salary",
      header: "Basic Salary",
      cell: (detail) => formatCurrency(detail.basic_salary),
    },
    {
      key: "gross_pay",
      header: "Gross Pay",
      cell: (detail) => formatCurrency(detail.gross_pay),
    },
    {
      key: "overtime_amount",
      header: "Overtime",
      cell: (detail) => formatCurrency(detail.overtime_amount),
    },
    {
      key: "total_deductions",
      header: "Deductions",
      cell: (detail) => formatCurrency(detail.total_deductions),
    },
    {
      key: "net_pay",
      header: "Net Pay",
      cell: (detail) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(detail.net_pay)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (detail) => (
        <button
          onClick={() => handleViewDetail(detail)}
          className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="View detail"
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ];

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

  // No payrun_id yet — show a loading/redirecting state while we find the latest
  if (!payrunId) {
    return (
      <>
        <div className="flex flex-1 flex-col">
          <div className="mt-4 mx-6 space-y-2">
            <h1 className="text-2xl font-medium">Employee Payruns</h1>

            {/* Still loading / redirecting */}
            {loading && !noPayrunsExist && !error && (
              <p className="text-base text-muted-foreground">
                Loading latest payrun…
              </p>
            )}

            {/* No payruns exist at all */}
            {noPayrunsExist && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 mt-4">
                <p className="text-sm font-medium text-yellow-800">
                  No payruns found
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  There are no payruns in your organisation yet. Create a
                  payrun first before viewing employee pay details.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => router.push("/payrun/history")}
                >
                  Go to Payrun History
                </Button>
              </div>
            )}

            {/* Error while fetching latest */}
            {error && !noPayrunsExist && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 mt-4">
                <p className="text-sm font-medium text-red-800">
                  Something went wrong
                </p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.refresh()}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="mt-4 mx-6 space-y-2">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/payrun/history")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Payrun History
              </Button>
            </div>
            <h1 className="text-2xl font-medium">
              {payrun ? payrun.payrun_name : "Employee Payruns"}
            </h1>
            <p className="text-base text-muted-foreground">
              Employee pay details for this payrun
            </p>
          </div>

          {/* TODO: i need a small meesage section to show who reviewed the payrun if status is reviewed and who reopened the payrun */}
          
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="w-full mx-auto p-4 bg-white">
              <div className="rounded-lg shadow-sm border p-4">
                <div className="relative mb-4 max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Find Employee"
                    aria-label="Search employees by name"
                    className="pl-9 pr-9"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <DataTable
                  data={payrunDetails}
                  columns={columns}
                  pagination={{
                    page,
                    limit: perPage,
                    totalItems,
                    totalPages,
                  }}
                  tableTitle="Payrun Employees Details"
                  filters={
                    <button className="flex items-center gap-1 px-3 py-1.5 border rounded-md text-xs">
                      <Filter className="w-3 h-3" /> Filters
                    </button>
                  }
                  button={
                    user && payrun?.status !== "finalized" && (
                      <div className="flex items-center gap-2">
                        {payrun?.status === "reviewed" ? (
                          <>
                            {canReopenPayrun && (
                              <button
                                className="flex items-center gap-1 px-3 py-1.5 border border-amber-600 text-amber-600 rounded-md text-xs hover:bg-amber-50"
                                onClick={() => openDialog("reopen")}
                              >
                                Reopen Payrun
                              </button>
                            )}
                            {canFinalizePayrun && (
                              <button
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs hover:bg-green-700"
                                onClick={() => openDialog("finalize")}
                              >
                                Finalize Payrun
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {canReviewPayrun && (
                              <button
                                className="flex items-center gap-1 px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md text-xs hover:bg-blue-50"
                                onClick={() => openDialog("review")}
                              >
                                Review Payrun
                              </button>
                            )}
                            {canFinalizePayrun && (
                              <button
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs hover:bg-green-700"
                                onClick={() => openDialog("finalize")}
                              >
                                Finalize Payrun
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )
                  }
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  loading={loading}
                  error={error}
                  emptyMessage={
                    search
                      ? `No employees match "${search}"`
                      : "No employee pay details found"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <PayrollActionDialog
        open={processDialogOpen}
        onOpenChange={setProcessDialogOpen}
        action={dialogAction}
        payrunStatus={payrun?.status}
        payrunName={payrun?.payrun_name}
        payPeriodStart={payrun?.pay_period_start}
        payPeriodEnd={payrun?.pay_period_end}
        totalGrossPay={payrun?.total_gross_pay}
        totalDeductions={payrun?.total_deductions}
        employeeCount={payrun?.employee_count}
        onConfirm={
          dialogAction === "review"
            ? handleReviewPayrun
            : dialogAction === "finalize"
              ? handleFinalizePayrun
              : handleReopenPayrun
        }
        loading={processLoading}
      />
      <PayrunDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        detail={selectedDetail}
        loading={detailLoading}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}