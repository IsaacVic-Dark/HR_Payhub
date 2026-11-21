"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  departmentAPI,
  DepartmentType,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from "@/services/api/department";
import { toast } from "sonner";

interface DepartmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: number;
  department?: DepartmentType | null; // if provided → edit mode
  onSuccess: () => void;
}

export function DepartmentFormDialog({
  open,
  onOpenChange,
  organizationId,
  department,
  onSuccess,
}: DepartmentFormDialogProps) {
  const isEdit = !!department;

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    is_active: 1 as 0 | 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (department) {
      setForm({
        name: department.name,
        code: department.code ?? "",
        description: department.description ?? "",
        is_active: department.is_active as 0 | 1,
      });
    } else {
      setForm({ name: "", code: "", description: "", is_active: 1 });
    }
    setErrors({});
  }, [department, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Department name is required";
    return newErrors;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      let response;

      if (isEdit && department) {
        const payload: UpdateDepartmentPayload = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          description: form.description.trim() || undefined,
          is_active: form.is_active,
        };
        response = await departmentAPI.updateDepartment(
          organizationId,
          department.id,
          payload
        );
      } else {
        const payload: CreateDepartmentPayload = {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          description: form.description.trim() || undefined,
          is_active: form.is_active,
        };
        response = await departmentAPI.createDepartment(organizationId, payload);
      }

      if (response.success) {
        toast.success(
          isEdit ? "Department updated successfully" : "Department created successfully"
        );
        onSuccess();
        onOpenChange(false);
      } else {
        if (response.errors) {
          const apiErrors: Record<string, string> = {};
          Object.entries(response.errors).forEach(([k, v]) => {
            apiErrors[k] = Array.isArray(v) ? v[0] : String(v);
          });
          setErrors(apiErrors);
        }
        toast.error(response.error || "Operation failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Department" : "Create Department"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Human Resources"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Department Code
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) =>
                setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
              }
              placeholder="e.g. HR"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Status (edit mode only) */}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={form.is_active}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    is_active: Number(e.target.value) as 0 | 1,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}