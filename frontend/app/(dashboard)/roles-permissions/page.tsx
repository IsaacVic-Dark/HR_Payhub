"use client";

import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { roleAPI, RoleType } from "@/services/api/role";
import { DataTable, ColumnDef } from "@/components/table";
import { RoleViewDrawer } from "@/app/(dashboard)/roles-permissions/components/role-view-drawer";
import { RoleFormDialog } from "@/app/(dashboard)/roles-permissions/components/role-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, Plus, ShieldAlert, Lock } from "lucide-react";
import { toast } from "sonner";

export default function RolesPermissionsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [roles, setRoles] = useState<RoleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewRole, setViewRole] = useState<RoleType | null>(null);

  // Create / Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleType | null>(null);

  // Client-side search (index endpoint returns the full org role list, unpaginated)
  const [searchInput, setSearchInput] = useState("");

  const isAdmin = user?.user_type === "admin";

  const fetchRoles = useCallback(async () => {
    if (!user?.organization_id) return;

    setLoading(true);
    setError(null);

    const response = await roleAPI.getRoles(user.organization_id);

    if (response.success && response.data) {
      setRoles(Array.isArray(response.data) ? response.data : []);
    } else {
      setError(response.error || "Failed to fetch roles");
      setRoles([]);
    }

    setLoading(false);
  }, [user?.organization_id]);

  useEffect(() => {
    if (isAdmin) fetchRoles();
  }, [fetchRoles, isAdmin]);

  const filteredRoles = searchInput.trim()
    ? roles.filter(
        (r) =>
          r.name.toLowerCase().includes(searchInput.trim().toLowerCase()) ||
          r.slug.toLowerCase().includes(searchInput.trim().toLowerCase())
      )
    : roles;

  const handleViewClick = (role: RoleType) => {
    setViewRole(role);
    setDrawerOpen(true);
  };

  const handleEditClick = (role: RoleType) => {
    setEditRole(role);
    setFormOpen(true);
  };

  const handleCreateClick = () => {
    setEditRole(null);
    setFormOpen(true);
  };

  const handleViewDetails = (role: RoleType) => {
    router.push(`/roles-permissions/${role.id}`);
  };

  const handleDelete = async (role: RoleType) => {
    if (!user?.organization_id) return;
    if (role.is_system) {
      toast.error("Default system roles cannot be deleted — remove its permissions instead");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to delete the "${role.name}" role? This cannot be done if any user is still assigned to it.`
      )
    )
      return;

    setDeleteLoading(true);
    const response = await roleAPI.deleteRole(user.organization_id, role.id);

    if (response.success) {
      toast.success("Role deleted successfully");
      fetchRoles();
    } else {
      toast.error(response.error || "Failed to delete role");
    }
    setDeleteLoading(false);
  };

  const columns: ColumnDef<RoleType>[] = [
    {
      key: "name",
      header: "Role Name",
      cell: (role) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{role.name}</span>
          {role.is_system && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Lock className="h-3 w-3" /> System
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      cell: (role) => <span className="font-mono text-xs text-gray-500">{role.slug}</span>,
    },
    {
      key: "permissions",
      header: "Permissions",
      cell: (role) => role.permissions.length,
    },
    {
      key: "user_count",
      header: "Users",
      cell: (role) => role.user_count,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (role) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewClick(role)}
            className="h-8 w-8 p-0"
            title="Quick view"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewDetails(role)}
            className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            View Details
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditClick(role)}
            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!role.is_system && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(role)}
              disabled={deleteLoading}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!authLoading && !isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center h-64">
        <div className="text-center max-w-sm">
          <ShieldAlert className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">You don&apos;t have access to this page</p>
          <p className="text-gray-500 text-sm mt-1">
            Roles &amp; Permissions is only available to organization administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="mt-4 mx-6 space-y-2">
            <h1 className="text-2xl font-medium">Roles &amp; Permissions</h1>
            <p className="text-base text-muted-foreground">
              Define custom roles and control what each one can access across your organization
            </p>
          </div>

          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="w-full mx-auto px-4">
              <div className="rounded-lg shadow-sm border p-4 bg-white">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">All Roles</h2>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by name or slug…"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <Button
                      onClick={handleCreateClick}
                      className="flex items-center gap-2 text-xs"
                      size="sm"
                    >
                      <Plus className="w-4 h-4" />
                      New Role
                    </Button>
                  </div>
                </div>

                <DataTable
                  data={filteredRoles}
                  columns={columns}
                  pagination={{
                    page: 1,
                    limit: filteredRoles.length || 10,
                    totalItems: filteredRoles.length,
                    totalPages: 1,
                  }}
                  onPageChange={() => {}}
                  onLimitChange={() => {}}
                  loading={loading}
                  error={error}
                  emptyMessage={
                    searchInput ? "No roles match your search" : "No roles found"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick-view Drawer */}
      <RoleViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        role={viewRole}
        onViewDetails={handleViewDetails}
        onEdit={(role) => {
          setDrawerOpen(false);
          handleEditClick(role);
        }}
        onDelete={(role) => {
          setDrawerOpen(false);
          handleDelete(role);
        }}
      />

      {/* Create / Edit Dialog */}
      {user?.organization_id && (
        <RoleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          organizationId={user.organization_id}
          role={editRole}
          onSuccess={fetchRoles}
        />
      )}
    </>
  );
}