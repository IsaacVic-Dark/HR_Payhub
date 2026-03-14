"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type CardDetail } from "@/components/section-cards";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DataTable, ColumnDef } from "@/components/table";
import { p9FormAPI, type P9FormType, type P9FormFilters, type P9StatisticRowType } from "@/services/api/p9forms";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { FileText, Filter, Download, Send, CheckCircle, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { P9FormViewDrawer } from "@/app/p9-forms/components/p9form-view-drawer";
import { P9FormGenerateModal } from "@/app/p9-forms/components/p9form-generate-modal";

export default function P9FormsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  
  // State for P9 forms data
  const [p9Forms, setP9Forms] = useState<P9FormType[]>([]);
  const [statistics, setStatistics] = useState<P9StatisticRowType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [viewP9Form, setViewP9Form] = useState<P9FormType | null>(null);
  
  // Pagination
  const [filters, setFilters] = useState<P9FormFilters>({
    page: 1,
    per_page: 10,
    year: new Date().getFullYear(),
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch P9 forms
  const fetchP9Forms = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      setError(null);

      const apiFilters: P9FormFilters = {
        ...filters,
        year: selectedYear ? parseInt(selectedYear) : undefined,
        status: selectedStatus as any || undefined,
        department_id: selectedDepartment ? parseInt(selectedDepartment) : undefined,
      };

      const response = await p9FormAPI.getP9Forms(user.organization_id);

      console.log("P9 Forms API response:", response);

      if (response.success && response.data) {
        setP9Forms(response.data.p9_forms || []);
        setTotalItems(response.data.pagination?.total || 0);
        setTotalPages(response.data.pagination?.last_page || 0);
      } else {
        setError(response.error || "Failed to fetch P9 forms");
        setP9Forms([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setP9Forms([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    if (!user?.organization_id) return;

    try {
      const response = await p9FormAPI.getP9Statistics(
        user.organization_id,
        // selectedYear ? parseInt(selectedYear) : undefined
      );

      if (response.success && response.data) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
    }
  };

  useEffect(() => {
    if (user?.organization_id) {
      fetchP9Forms();
      fetchStatistics();
    }
  }, [user?.organization_id, filters.page, filters.per_page, selectedYear, selectedStatus, selectedDepartment]);

  // Generate card details from statistics
  const cardDetails: CardDetail[] = (() => {
    if (!statistics.length) return [];

    const yearStats = statistics.reduce((acc, stat) => {
      if (!acc[stat.status]) {
        acc[stat.status] = {
          count: 0,
          sum_paye: 0,
          sum_gross_pay: 0,
        };
      }
      acc[stat.status].count += stat.form_count;
      acc[stat.status].sum_paye += stat.sum_paye;
      acc[stat.status].sum_gross_pay += stat.sum_gross_pay;
      return acc;
    }, {} as Record<string, { count: number; sum_paye: number; sum_gross_pay: number }>);

    return [
      {
        title: "Total P9 Forms",
        value: statistics.reduce((sum, stat) => sum + stat.form_count, 0).toString(),
        change: "",
        changeIcon: null,
        description: `For year ${selectedYear}`,
        footerText: "All statuses combined",
      },
      {
        title: "Generated",
        value: (yearStats.generated?.count || 0).toString(),
        change: "",
        changeIcon: null,
        description: "Ready to send",
        footerText: `PAYE: Kshs ${(yearStats.generated?.sum_paye || 0).toLocaleString()}`,
      },
      {
        title: "Sent",
        value: (yearStats.sent?.count || 0).toString(),
        change: "",
        changeIcon: null,
        description: "Sent to employees",
        footerText: `PAYE: Kshs ${(yearStats.sent?.sum_paye || 0).toLocaleString()}`,
      },
      {
        title: "Filed",
        value: (yearStats.filed?.count || 0).toString(),
        change: "",
        changeIcon: null,
        description: "Filed with KRA",
        footerText: `PAYE: Kshs ${(yearStats.filed?.sum_paye || 0).toLocaleString()}`,
      },
      {
        title: "Total PAYE",
        value: `Kshs ${statistics
          .reduce((sum, stat) => sum + stat.sum_paye, 0)
          .toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        change: "",
        changeIcon: null,
        description: "Total PAYE deducted",
        footerText: `For ${selectedYear}`,
      },
      {
        title: "Total Gross Pay",
        value: `Kshs ${statistics
          .reduce((sum, stat) => sum + stat.sum_gross_pay, 0)
          .toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        change: "",
        changeIcon: null,
        description: "Total gross pay",
        footerText: `For ${selectedYear}`,
      },
    ];
  })();

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
      generated: {
        color: "bg-yellow-100 text-yellow-800",
        label: "Generated",
        icon: FileText,
      },
      sent: {
        color: "bg-blue-100 text-blue-800",
        label: "Sent",
        icon: Send,
      },
      filed: {
        color: "bg-green-100 text-green-800",
        label: "Filed",
        icon: CheckCircle,
      },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
      icon: FileText,
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color} flex items-center gap-1 w-fit`}>
        <config.icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const handleViewClick = (p9Form: P9FormType) => {
    setViewP9Form(p9Form);
    setDrawerOpen(true);
  };

  const handleGenerateSuccess = () => {
    fetchP9Forms();
    fetchStatistics();
  };

  const handleSendP9 = async (p9Form: P9FormType) => {
    if (!user?.organization_id) return;

    try {
      const response = await p9FormAPI.markP9Sent(user.organization_id, p9Form.id);
      
      if (response.success) {
        toast.success(`P9 form ${p9Form.p9number} marked as sent`);
        fetchP9Forms();
        fetchStatistics();
      } else {
        toast.error(response.error || "Failed to mark as sent");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleFileP9 = async (p9Form: P9FormType) => {
    if (!user?.organization_id) return;

    try {
      const response = await p9FormAPI.markP9Filed(user.organization_id, p9Form.id);
      
      if (response.success) {
        toast.success(`P9 form ${p9Form.p9number} marked as filed`);
        fetchP9Forms();
        fetchStatistics();
      } else {
        toast.error(response.error || "Failed to mark as filed");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleDownloadPdf = async (p9Form: P9FormType) => {
    if (!p9Form.pdfpath) {
      toast.error("No PDF available for this P9 form");
      return;
    }

    // Open PDF in new tab or trigger download
    window.open(p9Form.pdfpath, '_blank');
  };

  const handleBulkSend = async () => {
    if (!user?.organization_id || !selectedYear) return;

    if (!confirm(`Are you sure you want to send all generated P9 forms for ${selectedYear}?`)) {
      return;
    }

    try {
      const response = await p9FormAPI.bulkSendP9Forms(user.organization_id, {
        year: parseInt(selectedYear),
      });

      if (response.success) {
        toast.success(`Successfully sent ${response.data?.sent_count} P9 forms`);
        fetchP9Forms();
        fetchStatistics();
      } else {
        toast.error(response.error || "Failed to bulk send");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, per_page: newLimit, page: 1 }));
  };

  const clearFilters = () => {
    setSelectedYear(new Date().getFullYear().toString());
    setSelectedStatus("");
    setSelectedDepartment("");
  };

  const hasActiveFilters = selectedStatus || selectedDepartment;

  const columns: ColumnDef<P9FormType>[] = [
    {
      key: "p9number",
      header: "P9 Number",
      cell: (p9Form) => (
        <div className="font-medium">{p9Form.p9number}</div>
      ),
    },
    {
      key: "employee",
      header: "Employee",
      cell: (p9Form) => (
        <div>
          <div className="font-medium">{p9Form.employee_name || "N/A"}</div>
          <div className="text-gray-500 text-xs">{p9Form.employee_number || "No employee number"}</div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      cell: (p9Form) => p9Form.department_name || "N/A",
    },
    {
      key: "employee_pin",
      header: "KRA PIN",
      cell: (p9Form) => p9Form.employee_pin || "N/A",
    },
    {
      key: "total_gross_pay",
      header: "Gross Pay",
      cell: (p9Form) => (
        <div className="font-medium">
          Kshs {p9Form.total_gross_pay.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      ),
    },
    {
      key: "total_paye",
      header: "PAYE",
      cell: (p9Form) => (
        <div className="font-medium text-red-600">
          Kshs {p9Form.total_paye.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p9Form) => getStatusBadge(p9Form.status),
    },
    {
      key: "generatedat",
      header: "Generated",
      cell: (p9Form) => new Date(p9Form.generatedat).toLocaleDateString(),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p9Form) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(p9Form)}
            className="h-8 w-8 p-0"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          {p9Form.pdfpath && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDownloadPdf(p9Form)}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
              title="Download PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          
          {p9Form.status === "generated" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleSendP9(p9Form)}
              className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="Mark as Sent"
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          )}
          
          {p9Form.status === "sent" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleFileP9(p9Form)}
              className="h-8 px-3 text-green-600 hover:text-green-700 hover:bg-green-50"
              title="Mark as Filed"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              File
            </Button>
          )}
        </div>
      ),
    },
  ];

  const path = pathname.split("/").filter(Boolean).pop() || "P9 Forms";

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
              <h1 className="text-2xl font-medium">P9 Forms</h1>
              <p className="text-base text-muted-foreground">
                Generate and manage P9 tax forms for employees
              </p>
            </div>
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="peer-data-[state=expanded]:xl:grid-cols-4 peer-data-[state=collapsed]:xl:grid-cols-5">
                <SectionCards details={cardDetails} />
              </div>
              
              <div className="w-full mx-auto p-4 bg-white">
                <div className="rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-semibold text-gray-900">P9 Forms List</h1>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Filter className="w-4 h-4" />
                        Filters
                      </button>
                      
                      <Button
                        onClick={() => setGenerateModalOpen(true)}
                        className="flex items-center gap-2"
                        size="sm"
                      >
                        <Plus className="w-4 h-4" />
                        Generate P9 Forms
                      </Button>
                      
                      {selectedYear && (
                        <Button
                          onClick={handleBulkSend}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Bulk Send
                        </Button>
                      )}
                    </div>
                  </div>

                  {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Year
                          </label>
                          <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            {[2024, 2025, 2026].map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </div>
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
                            <option value="filed">Filed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Department
                          </label>
                          <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">All Departments</option>
                            {/* Add departments dynamically */}
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
                    data={p9Forms}
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
                        ? "No P9 forms match your filters"
                        : "No P9 forms found. Click 'Generate P9 Forms' to create them."
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      <P9FormViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        p9Form={viewP9Form}
        onSend={handleSendP9}
        onFile={handleFileP9}
        onDownload={handleDownloadPdf}
      />

      <P9FormGenerateModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        onSuccess={handleGenerateSuccess}
      />
    </SidebarProvider>
  );
}