'use client';

import React, { useState, useEffect } from 'react';
import { Filter, Search, Plus, Download, ChevronDown } from 'lucide-react';
import { payrunAPI, PayrunType } from '@/services/api/payrun';

interface PayrunTableProps {
  organizationId: string;
}

const PayrunTable: React.FC<PayrunTableProps> = ({ organizationId }) => {
  const [payruns, setPayruns] = useState<PayrunType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayruns = async () => {
      try {
        setLoading(true);
        const response = await payrunAPI.getPayruns(51);
        
        if (response.success && response.data) {
          setPayruns(response.data.data);
        } else {
          setError(response.error || 'Failed to fetch payruns');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPayruns();
  }, [organizationId]);

  const formatCurrency = (amount: string) => {
    return `$${parseFloat(amount).toLocaleString()}`;
  };

  const formatDateRange = (startDate: string, endDate: string) => {
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

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const capitalizeFrequency = (frequency: string) => {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1).replace('-', '-');
  };

  const getStatusBadge = (status: string) => {
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

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['draft'];

    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.dotColor}`}></div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading payruns...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto p-4 bg-white">
        <div className="rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-500 mb-2">⚠️</div>
              <p className="text-red-600 font-medium">Error loading payruns</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
            </div>
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
          {payruns.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-red-500 font-medium">No payruns found</p>
                <p className="text-gray-400 text-sm mt-1">Create your first payrun to get started</p>
              </div>
            </div>
          ) : (
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
                {payruns.map((payrun) => (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default PayrunTable;