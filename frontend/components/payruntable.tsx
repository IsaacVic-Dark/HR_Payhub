'use client';

import React, { useState } from 'react';
import { Filter, Search, UserPlus, Download, MoreHorizontal, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const PayrollTable = () => {
  // Pagination state - ADD THESE LINES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [employees] = useState([
    {
      "name": "Michael Smith",
      "employee_id": "EMP-3726",
      "gross_pay": 8000,
      "net_pay": 7200,
      "salary": 6000,
      "benefits": 1200,
      "incentives": 800,
      "deductions": 800,
      "total_cost": 8800,
      "upcoming_payroll": "2025-11-04",
      "status": "Scheduled"
    },
    {
      "name": "Sarah Johnson",
      "employee_id": "EMP-6259",
      "gross_pay": 7500,
      "net_pay": 6800,
      "salary": 5800,
      "benefits": 1000,
      "incentives": 700,
      "deductions": 700,
      "total_cost": 8100,
      "upcoming_payroll": "2025-11-04",
      "status": "Scheduled"
    },
    {
      "name": "David Wilson",
      "employee_id": "EMP-5293",
      "gross_pay": 9200,
      "net_pay": 8400,
      "salary": 7200,
      "benefits": 1500,
      "incentives": 1000,
      "deductions": 800,
      "total_cost": 10200,
      "upcoming_payroll": "2025-11-04",
      "status": "Pending"
    },
    {
      "name": "Emily Davis",
      "employee_id": "EMP-4310",
      "gross_pay": 8700,
      "net_pay": 7900,
      "salary": 6800,
      "benefits": 1300,
      "incentives": 900,
      "deductions": 800,
      "total_cost": 9800,
      "upcoming_payroll": "2025-11-04",
      "status": "Scheduled"
    },
    {
      "name": "James Brown",
      "employee_id": "EMP-2876",
      "gross_pay": 6500,
      "net_pay": 5800,
      "salary": 5000,
      "benefits": 900,
      "incentives": 600,
      "deductions": 700,
      "total_cost": 7400,
      "upcoming_payroll": "2025-11-04",
      "status": "Scheduled"
    },
    {
      "name": "Olivia Martinez",
      "employee_id": "EMP-6134",
      "gross_pay": 7900,
      "net_pay": 7100,
      "salary": 6200,
      "benefits": 1100,
      "incentives": 800,
      "deductions": 800,
      "total_cost": 9000,
      "upcoming_payroll": "2025-11-04",
      "status": "Pending"
    },
    {
      "name": "William Thompson",
      "employee_id": "EMP-9482",
      "gross_pay": 8300,
      "net_pay": 7500,
      "salary": 6500,
      "benefits": 1400,
      "incentives": 900,
      "deductions": 800,
      "total_cost": 9600,
      "upcoming_payroll": "2025-11-04",
      "status": "Scheduled"
    },
    {
      "name": "Sophia White",
      "employee_id": "EMP-7041",
      "gross_pay": 7100,
      "net_pay": 6400,
      "salary": 5500,
      "benefits": 900,
      "incentives": 700,
      "deductions": 700,
      "total_cost": 8300,
      "upcoming_payroll": "2025-11-04",
      "status": "Scheduled"
    },
    {
      "name": "Ethan Hall",
      "employee_id": "EMP-5832",
      "gross_pay": 8800,
      "net_pay": 8000,
      "salary": 7000,
      "benefits": 1500,
      "incentives": 900,
      "deductions": 800,
      "total_cost": 10200,
      "upcoming_payroll": "2025-11-04",
      "status": "Pending"
    },
    {
      "name": "Ava King",
      "employee_id": "EMP-3659",
      "gross_pay": 7600,
      "net_pay": 6900,
      "salary": 6000,
      "benefits": 1000,
      "incentives": 800,
      "deductions": 700,
      "total_cost": 8800,
      "upcoming_payroll": "2025-11-04",
      "status": "Scheduled"
    }
  ]);

  // Pagination calculations - ADD THESE LINES
  const totalItems = employees.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEmployees = employees.slice(startIndex, endIndex);

  // Pagination handlers - ADD THESE FUNCTIONS
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusBadge = (status) => {
    if (status === 'Scheduled') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span className="text-blue-700 text-xs font-medium">Scheduled</span>
        </div>
      );
    } else if (status === 'Pending') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          <span className="text-orange-700 text-xs font-medium">Pending</span>
        </div>
      );
    }
  };

  return (
    <div className="w-full mx-auto p-4 bg-white">
      <div className="rounded-lg inset-shadow-2xs p-4"> 
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Employees Payroll</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-700">Filters</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Find Employee"
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <UserPlus className="w-4 h-4" />
              Add Employee
            </button>
          </div>
        </div>
        {/* Table */}
        <div className="bg-white overflow-hidden">
          <table className="">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Pay <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Pay <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Benefits <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Incentives <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deductions <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cost <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Upcoming Payroll <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payslip <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* CHANGE THIS LINE: Use currentEmployees instead of employees */}
              {currentEmployees.map((employee) => (
                <tr key={employee.employee_id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div>
                      <div className="text-xs font-medium text-gray-900">{employee.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(employee.gross_pay)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(employee.net_pay)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(employee.salary)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(employee.benefits)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(employee.incentives)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatCurrency(employee.deductions)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900 font-medium">
                    {formatCurrency(employee.total_cost)}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-900">
                    {formatDate(employee.upcoming_payroll)}
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(employee.status)}
                  </td>
                  <td className="px-4 py-4">
                    <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-md transition-colors">
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ADD THIS ENTIRE PAGINATION SECTION */}
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

export default PayrollTable;