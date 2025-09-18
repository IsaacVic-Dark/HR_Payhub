'use client';

import React, { useState, useEffect } from 'react';
import { Save, Eye, Edit, Plus, MapPin, Building2, Globe, Coins, AlertCircle, CheckCircle } from 'lucide-react';
import { organizationAPI, Organization } from '@/api/organization';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit' | 'view';
  organizationId?: number;
  onSuccess?: () => void;
}

interface OrganizationFormData {
  name: string;
  location: string;
  domain: string;
  currency: string;
  logo_url: string;
}

interface SubmitMessage {
  type: 'success' | 'error';
  text: string;
}

const OrganizationDrawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  mode,
  organizationId,
  onSuccess
}) => {
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: '',
    location: '',
    domain: '',
    currency: '',
    logo_url: ''
  });
  const [originalData, setOriginalData] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<SubmitMessage | null>(null);

  const isReadOnly = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';

  // Reset form when drawer opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      setSubmitMessage(null);
      if (isAddMode) {
        setFormData({
          name: '',
          location: '',
          domain: '',
          currency: '',
          logo_url: ''
        });
        setOriginalData(null);
      } else if ((isEditMode || mode === 'view') && organizationId) {
        fetchOrganization();
      }
    }
  }, [isOpen, mode, organizationId]);

  const fetchOrganization = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const response = await organizationAPI.getOrganizationById(organizationId);
      if (response.success && response.data?.data[0]) {
        const org = response.data.data[0];
        setOriginalData(org);
        setFormData({
          name: org.name,
          location: org.location,
          domain: org.domain,
          currency: org.currency,
          logo_url: org.logo_url
        });
      } else {
        setSubmitMessage({
          type: 'error',
          text: response.error || 'Failed to fetch organization'
        });
      }
    } catch (err) {
      setSubmitMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to fetch organization'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof OrganizationFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Organization name is required';
    if (!formData.location.trim()) return 'Location is required';
    if (!formData.domain.trim()) return 'Domain is required';
    if (!formData.currency.trim()) return 'Currency is required';
    return null;
  };

  const handleSubmit = async () => {
    if (isReadOnly) return;

    const validationError = validateForm();
    if (validationError) {
      setSubmitMessage({
        type: 'error',
        text: validationError
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      let response;
      
      if (isAddMode) {
        response = await organizationAPI.createOrganization(formData);
      } else if (isEditMode && organizationId) {
        response = await organizationAPI.updateOrganization(organizationId, formData);
      }

      if (response?.success) {
        setSubmitMessage({
          type: 'success',
          text: `Organization ${isAddMode ? 'created' : 'updated'} successfully!`
        });
        
        // Auto close after success
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setSubmitMessage({
          type: 'error',
          text: response?.error || 'Operation failed'
        });
      }
    } catch (err) {
      setSubmitMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Operation failed'
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
      case 'add':
        return 'Add New Organization';
      case 'edit':
        return 'Edit Organization';
      case 'view':
        return 'Organization Details';
      default:
        return 'Organization';
    }
  };

  const getDrawerIcon = () => {
    switch (mode) {
      case 'add':
        return <Plus className="h-4 w-4 text-blue-600" />;
      case 'edit':
        return <Edit className="h-4 w-4 text-purple-600" />;
      case 'view':
        return <Eye className="h-4 w-4 text-green-600" />;
      default:
        return <Building2 className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose} direction="right">
      <DrawerContent className="h-full min-w-xl ml-auto bg-white">
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
                  </div>
                </div>
              )}

              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Organization Name */}
                  <div className="space-y-2 col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Organization Name {!isReadOnly && <span className="text-red-500">*</span>}
                    </label>
                    {isReadOnly ? (
                      <div className="p-3 bg-gray-50 rounded-md border">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-lg">{formData.name}</span>
                        </div>
                      </div>
                    ) : (
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="e.g., Acme Corporation"
                        className="w-full"
                        required
                      />
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Location {!isReadOnly && <span className="text-red-500">*</span>}
                    </label>
                    {isReadOnly ? (
                      <div className="p-3 bg-gray-50 rounded-md border">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-600" />
                          <span>{formData.location}</span>
                        </div>
                      </div>
                    ) : (
                      <Input
                        type="text"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="e.g., Nairobi, Kenya"
                        className="w-full"
                        required
                      />
                    )}
                  </div>

                  {/* Domain */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Domain {!isReadOnly && <span className="text-red-500">*</span>}
                    </label>
                    {isReadOnly ? (
                      <div className="p-3 bg-gray-50 rounded-md border">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-blue-600" />
                          <span>{formData.domain}</span>
                        </div>
                      </div>
                    ) : (
                      <Input
                        type="text"
                        value={formData.domain}
                        onChange={(e) => handleInputChange('domain', e.target.value)}
                        placeholder="e.g., technology, healthcare"
                        className="w-full"
                        required
                      />
                    )}
                  </div>

                  {/* Currency */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Currency {!isReadOnly && <span className="text-red-500">*</span>}
                    </label>
                    {isReadOnly ? (
                      <div className="p-3 bg-gray-50 rounded-md border">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-yellow-600" />
                          <span>{formData.currency}</span>
                        </div>
                      </div>
                    ) : (
                      <Select
                        onValueChange={(value) => handleInputChange('currency', value)}
                        value={formData.currency}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                          <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                          <SelectItem value="TZS">TZS - Tanzanian Shilling</SelectItem>
                          <SelectItem value="UGX">UGX - Ugandan Shilling</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Logo URL */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Logo URL
                    </label>
                    {isReadOnly ? (
                      <div className="p-3 bg-gray-50 rounded-md border">
                        {formData.logo_url ? (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 border border-gray-200 rounded overflow-hidden bg-white flex items-center justify-center">
                              <img
                                src={formData.logo_url}
                                alt="Organization logo"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                            <span className="text-sm text-blue-600 break-all">{formData.logo_url}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">No logo provided</span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          type="url"
                          value={formData.logo_url}
                          onChange={(e) => handleInputChange('logo_url', e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="w-full"
                        />
                        {/* Logo Preview */}
                        {formData.logo_url && (
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border">
                            <span className="text-sm text-gray-600">Preview:</span>
                            <div className="w-8 h-8 border border-gray-200 rounded overflow-hidden bg-white flex items-center justify-center">
                              <img
                                src={formData.logo_url}
                                alt="Logo preview"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* System Information (View mode only) */}
              {isReadOnly && originalData && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    System Information
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Created At
                      </label>
                      <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                        <span className="text-blue-900">{formatDate(originalData.created_at)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Last Updated
                      </label>
                      <div className="p-3 bg-purple-50 rounded-md border border-purple-200">
                        <span className="text-purple-900">{formatDate(originalData.updated_at)}</span>
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
                    {isAddMode ? 'Creating...' : 'Updating...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isAddMode ? 'Create Organization' : 'Update Organization'}
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