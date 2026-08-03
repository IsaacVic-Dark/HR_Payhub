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
import { UserType, ROLE_LABELS } from "@/app/(dashboard)/users/components/data-table-users";
import { UserCircle, Mail, ShieldCheck, Building2, Clock } from "lucide-react";

interface UserViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserType | null;
}

export function UserViewDrawer({
  open,
  onOpenChange,
  user,
}: UserViewDrawerProps) {
  if (!user) return null;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      active: { color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { color: "bg-gray-100 text-gray-800", label: "Inactive" },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return <Badge className={config.color}>{config.label}</Badge>;
  };

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
              <UserCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                User Details
              </DrawerTitle>
              <DrawerDescription>{user.full_name}</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Account Information */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <UserCircle className="h-4 w-4 mr-2" />
              Account Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Full Name</span>
                <p className="font-medium">{user.full_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Username</span>
                <p className="font-medium">{user.username}</p>
              </div>
              <div>
                <span className="text-gray-600">User ID</span>
                <p className="font-medium">{user.id}</p>
              </div>
              <div>
                <span className="text-gray-600">Status</span>
                <div className="mt-1">{getStatusBadge(user.status)}</div>
              </div>
            </div>
          </div>

          {/* Contact & Role */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Role &amp; Access
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 flex items-center">
                  <Mail className="h-3 w-3 mr-1" /> Email
                </span>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <span className="text-gray-600">Role</span>
                <p className="font-medium">{ROLE_LABELS[user.role]}</p>
              </div>
              <div>
                <span className="text-gray-600 flex items-center">
                  <Building2 className="h-3 w-3 mr-1" /> Department
                </span>
                <p className="font-medium">{user.department || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600 flex items-center">
                  <Clock className="h-3 w-3 mr-1" /> Last Login
                </span>
                <p className="font-medium">{formatDateTime(user.last_login)}</p>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-600">Created At</span>
              <p className="font-medium">{formatDateTime(user.created_at)}</p>
            </div>
            <div>
              <span className="text-gray-600">Last Updated</span>
              <p className="font-medium">{formatDateTime(user.updated_at)}</p>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <DrawerClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}