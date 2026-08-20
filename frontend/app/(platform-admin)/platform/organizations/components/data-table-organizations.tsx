"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Eye } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  organizationAPI,
  type OrganizationType,
  type OrganizationFilters,
} from "@/services/api/organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, ColumnDef } from "@/components/table";
import { OrganizationViewDrawer } from "@/app/(platform-admin)/platform/organizations/components/organization-view-drawer";

const OrganizationsTable: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [organizations, setOrganizations] = useState<OrganizationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [filters, setFilters] = useState<OrganizationFilters>({
    page: 1,
    limit: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState<OrganizationType | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await organizationAPI.getOrganizations({
        ...filters,
        name: searchTerm || undefined,
        status: selectedStatus || undefined,
      });

      if (response.success && response.data) {
        setOrganizations(response.data);
        const pagination = response.metadata?.pagination;
        setTotalItems(pagination?.total || 0);
        setTotalPages(pagination?.total_pages || 0);
      } else {
        setError(response.error || "Failed to fetch organizations");
        setOrganizations([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, selectedStatus]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Deep-linking: ?id=42 in the URL opens that org's drawer directly —
  // covers both clicking "View" and loading/sharing a link with ?id= set.
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) {
      setDrawerOpen(false);
      return;
    }
    const org = organizations.find((o) => o.id === Number(id));
    if (org) {
      setViewOrg(org);
      setDrawerOpen(true);
    }
  }, [searchParams, organizations]);

  const handleViewClick = (org: OrganizationType) => {
    router.push(`${pathname}?id=${org.id}`, { scroll: false });
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      router.push(pathname, { scroll: false });
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const getSubscriptionBadge = (org: OrganizationType) => {
    if (!org.subscription) {
      return <span className="text-gray-400 text-xs">No plan</span>;
    }
    return (
      <div className="flex flex-col">
        <span className="font-medium text-sm">{org.subscription.name}</span>
        <span className="text-xs text-gray-500 capitalize">
          {org.subscription.billing_cycle} · {org.subscription.status}
        </span>
      </div>
    );
  };

  const getStatusBadge = (isActive: number) => (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
        }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );

  const columns: ColumnDef<OrganizationType>[] = [
    { key: "name", header: "Organization", cell: (org) => org.name },
    {
      key: "legal_type",
      header: "Legal Type",
      cell: (org) => org.legal_type || "—",
    },
    { key: "location", header: "Location", cell: (org) => org.location || "—" },
    { key: "currency", header: "Currency", cell: (org) => org.currency },
    {
      key: "subscription",
      header: "Plan",
      cell: (org) => getSubscriptionBadge(org),
    },
    {
      key: "status",
      header: "Status",
      cell: (org) => getStatusBadge(org.is_active),
    },
    {
      key: "created_at",
      header: "Created",
      cell: (org) => new Date(org.created_at).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      }),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (org) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleViewClick(org)}
          className="h-8 w-8 p-0"
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-6 gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {/* <SelectItem value="">All statuses</SelectItem> */}
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            emptyMessage="No organizations found"
          />
        </div>
      </div>

      <OrganizationViewDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        organization={viewOrg}
      />
    </>
  );
};

export default OrganizationsTable;