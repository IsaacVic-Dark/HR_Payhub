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
import { OrganizationType } from "@/services/api/organization";
import { Building2, MapPin, Landmark, Clock, CreditCard  } from "lucide-react";

interface OrganizationViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: OrganizationType | null;
}

export function OrganizationViewDrawer({
  open,
  onOpenChange,
  organization,
}: OrganizationViewDrawerProps) {
  if (!organization) return null;

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

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
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">{organization.name}</DrawerTitle>
              <DrawerDescription>
                <Badge className={organization.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                  {organization.is_active ? "Active" : "Inactive"}
                </Badge>
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Building2 className="h-4 w-4 mr-2" />
              Organization Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-600">Legal Type</span><p className="font-medium">{organization.legal_type || "—"}</p></div>
              <div><span className="text-gray-600">Registration No.</span><p className="font-medium">{organization.registration_number || "—"}</p></div>
              <div><span className="text-gray-600">KRA PIN</span><p className="font-medium">{organization.kra_pin || "—"}</p></div>
              <div><span className="text-gray-600">NSSF Number</span><p className="font-medium">{organization.nssf_number || "—"}</p></div>
              <div><span className="text-gray-600">NHIF Number</span><p className="font-medium">{organization.nhif_number || "—"}</p></div>
              <div><span className="text-gray-600">Currency</span><p className="font-medium">{organization.currency}</p></div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Location & Contact
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-600">Location</span><p className="font-medium">{organization.location || "—"}</p></div>
              <div><span className="text-gray-600">Physical Address</span><p className="font-medium">{organization.physical_address || "—"}</p></div>
              <div><span className="text-gray-600">Official Email</span><p className="font-medium">{organization.official_email || "—"}</p></div>
              <div><span className="text-gray-600">Primary Phone</span><p className="font-medium">{organization.primary_phone || "—"}</p></div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <Landmark className="h-4 w-4 mr-2" />
              Payroll & Banking
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-600">Payroll Schedule</span><p className="font-medium">{organization.payroll_schedule}</p></div>
              <div><span className="text-gray-600">Default Payday</span><p className="font-medium">{organization.default_payday ?? "—"}</p></div>
              <div><span className="text-gray-600">Bank Account Name</span><p className="font-medium">{organization.bank_account_name || "—"}</p></div>
              <div><span className="text-gray-600">Bank Account No.</span><p className="font-medium">{organization.bank_account_number || "—"}</p></div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Subscription
            </h3>
            {organization.subscription ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Plan</span>
                  <p className="font-medium">{organization.subscription.name}</p>
                </div>
                <div>
                  <span className="text-gray-600">Status</span>
                  <p className="font-medium">
                    <Badge
                      className={
                        organization.subscription.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {organization.subscription.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Billing Cycle</span>
                  <p className="font-medium capitalize">{organization.subscription.billing_cycle}</p>
                </div>
                <div>
                  <span className="text-gray-600">
                    {organization.subscription.status === "trialing" ? "Trial Ends" : "Renews"}
                  </span>
                  <p className="font-medium">
                    {organization.subscription.status === "trialing"
                      ? organization.subscription.trial_ends_at
                        ? formatDateTime(organization.subscription.trial_ends_at)
                        : "—"
                      : organization.subscription.current_period_ends_at
                      ? formatDateTime(organization.subscription.current_period_ends_at)
                      : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No active subscription</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
            <div>
              <span className="text-gray-600 flex items-center"><Clock className="h-3 w-3 mr-1" />Created At</span>
              <p className="font-medium">{formatDateTime(organization.created_at)}</p>
            </div>
            <div>
              <span className="text-gray-600 flex items-center"><Clock className="h-3 w-3 mr-1" />Last Updated</span>
              <p className="font-medium">{formatDateTime(organization.updated_at)}</p>
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t p-6">
          <DrawerClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}