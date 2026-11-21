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
  countyAPI,
  CountyType,
  CreateCountyPayload,
  UpdateCountyPayload,
} from "@/services/api/countries-counties";
import { toast } from "sonner";

interface CountyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countryId: number;
  county?: CountyType | null; // if provided → edit mode
  onSuccess: () => void;
}

export function CountyFormDialog({
  open,
  onOpenChange,
  countryId,
  county,
  onSuccess,
}: CountyFormDialogProps) {
  const isEdit = !!county;

  const [form, setForm] = useState({
    name: "",
    code: "",
    is_active: 1 as 0 | 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (county) {
      setForm({
        name: county.name,
        code: county.code ?? "",
        is_active: county.is_active as 0 | 1,
      });
    } else {
      setForm({ name: "", code: "", is_active: 1 });
    }
    setErrors({});
  }, [county, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "County name is required";
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

      // Note: country_id is immutable via the update endpoint — a county
      // can't be reassigned to a different country from this dialog.
      if (isEdit && county) {
        const payload: UpdateCountyPayload = {
          name: form.name.trim(),
          code: form.code.trim() || null,
          is_active: form.is_active,
        };
        response = await countyAPI.updateCounty(county.id, payload);
      } else {
        const payload: CreateCountyPayload = {
          name: form.name.trim(),
          code: form.code.trim() || null,
          is_active: form.is_active,
        };
        response = await countyAPI.createCounty(countryId, payload);
      }

      if (response.success) {
        toast.success(
          isEdit ? "County updated successfully" : "County created successfully"
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
          <DialogTitle>{isEdit ? "Edit County" : "Add County"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              County Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Nairobi"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              County Code
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) =>
                setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
              }
              placeholder="e.g. 047"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  setForm((p) => ({ ...p, is_active: Number(e.target.value) as 0 | 1 }))
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
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Add County"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}