"use client";

/**
 * Drop this into a tab/section on your user profile or user-detail page:
 *
 *   <UserPermissionOverrides organizationId={user.organization_id} userId={targetUser.id} />
 *
 * It is self-contained — it fetches the target user's effective permissions
 * and direct overrides, and lets an admin add/clear a grant or revoke.
 * Role assignment itself is intentionally NOT here — that lives on the Users
 * management page per your Roles & Permissions setup.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  permissionAPI,
  PermissionCatalog,
  UserPermissionOverride,
  EffectivePermission,
} from "@/services/api/permission";
import { PermissionScope } from "@/services/api/role";
import { toast } from "sonner";
import { ShieldCheck, ShieldMinus, X, Plus } from "lucide-react";

interface UserPermissionOverridesProps {
  organizationId: number;
  userId: number;
}

const SCOPES: { value: PermissionScope; label: string }[] = [
  { value: "own", label: "Own" },
  { value: "team", label: "Team" },
  { value: "department", label: "Department" },
  { value: "all", label: "All" },
];

export function UserPermissionOverrides({ organizationId, userId }: UserPermissionOverridesProps) {
  const [effective, setEffective] = useState<EffectivePermission[]>([]);
  const [overrides, setOverrides] = useState<UserPermissionOverride[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newPermission, setNewPermission] = useState("");
  const [newType, setNewType] = useState<"grant" | "revoke">("grant");
  const [newScope, setNewScope] = useState<PermissionScope>("all");
  const [saving, setSaving] = useState(false);
  const [clearingName, setClearingName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [permsRes, catalogRes] = await Promise.all([
      permissionAPI.getUserPermissions(organizationId, userId),
      permissionAPI.getCatalog(organizationId),
    ]);

    if (permsRes.success && permsRes.data) {
      setEffective(permsRes.data.effective_permissions ?? []);
      setOverrides(permsRes.data.direct_overrides ?? []);
    } else {
      setError(permsRes.error || "Failed to load user permissions");
    }

    if (catalogRes.success && catalogRes.data) {
      setCatalog(catalogRes.data);
    }

    setLoading(false);
  }, [organizationId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const allPermissionNames = useMemo(
    () => Object.values(catalog).flat().map((p) => p.name).sort(),
    [catalog]
  );

  const handleAddOverride = async () => {
    if (!newPermission) {
      toast.error("Choose a permission first");
      return;
    }
    setSaving(true);
    const response = await permissionAPI.setOverride(organizationId, userId, {
      permission: newPermission,
      type: newType,
      scope: newType === "grant" ? newScope : undefined,
    });
    if (response.success) {
      toast.success("Permission override saved");
      setAddOpen(false);
      setNewPermission("");
      setNewType("grant");
      setNewScope("all");
      load();
    } else {
      toast.error(response.error || "Failed to save override");
    }
    setSaving(false);
  };

  const handleClear = async (permissionName: string) => {
    if (!confirm(`Remove the direct override for "${permissionName}"? This falls back to whatever the user's role(s) grant.`)) {
      return;
    }
    setClearingName(permissionName);
    const response = await permissionAPI.clearOverride(organizationId, userId, permissionName);
    if (response.success) {
      toast.success("Override cleared");
      load();
    } else {
      toast.error(response.error || "Failed to clear override");
    }
    setClearingName(null);
  };

  if (loading) {
    return <p className="text-sm text-gray-500 py-6 text-center">Loading permissions…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 py-6 text-center">{error}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Direct overrides */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Direct Overrides</h3>
          <Button size="sm" onClick={() => setAddOpen((v) => !v)} className="gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Override
          </Button>
        </div>

        {addOpen && (
          <div className="mb-4 p-3 bg-gray-50 border rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Permission</label>
              <select
                value={newPermission}
                onChange={(e) => setNewPermission(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
              >
                <option value="">Select…</option>
                {allPermissionNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as "grant" | "revoke")}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
              >
                <option value="grant">Grant</option>
                <option value="revoke">Revoke</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value as PermissionScope)}
                disabled={newType === "revoke"}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white disabled:bg-gray-100 disabled:text-gray-400"
              >
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4 flex justify-end gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddOverride} disabled={saving}>
                {saving ? "Saving..." : "Save Override"}
              </Button>
            </div>
          </div>
        )}

        {overrides.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">
            No direct overrides — this user's access comes entirely from their role(s)
          </p>
        ) : (
          <div className="divide-y">
            {overrides.map((o) => (
              <div key={o.name} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  {o.type === "grant" ? (
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <ShieldMinus className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm text-gray-800">{o.name}</span>
                  <Badge
                    variant="outline"
                    className={o.type === "grant" ? "text-green-700 border-green-200" : "text-red-700 border-red-200"}
                  >
                    {o.type}
                  </Badge>
                  {o.scope && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {o.scope}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleClear(o.name)}
                  disabled={clearingName === o.name}
                  className="h-7 w-7 p-0 text-gray-500 hover:text-red-600"
                  title="Clear override"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Effective permissions */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Effective Permissions ({effective.length})
        </h3>
        {/*
          NOTE: rendering here assumes each entry has at least a `name`.
          Confirm the exact shape of PermissionService::allPermissionsFor()
          and adjust the fields shown (e.g. `scope`, `source`) if they differ.
        */}
        {effective.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">
            This user has no effective permissions
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {effective.map((p) => (
              <span
                key={p.name}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                title={p.source ? `via ${p.source}` : undefined}
              >
                {p.name}
                {p.scope ? ` · ${p.scope}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}