"use client";

import { DataTable, ColumnDef } from "@/components/table";
import { Button } from "@/components/ui/button";
import { MasterHolidayType } from "@/services/api/public-holidays";
import { Pencil, Trash2, RotateCcw } from "lucide-react";

interface DataTablePublicHolidaysProps {
  holidays: MasterHolidayType[];
  loading: boolean;
  error: string | null;
  deleteLoading?: boolean;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onEdit: (holiday: MasterHolidayType) => void;
  onDeactivate: (holiday: MasterHolidayType) => void;
  onReactivate: (holiday: MasterHolidayType) => void;
  emptyMessage?: string;
}

const TYPE_LABELS: Record<string, string> = {
  national: "National",
  regional: "Regional",
  religious: "Religious",
  bank: "Bank",
  observance: "Observance",
};

const SOURCE_LABELS: Record<string, string> = {
  api_mansa: "Mansa import",
  manual: "Manual",
};

export function DataTablePublicHolidays({
  holidays,
  loading,
  error,
  deleteLoading,
  pagination,
  onPageChange,
  onLimitChange,
  onEdit,
  onDeactivate,
  onReactivate,
  emptyMessage = "No holidays found",
}: DataTablePublicHolidaysProps) {
  const getStatusBadge = (isActive: number) =>
    isActive === 1 ? (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Inactive
      </span>
    );

  const getSourceBadge = (source: string) => (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        source === "manual"
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      {SOURCE_LABELS[source] || source}
    </span>
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const columns: ColumnDef<MasterHolidayType>[] = [
    {
      key: "holiday_date",
      header: "Date",
      cell: (holiday) => (
        <span className="font-medium text-gray-900">
          {formatDate(holiday.holiday_date)}
        </span>
      ),
    },
    {
      key: "name",
      header: "Holiday",
      cell: (holiday) => holiday.name,
    },
    {
      key: "country_code",
      header: "Country",
      cell: (holiday) => (
        <span className="font-mono text-xs">{holiday.country_code}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (holiday) => (holiday.type ? TYPE_LABELS[holiday.type] || holiday.type : "—"),
    },
    {
      key: "source",
      header: "Source",
      cell: (holiday) => getSourceBadge(holiday.source),
    },
    {
      key: "is_active",
      header: "Status",
      cell: (holiday) => getStatusBadge(holiday.is_active),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (holiday) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(holiday)}
            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {holiday.is_active === 1 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeactivate(holiday)}
              disabled={deleteLoading}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Deactivate"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReactivate(holiday)}
              disabled={deleteLoading}
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              title="Reactivate"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={holidays}
      columns={columns}
      pagination={pagination}
      onPageChange={onPageChange}
      onLimitChange={onLimitChange}
      loading={loading}
      error={error}
      emptyMessage={emptyMessage}
    />
  );
}