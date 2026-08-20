"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  subscriptionPlanAPI,
  type SubscriptionPlan,
  type CreatePlanPayload,
} from "@/services/api/subscription-plan";

type PlanFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: SubscriptionPlan | null; // present = edit mode, absent = create mode
  onSaved: () => void; // called after a successful create/update so the parent can refetch
};

type FormState = {
  code: string;
  name: string;
  billing_cycle: "monthly" | "annual";
  base_price: string;
  price_per_employee: string;
  trial_days: string;
  max_employees: string;
  requires_card: boolean;
  is_active: boolean;
  features: string[];
};

const emptyForm: FormState = {
  code: "",
  name: "",
  billing_cycle: "monthly",
  base_price: "",
  price_per_employee: "",
  trial_days: "0",
  max_employees: "",
  requires_card: false,
  is_active: true,
  features: [],
};

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  onSaved,
}: PlanFormDialogProps) {
  const isEditMode = Boolean(plan);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [newFeature, setNewFeature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset / hydrate the form whenever the dialog opens or the target plan changes
  useEffect(() => {
    if (!open) return;

    if (plan) {
      setForm({
        code: plan.code,
        name: plan.name,
        billing_cycle: plan.billing_cycle,
        base_price: String(plan.base_price ?? ""),
        price_per_employee:
          plan.price_per_employee !== null ? String(plan.price_per_employee) : "",
        trial_days: plan.trial_days !== null ? String(plan.trial_days) : "0",
        max_employees: plan.max_employees !== null ? String(plan.max_employees) : "",
        requires_card: plan.requires_card,
        is_active: plan.is_active,
        features: [...plan.features],
      });
    } else {
      setForm(emptyForm);
    }
    setNewFeature("");
    setError(null);
  }, [open, plan]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (!trimmed) return;
    if (form.features.includes(trimmed)) {
      setNewFeature("");
      return;
    }
    updateField("features", [...form.features, trimmed]);
    setNewFeature("");
  };

  const removeFeature = (feature: string) => {
    updateField(
      "features",
      form.features.filter((f) => f !== feature)
    );
  };

  const validate = (): string | null => {
    if (!form.code.trim()) return "Plan code is required.";
    if (!form.name.trim()) return "Plan name is required.";
    if (form.base_price === "" || Number(form.base_price) < 0) {
      return "Base price must be a valid, non-negative number.";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreatePlanPayload = {
      code: form.code.trim(),
      name: form.name.trim(),
      billing_cycle: form.billing_cycle,
      base_price: Number(form.base_price),
      price_per_employee:
        form.price_per_employee === "" ? null : Number(form.price_per_employee),
      trial_days: form.trial_days === "" ? 0 : Number(form.trial_days),
      max_employees: form.max_employees === "" ? null : Number(form.max_employees),
      requires_card: form.requires_card,
      is_active: form.is_active,
      features: form.features,
    };

    const result =
      isEditMode && plan
        ? await subscriptionPlanAPI.updatePlan(plan.id, payload)
        : await subscriptionPlanAPI.createPlan(payload);

    setSaving(false);

    if (!result.success) {
      setError(result.error || "Something went wrong. Please try again.");
      return;
    }

    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit plan" : "New subscription plan"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the pricing and features for this plan."
              : "Define a new plan organizations can subscribe to."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="code"
                placeholder="starter"
                value={form.code}
                onChange={(e) => updateField("code", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Starter"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billing_cycle">Billing cycle</Label>
              <Select
                value={form.billing_cycle}
                onValueChange={(value) =>
                  updateField("billing_cycle", value as "monthly" | "annual")
                }
              >
                <SelectTrigger id="billing_cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="base_price">
                Base price (KES) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="base_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.base_price}
                onChange={(e) => updateField("base_price", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_per_employee">Price per employee</Label>
              <Input
                id="price_per_employee"
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave blank if flat-rate"
                value={form.price_per_employee}
                onChange={(e) => updateField("price_per_employee", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_employees">Max employees</Label>
              <Input
                id="max_employees"
                type="number"
                min="0"
                placeholder="Leave blank for unlimited"
                value={form.max_employees}
                onChange={(e) => updateField("max_employees", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trial_days">Trial days</Label>
              <Input
                id="trial_days"
                type="number"
                min="0"
                value={form.trial_days}
                onChange={(e) => updateField("trial_days", e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 mt-6">
              <Label htmlFor="requires_card" className="cursor-pointer">
                Requires card upfront
              </Label>
              <Switch
                id="requires_card"
                checked={form.requires_card}
                onCheckedChange={(checked) => updateField("requires_card", checked)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-gray-500">
                Inactive plans are hidden from pricing pages and org sign-up.
              </p>
            </div>
            <Switch
              id="is_active"
              checked={form.is_active}
              onCheckedChange={(checked) => updateField("is_active", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Features</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Core payroll runs"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFeature();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addFeature}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {form.features.length === 0 ? (
              <p className="text-xs text-gray-500">No features added yet.</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {form.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
                  >
                    <span>{feature}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(feature)}
                      className="text-gray-400 hover:text-gray-700"
                      aria-label={`Remove ${feature}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEditMode ? "Save changes" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}