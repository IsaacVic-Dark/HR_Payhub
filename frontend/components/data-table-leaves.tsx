'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Search, Plus, ChevronDown, ChevronLeft, ChevronRight, Check, X, Eye } from 'lucide-react';
import { leaveAPI, LeaveType, LeaveFilters } from '@/services/api/leave';
import { Button } from '@/components/ui/button';
import { LeaveActionDialog } from '@/app/leaves/leave-action-dialog';
import { LeaveViewDrawer } from '@/app/leaves/leave-view-drawer';
import { toast } from 'sonner';

interface LeaveTableProps {
  organizationId: string;
}

const LeaveTable: React.FC<LeaveTableProps> = ({ organizationId }) => {
  const [leaves, setLeaves] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveType | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewLeave, setViewLeave] = useState<LeaveType | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<LeaveFilters>({
    page: 1,
    limit: 10,
  });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getLeaves(filters);

      if (response.success && response.data) {
        setLeaves(response.data.data);
        if (response.data.metadata) {
          setTotalItems(response.data.metadata.total || response.data.data.length);
          setTotalPages(
            response.data.metadata.totalPages ||
              Math.ceil(response.data.data.length / (filters.limit || 10))
          );
        }
      } else {
        setError(response.error || 'Failed to fetch leaves');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // Filter leaves locally
  const filteredLeaves = leaves.filter((leave) => {
    const matchesSearch =
      searchTerm === '' ||
      `${leave.first_name} ${leave.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      leave.employee_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLeaveType =
      selectedLeaveType === '' || leave.leave_type === selectedLeaveType;

    const matchesStartDate =
      startDateFilter === '' ||
      new Date(leave.start_date) >= new Date(startDateFilter);

    const matchesEndDate =
      endDateFilter === '' ||
      new Date(leave.end_date) <= new Date(endDateFilter);

    return matchesSearch && matchesLeaveType && matchesStartDate && matchesEndDate;
  });

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startFormatted = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const endFormatted = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return `${startFormatted} — ${endFormatted}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: {
        color: 'bg-yellow-100 text-yellow-800',
        label: 'Pending',
      },
      approved: {
        color: 'bg-green-100 text-green-800',
        label: 'Approved',
      },
      rejected: {
        color: 'bg-red-100 text-red-800',
        label: 'Rejected',
      },
    };

    const config = statusConfig[status] || {
      color: 'bg-gray-100 text-gray-800',
      label: status,
    };

    return (
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          {config.label}
        </span>
      </div>
    );
  };

  const handleActionClick = (leave: LeaveType, action: 'approve' | 'reject') => {
    setSelectedLeave(leave);
    setActionType(action);
    setDialogOpen(true);
  };

  const handleViewClick = (leave: LeaveType) => {
    setViewLeave(leave);
    setDrawerOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedLeave) return;

    setActionLoading(true);
    try {
      const newStatus = actionType === 'approve' ? 'approved' : 'rejected';
      const response = await leaveAPI.updateLeaveStatus(
        selectedLeave.leave_id,
        newStatus
      );

      if (response.success) {
        toast.success(
          `Leave ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`
        );
        setDialogOpen(false);
        fetchLeaves(); // Refresh the list
      } else {
        toast.error(response.error || 'Failed to update leave status');
      }
    } catch (err) {
      toast.error('An error occurred while updating leave status');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedLeaveType('');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  if (loading) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4 flex items-center justify-center py-12">
          <p className="text-gray-500">Loading leaves...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4 flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 font-medium">Error loading leaves</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">
              Leave Management
            </h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" />
                Create Leave
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Leave Type
                  </label>
                  <select
                    value={selectedLeaveType}
                    onChange={(e) => setSelectedLeaveType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Types</option>
                    <option value="annual">Annual</option>
                    <option value="sick">Sick</option>
                    <option value="maternity">Maternity</option>
                    <option value="paternity">Paternity</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Start Date From
                  </label>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    End Date To
                  </label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white overflow-x-auto">
            {filteredLeaves.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-gray-500 font-medium">No leaves found</p>
                  <p className="text-gray-400 text-sm mt-1">
                    {searchTerm || selectedLeaveType || startDateFilter || endDateFilter
                      ? 'Try adjusting your filters'
                      : 'Create your first leave to get started'}
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full min-w-max">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leave Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLeaves.map((leave) => (
                    <tr key={leave.leave_id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-xs text-gray-900">
                        {leave.first_name} {leave.last_name}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-900 capitalize">
                        {leave.leave_type}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-900">
                        {formatDateRange(leave.start_date, leave.end_date)}
                      </td>
                      <td className="px-4 py-4">{getStatusBadge(leave.status)}</td>
                      <td className="px-4 py-4 text-xs text-gray-900">
                        {leave.employee_email || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewClick(leave)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {leave.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleActionClick(leave, 'approve')}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleActionClick(leave, 'reject')}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {filteredLeaves.length > 0 && (
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
                    className="px-3 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={25}>25</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1">
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
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

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

      {/* Action Dialog */}
      <LeaveActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        action={actionType}
        leavePeriod={
          selectedLeave
            ? formatDateRange(selectedLeave.start_date, selectedLeave.end_date)
            : ''
        }
        employeeName={
          selectedLeave
            ? `${selectedLeave.first_name} ${selectedLeave.last_name}`
            : ''
        }
        onConfirm={handleConfirmAction}
        loading={actionLoading}
      />

      {/* View Drawer */}
      <LeaveViewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        leave={viewLeave}
      />
    </>
  );
};

export default LeaveTable;