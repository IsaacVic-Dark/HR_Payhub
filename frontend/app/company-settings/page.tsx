"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
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
import { UIConfigItem } from "@/services/api/organization-config";
import { toast } from "sonner";
import { useOrganization } from "./components/organization-actions";
import { useOrganizationConfig } from "@/hooks/useOrganizationConfig";

const sidebarItems = [
  { key: "profile", label: "My Profile", icon: IconBuilding },
  { key: "tax", label: "Tax Configuration", icon: IconReceipt },
  { key: "deduction", label: "Deductions", icon: IconPercentage },
  { key: "loan", label: "Loans", icon: IconCurrencyDollar },
  { key: "benefit", label: "Benefits", icon: IconGift },
  { key: "per_diem", label: "Per Diem", icon: IconPlane },
  { key: "advance", label: "Advances", icon: IconArrowForward },
  { key: "refund", label: "Refunds", icon: IconCreditCard },
  { key: "notifications", label: "Notifications", icon: IconBell },
  { key: "billing", label: "Billing", icon: IconCreditCard },
  { key: "export", label: "Data Export", icon: IconDownload },
];

// Loading Skeleton Component
const ConfigSkeleton = () => (
  <div className="p-6 space-y-6">
    <div className="mb-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse mb-4"></div>
      <Separator />
    </div>
    {[1, 2, 3].map((i) => (
      <div key={i}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
              <div className="h-5 w-12 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="h-4 w-64 bg-muted rounded animate-pulse mb-3"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
            <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        <Separator className="mt-4" />
      </div>
    ))}
  </div>
);

// Profile Section Component
interface ProfileSectionProps {
  organization: any;
  isLoading: boolean;
  onEditClick: (field: string, value: string) => void;
}

function ProfileSection({
  organization,
  isLoading,
  onEditClick,
}: ProfileSectionProps) {
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
    {
      key: "name",
      label: "Organization Name",
      description: "The name of your organization",
    },
    {
      key: "kra_pin",
      label: "KRA PIN",
      description: "Your organization's tax identification number",
    },
    {
      key: "nssf_number",
      label: "NSSF Number",
      description: "National Social Security Fund number",
    },
    {
      key: "nhif_number",
      label: "NHIF Number",
      description: "National Hospital Insurance Fund number",
    },
    {
      key: "payroll_schedule",
      label: "Payroll Schedule",
      description: "Default payroll processing frequency",
    },
    {
      key: "primary_phone",
      label: "Primary Phone",
      description: "Main contact phone number",
    },
    {
      key: "official_email",
      label: "Official Email",
      description: "Official organization email",
    },
    {
      key: "physical_address",
      label: "Physical Address",
      description: "Physical location address",
    },
    {
      key: "postal_address",
      label: "Postal Address",
      description: "Mailing address",
    },
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
                  {organization[field.key as keyof typeof organization] ||
                    "Not set"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onEditClick(
                    field.key,
                    organization[field.key as keyof typeof organization] || "",
                  )
                }
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

// Notifications Section Component
function NotificationsSection() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Notifications</h2>
      <Separator className="mb-6" />
      <div className="space-y-6">
        {[
          {
            title: "Email Notifications",
            description: "Send email notifications for payroll processing",
            defaultChecked: true,
          },
          {
            title: "Leave Approvals",
            description: "Notify when employees request leave",
            defaultChecked: true,
          },
          {
            title: "Payroll Reminders",
            description: "Get reminded before payroll processing dates",
            defaultChecked: false,
          },
        ].map((item, index) => (
          <div key={index}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Switch defaultChecked={item.defaultChecked} />
            </div>
            <Separator className="mt-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Billing Section Component
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

// Data Export Section Component
function DataExportSection() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Data Export</h2>
      <Separator className="mb-6" />
      <div className="space-y-6">
        {[
          {
            title: "Export Payroll Data",
            description: "Download all payroll records in CSV format",
          },
          {
            title: "Export Employee Records",
            description: "Download all employee data in Excel format",
          },
          {
            title: "Export Leave Records",
            description: "Download leave history in PDF format",
          },
        ].map((item, index) => (
          <div key={index}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Button variant="outline" size="sm">
                <IconDownload size={14} className="mr-1" />
                Export
              </Button>
            </div>
            {index < 2 && <Separator className="mt-6" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Component
export default function OrganizationConfigPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("profile");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingField, setEditingField] = useState<string>("");
  const [editValue, setEditValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showEditConfigModal, setShowEditConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<{
    id: number | null;
    name: string;
    calculationType: "percentage" | "fixed";
    value: string;
  }>({
    id: null,
    name: "",
    calculationType: "percentage",
    value: "",
  });

  // State for add modal
  const [newConfig, setNewConfig] = useState({
    name: "",
    calculationType: "percentage" as "percentage" | "fixed",
    value: "",
  });

  const { organization, isLoading, updateOrganization } = useOrganization();
  const {
    configs,
    loading: configsLoading,
    error,
    createConfig,
    deleteConfig,
    toggleActive,
    fetchConfigs,
    updateConfig,
  } = useOrganizationConfig();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddConfig = async () => {
    if (!newConfig.name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (!newConfig.value.trim()) {
      toast.error("Please enter a value");
      return;
    }

    // Build config data based on calculation type
    const configData: any = {
      config_type: activeSection,
      name: newConfig.name,
      is_active: 1,
    };

    if (newConfig.calculationType === "percentage") {
      configData.percentage = parseFloat(newConfig.value);
      configData.fixed_amount = null; // Explicitly set to null
    } else {
      configData.fixed_amount = parseFloat(newConfig.value);
      configData.percentage = null; // Explicitly set to null
    }

    const response = await createConfig(configData);

    if (response.success) {
      setShowAddModal(false);
      setNewConfig({
        name: "",
        calculationType: "percentage",
        value: "",
      });
    }
  };

  const handleDeleteConfig = async (id: number) => {
    const response = await deleteConfig(id);
    if (response.success) {
      toast.success("Configuration deleted successfully");
    }
  };

  const handleToggleActive = async (id: number, currentIsActive: boolean) => {
    await toggleActive(id, currentIsActive, activeSection);
  };

  const handleEditClick = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
    setShowEditModal(true);
  };

  const handleEditConfigClick = (config: UIConfigItem) => {
    // Only allow editing active configs
    if (!config.is_active) {
      toast.error("Cannot edit inactive configurations");
      return;
    }

    setEditingConfig({
      id: config.id,
      name: config.name,
      calculationType: config.percentage !== null ? "percentage" : "fixed",
      value:
        config.percentage !== null
          ? config.percentage.toString()
          : (config.fixed_amount || 0).toString(),
    });
    setShowEditConfigModal(true);
  };

  const handleSaveEditConfig = async () => {
    console.log("handleSaveEditConfig called");

    if (!editingConfig.name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (!editingConfig.value.trim()) {
      toast.error("Please enter a value");
      return;
    }

    if (!editingConfig.id) {
      toast.error("Configuration ID not found");
      return;
    }

    // Build config data based on calculation type
    const configData: any = {
      name: editingConfig.name,
      is_active: 1, // Keep it active
    };

    if (editingConfig.calculationType === "percentage") {
      configData.percentage = parseFloat(editingConfig.value);
      configData.fixed_amount = null; // Explicitly set to null
    } else {
      configData.fixed_amount = parseFloat(editingConfig.value);
      configData.percentage = null; // Explicitly set to null
    }

    console.log("Sending update with data:", configData); // Debug log

    try {
      // Use the updateConfig function from your hook
      const response = await updateConfig(editingConfig.id, configData);

      console.log("Update response:", response); // Debug log

      if (response.success) {
        toast.success("Configuration updated successfully!");
        setShowEditConfigModal(false);
        setEditingConfig({
          id: null,
          name: "",
          calculationType: "percentage",
          value: "",
        });
      } else {
        toast.error(response.error || "Failed to update configuration");
      }
    } catch (error) {
      console.error("Update error:", error); // Debug log
      toast.error("An unexpected error occurred");
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

  // Get active configs based on section
  const getActiveConfigs = () => {
    const configTypeMap: Record<string, keyof typeof configs> = {
      tax: "tax",
      deduction: "deduction",
      loan: "loan",
      benefit: "benefit",
      per_diem: "per_diem",
      advance: "advance",
      refund: "refund",
    };

    const configType = configTypeMap[activeSection];
    return configType ? configs[configType] : [];
  };

  const activeConfigs = getActiveConfigs();

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
            <div className="">
              <div className="mt-4 mx-6 space-y-2">
                <h1 className="text-2xl font-medium">Settings</h1>
                <p className="text-base text-muted-foreground">
                  This page has all configurations related to your company:
                </p>
              </div>

              <div className="relative flex gap-6 mx-6 my-6">
                {/* Left Sidebar Navigation */}
                <div className="w-64 flex-shrink-0">
                  <div className="p-4">
                    <div className="space-y-1">
                      {sidebarItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                          <button
                            key={item.key}
                            onClick={() => setActiveSection(item.key)}
                            className={`w-full flex items-center text-left px-3 py-2 rounded-md text-sm transition-colors ${
                              activeSection === item.key
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <IconComponent size={16} className="mr-2" />
                            {item.label}
                          </button>
                        );
                      })}
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
                    ) : configsLoading ? (
                      <ConfigSkeleton />
                    ) : error ? (
                      <div className="p-6">
                        <div className="mb-6">
                          <h2 className="text-lg font-semibold mb-4">
                            {
                              sidebarItems.find(
                                (item) => item.key === activeSection,
                              )?.label
                            }
                          </h2>
                          <Separator />
                        </div>
                        <div className="py-12 text-center">
                          <p className="text-sm text-destructive mb-4">
                            {error}
                          </p>
                          <Button onClick={fetchConfigs}>
                            <IconRefresh size={16} className="mr-2" />
                            Retry
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6">
                        {/* Header */}
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">
                              {
                                sidebarItems.find(
                                  (item) => item.key === activeSection,
                                )?.label
                              }
                            </h2>
                            <Button
                              onClick={() => setShowAddModal(true)}
                              size="sm"
                            >
                              <IconPlus size={16} className="mr-2" />
                              Add Configuration
                            </Button>
                          </div>
                          <Separator />
                        </div>

                        {/* Config List */}
                        <div className="space-y-6">
                          {activeConfigs.length > 0 ? (
                            activeConfigs.map((config) => (
                              <div key={config.id}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <h3 className="font-medium">
                                        {config.name}
                                      </h3>
                                      <Switch
                                        checked={config.is_active}
                                        onCheckedChange={() =>
                                          handleToggleActive(
                                            config.id,
                                            config.is_active,
                                          )
                                        }
                                        size="sm"
                                      />
                                      {!config.is_active && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          Inactive
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {config.percentage !== null
                                        ? `This configuration applies ${config.percentage}% calculation`
                                        : `This configuration uses a fixed amount of ${formatCurrency(
                                            config.fixed_amount || 0,
                                          )}`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleEditConfigClick(config)
                                      }
                                      disabled={!config.is_active} // Disable for inactive configs
                                    >
                                      <IconEdit size={14} className="mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() =>
                                        handleDeleteConfig(config.id)
                                      }
                                    >
                                      <IconTrash size={14} />
                                    </Button>
                                  </div>
                                </div>
                                <Separator className="mt-4" />
                              </div>
                            ))
                          ) : (
                            <div className="py-12 text-center">
                              <div className="mb-4">
                                <IconReceipt
                                  size={48}
                                  className="mx-auto text-muted-foreground mb-4"
                                />
                                <p className="text-sm text-muted-foreground mb-4">
                                  No {activeSection} configurations found
                                </p>
                              </div>
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

      {/* Add Configuration Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Configuration</DialogTitle>
            <DialogDescription>
              Create a new {activeSection} configuration for your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Configuration Name</Label>
              <Input
                id="name"
                placeholder="e.g., PAYE, NSSF, etc."
                value={newConfig.name}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Calculation Type</Label>
              <Select
                value={newConfig.calculationType}
                onValueChange={(value: "percentage" | "fixed") =>
                  setNewConfig({
                    ...newConfig,
                    calculationType: value,
                    value: "",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select calculation type" />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="percentage">
                    <div className="flex items-center">
                      <IconPercentage size={14} className="mr-2" />
                      Percentage
                    </div>
                  </SelectItem>
                  <SelectItem value="fixed">
                    <div className="flex items-center">
                      <IconCurrencyDollar size={14} className="mr-2" />
                      Fixed Amount
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">
                {newConfig.calculationType === "percentage"
                  ? "Percentage Value (%)"
                  : "Fixed Amount (KES)"}
              </Label>
              <Input
                id="value"
                type="number"
                placeholder={
                  newConfig.calculationType === "percentage"
                    ? "Enter percentage"
                    : "Enter amount"
                }
                value={newConfig.value}
                onChange={(e) =>
                  setNewConfig({ ...newConfig, value: e.target.value })
                }
                step={newConfig.calculationType === "percentage" ? "0.01" : "1"}
              />
              {newConfig.calculationType === "percentage" && (
                <p className="text-xs text-muted-foreground">
                  Enter percentage value (e.g., 30 for 30%)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setNewConfig({
                  name: "",
                  calculationType: "percentage",
                  value: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddConfig}
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      {/* <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit {getFieldLabel(editingField)}</DialogTitle>
            <DialogDescription>
              {getFieldDescription(editingField)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">{getFieldLabel(editingField)}</Label>
              <Input
                id="edit-value"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={`Enter ${getFieldLabel(editingField).toLowerCase()}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setEditingField("");
                setEditValue("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}

      {/* Edit Configuration Modal */}
      <Dialog open={showEditConfigModal} onOpenChange={setShowEditConfigModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Configuration</DialogTitle>
            <DialogDescription>
              Update the {activeSection} configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Configuration Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., PAYE, NSSF, etc."
                value={editingConfig.name}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Calculation Type</Label>
              <Select
                value={editingConfig.calculationType}
                onValueChange={(value: "percentage" | "fixed") =>
                  setEditingConfig({
                    ...editingConfig,
                    calculationType: value,
                    value: "",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select calculation type" />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="percentage">
                    <div className="flex items-center">
                      <IconPercentage size={14} className="mr-2" />
                      Percentage
                    </div>
                  </SelectItem>
                  <SelectItem value="fixed">
                    <div className="flex items-center">
                      <IconCurrencyDollar size={14} className="mr-2" />
                      Fixed Amount
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-value">
                {editingConfig.calculationType === "percentage"
                  ? "Percentage Value (%)"
                  : "Fixed Amount (KES)"}
              </Label>
              <Input
                id="edit-value"
                type="number"
                placeholder={
                  editingConfig.calculationType === "percentage"
                    ? "Enter percentage"
                    : "Enter amount"
                }
                value={editingConfig.value}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, value: e.target.value })
                }
                step={
                  editingConfig.calculationType === "percentage" ? "0.01" : "1"
                }
              />
              {editingConfig.calculationType === "percentage" && (
                <p className="text-xs text-muted-foreground">
                  Enter percentage value (e.g., 30 for 30%)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditConfigModal(false);
                setEditingConfig({
                  id: null,
                  name: "",
                  calculationType: "percentage",
                  value: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEditConfig}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
