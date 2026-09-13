"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { roleAPI, RoleDetailType } from "@/services/api/role";
import { RoleFormDialog } from "@/app/(dashboard)/roles-permissions/components/role-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  Users,
  Pencil,
  Trash2,
  Lock,
  ShieldAlert,
} from "lucide-react";

export default function RoleDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roleId = Number(params?.id);

  const [role, setRole] = useState<RoleDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);

  const isAdmin = user?.user_type === "admin";

  const fetchRole = useCallback(async () => {
    if (!user?.organization_id || !roleId) return;
    setLoading(true);
    setError(null);
    const response = await roleAPI.getRole(user.organization_id, roleId);
    if (response.success && response.data) {
      setRole(response.data);
    } else {
      setError(response.error || "Failed to fetch role");
    }
    setLoading(false);
  }, [user?.organization_id, roleId]);

  useEffect(() => {
    if (isAdmin) fetchRole();
  }, [fetchRole, isAdmin]);

  const permissionsByModule = useMemo(() => {
    if (!role) return [] as [string, RoleDetailType["permissions"]][];
    const grouped: Record<string, RoleDetailType["permissions"]> = {};
    role.permissions.forEach((p) => {
      grouped[p.module] = grouped[p.module] ?? [];
      grouped[p.module].push(p);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [role]);

  const handleDelete = async () => {
    if (!user?.organization_id || !role) return;
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
      router.push("/roles-permissions");
    } else {
      toast.error(response.error || "Failed to delete role");
    }
    setDeleteLoading(false);
  };

  const sidebarStyle = {
    "--sidebar-width": "calc(var(--spacing) * 72)",
    "--header-height": "calc(var(--spacing) * 12)",
  } as React.CSSProperties;

  if (!isAdmin) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-sm">
              <ShieldAlert className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-900 font-medium">You don&apos;t have access to this page</p>
              <p className="text-gray-500 text-sm mt-1">
                Roles &amp; Permissions is only available to organization administrators.
              </p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (loading) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading role…</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error || !role) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 font-medium">Failed to load role</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                Go Back
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
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
              Back to Roles &amp; Permissions
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-medium flex items-center gap-2">
                  {role.name}
                  {role.is_system && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="h-3 w-3" /> System
                    </Badge>
                  )}
                </h1>
                <p className="text-base text-muted-foreground">
                  {role.description || "Role permissions and assigned users"}
                </p>
              </div>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  onClick={() => setFormOpen(true)}
                  className="flex items-center gap-2 text-xs"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Role
                </Button>
                {!role.is_system && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex items-center gap-2 text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 mx-6">
            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Role Info
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Slug</span>
                    <span className="font-medium font-mono">{role.slug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium">{role.is_system ? "System" : "Custom"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Permissions
                </div>
                <div className="text-3xl font-bold text-blue-600">{role.permissions.length}</div>
                <p className="text-xs text-gray-500">
                  Across {permissionsByModule.length} module{permissionsByModule.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                  <Users className="h-4 w-4" />
                  Assigned Users
                </div>
                <div className="text-3xl font-bold text-blue-600">{role.users.length}</div>
                <p className="text-xs text-gray-500">
                  Managed from the Users page
                </p>
              </div>
            </div>

            {/* Permissions by module */}
            <div className="bg-white border rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Permissions granted to {role.name}
              </h2>
              {permissionsByModule.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-6 text-center">
                  No permissions assigned to this role yet
                </p>
              ) : (
                <div className="space-y-4">
                  {permissionsByModule.map(([mod, perms]) => (
                    <div key={mod} className="border rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-800 capitalize mb-3">
                        {mod.replace(/_/g, " ")}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {perms.map((p) => (
                          <div
                            key={p.name}
                            className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md text-sm"
                          >
                            <span className="text-gray-700">{p.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                              {p.scope}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned users */}
            <div className="bg-white border rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Users with the {role.name} role
              </h2>
              {role.users.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-6 text-center">
                  No users are currently assigned this role
                </p>
              ) : (
                <div className="divide-y">
                  {role.users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                          {u.username?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.username}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">
                To assign or unassign this role, use the Users management page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      {user?.organization_id && (
        <RoleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          organizationId={user.organization_id}
          role={role}
          onSuccess={fetchRole}
        />
      )}
    </>
  );
}