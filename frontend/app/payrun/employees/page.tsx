"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { payrunDetailAPI, PayrunDetailType } from "@/services/api/payrun-detail";
import { payrunAPI, PayrunType } from "@/services/api/payrun";
import { useAuth } from "@/lib/AuthContext";
import { DataTable, ColumnDef } from "@/components/table";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Page() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [payrunDetails, setPayrunDetails] = useState<PayrunDetailType[]>([]);
  const [payrun, setPayrun] = useState<PayrunType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const payrunId = searchParams.get("payrun_id");

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.organization_id || !payrunId) {
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
          { page, per_page: perPage }
        );

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
              parseInt(payrunId)
            );
            if (payrunResponse.success && payrunResponse.data) {
              setPayrun(payrunResponse.data);
            }
          }
        } else {
          setError(detailsResponse.error || "Failed to fetch payrun employees");
          setPayrunDetails([]);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        setPayrunDetails([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.organization_id, payrunId, page, perPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setPerPage(newLimit);
    setPage(1);
  };

  const formatCurrency = (amount: number) => {
    return `Kshs ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const columns: ColumnDef<PayrunDetailType>[] = [
    {
      key: "employee",
      header: "Employee",
      cell: (detail) => detail.employee_full_name,
    },
    {
      key: "employee_number",
      header: "Employee Number",
      cell: (detail) => detail.employee_number || "—",
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

  if (!payrunId) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="mt-4 mx-6 space-y-2">
              <h1 className="text-2xl font-medium">Employee Payruns</h1>
              <p className="text-base text-muted-foreground">
                Please select a payrun to view employee details.
              </p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
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
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="w-full mx-auto p-4 bg-white">
                <div className="rounded-lg shadow-sm border p-4">
                  <DataTable
                    data={payrunDetails}
                    columns={columns}
                    pagination={{
                      page,
                      limit: perPage,
                      totalItems,
                      totalPages,
                    }}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                    loading={loading}
                    error={error}
                    emptyMessage="No employee pay details found"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

