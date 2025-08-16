'use client';

import React, { useState } from 'react';
import { Filter, Search, Plus, Download, MoreHorizontal, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const PayrunTable = () => {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [payruns] = useState([
    {
      "id": 1,
      "organization_id": 51,
      "payrun_name": "January 2025 Payroll",
      "pay_period_start": "2025-01-01",
      "pay_period_end": "2025-01-31",
      "pay_frequency": "monthly",
      "status": "draft",
      "total_gross_pay": "50000.00",
      "total_deductions": "5000.00",
      "total_net_pay": "45000.00",
      "employee_count": 25,
      "created_by": 43,
      "reviewed_by": null,
      "finalized_by": null,
      "created_at": "2025-08-11 19:27:59",
      "reviewed_at": null,
      "finalized_at": null,
      "updated_at": "2025-08-11 19:27:59"
    },
    {
      "id": 2,
      "organization_id": 51,
      "payrun_name": "February 2025 Payroll",
      "pay_period_start": "2025-02-01",
      "pay_period_end": "2025-02-28",
      "pay_frequency": "monthly",
      "status": "reviewed",
      "total_gross_pay": "52000.00",
      "total_deductions": "5200.00",
      "total_net_pay": "46800.00",
      "employee_count": 26,
      "created_by": 43,
      "reviewed_by": 44,
      "finalized_by": null,
      "created_at": "2025-08-12 10:15:30",
      "reviewed_at": "2025-08-12 14:20:15",
      "finalized_at": null,
      "updated_at": "2025-08-12 14:20:15"
    },
    {
      "id": 3,
      "organization_id": 51,
      "payrun_name": "March 2025 Payroll",
      "pay_period_start": "2025-03-01",
      "pay_period_end": "2025-03-31",
      "pay_frequency": "monthly",
      "status": "finalized",
      "total_gross_pay": "48500.00",
      "total_deductions": "4850.00",
      "total_net_pay": "43650.00",
      "employee_count": 24,
      "created_by": 43,
      "reviewed_by": 44,
      "finalized_by": 45,
      "created_at": "2025-08-13 09:30:45",
      "reviewed_at": "2025-08-13 11:45:20",
      "finalized_at": "2025-08-13 15:30:00",
      "updated_at": "2025-08-13 15:30:00"
    },
    {
      "id": 4,
      "organization_id": 51,
      "payrun_name": "Bi-weekly Payroll #1",
      "pay_period_start": "2025-04-01",
      "pay_period_end": "2025-04-14",
      "pay_frequency": "bi-weekly",
      "status": "draft",
      "total_gross_pay": "25000.00",
      "total_deductions": "2500.00",
      "total_net_pay": "22500.00",
      "employee_count": 20,
      "created_by": 43,
      "reviewed_by": null,
      "finalized_by": null,
      "created_at": "2025-08-14 08:00:00",
      "reviewed_at": null,
      "finalized_at": null,
      "updated_at": "2025-08-14 08:00:00"
    },
    {
      "id": 5,
      "organization_id": 51,
      "payrun_name": "Weekly Payroll #12",
      "pay_period_start": "2025-04-21",
      "pay_period_end": "2025-04-27",
      "pay_frequency": "weekly",
      "status": "reviewed",
      "total_gross_pay": "12500.00",
      "total_deductions": "1250.00",
      "total_net_pay": "11250.00",
      "employee_count": 15,
      "created_by": 43,
      "reviewed_by": 44,
      "finalized_by": null,
      "created_at": "2025-08-15 07:15:30",
      "reviewed_at": "2025-08-15 12:00:00",
      "finalized_at": null,
      "updated_at": "2025-08-15 12:00:00"
    }
  ]);

  // Pagination calculations
  const totalItems = payruns.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPayruns = payruns.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toLocaleString()}`;
  };

  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startFormatted = start.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    const endFormatted = end.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `${startFormatted} – ${endFormatted}`;
  };

  const formatLastUpdated = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const capitalizeFrequency = (frequency) => {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1).replace('-', '-');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'draft': {
        color: 'bg-yellow-100 text-yellow-800',
        dotColor: 'bg-yellow-500',
        label: 'Draft'
      },
      'reviewed': {
        color: 'bg-blue-100 text-blue-800',
        dotColor: 'bg-blue-500',
        label: 'Reviewed'
      },
      'finalized': {
        color: 'bg-green-100 text-green-800',
        dotColor: 'bg-green-500',
        label: 'Finalized'
      }
    };

    const config = statusConfig[status] || statusConfig['draft'];

    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.dotColor}`}></div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
    );
  };

  return (
    <div className="w-full mx-auto p-4 bg-white">
      <div className="rounded-lg inset-shadow-2xs p-4"> 
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Payrun Management</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-700">Filters</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search Payruns"
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />
              Create Payrun
            </button>
          </div>
        </div>
        
        {/* Table */}
        <div className="bg-white overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Frequency <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee Count <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Pay <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deductions <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Pay <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPayruns.map((payrun) => (
                <tr key={payrun.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="text-xs font-medium text-gray-900">{payrun.payrun_name}</div>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatDateRange(payrun.pay_period_start, payrun.pay_period_end)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {capitalizeFrequency(payrun.pay_frequency)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {payrun.employee_count}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(payrun.total_gross_pay)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(payrun.total_deductions)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900 font-medium">
                    {formatCurrency(payrun.total_net_pay)}
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(payrun.status)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatLastUpdated(payrun.updated_at)}
                  </td>
                  <td className="px-4 py-4">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-md transition-colors">
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6 px-4 py-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-700">
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} results
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-xs text-gray-700">per page</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Previous Button */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                currentPage === 1 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ChevronLeft className="w-3 h-3" />
              Previous
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                {page}
              </button>
            ))}

            {/* Next Button */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                currentPage === totalPages 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrunTable;