"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { organizationConfigAPI, UIConfigItem, ConfigsByType } from '@/services/api/organization-config';
import { toast } from 'sonner';

export const useOrganizationConfig = () => {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ConfigsByType>({
    tax: [],
    deduction: [],
    loan: [],
    benefit: [],
    per_diem: [],
    advance: [],
    refund: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!user?.organization_id) {
      setError('No organization ID found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await organizationConfigAPI.getOrganizationConfigs(user.organization_id);

      if (response.success && response.data) {
        const transformedConfigs = organizationConfigAPI.transformToUIConfig(response.data);
        setConfigs(transformedConfigs);
      } else {
        setError(response.error || 'Failed to fetch configurations');
        toast.error(response.error || 'Failed to fetch configurations');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user?.organization_id]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const createConfig = async (configData: {
    config_type: string;
    name: string;
    percentage?: number | null;
    fixed_amount?: number | null;
    is_active?: number;
  }) => {
    if (!user?.organization_id) {
      toast.error('No organization ID found');
      return { success: false };
    }

    try {
      const response = await organizationConfigAPI.createConfig(
        user.organization_id,
        configData
      );

      if (response.success) {
        toast.success('Configuration created successfully!');
        // Refresh the configs
        await fetchConfigs();
      } else {
        toast.error(response.error || 'Failed to create configuration');
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create configuration';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const updateConfig = async (configId: number, configData: {
    name?: string;
    percentage?: number | null;
    fixed_amount?: number | null;
    is_active?: number;
  }) => {
    if (!user?.organization_id) {
      toast.error('No organization ID found');
      return { success: false };
    }

    try {
      const response = await organizationConfigAPI.updateConfig(
        user.organization_id,
        configId,
        configData
      );

      if (response.success) {
        toast.success('Configuration updated successfully!');
        await fetchConfigs();
      } else {
        toast.error(response.error || 'Failed to update configuration');
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const deleteConfig = async (configId: number) => {
    if (!user?.organization_id) {
      toast.error('No organization ID found');
      return { success: false };
    }

    try {
      const response = await organizationConfigAPI.deleteConfig(
        user.organization_id,
        configId
      );

      if (response.success) {
        toast.success('Configuration deleted successfully!');
        await fetchConfigs();
      } else {
        toast.error(response.error || 'Failed to delete configuration');
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete configuration';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const toggleActive = async (configId: number, currentIsActive: boolean, configType: string) => {
    if (!user?.organization_id) {
      toast.error('No organization ID found');
      return { success: false };
    }

    // Find the current config to update
    const configTypeKey = configType as keyof ConfigsByType;
    const currentConfig = configs[configTypeKey].find(config => config.id === configId);

    if (!currentConfig) {
      toast.error('Configuration not found');
      return { success: false };
    }

    try {
      // Calculate the new is_active value (toggle)
      const newIsActiveValue = currentIsActive ? 0 : 1;

      const response = await organizationConfigAPI.updateConfig(
        user.organization_id,
        configId,
        { is_active: newIsActiveValue }  // This should be the opposite of current
      );

      if (response.success) {
        toast.success(`Configuration ${currentIsActive ? 'deactivated' : 'activated'} successfully!`);
        await fetchConfigs();
      } else {
        toast.error(response.error || `Failed to ${currentIsActive ? 'deactivate' : 'activate'} configuration`);
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle configuration status';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    configs,
    loading,
    error,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleActive,
  };
};