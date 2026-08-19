"use client";

import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  countryAPI,
  countyAPI,
  CountryDetailType,
  CountyType,
  CountyFilters,
} from "@/services/api/countries-counties";
import { DataTable, ColumnDef } from "@/components/table";
import { CountryFormDialog } from "@/app/(platform-admin)/platform/countries/components/country-form-dialog";
import { CountyFormDialog } from "@/app/(platform-admin)/platform/countries/components/county-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Globe,
  Landmark,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";

export default function CountryDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const countryId = Number(params?.id);

  const [country, setCountry] = useState<CountryDetailType | null>(null);
  const [countryLoading, setCountryLoading] = useState(true);
  const [countryError, setCountryError] = useState<string | null>(null);

  const [counties, setCounties] = useState<CountyType[]>([]);
  const [countyLoading, setCountyLoading] = useState(true);
  const [countyError, setCountyError] = useState<string | null>(null);
  const [countyFilters, setCountyFilters] = useState<CountyFilters>({
    page: 1,
    per_page: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const [countryFormOpen, setCountryFormOpen] = useState(false);
  const [countyFormOpen, setCountyFormOpen] = useState(false);
  const [editCounty, setEditCounty] = useState<CountyType | null>(null);

  const canWrite = user?.user_type === "super_admin";

  const fetchCountry = useCallback(async () => {
    if (!countryId) return;
    setCountryLoading(true);
    setCountryError(null);
    const response = await countryAPI.getCountryById(countryId);
    if (response.success && response.data) {
      setCountry(response.data);
    } else {
      setCountryError(response.error || "Failed to fetch country");
    }
    setCountryLoading(false);
  }, [countryId]);

  const fetchCounties = useCallback(async () => {
    if (!countryId) return;
    setCountyLoading(true);
    setCountyError(null);
    const response = await countyAPI.getCounties(countryId, countyFilters);
    if (response.success && response.data) {
      setCounties(Array.isArray(response.data) ? (response.data as CountyType[]) : []);
      const pagination = response.metadata?.pagination;
      setTotalItems(pagination?.total || 0);
      setTotalPages(pagination?.total_pages || 0);
    } else {
      setCountyError(response.error || "Failed to fetch counties");
      setCounties([]);
    }
    setCountyLoading(false);
  }, [countryId, countyFilters]);

  useEffect(() => { fetchCountry(); }, [fetchCountry]);
  useEffect(() => { fetchCounties(); }, [fetchCounties]);

  const getStatusBadge = (isActive: number) =>
    isActive === 1 ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">Inactive</Badge>
    );

  const handleAddCountyClick = () => {
    setEditCounty(null);
    setCountyFormOpen(true);
  };

  const handleEditCountyClick = (county: CountyType) => {
    setEditCounty(county);
    setCountyFormOpen(true);
  };

  const handleDeactivateCounty = async (county: CountyType) => {
    if (!confirm(`Deactivate "${county.name}"? It will no longer be selectable.`)) return;
    setActionLoading(true);
    const response = await countyAPI.deleteCounty(county.id);
    if (response.success) {
      toast.success("County deactivated successfully");
      fetchCounties();
    } else {
      toast.error(response.error || "Failed to deactivate county");
    }
    setActionLoading(false);
  };

  // No dedicated reactivate endpoint — PATCH is_active back to 1.
  const handleReactivateCounty = async (county: CountyType) => {
    setActionLoading(true);
    const response = await countyAPI.updateCounty(county.id, { is_active: 1 });
    if (response.success) {
      toast.success("County reactivated successfully");
      fetchCounties();
    } else {
      toast.error(response.error || "Failed to reactivate county");
    }
    setActionLoading(false);
  };

  const countyColumns: ColumnDef<CountyType>[] = [
    {
      key: "name",
      header: "County Name",
      cell: (county) => <span className="font-medium">{county.name}</span>,
    },
    {
      key: "code",
      header: "Code",
      cell: (county) => county.code || "—",
    },
    {
      key: "is_active",
      header: "Status",
      cell: (county) => getStatusBadge(county.is_active),
    },
    ...(canWrite
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (county: CountyType) => (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditCountyClick(county)}
                  className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {county.is_active === 1 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeactivateCounty(county)}
                    disabled={actionLoading}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Deactivate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReactivateCounty(county)}
                    disabled={actionLoading}
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    title="Reactivate"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          } as ColumnDef<CountyType>,
        ]
      : []),
  ];

  if (countryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading country…</p>
      </div>
    );
  }

  if (countryError || !country) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 font-medium">Failed to load country</p>
          <p className="text-gray-500 text-sm mt-1">{countryError}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          {/* Page header */}
          <div className="mt-4 mx-6 space-y-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Countries
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-medium">{country.name}</h1>
                <p className="text-base text-muted-foreground">
                  Country details and counties
                </p>
              </div>
              {canWrite && (
                <Button
                  size="sm"
                  onClick={() => setCountryFormOpen(true)}
                  className="flex items-center gap-2 text-xs mt-1"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Country
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 mx-6">
            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <Globe className="h-4 w-4" />
                  Country Info
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">ISO2 / ISO3</span>
                    <span className="font-medium font-mono">
                      {country.iso2} / {country.iso3}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone Code</span>
                    <span className="font-medium">{country.phone_code || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Status</span>
                    {getStatusBadge(country.is_active)}
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <Landmark className="h-4 w-4" />
                  Currency
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Code</span>
                    <span className="font-medium">{country.currency_code || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Symbol</span>
                    <span className="font-medium">{country.currency_symbol || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Timezone</span>
                    <span className="font-medium">{country.timezone || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <MapPin className="h-4 w-4" />
                  Counties
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {country.county_count}
                </div>
                <p className="text-xs text-gray-500">Total counties</p>
              </div>
            </div>

            {/* Counties table */}
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Counties in {country.name}
                </h2>
                {canWrite && (
                  <Button
                    size="sm"
                    onClick={handleAddCountyClick}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Add County
                  </Button>
                )}
              </div>
              <DataTable
                data={counties}
                columns={countyColumns}
                pagination={{
                  page: countyFilters.page || 1,
                  limit: countyFilters.per_page || 10,
                  totalItems,
                  totalPages,
                }}
                onPageChange={(page) =>
                  setCountyFilters((prev) => ({ ...prev, page }))
                }
                onLimitChange={(per_page) =>
                  setCountyFilters((prev) => ({ ...prev, per_page, page: 1 }))
                }
                loading={countyLoading}
                error={countyError}
                emptyMessage="No counties found for this country"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Edit country dialog */}
      <CountryFormDialog
        open={countryFormOpen}
        onOpenChange={setCountryFormOpen}
        country={country}
        onSuccess={fetchCountry}
      />

      {/* Create / Edit county dialog */}
      <CountyFormDialog
        open={countyFormOpen}
        onOpenChange={setCountyFormOpen}
        countryId={countryId}
        county={editCounty}
        onSuccess={fetchCounties}
      />
    </>
  );
}