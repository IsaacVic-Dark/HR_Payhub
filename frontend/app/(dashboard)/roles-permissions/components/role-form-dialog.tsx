"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  roleAPI,
  RoleDetailType,
  RoleType,
  PermissionScope,
  RolePermissionInput,
} from "@/services/api/role";
import { permissionAPI, PermissionCatalog } from "@/services/api/permission";
import { toast } from "sonner";

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: number;
  role?: RoleType | RoleDetailType | null; // if provided → edit mode
  onSuccess: () => void;
}

const SCOPES: { value: PermissionScope; label: string }[] = [
  { value: "own", label: "Own" },
  { value: "team", label: "Team" },
  { value: "department", label: "Department" },
  { value: "all", label: "All" },
];

// permission name -> selected scope (absence of a key = not granted)
type SelectionMap = Record<string, PermissionScope>;

export function RoleFormDialog({
  open,
  onOpenChange,
  organizationId,
  role,
  onSuccess,
}: RoleFormDialogProps) {
  const isEdit = !!role;
  const isSystem = !!role?.is_system;

  const [form, setForm] = useState({ name: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [catalog, setCatalog] = useState<PermissionCatalog>({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selection, setSelection] = useState<SelectionMap>({});
  const [moduleFilter, setModuleFilter] = useState("");

  // Load the platform permission catalog whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCatalogLoading(true);
    permissionAPI.getCatalog(organizationId).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) {
        setCatalog(response.data);
      } else {
        toast.error(response.error || "Failed to load permissions catalog");
      }
      setCatalogLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  // Seed form + selection from the role being edited (or reset for create)
  useEffect(() => {
    if (role) {
      setForm({ name: role.name, description: role.description ?? "" });
      const seeded: SelectionMap = {};
      role.permissions.forEach((p) => {
        seeded[p.name] = p.scope;
      });
      setSelection(seeded);
    } else {
      setForm({ name: "", description: "" });
      setSelection({});
    }
    setErrors({});
    setModuleFilter("");
  }, [role, open]);

  const modules = useMemo(() => Object.keys(catalog).sort(), [catalog]);
  const selectedCount = Object.keys(selection).length;

  const filteredModules = useMemo(() => {
    if (!moduleFilter.trim()) return modules;
    const q = moduleFilter.trim().toLowerCase();
    return modules.filter(
      (m) =>
        m.toLowerCase().includes(q) ||
        catalog[m].some((p) => p.name.toLowerCase().includes(q))
    );
  }, [modules, catalog, moduleFilter]);

  const togglePermission = (name: string, checked: boolean) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (checked) {
        next[name] = next[name] ?? "all";
      } else {
        delete next[name];
      }
      return next;
    });
  };

  const setScope = (name: string, scope: PermissionScope) => {
    setSelection((prev) => ({ ...prev, [name]: scope }));
  };

  const toggleModule = (mod: string, checked: boolean) => {
    setSelection((prev) => {
      const next = { ...prev };
      catalog[mod].forEach((p) => {
        if (checked) {
          next[p.name] = next[p.name] ?? "all";
        } else {
          delete next[p.name];
        }
      });
      return next;
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Role name is required";
    return newErrors;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const permissions: RolePermissionInput[] = Object.entries(selection).map(
      ([name, scope]) => ({ name, scope })
    );

    setLoading(true);
    try {
      let response;

      if (isEdit && role) {
        response = await roleAPI.updateRole(organizationId, role.id, {
          // Backend rejects a name change on system roles — omit it entirely
          // rather than send a value that will be silently blocked.
          ...(isSystem ? {} : { name: form.name.trim() }),
          description: form.description.trim() || undefined,
          permissions,
        });
      } else {
        response = await roleAPI.createRole(organizationId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          permissions,
        });
      }

      if (response.success) {
        toast.success(isEdit ? "Role updated successfully" : "Role created successfully");
        onSuccess();
        onOpenChange(false);
      } else {
        if (response.errors) {
          const apiErrors: Record<string, string> = {};
          Object.entries(response.errors).forEach(([k, v]) => {
            apiErrors[k] = Array.isArray(v) ? v[0] : String(v);
          });
          setErrors(apiErrors);
        }
        toast.error(response.error || "Operation failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? "Edit Role" : "Create Role"}
            {isSystem && <Badge variant="outline">System role</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto pr-1">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Regional Lead"
              disabled={isSystem}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            {isSystem && (
              <p className="text-xs text-gray-500 mt-1">
                Default system roles cannot be renamed, but their permissions can still be changed.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700">
                Permissions <span className="text-gray-400 font-normal">({selectedCount} selected)</span>
              </label>
              <input
                type="text"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                placeholder="Filter modules/permissions…"
                className="w-48 px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {catalogLoading ? (
              <p className="text-sm text-gray-500 py-4 text-center">Loading permissions…</p>
            ) : filteredModules.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center italic">No permissions match</p>
            ) : (
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {filteredModules.map((mod) => {
                  const perms = catalog[mod];
                  const allChecked = perms.every((p) => p.name in selection);
                  const someChecked = perms.some((p) => p.name in selection);

                  return (
                    <div key={mod} className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = someChecked && !allChecked;
                          }}
                          onChange={(e) => toggleModule(mod, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm font-semibold capitalize text-gray-800">
                          {mod.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="pl-6 space-y-1.5">
                        {perms.map((p) => {
                          const checked = p.name in selection;
                          return (
                            <div
                              key={p.name}
                              className="flex items-center justify-between gap-3 py-0.5"
                            >
                              <label className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => togglePermission(p.name, e.target.checked)}
                                  className="h-4 w-4 shrink-0"
                                />
                                <span className="truncate" title={p.description ?? p.name}>
                                  {p.name}
                                </span>
                              </label>
                              <select
                                value={selection[p.name] ?? "all"}
                                onChange={(e) => setScope(p.name, e.target.value as PermissionScope)}
                                disabled={!checked}
                                className="shrink-0 px-2 py-1 border border-gray-300 rounded-md text-xs bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {SCOPES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || catalogLoading}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}