'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Search, Plus, ChevronDown, ChevronLeft, ChevronRight, MapPin, Building2, Globe, Coins, Calendar, Eye, Edit, Trash2 } from 'lucide-react';
import { organizationAPI, Organization, OrganizationFilters } from '@/api/organization';
import OrganizationDrawer from '@/app/organization/drawer';
import { Input } from '@/components/ui/input';

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
  }>({
    isOpen: false
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
            response.data.metadata.totalPages ||
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
      organizationName
    });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({
      isOpen: false
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm.organizationId) return;

    console.log("Organization id :", deleteConfirm.organizationId);

    try {
      const response = await organizationAPI.deleteOrganization(deleteConfirm.organizationId);
      if (response.success) {
        await fetchOrganizations(); // Refresh the table
        closeDeleteConfirm();
      } else {
        setError(response.error || 'Failed to delete organization');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
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
          <div className="bg-white overflow-x-auto ">
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
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Currency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
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
                        <div className="flex items-center">
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{org.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          {org.location}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          {org.domain}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          {org.currency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          {formatDate(org.created_at)}
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
                          <button 
                            onClick={() => openDeleteConfirm(org.id, org.name)}
                            className="flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                            title="Delete organization"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
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
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange((filters.page || 1) - 1)}
                  disabled={(filters.page || 1) === 1}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                    (filters.page || 1) === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <ChevronLeft className="w-3 h-3" />
                  Previous
                </button>

                {/* Page Numbers */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const currentPage = filters.page || 1;
                  let pageNumber;

                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        currentPage === pageNumber
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange((filters.page || 1) + 1)}
                  disabled={(filters.page || 1) === totalPages}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeDeleteConfirm}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Organization
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete "{deleteConfirm.organizationName}"? This action cannot be undone and will permanently remove all associated data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={closeDeleteConfirm}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrganizationTable;