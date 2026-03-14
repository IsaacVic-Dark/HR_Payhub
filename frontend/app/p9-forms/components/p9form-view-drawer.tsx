"use client";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { type P9FormType } from "@/services/api/p9forms";
import { Download, Send, CheckCircle, X, FileText, Calendar, User, Building, Hash } from "lucide-react";
import { format } from "date-fns";

interface P9FormViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  p9Form: P9FormType | null;
  onSend?: (p9Form: P9FormType) => void;
  onFile?: (p9Form: P9FormType) => void;
  onDownload?: (p9Form: P9FormType) => void;
}

export function P9FormViewDrawer({
  open,
  onOpenChange,
  p9Form,
  onSend,
  onFile,
  onDownload,
}: P9FormViewDrawerProps) {
  if (!p9Form) return null;

  const formatCurrency = (value: number) => {
    return `Kshs ${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "generated":
        return "bg-yellow-100 text-yellow-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "filed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="max-w-[600px]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-xl">P9 Form Details</DrawerTitle>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Header with P9 Number and Status */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{p9Form.p9number}</h3>
              <p className="text-sm text-gray-500">Tax Form for Year {p9Form.year}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(p9Form.status)}`}>
              {p9Form.status.charAt(0).toUpperCase() + p9Form.status.slice(1)}
            </span>
          </div>

          {/* Employee Information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Employee Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-sm font-medium">{p9Form.employee_name || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Employee Number</p>
                  <p className="text-sm font-medium">{p9Form.employee_number || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Department</p>
                  <p className="text-sm font-medium">{p9Form.department_name || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">KRA PIN</p>
                  <p className="text-sm font-medium">{p9Form.employee_pin || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Employer Information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Employer Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Organization</p>
                  <p className="text-sm font-medium">{p9Form.organization_name || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Employer PIN</p>
                  <p className="text-sm font-medium">{p9Form.employer_pin || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Annual Totals */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Annual Totals</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Basic Salary</p>
                <p className="text-sm font-medium">{formatCurrency(p9Form.total_basic_salary)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gross Pay</p>
                <p className="text-sm font-medium">{formatCurrency(p9Form.total_gross_pay)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Taxable Pay</p>
                <p className="text-sm font-medium">{formatCurrency(p9Form.total_taxable_pay)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">PAYE Deducted</p>
                <p className="text-sm font-medium text-red-600">{formatCurrency(p9Form.total_paye)}</p>
              </div>
            </div>
          </div>

          {/* Generated Date */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Generated On</p>
                <p className="text-sm font-medium">
                  {format(new Date(p9Form.generatedat), "MMMM dd, yyyy 'at' hh:mm a")}
                </p>
              </div>
            </div>
          </div>

          {/* PDF Preview Placeholder */}
          {p9Form.pdfpath && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">PDF Document</h4>
              <div className="bg-white rounded-lg border p-8 flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm text-gray-600 mb-2">P9 Form PDF</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload?.(p9Form)}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t p-4">
          <div className="flex items-center justify-end gap-3">
            {p9Form.status === "generated" && onSend && (
              <Button onClick={() => onSend(p9Form)} className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Mark as Sent
              </Button>
            )}
            {p9Form.status === "sent" && onFile && (
              <Button onClick={() => onFile(p9Form)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4" />
                Mark as Filed
              </Button>
            )}
            {p9Form.pdfpath && onDownload && (
              <Button variant="outline" onClick={() => onDownload(p9Form)} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}