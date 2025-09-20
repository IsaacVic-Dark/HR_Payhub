'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Search, Plus, ChevronDown, ChevronLeft, ChevronRight, MapPin, Building2, Globe, Coins, Calendar, Eye, Edit, Trash2 } from 'lucide-react';
import { organizationAPI, Organization, OrganizationFilters } from '@/api/organization';
import OrganizationDrawer from '@/app/organization/drawer';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface OrganizationTableProps {
  className?: string;
}

const OrganizationTable: React.FC<OrganizationTableProps> = ({ className }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<OrganizationFilters>({
    page: 1,
    limit: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Drawer state
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit' | 'view';
    organizationId?: number;
  }>({
    isOpen: false,
    mode: 'add'
  });

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    organizationId?: number;
    organizationName?: string;
    isDeleting?: boolean;
  }>({
    isOpen: false,
    isDeleting: false
  });

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await organizationAPI.getOrganizations(filters);

      if (response.success && response.data) {
        setOrganizations(response.data.data);
        if (response.data.metadata) {
          setTotalItems(response.data.metadata.total || response.data.data.length);
          setTotalPages(
            response.data.metadata.total_pages ||
              Math.ceil(response.data.data.length / (filters.limit || 10))
          );
        }
      } else {
        setError(response.error || 'Failed to fetch organizations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handleSearch = (searchTerm: string) => {
    setFilters((prev) => ({ ...prev, search: searchTerm, page: 1 }));
  };

  // Drawer handlers
  const openDrawer = (mode: 'add' | 'edit' | 'view', organizationId?: number) => {
    setDrawerState({
      isOpen: true,
      mode,
      organizationId
    });
  };

  const closeDrawer = () => {
    setDrawerState({
      isOpen: false,
      mode: 'add'
    });
  };

  const handleDrawerSuccess = () => {
    fetchOrganizations(); // Refresh the table
  };

  // Delete handlers
  const openDeleteConfirm = (organizationId: number, organizationName: string) => {
    setDeleteConfirm({
      isOpen: true,
      organizationId,
      organizationName,
      isDeleting: false
    });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({
      isOpen: false,
      isDeleting: false
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.organizationId) return;

    setDeleteConfirm(prev => ({ ...prev, isDeleting: true }));

    try {
      const response = await organizationAPI.deleteOrganization(deleteConfirm.organizationId);
      if (response.success) {
        await fetchOrganizations(); // Refresh the table
        closeDeleteConfirm();
      } else {
        setError(response.error || 'Failed to delete organization');
        setDeleteConfirm(prev => ({ ...prev, isDeleting: false }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
      setDeleteConfirm(prev => ({ ...prev, isDeleting: false }));
    }
  };

  if (loading) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4 flex items-center justify-center py-12">
          <p className="text-gray-500">Loading organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4 flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 font-medium">Error loading organizations</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`w-full mx-auto p-4 bg-white ${className}`}>
        <div className="rounded-lg shadow-sm border p-4">
          {/* Header */}
          <div className="flex items-center justify-end mb-6">          
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search organizations"
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <button 
                onClick={() => openDrawer('add')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Organization
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white overflow-x-auto">
            {organizations.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-gray-500 font-medium">No organizations found</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Create your first organization to get started
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type & Registration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location & Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Financial Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payroll Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status & Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{org.name}</div>
                          <div className="text-xs text-gray-500">
                            <Globe className="w-3 h-3 inline mr-1" />
                            {org.domain}
                          </div>
                          <div className="text-xs text-gray-500">KRA: {org.kra_pin}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm text-gray-900">{org.legal_type}</div>
                          <div className="text-xs text-gray-500">{org.registration_number}</div>
                          <div className="text-xs text-gray-500">Prefix: {org.payroll_number_prefix}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm text-gray-900">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {org.location}
                          </div>
                          <div className="text-xs text-gray-500">{org.primary_phone}</div>
                          <div className="text-xs text-gray-500 truncate max-w-32">{org.official_email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm text-gray-900">
                            <Coins className="w-3 h-3 inline mr-1" />
                            {org.currency}
                          </div>
                          <div className="text-xs text-gray-500">{org.bank_account_name}</div>
                          <div className="text-xs text-gray-500">{org.bank_account_number}</div>
                          <div className="text-xs text-gray-500">{org.bank_branch}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm text-gray-900">{org.payroll_schedule}</div>
                          <div className="text-xs text-gray-500">Pay Day: {org.default_payday}</div>
                          <div className="text-xs text-gray-500">NSSF: {org.nssf_number}</div>
                          <div className="text-xs text-gray-500">NHIF: {org.nhif_number}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className={`text-xs px-2 py-1 rounded-full w-fit ${
                            org.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {org.is_active ? 'Active' : 'Inactive'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatDate(org.created_at)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openDrawer('view', org.id)}
                            className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => openDrawer('edit', org.id)}
                            className="flex items-center gap-1 px-2 py-1 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded transition-colors"
                            title="Edit organization"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button 
                                className="flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                                title="Delete organization"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{org.name}</strong>? This action cannot be undone and will permanently remove all associated data including employees, payroll records, and organizational settings.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    openDeleteConfirm(org.id, org.name);
                                  }}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {deleteConfirm.isDeleting && deleteConfirm.organizationId === org.id 
                                    ? 'Deleting...' 
                                    : 'Delete'
                                  }
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {organizations.length > 0 && (
            <div className="flex items-center justify-between mt-6 px-4 py-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-700">
                  Showing {((filters.page || 1) - 1) * (filters.limit || 10) + 1} to{' '}
                  {Math.min((filters.page || 1) * (filters.limit || 10), totalItems)} of{' '}
                  {totalItems} results
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-700">Rows per page:</span>
                  <select
                    value={filters.limit || 10}
                    onChange={(e) => handleLimitChange(Number(e.target.value))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange((filters.page || 1) - 1)}
                  disabled={(filters.page || 1) === 1}
                  className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
                    (filters.page || 1) === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <ChevronLeft className="w-3 h-3" />
                  Previous
                </button>

                {/* Page Numbers */}
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const currentPage = filters.page || 1;
                  let pageNumber;

                  if (totalPages <= 7) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 4) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNumber = totalPages - 6 + i;
                  } else {
                    pageNumber = currentPage - 3 + i;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        currentPage === pageNumber
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                {/* Show dots if there are many pages */}
                {totalPages > 7 && (filters.page || 1) < totalPages - 3 && (
                  <span className="px-2 py-1 text-xs text-gray-500">...</span>
                )}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange((filters.page || 1) + 1)}
                  disabled={(filters.page || 1) === totalPages}
                  className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
                    (filters.page || 1) === totalPages
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Organization Drawer */}
      <OrganizationDrawer
        isOpen={drawerState.isOpen}
        onClose={closeDrawer}
        mode={drawerState.mode}
        organizationId={drawerState.organizationId}
        onSuccess={handleDrawerSuccess}
      />
    </>
  );
};

export default OrganizationTable;