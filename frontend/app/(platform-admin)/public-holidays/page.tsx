"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import {
  publicHolidayAPI,
  type MasterHolidayType,
  type MasterHolidayFilters,
} from "@/services/api/public-holidays";
import type { CountryType } from "@/services/api/countries-counties";
import { DataTablePublicHolidays } from "./components/data-table-public-holidays";
import { HolidayFormDialog } from "./components/holiday-form-dialog";

const ALL_COUNTRIES = "all";
const ALL_STATUS = "all";

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 2; y <= current + 3; y++) years.push(y);
  return years;
}

export default function PublicHolidaysPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.user_type === "super_admin";

  const [countries, setCountries] = useState<CountryType[]>([]);
  const [holidays, setHolidays] = useState<MasterHolidayType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [countryCode, setCountryCode] = useState<string>(ALL_COUNTRIES);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [status, setStatus] = useState<string>(ALL_STATUS);
  const [searchTerm, setSearchTerm] = useState("");

  const [filters, setFilters] = useState<{ page: number; limit: number }>({
    page: 1,
    limit: 15,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<MasterHolidayType | null>(
    null
  );

  const [importOpen, setImportOpen] = useState(false);
  const [importCountry, setImportCountry] = useState<string>("");
  const [importYear, setImportYear] = useState<number>(new Date().getFullYear());
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Countries for the filter bar + form dropdowns.
  useEffect(() => {
    (async () => {
      const response = await publicHolidayAPI.getCountries();
      if (response.success && response.data) {
        setCountries(response.data);
      }
    })();
  }, []);

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const apiFilters: MasterHolidayFilters = {
        page: filters.page,
        per_page: filters.limit,
        year,
      };
      if (countryCode !== ALL_COUNTRIES) apiFilters.country_code = countryCode;
      if (status !== ALL_STATUS) apiFilters.is_active = status === "active" ? 1 : 0;
      if (searchTerm) apiFilters.search = searchTerm;

      const response = await publicHolidayAPI.getMasterHolidays(apiFilters);

      if (response.success && response.data) {
        setHolidays(response.data);
        const pagination = response.metadata?.pagination;
        setTotalItems(pagination?.total || 0);
        setTotalPages(pagination?.total_pages || 0);
      } else {
        setError(response.error || "Failed to fetch holidays");
        setHolidays([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, [filters, countryCode, year, status, searchTerm]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchHolidays();
  }, [fetchHolidays, isSuperAdmin]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handleAdd = () => {
    setEditingHoliday(null);
    setFormOpen(true);
  };

  const handleEdit = (holiday: MasterHolidayType) => {
    setEditingHoliday(holiday);
    setFormOpen(true);
  };

  const handleDeactivate = async (holiday: MasterHolidayType) => {
    if (!confirm(`Deactivate "${holiday.name}" (${holiday.holiday_date})?`)) return;
    setActionLoading(true);
    const response = await publicHolidayAPI.deactivateMasterHoliday(holiday.id);
    setActionLoading(false);
    if (response.success) {
      fetchHolidays();
    } else {
      alert(response.error || "Failed to deactivate holiday");
    }
  };

  const handleReactivate = async (holiday: MasterHolidayType) => {
    setActionLoading(true);
    const response = await publicHolidayAPI.reactivateMasterHoliday(holiday.id);
    setActionLoading(false);
    if (response.success) {
      fetchHolidays();
    } else {
      alert(response.error || "Failed to reactivate holiday");
    }
  };

  const handleImport = async () => {
    if (!importCountry) {
      setImportError("Select a country to import");
      return;
    }
    setImportLoading(true);
    setImportError(null);

    const response = await publicHolidayAPI.importHolidays({
      country_code: importCountry,
      year: importYear,
    });

    setImportLoading(false);

    if (!response.success) {
      setImportError(response.error || "Import failed");
      return;
    }

    setImportOpen(false);
    fetchHolidays();
  };

  if (!isSuperAdmin) {
    return (
      <div className="w-full mx-auto p-6">
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          This page is restricted to super admins.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto p-4 bg-white">
      <div className="rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Public Holidays
            </h1>
            <p className="text-sm text-muted-foreground">
              Master calendar shared across all organizations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportCountry(
                  countryCode !== ALL_COUNTRIES ? countryCode : ""
                );
                setImportYear(year);
                setImportError(null);
                setImportOpen(true);
              }}
            >
              <UploadCloud className="h-4 w-4" />
              Import from Mansa
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Add Holiday
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search holidays..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={countryCode}
            onValueChange={(value) => {
              setCountryCode(value);
              setFilters((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent searchable searchPlaceholder="Search countries...">
              <SelectItem value={ALL_COUNTRIES}>All countries</SelectItem>
              {countries.map((country) => (
                <SelectItem key={country.iso2} value={country.iso2}>
                  {country.name} ({country.iso2})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(year)}
            onValueChange={(value) => {
              setYear(Number(value));
              setFilters((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions().map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setFilters((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTablePublicHolidays
          holidays={holidays}
          loading={loading}
          error={error}
          deleteLoading={actionLoading}
          pagination={{
            page: filters.page,
            limit: filters.limit,
            totalItems,
            totalPages,
          }}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
          emptyMessage="No holidays found for these filters"
        />
      </div>

      <HolidayFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        holiday={editingHoliday}
        countries={countries}
        defaultCountryCode={countryCode !== ALL_COUNTRIES ? countryCode : undefined}
        onSaved={fetchHolidays}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Import from Mansa</DialogTitle>
            <DialogDescription>
              Pulls the public holiday calendar for a country/year from Mansa
              and adds any missing rows to the master calendar. Existing rows
              you've edited manually are not overwritten.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="import-country">Country</Label>
              <Select value={importCountry} onValueChange={setImportCountry}>
                <SelectTrigger id="import-country" className="w-full">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent searchable searchPlaceholder="Search countries...">
                  {countries.map((country) => (
                    <SelectItem key={country.iso2} value={country.iso2}>
                      {country.name} ({country.iso2})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-year">Year</Label>
              <Select
                value={String(importYear)}
                onValueChange={(value) => setImportYear(Number(value))}
              >
                <SelectTrigger id="import-year" className="w-full">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions().map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {importError && <p className="text-sm text-red-600">{importError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={importLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importLoading}>
              {importLoading ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}