"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Filter,
  Search,
  Plus,
  MapPin,
  Building2,
  Globe,
  Coins,
  Calendar,
  Eye,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import {
  organizationAPI,
  Organization,
  OrganizationFilters,
} from "@/api/organization";
import OrganizationDrawer from "@/app/organization/drawer";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DataTable, ColumnDef } from "@/components/table";

interface OrganizationTableProps {
  className?: string;
}

const OrganizationTable: React.FC<OrganizationTableProps> = ({ className }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<OrganizationFilters>({
    page: 1,
    limit: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Local state for filter inputs
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Add these after your existing useState declarations
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const locationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drawer state
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    mode: "add" | "edit" | "view";
    organizationId?: number;
  }>({
    isOpen: false,
    mode: "add",
  });

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    organizationId?: number;
    organizationName?: string;
    isDeleting?: boolean;
  }>({
    isOpen: false,
    isDeleting: false,
  });

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await organizationAPI.getOrganizations(filters);

      if (response.success && response.data) {
        setOrganizations(response.data);
        if (response.data.metadata) {
          setTotalItems(
            response.data.metadata.total || response.data.data.length
          );
          setTotalPages(
            response.data.metadata.total_pages ||
              Math.ceil(response.data.data.length / (filters.limit || 10))
          );
        }
      } else {
        setError(response.error || "Failed to fetch organizations");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handleSearch = (searchTerm: string) => {
    setSearchTerm(searchTerm);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        name: searchTerm || undefined,
        page: 1,
      }));
    }, 500);
  };

  const handleLocationFilter = (location: string) => {
    setLocationFilter(location);

    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current);
    }

    locationTimeoutRef.current = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        location: location || undefined,
        page: 1,
      }));
    }, 500);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setFilters((prev) => ({ ...prev, status: status || undefined, page: 1 }));
  };

  const clearAllFilters = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current);
    }

    setSearchTerm("");
    setLocationFilter("");
    setStatusFilter("");
    setFilters({ page: 1, limit: filters.limit });
  };

  const hasActiveFilters = searchTerm || locationFilter || statusFilter;

  // Drawer handlers
  const openDrawer = (
    mode: "add" | "edit" | "view",
    organizationId?: number
  ) => {
    setDrawerState({
      isOpen: true,
      mode,
      organizationId,
    });
  };

  const closeDrawer = () => {
    setDrawerState({
      isOpen: false,
      mode: "add",
    });
  };

  const handleDrawerSuccess = () => {
    fetchOrganizations();
  };

  // Delete handlers
  const openDeleteConfirm = (
    organizationId: number,
    organizationName: string
  ) => {
    setDeleteConfirm({
      isOpen: true,
      organizationId,
      organizationName,
      isDeleting: false,
    });
  };

  const handleDelete = async (organizationId: number) => {
    if (!organizationId) return;

    try {
      const response = await organizationAPI.deleteOrganization(organizationId);
      if (response.success) {
        await fetchOrganizations();
      } else {
        setError(response.error || "Failed to delete organization");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete organization"
      );
    }
  };

  // Table columns configuration
  const columns: ColumnDef<Organization>[] = [
    {
      key: "organization",
      header: "Organization",
      cell: (org) => (
        <div className="flex flex-col">
          <div className="text-sm font-medium text-gray-900">{org.name}</div>
          <div className="text-xs text-gray-500">
            <Globe className="w-3 h-3 inline mr-1" />
            {org.domain}
          </div>
          <div className="text-xs text-gray-500">KRA: {org.kra_pin}</div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type & Registration",
      cell: (org) => (
        <div className="flex flex-col">
          <div className="text-sm text-gray-900">{org.legal_type}</div>
          <div className="text-xs text-gray-500">{org.registration_number}</div>
          <div className="text-xs text-gray-500">
            Prefix: {org.payroll_number_prefix}
          </div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location & Contact",
      cell: (org) => (
        <div className="flex flex-col">
          <div className="text-sm text-gray-900">
            <MapPin className="w-3 h-3 inline mr-1" />
            {org.location}
          </div>
          <div className="text-xs text-gray-500">{org.primary_phone}</div>
          <div className="text-xs text-gray-500 truncate max-w-32">
            {org.official_email}
          </div>
        </div>
      ),
    },
    {
      key: "financial",
      header: "Financial Details",
      cell: (org) => (
        <div className="flex flex-col">
          <div className="text-sm text-gray-900">
            <Coins className="w-3 h-3 inline mr-1" />
            {org.currency}
          </div>
          <div className="text-xs text-gray-500">{org.bank_account_name}</div>
          <div className="text-xs text-gray-500">{org.bank_account_number}</div>
          <div className="text-xs text-gray-500">{org.bank_branch}</div>
        </div>
      ),
    },
    {
      key: "payroll",
      header: "Payroll Info",
      cell: (org) => (
        <div className="flex flex-col">
          <div className="text-sm text-gray-900">{org.payroll_schedule}</div>
          <div className="text-xs text-gray-500">Pay Day: {org.default_payday}</div>
          <div className="text-xs text-gray-500">NSSF: {org.nssf_number}</div>
          <div className="text-xs text-gray-500">NHIF: {org.nhif_number}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status & Date",
      cell: (org) => (
        <div className="flex flex-col">
          <div
            className={`text-xs px-2 py-1 rounded-full w-fit ${
              org.is_active
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {org.is_active ? "Active" : "Inactive"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            <Calendar className="w-3 h-3 inline mr-1" />
            {formatDate(org.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (org) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openDrawer("view", org.id)}
            className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
            title="View details"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            onClick={() => openDrawer("edit", org.id)}
            className="flex items-center gap-1 px-2 py-1 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded transition-colors"
            title="Edit organization"
          >
            <Edit className="w-3 h-3" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                title="Delete organization"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete Organization
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete{" "}
                  <strong>{org.name}</strong>? This action
                  cannot be undone and will permanently remove
                  all associated data including employees,
                  payroll records, and organizational settings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(org.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteConfirm.isDeleting &&
                  deleteConfirm.organizationId === org.id
                    ? "Deleting..."
                    : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={`w-full mx-auto p-4 bg-white ${className}`}>
        <div className="rounded-lg shadow-sm border p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  showFilters || hasActiveFilters
                    ? "bg-purple-100 text-purple-700 border border-purple-300"
                    : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-600 text-white rounded-full text-xs">
                    {
                      [searchTerm, locationFilter, statusFilter].filter(Boolean)
                        .length
                    }
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search organizations"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
                />
              </div>
              <button
                onClick={() => openDrawer("add")}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Organization
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Filter by location"
                      value={locationFilter}
                      onChange={(e) => handleLocationFilter(e.target.value)}
                      className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Data Table */}
          <DataTable
            data={organizations}
            columns={columns}
            pagination={{
              page: filters.page || 1,
              limit: filters.limit || 10,
              totalItems,
              totalPages,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={loading}
            error={error}
            emptyMessage={
              hasActiveFilters
                ? "No organizations match your filters"
                : "No organizations found"
            }
          />
        </div>
      </div>

      {/* Organization Drawer */}
      <OrganizationDrawer
        isOpen={drawerState.isOpen}
        onClose={closeDrawer}
        mode={drawerState.mode}
        organizationId={drawerState.organizationId}
        onSuccess={handleDrawerSuccess}
      />
    </>
  );
};

export default OrganizationTable;