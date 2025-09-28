"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  Eye,
  Edit,
  Plus,
  MapPin,
  Building2,
  Globe,
  Coins,
  AlertCircle,
  CheckCircle,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  Users,
  FileText,
  MapPinIcon,
} from "lucide-react";
import { organizationAPI, Organization } from "@/api/organization";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DatePicker } from "@/components/datepicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "add" | "edit" | "view";
  organizationId?: number;
  onSuccess?: () => void;
}

interface OrganizationFormData {
  tenant_id: string;
  name: string;
  payroll_number_prefix: string;
  kra_pin: string;
  nssf_number: string;
  nhif_number: string;
  legal_type: string;
  registration_number: string;
  physical_address: string;
  location: string;
  postal_address: string;
  postal_code_id: string;
  county_id: string;
  primary_phone: string;
  secondary_phone: string;
  official_email: string;
  logo_url: string;
  currency: string;
  payroll_schedule: string;
  payroll_lock_date: string;
  default_payday: string;
  bank_id: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  swift_code: string;
  nssf_branch_code: string;
  nhif_branch_code: string;
  primary_administrator_id: string;
  is_active: boolean;
  domain: string;
}

interface SubmitMessage {
  type: "success" | "error";
  text: string;
}

const OrganizationDrawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  mode,
  organizationId,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<OrganizationFormData>({
    tenant_id: "",
    name: "",
    payroll_number_prefix: "EMP",
    kra_pin: "",
    nssf_number: "",
    nhif_number: "",
    legal_type: "",
    registration_number: "",
    physical_address: "",
    location: "",
    postal_address: "",
    postal_code_id: "",
    county_id: "",
    primary_phone: "",
    secondary_phone: "",
    official_email: "",
    logo_url: "",
    currency: "KES",
    payroll_schedule: "Monthly",
    payroll_lock_date: "",
    default_payday: "",
    bank_id: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch: "",
    swift_code: "",
    nssf_branch_code: "",
    nhif_branch_code: "",
    primary_administrator_id: "",
    is_active: true,
    domain: "",
  });
  const [originalData, setOriginalData] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<SubmitMessage | null>(
    null
  );

  const isReadOnly = mode === "view";
  const isEditMode = mode === "edit";
  const isAddMode = mode === "add";

  // Reset form when drawer opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      setSubmitMessage(null);
      if (isAddMode) {
        setFormData({
          tenant_id: "",
          name: "",
          payroll_number_prefix: "EMP",
          kra_pin: "",
          nssf_number: "",
          nhif_number: "",
          legal_type: "",
          registration_number: "",
          physical_address: "",
          location: "",
          postal_address: "",
          postal_code_id: "",
          county_id: "",
          primary_phone: "",
          secondary_phone: "",
          official_email: "",
          logo_url: "",
          currency: "KES",
          payroll_schedule: "Monthly",
          payroll_lock_date: "",
          default_payday: "",
          bank_id: "",
          bank_account_name: "",
          bank_account_number: "",
          bank_branch: "",
          swift_code: "",
          nssf_branch_code: "",
          nhif_branch_code: "",
          primary_administrator_id: "",
          is_active: true,
          domain: "",
        });
        setOriginalData(null);
      } else if ((isEditMode || mode === "view") && organizationId) {
        fetchOrganization();
      }
    }
  }, [isOpen, mode, organizationId]);

  const fetchOrganization = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const response = await organizationAPI.getOrganizationById(
        organizationId
      );
      if (response.success && response.data) {
        const org = response.data;
        setOriginalData(org);
        setFormData({
          tenant_id: org.tenant_id?.toString() || "",
          name: org.name || "",
          payroll_number_prefix: org.payroll_number_prefix || "EMP",
          kra_pin: org.kra_pin || "",
          nssf_number: org.nssf_number || "",
          nhif_number: org.nhif_number || "",
          legal_type: org.legal_type || "",
          registration_number: org.registration_number || "",
          physical_address: org.physical_address || "",
          location: org.location || "",
          postal_address: org.postal_address || "",
          postal_code_id: org.postal_code_id?.toString() || "",
          county_id: org.county_id?.toString() || "",
          primary_phone: org.primary_phone || "",
          secondary_phone: org.secondary_phone || "",
          official_email: org.official_email || "",
          logo_url: org.logo_url || "",
          currency: org.currency || "KES",
          payroll_schedule: org.payroll_schedule || "Monthly",
          payroll_lock_date: org.payroll_lock_date || "",
          default_payday: org.default_payday?.toString() || "",
          bank_id: org.bank_id?.toString() || "",
          bank_account_name: org.bank_account_name || "",
          bank_account_number: org.bank_account_number || "",
          bank_branch: org.bank_branch || "",
          swift_code: org.swift_code || "",
          nssf_branch_code: org.nssf_branch_code || "",
          nhif_branch_code: org.nhif_branch_code || "",
          primary_administrator_id:
            org.primary_administrator_id?.toString() || "",
          is_active:
            org.is_active !== undefined ? Boolean(org.is_active) : true,
          domain: org.domain || "",
        });
      } else {
        setSubmitMessage({
          type: "error",
          text: response.error || "Failed to fetch organization",
        });
      }
    } catch (err) {
      setSubmitMessage({
        type: "error",
        text:
          err instanceof Error ? err.message : "Failed to fetch organization",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof OrganizationFormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "Organization name is required";
    if (!formData.location.trim()) return "Location is required";

    // Validate email format if provided
    if (
      formData.official_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.official_email)
    ) {
      return "Please enter a valid email address";
    }

    // Validate KRA PIN format if provided
    if (formData.kra_pin && formData.kra_pin.length > 11) {
      return "KRA PIN must be 11 characters or less";
    }

    // Validate default payday if provided
    if (formData.default_payday) {
      const day = parseInt(formData.default_payday);
      if (day < 1 || day > 31) {
        return "Default payday must be between 1 and 31";
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    if (isReadOnly) return;

    const validationError = validateForm();
    if (validationError) {
      setSubmitMessage({
        type: "error",
        text: validationError,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      let response;

      // Convert form data to proper types for API
      const submitData = {
        ...formData,
        tenant_id: formData.tenant_id ? parseInt(formData.tenant_id) : null,
        postal_code_id: formData.postal_code_id
          ? parseInt(formData.postal_code_id)
          : null,
        county_id: formData.county_id ? parseInt(formData.county_id) : null,
        default_payday: formData.default_payday
          ? parseInt(formData.default_payday)
          : null,
        bank_id: formData.bank_id ? parseInt(formData.bank_id) : null,
        primary_administrator_id: formData.primary_administrator_id
          ? parseInt(formData.primary_administrator_id)
          : null,
      };

      if (isAddMode) {
        response = await organizationAPI.createOrganization(submitData);
      } else if (isEditMode && organizationId) {
        response = await organizationAPI.updateOrganization(
          organizationId,
          submitData
        );
      }

      if (response?.success) {
        setSubmitMessage({
          type: "success",
          text: `Organization ${
            isAddMode ? "created" : "updated"
          } successfully!`,
        });

        // Auto close after success
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setSubmitMessage({
          type: "error",
          text: response?.error || "Operation failed",
        });
      }
    } catch (err) {
      setSubmitMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Operation failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const getDrawerTitle = () => {
    switch (mode) {
      case "add":
        return "Add New Organization";
      case "edit":
        return "Edit Organization";
      case "view":
        return "Organization Details";
      default:
        return "Organization";
    }
  };

  const getDrawerIcon = () => {
    switch (mode) {
      case "add":
        return <Plus className="h-4 w-4 text-blue-600" />;
      case "edit":
        return <Edit className="h-4 w-4 text-purple-600" />;
      case "view":
        return <Eye className="h-4 w-4 text-green-600" />;
      default:
        return <Building2 className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const legalTypeOptions = [
    { value: "LTD", label: "Limited Company (LTD)" },
    { value: "PLC", label: "Public Limited Company (PLC)" },
    { value: "Sole_Proprietor", label: "Sole Proprietor" },
    { value: "Partnership", label: "Partnership" },
    { value: "NGO", label: "Non-Governmental Organization (NGO)" },
    { value: "Government", label: "Government" },
    { value: "School", label: "School" },
    { value: "Other", label: "Other" },
  ];

  const currencyOptions = [
    { value: "KES", label: "KES - Kenyan Shilling" },
    { value: "USD", label: "USD - US Dollar" },
    { value: "EUR", label: "EUR - Euro" },
    { value: "GBP", label: "GBP - British Pound" },
    { value: "JPY", label: "JPY - Japanese Yen" },
    { value: "TZS", label: "TZS - Tanzanian Shilling" },
    { value: "UGX", label: "UGX - Ugandan Shilling" },
    { value: "CAD", label: "CAD - Canadian Dollar" },
    { value: "AUD", label: "AUD - Australian Dollar" },
  ];

  const payrollScheduleOptions = [
    { value: "Monthly", label: "Monthly" },
    { value: "Bi-Monthly", label: "Bi-Monthly" },
    { value: "Weekly", label: "Weekly" },
  ];

  return (
    <Drawer open={isOpen} onOpenChange={onClose} direction="right">
      <DrawerContent className="h-full max-w-4xl ml-auto bg-white">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
              {getDrawerIcon()}
            </div>
            <span>{getDrawerTitle()}</span>
          </DrawerTitle>
          <DrawerDescription>
            {isAddMode && "Create a new organization"}
            {isEditMode && "Update organization information"}
            {isReadOnly && "View organization details"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Submit Message */}
          {submitMessage && (
            <Alert
              className={
                submitMessage.type === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-green-200 bg-green-50"
              }
            >
              {submitMessage.type === "error" ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription
                className={
                  submitMessage.type === "error"
                    ? "text-red-800"
                    : "text-green-800"
                }
              >
                {submitMessage.text}
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Loading organization...</p>
            </div>
          ) : (
            <>
              {/* View Mode - Display Organization ID */}
              {isReadOnly && originalData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      Organization ID: #{originalData.id}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          formData.is_active ? "bg-green-500" : "bg-red-500"
                        }`}
                      ></div>
                      <span
                        className={`text-sm font-medium ${
                          formData.is_active ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formData.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="legal">Legal & Tax</TabsTrigger>
                  <TabsTrigger value="payroll">Payroll</TabsTrigger>
                  <TabsTrigger value="banking">Banking</TabsTrigger>
                </TabsList>

                {/* Basic Information Tab */}
                <TabsContent value="basic" className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Organization Name */}
                    <div className="space-y-2 col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Organization Name{" "}
                        {!isReadOnly && <span className="text-red-500">*</span>}
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-lg">
                              {formData.name}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.name}
                          onChange={(e) =>
                            handleInputChange("name", e.target.value)
                          }
                          placeholder="e.g., Acme Corporation"
                          className="w-full"
                          required
                        />
                      )}
                    </div>

                    {/* Tenant ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Tenant ID
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.tenant_id || "Not assigned"}</span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          value={formData.tenant_id}
                          onChange={(e) =>
                            handleInputChange("tenant_id", e.target.value)
                          }
                          placeholder="Enter tenant ID"
                        />
                      )}
                    </div>

                    {/* Legal Type */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Legal Type
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-600" />
                            <span>
                              {legalTypeOptions.find(
                                (opt) => opt.value === formData.legal_type
                              )?.label || "Not specified"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Select
                          onValueChange={(value) =>
                            handleInputChange("legal_type", value)
                          }
                          value={formData.legal_type}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select legal type" />
                          </SelectTrigger>
                          <SelectContent>
                            {legalTypeOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Registration Number */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Registration Number
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.registration_number || "Not provided"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.registration_number}
                          onChange={(e) =>
                            handleInputChange(
                              "registration_number",
                              e.target.value
                            )
                          }
                          placeholder="e.g., C.123456"
                        />
                      )}
                    </div>

                    {/* Domain */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Domain/Industry
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-600" />
                            <span>{formData.domain || "Not specified"}</span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.domain}
                          onChange={(e) =>
                            handleInputChange("domain", e.target.value)
                          }
                          placeholder="e.g., Technology, Healthcare"
                        />
                      )}
                    </div>

                    {/* Logo URL */}
                    <div className="space-y-2 col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Logo URL
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          {formData.logo_url ? (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 border border-gray-200 rounded overflow-hidden bg-white flex items-center justify-center">
                                <img
                                  src={formData.logo_url}
                                  alt="Organization logo"
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                  }}
                                />
                              </div>
                              <span className="text-sm text-blue-600 break-all">
                                {formData.logo_url}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">
                              No logo provided
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            type="url"
                            value={formData.logo_url}
                            onChange={(e) =>
                              handleInputChange("logo_url", e.target.value)
                            }
                            placeholder="https://example.com/logo.png"
                            className="w-full"
                          />
                          {/* Logo Preview */}
                          {formData.logo_url && (
                            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                              <span className="text-sm text-gray-600">
                                Preview:
                              </span>
                              <div className="w-8 h-8 border border-gray-200 rounded overflow-hidden bg-white flex items-center justify-center">
                                <img
                                  src={formData.logo_url}
                                  alt="Logo preview"
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status Toggle */}
                    {!isAddMode && (
                      <div className="space-y-2 col-span-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Organization Status
                        </label>
                        <div className="flex items-center space-x-3">
                          {isReadOnly ? (
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  formData.is_active
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }`}
                              ></div>
                              <span
                                className={`font-medium ${
                                  formData.is_active
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {formData.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          ) : (
                            <>
                              <Switch
                                checked={formData.is_active}
                                onCheckedChange={(checked) =>
                                  handleInputChange("is_active", checked)
                                }
                              />
                              <span
                                className={`text-sm font-medium ${
                                  formData.is_active
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {formData.is_active ? "Active" : "Inactive"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Contact Information Tab */}
                <TabsContent value="contact" className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Physical Address */}
                    <div className="space-y-2 col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Physical Address
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-green-600" />
                            <span>
                              {formData.physical_address || "Not provided"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Textarea
                          value={formData.physical_address}
                          onChange={(e) =>
                            handleInputChange(
                              "physical_address",
                              e.target.value
                            )
                          }
                          placeholder="Enter the physical address"
                          className="w-full"
                          rows={3}
                        />
                      )}
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Location{" "}
                        {!isReadOnly && <span className="text-red-500">*</span>}
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-green-600" />
                            <span>{formData.location}</span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.location}
                          onChange={(e) =>
                            handleInputChange("location", e.target.value)
                          }
                          placeholder="e.g., Nairobi, Kenya"
                          className="w-full"
                          required
                        />
                      )}
                    </div>

                    {/* Postal Address */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Postal Address
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.postal_address || "Not provided"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.postal_address}
                          onChange={(e) =>
                            handleInputChange("postal_address", e.target.value)
                          }
                          placeholder="P.O. Box 12345"
                        />
                      )}
                    </div>

                    {/* Postal Code ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Postal Code ID
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.postal_code_id || "Not provided"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          value={formData.postal_code_id}
                          onChange={(e) =>
                            handleInputChange("postal_code_id", e.target.value)
                          }
                          placeholder="Enter postal code ID"
                        />
                      )}
                    </div>

                    {/* County ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        County ID
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.county_id || "Not provided"}</span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          value={formData.county_id}
                          onChange={(e) =>
                            handleInputChange("county_id", e.target.value)
                          }
                          placeholder="Enter county ID"
                        />
                      )}
                    </div>

                    {/* Primary Phone */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Primary Phone
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-blue-600" />
                            <span>
                              {formData.primary_phone || "Not provided"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="tel"
                          value={formData.primary_phone}
                          onChange={(e) =>
                            handleInputChange("primary_phone", e.target.value)
                          }
                          placeholder="+254 700 000 000"
                        />
                      )}
                    </div>

                    {/* Secondary Phone */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Secondary Phone
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span>
                              {formData.secondary_phone || "Not provided"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="tel"
                          value={formData.secondary_phone}
                          onChange={(e) =>
                            handleInputChange("secondary_phone", e.target.value)
                          }
                          placeholder="+254 700 000 001"
                        />
                      )}
                    </div>

                    {/* Official Email */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Official Email
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-600" />
                            <span>
                              {formData.official_email || "Not provided"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="email"
                          value={formData.official_email}
                          onChange={(e) =>
                            handleInputChange("official_email", e.target.value)
                          }
                          placeholder="info@organization.com"
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Legal & Tax Information Tab */}
                <TabsContent value="legal" className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    Legal & Tax Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* KRA PIN */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        KRA PIN
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.kra_pin || "Not provided"}</span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.kra_pin}
                          onChange={(e) =>
                            handleInputChange("kra_pin", e.target.value)
                          }
                          placeholder="P123456789A"
                          maxLength={11}
                        />
                      )}
                    </div>

                    {/* NSSF Number */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        NSSF Number
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.nssf_number || "Not provided"}</span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.nssf_number}
                          onChange={(e) =>
                            handleInputChange("nssf_number", e.target.value)
                          }
                          placeholder="Enter NSSF number"
                          maxLength={15}
                        />
                      )}
                    </div>

                    {/* NHIF Number */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        NHIF Number
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.nhif_number || "Not provided"}</span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.nhif_number}
                          onChange={(e) =>
                            handleInputChange("nhif_number", e.target.value)
                          }
                          placeholder="Enter NHIF number"
                          maxLength={15}
                        />
                      )}
                    </div>

                    {/* NSSF Branch Code */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        NSSF Branch Code
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.nssf_branch_code || "Not provided"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.nssf_branch_code}
                          onChange={(e) =>
                            handleInputChange(
                              "nssf_branch_code",
                              e.target.value
                            )
                          }
                          placeholder="Enter NSSF branch code"
                        />
                      )}
                    </div>

                    {/* NHIF Branch Code */}
                    <div className="space-y-2 col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        NHIF Branch Code
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.nhif_branch_code || "Not provided"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.nhif_branch_code}
                          onChange={(e) =>
                            handleInputChange(
                              "nhif_branch_code",
                              e.target.value
                            )
                          }
                          placeholder="Enter NHIF branch code"
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Payroll Information Tab */}
                <TabsContent value="payroll" className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    Payroll Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Payroll Number Prefix */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Payroll Number Prefix
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.payroll_number_prefix}</span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.payroll_number_prefix}
                          onChange={(e) =>
                            handleInputChange(
                              "payroll_number_prefix",
                              e.target.value
                            )
                          }
                          placeholder="EMP"
                          maxLength={10}
                        />
                      )}
                    </div>

                    {/* Currency */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Currency
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-yellow-600" />
                            <span>
                              {currencyOptions.find(
                                (opt) => opt.value === formData.currency
                              )?.label || formData.currency}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Select
                          onValueChange={(value) =>
                            handleInputChange("currency", value)
                          }
                          value={formData.currency}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {currencyOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Payroll Schedule */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Payroll Schedule
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span>{formData.payroll_schedule}</span>
                          </div>
                        </div>
                      ) : (
                        <Select
                          onValueChange={(value) =>
                            handleInputChange("payroll_schedule", value)
                          }
                          value={formData.payroll_schedule}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select payroll schedule" />
                          </SelectTrigger>
                          <SelectContent>
                            {payrollScheduleOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Default Payday */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Default Payday (Day of Month)
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.default_payday
                              ? `Day ${formData.default_payday}`
                              : "Not set"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={formData.default_payday}
                          onChange={(e) =>
                            handleInputChange("default_payday", e.target.value)
                          }
                          placeholder="e.g., 25"
                        />
                      )}
                    </div>

                    {/* Payroll Lock Date */}
                    <div className="space-y-2">
                      {/* <label className="block text-sm font-medium text-gray-700">
                        Payroll Lock Date
                      </label> */}
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.payroll_lock_date
                              ? new Date(
                                  formData.payroll_lock_date
                                ).toLocaleDateString()
                              : "Not set"}
                          </span>
                        </div>
                      ) : (
                        <DatePicker
                          label="Payroll Lock Date"
                          value={
                            formData.payroll_lock_date
                              ? new Date(formData.payroll_lock_date)
                              : undefined
                          }
                          onChange={(date) =>
                            handleInputChange(
                              "payroll_lock_date",
                              date ? date.toISOString() : ""
                            )
                          }
                        />
                      )}
                    </div>

                    {/* Primary Administrator ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Primary Administrator ID
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-600" />
                            <span>
                              {formData.primary_administrator_id ||
                                "Not assigned"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          value={formData.primary_administrator_id}
                          onChange={(e) =>
                            handleInputChange(
                              "primary_administrator_id",
                              e.target.value
                            )
                          }
                          placeholder="Enter user ID"
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Banking Information Tab */}
                <TabsContent value="banking" className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    Banking Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Bank ID */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Bank ID
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.bank_id || "Not provided"}</span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          value={formData.bank_id}
                          onChange={(e) =>
                            handleInputChange("bank_id", e.target.value)
                          }
                          placeholder="Enter bank ID"
                        />
                      )}
                    </div>

                    {/* Bank Account Name */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Bank Account Name
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-green-600" />
                            <span>
                              {formData.bank_account_name || "Not provided"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.bank_account_name}
                          onChange={(e) =>
                            handleInputChange(
                              "bank_account_name",
                              e.target.value
                            )
                          }
                          placeholder="Organization Bank Account"
                        />
                      )}
                    </div>

                    {/* Bank Account Number */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Bank Account Number
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>
                            {formData.bank_account_number || "Not provided"}
                          </span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.bank_account_number}
                          onChange={(e) =>
                            handleInputChange(
                              "bank_account_number",
                              e.target.value
                            )
                          }
                          placeholder="1234567890"
                        />
                      )}
                    </div>

                    {/* Bank Branch */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Bank Branch
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.bank_branch || "Not provided"}</span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.bank_branch}
                          onChange={(e) =>
                            handleInputChange("bank_branch", e.target.value)
                          }
                          placeholder="Nairobi Branch"
                        />
                      )}
                    </div>

                    {/* SWIFT Code */}
                    <div className="space-y-2 col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        SWIFT Code
                      </label>
                      {isReadOnly ? (
                        <div className="py-2">
                          <span>{formData.swift_code || "Not provided"}</span>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={formData.swift_code}
                          onChange={(e) =>
                            handleInputChange("swift_code", e.target.value)
                          }
                          placeholder="ABCDKENA"
                          maxLength={11}
                        />
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* System Information (View mode only) */}
              {isReadOnly && originalData && (
                <div className="space-y-4 mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    System Information
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Created At
                      </label>
                      <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                        <span className="text-blue-900">
                          {formatDate(originalData.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Last Updated
                      </label>
                      <div className="p-3 bg-purple-50 rounded-md border border-purple-200">
                        <span className="text-purple-900">
                          {formatDate(originalData.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Only show for add/edit modes */}
        {!isReadOnly && (
          <DrawerFooter className="border-t bg-gray-50">
            <div className="flex space-x-2">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-purple-600 hover:bg-purple-800"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isAddMode ? "Creating..." : "Updating..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isAddMode ? "Create Organization" : "Update Organization"}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default OrganizationDrawer;
