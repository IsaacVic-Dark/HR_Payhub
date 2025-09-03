'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Search, Plus, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { leaveAPI, LeaveType, LeaveFilters } from '@/services/api/leave';

interface LeaveTableProps {
  organizationId: string;
}

const LeaveTable: React.FC<LeaveTableProps> = ({ organizationId }) => {
  const [leaves, setLeaves] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    return `${startFormatted} – ${endFormatted}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { color: string; dotColor: string; label: string }
    > = {
      pending: {
        color: 'bg-yellow-100 text-yellow-800',
        dotColor: 'bg-yellow-500',
        label: 'Pending',
      },
      approved: {
        color: 'bg-green-100 text-green-800',
        dotColor: 'bg-green-500',
        label: 'Approved',
      },
      rejected: {
        color: 'bg-red-100 text-red-800',
        dotColor: 'bg-red-500',
        label: 'Rejected',
      },
    };

    const config = statusConfig[status] || {
      color: 'bg-gray-100 text-gray-800',
      dotColor: 'bg-gray-400',
      label: status,
    };

    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.dotColor}`}></div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          {config.label}
        </span>
      </div>
    );
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, page: 1 }));
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
                placeholder="Search leaves"
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />
              Create Leave
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white overflow-x-auto">
          {leaves.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-gray-500 font-medium">No leaves found</p>
                <p className="text-gray-400 text-sm mt-1">
                  Create your first leave to get started
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaves.map((leave) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {leaves.length > 0 && (
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
                        ? 'bg-blue-600 text-white'
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
  );
};

export default LeaveTable;
