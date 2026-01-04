"use client";

import { useState } from "react";
import {
  IconReceipt,
  IconCoin,
  IconGift,
  IconPlane,
  IconArrowForward,
  IconRefresh,
  IconPlus,
  IconEdit,
  IconTrash,
  IconPercentage,
  IconCurrencyDollar,
  IconBuilding,
  IconBell,
  IconCreditCard,
  IconDownload,
} from "@tabler/icons-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useOrganization } from "./components/organization-actions";

// Dummy data for different config types
const dummyConfigs = {
  tax: [
    {
      id: 1,
      name: "PAYE",
      percentage: 30.0,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 2,
      name: "NSSF",
      percentage: null,
      fixed_amount: 200.0,
      is_active: true,
    },
    {
      id: 3,
      name: "NHIF",
      percentage: null,
      fixed_amount: 1700.0,
      is_active: true,
    },
    {
      id: 4,
      name: "Housing Levy",
      percentage: 1.5,
      fixed_amount: null,
      is_active: true,
    },
  ],
  deduction: [
    {
      id: 5,
      name: "Pension Contribution",
      percentage: 5.0,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 6,
      name: "Union Dues",
      percentage: null,
      fixed_amount: 500.0,
      is_active: true,
    },
    {
      id: 7,
      name: "Medical Insurance",
      percentage: null,
      fixed_amount: 3000.0,
      is_active: true,
    },
  ],
  loan: [
    {
      id: 8,
      name: "Emergency Loan",
      percentage: 10.0,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 9,
      name: "Asset Loan",
      percentage: 12.5,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 10,
      name: "Education Loan",
      percentage: 8.0,
      fixed_amount: null,
      is_active: true,
    },
  ],
  benefit: [
    {
      id: 11,
      name: "Transport Allowance",
      percentage: null,
      fixed_amount: 5000.0,
      is_active: true,
    },
    {
      id: 12,
      name: "Housing Allowance",
      percentage: 20.0,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 13,
      name: "Meal Allowance",
      percentage: null,
      fixed_amount: 3000.0,
      is_active: true,
    },
  ],
  per_diem: [
    {
      id: 14,
      name: "Local Travel",
      percentage: null,
      fixed_amount: 2500.0,
      is_active: true,
    },
    {
      id: 15,
      name: "International Travel",
      percentage: null,
      fixed_amount: 15000.0,
      is_active: true,
    },
    {
      id: 16,
      name: "Upcountry Travel",
      percentage: null,
      fixed_amount: 4000.0,
      is_active: true,
    },
  ],
  advance: [
    {
      id: 17,
      name: "Salary Advance",
      percentage: 50.0,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 18,
      name: "Travel Advance",
      percentage: null,
      fixed_amount: 10000.0,
      is_active: true,
    },
  ],
  refund: [
    {
      id: 19,
      name: "Medical Refund",
      percentage: 100.0,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 20,
      name: "Travel Refund",
      percentage: 100.0,
      fixed_amount: null,
      is_active: true,
    },
    {
      id: 21,
      name: "Equipment Refund",
      percentage: null,
      fixed_amount: 5000.0,
      is_active: true,
    },
  ],
};

const sidebarItems = [
  { key: "profile", label: "My Profile" },
  { key: "tax", label: "Tax Configuration" },
  { key: "deduction", label: "Deductions" },
  { key: "loan", label: "Loans" },
  { key: "benefit", label: "Benefits" },
  { key: "per_diem", label: "Per Diem" },
  { key: "advance", label: "Advances" },
  { key: "refund", label: "Refunds" },
  { key: "notifications", label: "Notifications" },
  { key: "billing", label: "Billing" },
  { key: "export", label: "Data Export" },
];

export default function OrganizationConfigPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [configs, setConfigs] = useState(dummyConfigs);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingField, setEditingField] = useState<string>("");
  const [editValue, setEditValue] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { organization, isLoading, updateOrganization } = useOrganization();

  const activeConfigs = configs[activeSection as keyof typeof configs] || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const toggleActive = (id: number) => {
    setConfigs((prev) => ({
      ...prev,
      [activeSection]: prev[activeSection as keyof typeof prev].map((config) =>
        config.id === id ? { ...config, is_active: !config.is_active } : config
      ),
    }));
  };

  const deleteConfig = (id: number) => {
    setConfigs((prev) => ({
      ...prev,
      [activeSection]: prev[activeSection as keyof typeof prev].filter(
        (config) => config.id !== id
      ),
    }));
  };

  const handleEditClick = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingField || !editValue.trim()) {
      toast.error("Please enter a value");
      return;
    }

    setLoading(true);
    try {
      const success = await updateOrganization(editingField, editValue.trim());
      if (success) {
        setShowEditModal(false);
        setEditingField("");
        setEditValue("");
      }
    } catch (error) {
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const getFieldLabel = (field: string): string => {
    const fieldLabels: Record<string, string> = {
      name: "Organization Name",
      kra_pin: "KRA PIN",
      nssf_number: "NSSF Number",
      nhif_number: "NHIF Number",
      payroll_schedule: "Payroll Schedule",
      primary_phone: "Primary Phone",
      official_email: "Official Email",
      physical_address: "Physical Address",
      postal_address: "Postal Address",
    };
    return fieldLabels[field] || field.replace(/_/g, " ");
  };

  const getFieldDescription = (field: string): string => {
    const descriptions: Record<string, string> = {
      name: "The name of your organization",
      kra_pin: "Your organization's tax identification number",
      nssf_number: "National Social Security Fund number",
      nhif_number: "National Hospital Insurance Fund number",
      payroll_schedule: "Default payroll processing frequency",
      primary_phone: "Main contact phone number",
      official_email: "Official organization email",
      physical_address: "Physical location address",
      postal_address: "Mailing address",
    };
    return descriptions[field] || `Edit ${field.replace(/_/g, " ")}`;
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">
            {/* Main Container */}
            <div className="">
              <div className="mt-4 mx-6 space-y-2">
                <h1 className="text-2xl font-medium">Settings</h1>
                <p className="text-base text-muted-foreground">
                  This page has all configurations related to your company:
                </p>
              </div>
              {/* Two Column Layout */}
              <div className="relative flex gap-6 mx-6 my-6">
                {/* Left Sidebar Navigation */}
                <div className="w-64 flex-shrink-0">
                  <div className="p-4">
                    <div className="space-y-1">
                      {sidebarItems.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => setActiveSection(item.key)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            activeSection === item.key
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <Separator className="my-4" />

                    <button className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors">
                      Delete Organization
                    </button>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="absolute left-[16rem] top-6 bottom-6 w-px bg-border" />

                {/* Right Content Area */}
                <div className="flex-1">
                  <div className="pl-6">
                    {activeSection === "profile" ? (
                      <ProfileSection 
                        organization={organization}
                        isLoading={isLoading}
                        onEditClick={handleEditClick}
                      />
                    ) : activeSection === "notifications" ? (
                      <NotificationsSection />
                    ) : activeSection === "billing" ? (
                      <BillingSection />
                    ) : activeSection === "export" ? (
                      <DataExportSection />
                    ) : (
                      <div className="p-6">
                        {/* Header */}
                        <div className="mb-6">
                          <h2 className="text-lg font-semibold mb-4">
                            {
                              sidebarItems.find(
                                (item) => item.key === activeSection
                              )?.label
                            }
                          </h2>
                          <Separator />
                        </div>

                        {/* Config List */}
                        <div className="space-y-6">
                          {activeConfigs.map((config) => (
                            <div key={config.id}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-medium">
                                      {config.name}
                                    </h3>
                                    <Switch
                                      checked={config.is_active}
                                      onCheckedChange={() => toggleActive(config.id)}
                                      size="sm"
                                    />
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-3">
                                    {config.percentage !== null
                                      ? `This configuration applies ${config.percentage}% calculation`
                                      : `This configuration uses a fixed amount of ${formatCurrency(
                                          config.fixed_amount || 0
                                        )}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm">
                                    <IconEdit size={14} className="mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteConfig(config.id)}
                                  >
                                    <IconTrash size={14} />
                                  </Button>
                                </div>
                              </div>
                              <Separator className="mt-4" />
                            </div>
                          ))}

                          {activeConfigs.length === 0 && (
                            <div className="py-12 text-center">
                              <p className="text-sm text-muted-foreground mb-4">
                                No configurations found
                              </p>
                              <Button onClick={() => setShowAddModal(true)}>
                                <IconPlus size={16} className="mr-2" />
                                Add Configuration
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Configuration</DialogTitle>
            <DialogDescription>
              Create a new {activeSection} configuration for your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Configuration name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Calculation Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input id="value" type="number" placeholder="Enter value" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddModal(false)}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {getFieldLabel(editingField)}</DialogTitle>
            <DialogDescription>
              {getFieldDescription(editingField)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">
                {getFieldLabel(editingField)}
              </Label>
              <Input
                id="edit-value"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={`Enter ${getFieldLabel(editingField).toLowerCase()}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditModal(false);
              setEditingField("");
              setEditValue("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

interface ProfileSectionProps {
  organization: any;
  isLoading: boolean;
  onEditClick: (field: string, value: string) => void;
}

function ProfileSection({ organization, isLoading, onEditClick }: ProfileSectionProps) {
  if (isLoading) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <Separator className="mb-6" />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-48 bg-muted rounded animate-pulse mb-3"></div>
                  <div className="h-5 w-24 bg-muted rounded animate-pulse"></div>
                </div>
                <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
              </div>
              <Separator className="mt-6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <Separator className="mb-6" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">No organization data found</p>
        </div>
      </div>
    );
  }

  const profileFields = [
    { key: "name", label: "Organization Name", description: "The name of your organization" },
    { key: "kra_pin", label: "KRA PIN", description: "Your organization's tax identification number" },
    { key: "nssf_number", label: "NSSF Number", description: "National Social Security Fund number" },
    { key: "nhif_number", label: "NHIF Number", description: "National Hospital Insurance Fund number" },
    { key: "payroll_schedule", label: "Payroll Schedule", description: "Default payroll processing frequency" },
    { key: "primary_phone", label: "Primary Phone", description: "Main contact phone number" },
    { key: "official_email", label: "Official Email", description: "Official organization email" },
    { key: "physical_address", label: "Physical Address", description: "Physical location address" },
    { key: "postal_address", label: "Postal Address", description: "Mailing address" },
  ];

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Profile</h2>
      <Separator className="mb-6" />

      <div className="space-y-6">
        {profileFields.map((field) => (
          <div key={field.key}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium mb-1">{field.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {field.description}
                </p>
                <p className="mt-2">
                  {organization[field.key as keyof typeof organization] || "Not set"}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEditClick(field.key, organization[field.key as keyof typeof organization] || "")}
              >
                <IconEdit size={14} className="mr-1" />
                Edit
              </Button>
            </div>
            <Separator className="mt-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Notifications</h2>
      <Separator className="mb-6" />

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Email Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Send email notifications for payroll processing
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator className="mt-6" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Leave Approvals</h3>
              <p className="text-sm text-muted-foreground">
                Notify when employees request leave
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator className="mt-6" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Payroll Reminders</h3>
              <p className="text-sm text-muted-foreground">
                Get reminded before payroll processing dates
              </p>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingSection() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Billing</h2>
      <Separator className="mb-6" />

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Current Plan</h3>
              <p className="text-sm text-muted-foreground">
                Your subscription details
              </p>
              <div className="mt-2">
                <p className="font-medium">Professional Plan</p>
                <p className="text-sm text-muted-foreground">
                  KES 15,000/month
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Upgrade
            </Button>
          </div>
          <Separator className="mt-6" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Payment Method</h3>
              <p className="text-sm text-muted-foreground">
                Manage your payment methods
              </p>
              <p className="mt-2">M-Pesa: +254 712 345 678</p>
            </div>
            <Button variant="outline" size="sm">
              <IconEdit size={14} className="mr-1" />
              Change
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataExportSection() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Data Export</h2>
      <Separator className="mb-6" />

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Export Payroll Data</h3>
              <p className="text-sm text-muted-foreground">
                Download all payroll records in CSV format
              </p>
            </div>
            <Button variant="outline" size="sm">
              <IconDownload size={14} className="mr-1" />
              Export
            </Button>
          </div>
          <Separator className="mt-6" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Export Employee Records</h3>
              <p className="text-sm text-muted-foreground">
                Download all employee data in Excel format
              </p>
            </div>
            <Button variant="outline" size="sm">
              <IconDownload size={14} className="mr-1" />
              Export
            </Button>
          </div>
          <Separator className="mt-6" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Export Leave Records</h3>
              <p className="text-sm text-muted-foreground">
                Download leave history in PDF format
              </p>
            </div>
            <Button variant="outline" size="sm">
              <IconDownload size={14} className="mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}