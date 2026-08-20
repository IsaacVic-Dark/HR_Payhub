"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CountryType } from "@/services/api/countries-counties";
import {
  publicHolidayAPI,
  type MasterHolidayType,
  type HolidayType,
} from "@/services/api/public-holidays";

const HOLIDAY_TYPES: { value: HolidayType; label: string }[] = [
  { value: "national", label: "National" },
  { value: "regional", label: "Regional" },
  { value: "religious", label: "Religious" },
  { value: "bank", label: "Bank" },
  { value: "observance", label: "Observance" },
];

interface HolidayFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing row to edit it, or null to create a new one. */
  holiday: MasterHolidayType | null;
  countries: CountryType[];
  /** Preselect the country the table is currently filtered to, on create. */
  defaultCountryCode?: string;
  /** Called after a successful create/update so the caller can refetch. */
  onSaved: () => void;
}

const emptyForm = {
  country_code: "",
  holiday_date: "",
  name: "",
  type: "" as HolidayType | "",
};

export function HolidayFormDialog({
  open,
  onOpenChange,
  holiday,
  countries,
  defaultCountryCode,
  onSaved,
}: HolidayFormDialogProps) {
  const isEdit = Boolean(holiday);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (holiday) {
      setForm({
        country_code: holiday.country_code,
        holiday_date: holiday.holiday_date.slice(0, 10),
        name: holiday.name,
        type: holiday.type ?? "",
      });
    } else {
      setForm({
        ...emptyForm,
        country_code: defaultCountryCode || "",
      });
    }
    setError(null);
  }, [open, holiday, defaultCountryCode]);

  const handleSubmit = async () => {
    if (!form.country_code) {
      setError("Country is required");
      return;
    }
    if (!form.holiday_date) {
      setError("Date is required");
      return;
    }
    if (!form.name.trim()) {
      setError("Holiday name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const response = isEdit
      ? await publicHolidayAPI.updateMasterHoliday(holiday!.id, {
          holiday_date: form.holiday_date,
          name: form.name.trim(),
          type: form.type || null,
        })
      : await publicHolidayAPI.createMasterHoliday({
          country_code: form.country_code,
          holiday_date: form.holiday_date,
          name: form.name.trim(),
          type: form.type || null,
        });

    setSaving(false);

    if (!response.success) {
      setError(response.error || "Something went wrong. Please try again.");
      return;
    }

    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this master calendar entry."
              : "Add a holiday to the master calendar for a country."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="holiday-country">Country</Label>
            <Select
              value={form.country_code}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, country_code: value }))
              }
              disabled={isEdit}
            >
              <SelectTrigger id="holiday-country" className="w-full">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent searchable searchPlaceholder="Search countries...">
                {countries.map((country) => (
                  <SelectItem key={country.iso2} value={country.iso2}>
                    {country.name} ({country.iso2})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Country can't be changed after creation. Deactivate this entry
                and add it under the correct country instead.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="holiday-date">Date</Label>
            <Input
              id="holiday-date"
              type="date"
              value={form.holiday_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, holiday_date: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="holiday-name">Holiday name</Label>
            <Input
              id="holiday-name"
              placeholder="e.g. Labour Day"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="holiday-type">Type (optional)</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, type: value as HolidayType }))
              }
            >
              <SelectTrigger id="holiday-type" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {HOLIDAY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}