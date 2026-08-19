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
  countryAPI,
  CountryType,
  CreateCountryPayload,
  UpdateCountryPayload,
} from "@/services/api/countries-counties";
import { toast } from "sonner";

interface CountryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country?: CountryType | null; // if provided → edit mode
  onSuccess: () => void;
}

export function CountryFormDialog({
  open,
  onOpenChange,
  country,
  onSuccess,
}: CountryFormDialogProps) {
  const isEdit = !!country;

  const [form, setForm] = useState({
    name: "",
    iso2: "",
    iso3: "",
    phone_code: "",
    currency_code: "",
    currency_symbol: "",
    timezone: "",
    is_active: 1 as 0 | 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (country) {
      setForm({
        name: country.name,
        iso2: country.iso2,
        iso3: country.iso3,
        phone_code: country.phone_code ?? "",
        currency_code: country.currency_code ?? "",
        currency_symbol: country.currency_symbol ?? "",
        timezone: country.timezone ?? "",
        is_active: country.is_active as 0 | 1,
      });
    } else {
      setForm({
        name: "",
        iso2: "",
        iso3: "",
        phone_code: "",
        currency_code: "",
        currency_symbol: "",
        timezone: "",
        is_active: 1,
      });
    }
    setErrors({});
  }, [country, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Country name is required";
    if (form.iso2.trim().length !== 2) newErrors.iso2 = "ISO2 must be exactly 2 characters";
    if (form.iso3.trim().length !== 3) newErrors.iso3 = "ISO3 must be exactly 3 characters";
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

      if (isEdit && country) {
        const payload: UpdateCountryPayload = {
          name: form.name.trim(),
          iso2: form.iso2.trim().toUpperCase(),
          iso3: form.iso3.trim().toUpperCase(),
          phone_code: form.phone_code.trim() || null,
          currency_code: form.currency_code.trim() || null,
          currency_symbol: form.currency_symbol.trim() || null,
          timezone: form.timezone.trim() || null,
          is_active: form.is_active,
        };
        response = await countryAPI.updateCountry(country.id, payload);
      } else {
        const payload: CreateCountryPayload = {
          name: form.name.trim(),
          iso2: form.iso2.trim().toUpperCase(),
          iso3: form.iso3.trim().toUpperCase(),
          phone_code: form.phone_code.trim() || null,
          currency_code: form.currency_code.trim() || null,
          currency_symbol: form.currency_symbol.trim() || null,
          timezone: form.timezone.trim() || null,
          is_active: form.is_active,
        };
        response = await countryAPI.createCountry(payload);
      }

      if (response.success) {
        toast.success(
          isEdit ? "Country updated successfully" : "Country created successfully"
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
          <DialogTitle>{isEdit ? "Edit Country" : "Create Country"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Country Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Kenya"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* ISO2 / ISO3 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ISO2 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.iso2}
                maxLength={2}
                onChange={(e) =>
                  setForm((p) => ({ ...p, iso2: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. KE"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.iso2 ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.iso2 && <p className="text-xs text-red-500 mt-1">{errors.iso2}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ISO3 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.iso3}
                maxLength={3}
                onChange={(e) =>
                  setForm((p) => ({ ...p, iso3: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. KEN"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.iso3 ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.iso3 && <p className="text-xs text-red-500 mt-1">{errors.iso3}</p>}
            </div>
          </div>

          {/* Phone code */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Phone Code
            </label>
            <input
              type="text"
              value={form.phone_code}
              onChange={(e) => setForm((p) => ({ ...p, phone_code: e.target.value }))}
              placeholder="e.g. +254"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Currency Code
              </label>
              <input
                type="text"
                value={form.currency_code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, currency_code: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. KES"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={form.currency_symbol}
                onChange={(e) =>
                  setForm((p) => ({ ...p, currency_symbol: e.target.value }))
                }
                placeholder="e.g. KSh"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <input
              type="text"
              value={form.timezone}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              placeholder="e.g. Africa/Nairobi"
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
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Country"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}