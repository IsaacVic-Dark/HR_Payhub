"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { subscriptionPlanAPI, type SubscriptionPlan } from "@/services/api/subscription-plan";
import { DataTablePlans } from "./components/data-table-plans";
import { PlanFormDialog } from "./components/plan-form-dialog";

export default function SubscriptionPlansPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.user_type === "super_admin";

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await subscriptionPlanAPI.getAllPlans();

    if (result.success && result.data) {
      setPlans(result.data);
    } else {
      setError(result.error || "Failed to load subscription plans.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchPlans();
  }, [isSuperAdmin, fetchPlans]);

  const openCreateDialog = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-dashed py-16 text-center text-sm text-gray-500">
          You don&apos;t have access to subscription plan management.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Subscription plans</h2>
          <p className="text-sm text-gray-500">
            Manage the plans organizations can subscribe to, and what each one includes.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New plan
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-md border py-16 text-center text-sm text-gray-500">
          Loading plans...
        </div>
      ) : (
        <DataTablePlans plans={plans} onEdit={openEditDialog} onChanged={fetchPlans} />
      )}

      <PlanFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editingPlan}
        onSaved={fetchPlans}
      />
    </div>
  );
}