"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { departmentAPI, DepartmentEmployeeType } from "@/services/api/department";
import { toast } from "sonner";
import { Search, X, UserCheck } from "lucide-react";

interface AssignHeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: number;
  departmentId: number;
  departmentName: string;
  currentHeadEmployeeId: number | null;
  onSuccess: () => void;
}

export function AssignHeadDialog({
  open,
  onOpenChange,
  organizationId,
  departmentId,
  departmentName,
  currentHeadEmployeeId,
  onSuccess,
}: AssignHeadDialogProps) {
  const [employees, setEmployees] = useState<DepartmentEmployeeType[]>([]);
  const [filtered, setFiltered] = useState<DepartmentEmployeeType[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DepartmentEmployeeType | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch department employees when dialog opens
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected(null);

    const fetch = async () => {
      setLoadingEmployees(true);
      const response = await departmentAPI.getDepartmentEmployees(
        organizationId,
        departmentId,
        { per_page: 100 }
      );
      if (response.success && response.data) {
        const list = Array.isArray(response.data) ? response.data : [];
        setEmployees(list);
        setFiltered(list);
      } else {
        toast.error("Could not load department employees");
        setEmployees([]);
        setFiltered([]);
      }
      setLoadingEmployees(false);
    };

    fetch();
  }, [open, organizationId, departmentId]);

  // Filter on search input
  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      setFiltered(employees);
      return;
    }
    setFiltered(
      employees.filter(
        (e) =>
          e.first_name.toLowerCase().includes(q) ||
          e.surname.toLowerCase().includes(q) ||
          e.employee_number.toLowerCase().includes(q) ||
          (e.job_title?.toLowerCase().includes(q) ?? false)
      )
    );
  }, [search, employees]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (emp: DepartmentEmployeeType) => {
    setSelected(emp);
    setSearch(`${emp.first_name} ${emp.surname}`);
    setDropdownOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch("");
    setDropdownOpen(false);
  };

  const handleSubmit = async () => {
    if (!selected) {
      toast.error("Please select an employee");
      return;
    }

    setSubmitting(true);
    const response = await departmentAPI.assignHead(
      organizationId,
      departmentId,
      selected.id
    );

    if (response.success) {
      toast.success(
        `${response.data?.head_full_name ?? selected.first_name + " " + selected.surname} assigned as department head`
      );
      onSuccess();
      onOpenChange(false);
    } else {
      toast.error(response.error || "Failed to assign department head");
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            Assign Department Head
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Select a new head for <span className="font-medium">{departmentName}</span>
          </p>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Current head indicator */}
          {currentHeadEmployeeId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <span>This department already has a head. Assigning a new one will replace them.</span>
            </div>
          )}

          {/* Searchable dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Employee <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(null);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={
                    loadingEmployees
                      ? "Loading employees…"
                      : "Search by name or employee number…"
                  }
                  disabled={loadingEmployees}
                  className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
                {search && (
                  <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown list */}
              {dropdownOpen && !loadingEmployees && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      No employees found
                    </div>
                  ) : (
                    filtered.map((emp) => {
                      const isCurrentHead = emp.id === currentHeadEmployeeId;
                      return (
                        <button
                          key={emp.id}
                          onClick={() => handleSelect(emp)}
                          className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-start justify-between gap-2 ${
                            isCurrentHead ? "bg-gray-50" : ""
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {emp.first_name} {emp.surname}
                            </p>
                            <p className="text-xs text-gray-500">
                              {emp.employee_number}
                              {emp.job_title ? ` · ${emp.job_title}` : ""}
                            </p>
                          </div>
                          {isCurrentHead && (
                            <span className="text-xs text-amber-600 font-medium shrink-0 mt-0.5">
                              Current head
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected employee preview */}
          {selected && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="h-9 w-9 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                {selected.first_name[0]}
                {selected.surname[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {selected.first_name} {selected.surname}
                </p>
                <p className="text-xs text-blue-600">
                  {selected.employee_number}
                  {selected.job_title ? ` · ${selected.job_title}` : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selected}>
            {submitting ? "Assigning…" : "Assign as Head"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}