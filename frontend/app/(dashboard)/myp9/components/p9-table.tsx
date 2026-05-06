"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, FileText } from "lucide-react";
import { p9API, P9FormType } from "@/services/api/p9";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/table";
import { useAuth } from "@/lib/AuthContext";
import { generateP9PDF } from "@/app/(dashboard)/myp9/utils/p9-pdf-generator";

const P9Table: React.FC = () => {
  const { user } = useAuth();
  const [forms, setForms] = useState<P9FormType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchP9Forms = useCallback(async () => {
    if (!user?.organization_id || !user?.employee?.id) {
      setError("No organization or employee ID found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await p9API.getEmployeeP9Forms(
        user.organization_id,
        user.employee.id,
      );

      if (response.success && response.data) {
        setForms(Array.isArray(response.data) ? response.data : []);
      } else {
        setError(response.error || "Failed to fetch P9 forms");
        setForms([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id, user?.employee?.id]);

  useEffect(() => {
    if (user?.organization_id && user?.employee?.id) {
      fetchP9Forms();
    }
  }, [fetchP9Forms, user?.organization_id, user?.employee?.id]);

  const handleDownload = async (form: P9FormType) => {
    setDownloadingId(form.id);
    try {
      if (form.pdfpath) {
        window.open(form.pdfpath, "_blank");
        return;
      }
      const employeeName = user?.employee
        ? [
            user.employee.firstname,
            user.employee.middlename,
            user.employee.surname,
          ]
            .filter(Boolean)
            .join(" ")
        : undefined;

      generateP9PDF(form, employeeName);
    } finally {
      setTimeout(() => setDownloadingId(null), 800);
    }
  };

  const formatCurrency = (value: string) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(parseFloat(value));

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      filed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      draft: "bg-gray-100 text-gray-700",
    };
    return (
      <Badge className={config[status] ?? "bg-gray-100 text-gray-700"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const columns: ColumnDef<P9FormType>[] = [
    {
      key: "year",
      header: "Tax Year",
      cell: (row) => (
        <span className="font-semibold">{row.year}</span>
      ),
    },
    {
      key: "p9number",
      header: "P9 Number",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-mono text-sm">{row.p9number}</span>
        </div>
      ),
    },
    {
      key: "employee_pin",
      header: "Employee PIN",
      cell: (row) => (
        <span className="font-mono text-sm">{row.employee_pin}</span>
      ),
    },
    {
      key: "total_gross_pay",
      header: "Gross Pay",
      cell: (row) => (
        <span className="tabular-nums">
          {formatCurrency(row.total_gross_pay)}
        </span>
      ),
    },
    {
      key: "total_taxable_pay",
      header: "Taxable Pay",
      cell: (row) => (
        <span className="tabular-nums">
          {formatCurrency(row.total_taxable_pay)}
        </span>
      ),
    },
    {
      key: "total_paye",
      header: "Total PAYE",
      cell: (row) => (
        <span className="tabular-nums font-semibold">
          {formatCurrency(row.total_paye)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => getStatusBadge(row.status),
    },
    {
      key: "generatedat",
      header: "Generated",
      cell: (row) => (
        <span className="text-sm text-gray-600">
          {new Date(row.generatedat).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => {
        const isDownloading = downloadingId === row.id;
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDownload(row)}
            disabled={isDownloading}
            className="flex items-center gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
          >
            <Download className={`h-3.5 w-3.5 ${isDownloading ? "animate-bounce" : ""}`} />
            {isDownloading ? "Preparing..." : "Download PDF"}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-base font-semibold text-gray-900">P9 Forms</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your annual tax deduction cards issued by the employer
          </p>
        </div>
      </div>

      <div className="p-4">
        <DataTable
          data={forms}
          columns={columns}
          loading={loading}
          error={error}
          emptyMessage="No P9 forms found"
        />
      </div>
    </div>
  );
};

export default P9Table;