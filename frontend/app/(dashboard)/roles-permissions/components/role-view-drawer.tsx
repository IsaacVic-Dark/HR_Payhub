"use client";

import { useMemo } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleType } from "@/services/api/role";
import { ShieldCheck, Users, Lock, Pencil, Trash2 } from "lucide-react";

interface RoleViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleType | null;
  onViewDetails?: (role: RoleType) => void;
  onEdit?: (role: RoleType) => void;
  onDelete?: (role: RoleType) => void;
}

export function RoleViewDrawer({
  open,
  onOpenChange,
  role,
  onViewDetails,
  onEdit,
  onDelete,
}: RoleViewDrawerProps) {
  const moduleBreakdown = useMemo(() => {
    if (!role) return [];
    const counts: Record<string, number> = {};
    role.permissions.forEach((p) => {
      counts[p.module] = (counts[p.module] ?? 0) + 1;
    });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }, [role]);

  if (!role) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DrawerHeader className="border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold flex items-center gap-2">
                {role.name}
                {role.is_system && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" /> System
                  </Badge>
                )}
              </DrawerTitle>
              <DrawerDescription>Role Details and Permissions</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Role Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center text-sm">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Role Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Slug</span>
                <p className="font-medium mt-0.5 font-mono">{role.slug}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Assigned Users</span>
                <p className="font-medium mt-0.5">{role.user_count}</p>
              </div>
              {role.description && (
                <div className="col-span-2">
                  <span className="text-gray-500 text-xs">Description</span>
                  <p className="font-medium mt-0.5">{role.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Permissions summary */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center text-sm">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Permissions ({role.permissions.length})
            </h3>
            {moduleBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No permissions assigned</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {moduleBreakdown.map(([mod, count]) => (
                  <span
                    key={mod}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize"
                  >
                    {mod.replace(/_/g, " ")} · {count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Workforce */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center text-sm">
              <Users className="h-4 w-4 mr-2" />
              Users with this role
            </h3>
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-3xl font-bold text-blue-600">{role.user_count}</span>
              <span className="text-sm text-blue-700">
                user{role.user_count === 1 ? "" : "s"} assigned
              </span>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <div className="flex gap-2">
            {onViewDetails && (
              <Button
                onClick={() => {
                  onViewDetails(role);
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                View Full Details
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" onClick={() => onEdit(role)} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {onDelete && !role.is_system && (
              <Button
                variant="outline"
                onClick={() => onDelete(role)}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}