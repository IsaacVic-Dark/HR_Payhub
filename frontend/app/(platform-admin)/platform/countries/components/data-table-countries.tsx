"use client";

import { DataTable, ColumnDef } from "@/components/table";
import { Button } from "@/components/ui/button";
import { CountryType } from "@/services/api/countries-counties";
import { Eye, Pencil, Trash2, RotateCcw } from "lucide-react";

interface DataTableCountriesProps {
  countries: CountryType[];
  loading: boolean;
  error: string | null;
  deleteLoading?: boolean;
  canWrite: boolean;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onView: (country: CountryType) => void;
  onViewDetails: (country: CountryType) => void;
  onEdit: (country: CountryType) => void;
  onDeactivate: (country: CountryType) => void;
  onReactivate: (country: CountryType) => void;
  emptyMessage?: string;
}

export function DataTableCountries({
  countries,
  loading,
  error,
  deleteLoading,
  canWrite,
  pagination,
  onPageChange,
  onLimitChange,
  onView,
  onViewDetails,
  onEdit,
  onDeactivate,
  onReactivate,
  emptyMessage = "No countries found",
}: DataTableCountriesProps) {
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

  const columns: ColumnDef<CountryType>[] = [
    {
      key: "name",
      header: "Country",
      cell: (country) => (
        <span className="font-medium text-gray-900">{country.name}</span>
      ),
    },
    {
      key: "iso2",
      header: "ISO2",
      cell: (country) => <span className="font-mono text-xs">{country.iso2}</span>,
    },
    {
      key: "iso3",
      header: "ISO3",
      cell: (country) => <span className="font-mono text-xs">{country.iso3}</span>,
    },
    {
      key: "currency",
      header: "Currency",
      cell: (country) =>
        country.currency_code ? (
          <span>
            {country.currency_code}
            {country.currency_symbol ? ` (${country.currency_symbol})` : ""}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "phone_code",
      header: "Phone Code",
      cell: (country) => country.phone_code || "—",
    },
    {
      key: "is_active",
      header: "Status",
      cell: (country) => getStatusBadge(country.is_active),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (country) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onView(country)}
            className="h-8 w-8 p-0"
            title="Quick view"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewDetails(country)}
            className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            View Details
          </Button>
          {canWrite && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(country)}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {country.is_active === 1 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeactivate(country)}
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
                  onClick={() => onReactivate(country)}
                  disabled={deleteLoading}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  title="Reactivate"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={countries}
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