// app/company-settings/components/organization-actions.tsx
"use client";

import { useState, useEffect } from "react";
import { organizationAPI, type OrganizationType } from "@/services/api/organization";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner"; // or whatever toast library you're using

interface UseOrganizationReturn {
  organization: OrganizationType | null;
  isLoading: boolean;
  error: string | null;
  refetchOrganization: () => Promise<void>;
  updateOrganization: (field: string, value: any) => Promise<boolean>;
}

export function useOrganization(): UseOrganizationReturn {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<OrganizationType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = async () => {
    if (!user?.organization_id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await organizationAPI.getOrganizationDetails(user.organization_id);

      if (response.success && response.data) {
        setOrganization(response.data);
      } else {
        setError(response.error || "Failed to fetch organization details");
        toast.error(response.error || "Failed to fetch organization details");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrganization = async (field: string, value: any): Promise<boolean> => {
    if (!user?.organization_id || !organization) {
      toast.error("Organization not found");
      return false;
    }

    try {
      const updateData = { [field]: value };
      const response = await organizationAPI.updateOrganization(
        user.organization_id,
        updateData
      );

      if (response.success && response.data) {
        setOrganization(response.data);
        toast.success(response.message || "Organization updated successfully");
        return true;
      } else {
        // Handle validation errors
        if (response.errors && Object.keys(response.errors).length > 0) {
          const errorMessages = Object.values(response.errors)
            .flat()
            .join(", ");
          toast.error(errorMessages);
        } else {
          toast.error(response.error || "Failed to update organization");
        }
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
      return false;
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, [user?.organization_id]);

  return {
    organization,
    isLoading,
    error,
    refetchOrganization: fetchOrganization,
    updateOrganization,
  };
}