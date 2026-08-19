"use client";

import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  countryAPI,
  CountryType,
  CountryFilters,
} from "@/services/api/countries-counties";
import { CountryViewDrawer } from "@/app/(platform-admin)/platform/countries/components/country-view-drawer";
import { CountryFormDialog } from "@/app/(platform-admin)/platform/countries/components/country-form-dialog";
import { DataTableCountries } from "@/app/(platform-admin)/platform/countries/components/data-table-countries";
import { Button } from "@/components/ui/button";
import { Filter, Plus } from "lucide-react";
import { toast } from "sonner";

export default function CountriesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [countries, setCountries] = useState<CountryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewCountry, setViewCountry] = useState<CountryType | null>(null);

  // Create / Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editCountry, setEditCountry] = useState<CountryType | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [filters, setFilters] = useState<CountryFilters>({ page: 1, per_page: 10 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Only super_admin can create/edit/deactivate — GET routes are public.
  const canWrite = user?.user_type === "super_admin";

  const fetchCountries = useCallback(async () => {
    setLoading(true);
    setError(null);

    const apiFilters: CountryFilters = {
      ...filters,
      search: searchInput || undefined,
      is_active:
        selectedStatus === "1" ? true : selectedStatus === "0" ? false : undefined,
    };

    const response = await countryAPI.getCountries(apiFilters);

    if (response.success && response.data) {
      setCountries(Array.isArray(response.data) ? (response.data as CountryType[]) : []);
      const pagination = response.metadata?.pagination;
      setTotalItems(pagination?.total || 0);
      setTotalPages(pagination?.total_pages || 0);
    } else {
      setError(response.error || "Failed to fetch countries");
      setCountries([]);
      setTotalItems(0);
      setTotalPages(0);
    }

    setLoading(false);
  }, [filters, searchInput, selectedStatus]);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const handleViewClick = (country: CountryType) => {
    setViewCountry(country);
    setDrawerOpen(true);
  };

  const handleEditClick = (country: CountryType) => {
    setEditCountry(country);
    setFormOpen(true);
  };

  const handleCreateClick = () => {
    setEditCountry(null);
    setFormOpen(true);
  };

  const handleViewDetails = (country: CountryType) => {
    router.push(`/platform/countries/${country.id}`);
  };

  const handleDeactivate = async (country: CountryType) => {
    if (
      !confirm(
        `Are you sure you want to deactivate "${country.name}"? It will no longer be selectable in dropdowns.`
      )
    )
      return;

    setDeleteLoading(true);
    const response = await countryAPI.deleteCountry(country.id);

    if (response.success) {
      toast.success("Country deactivated successfully");
      fetchCountries();
    } else {
      toast.error(response.error || "Failed to deactivate country");
    }
    setDeleteLoading(false);
  };

  // No dedicated reactivate endpoint — PATCH is_active back to 1.
  const handleReactivate = async (country: CountryType) => {
    setDeleteLoading(true);
    const response = await countryAPI.updateCountry(country.id, { is_active: 1 });

    if (response.success) {
      toast.success("Country reactivated successfully");
      fetchCountries();
    } else {
      toast.error(response.error || "Failed to reactivate country");
    }
    setDeleteLoading(false);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSelectedStatus("");
    setFilters({ page: 1, per_page: 10 });
  };

  const hasActiveFilters = searchInput || selectedStatus;

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="mt-4 mx-6 space-y-2">
            <h1 className="text-2xl font-medium">Countries</h1>
            <p className="text-base text-muted-foreground">
              Manage the global list of countries available across the platform
            </p>
          </div>

          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="w-full mx-auto px-4">
              <div className="rounded-lg shadow-sm border p-4 bg-white">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    All Countries
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                    </button>
                    {canWrite && (
                      <Button
                        onClick={handleCreateClick}
                        className="flex items-center gap-2 text-xs"
                        size="sm"
                      >
                        <Plus className="w-4 h-4" />
                        New Country
                      </Button>
                    )}
                  </div>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Search
                        </label>
                        <input
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder="Search by name, ISO2 or ISO3…"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
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
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
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

                <DataTableCountries
                  countries={countries}
                  loading={loading}
                  error={error}
                  deleteLoading={deleteLoading}
                  canWrite={canWrite}
                  pagination={{
                    page: filters.page || 1,
                    limit: filters.per_page || 10,
                    totalItems,
                    totalPages,
                  }}
                  onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                  onLimitChange={(per_page) =>
                    setFilters((prev) => ({ ...prev, per_page, page: 1 }))
                  }
                  onView={handleViewClick}
                  onViewDetails={handleViewDetails}
                  onEdit={handleEditClick}
                  onDeactivate={handleDeactivate}
                  onReactivate={handleReactivate}
                  emptyMessage={
                    hasActiveFilters
                      ? "No countries match your filters"
                      : "No countries found"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick-view Drawer */}
      <CountryViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        country={viewCountry}
        onViewDetails={handleViewDetails}
      />

      {/* Create / Edit Dialog */}
      <CountryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        country={editCountry}
        onSuccess={fetchCountries}
      />
    </>
  );
}