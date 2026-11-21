"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Ban, RotateCcw } from "lucide-react";
import { subscriptionPlanAPI, type SubscriptionPlan } from "@/services/api/subscription-plan";

type DataTablePlansProps = {
  plans: SubscriptionPlan[];
  onEdit: (plan: SubscriptionPlan) => void;
  onChanged: () => void; // called after deactivate/reactivate so the parent can refetch
};

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});

export function DataTablePlans({ plans, onEdit, onChanged }: DataTablePlansProps) {
  const [pendingToggle, setPendingToggle] = useState<SubscriptionPlan | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const confirmToggle = async () => {
    if (!pendingToggle) return;

    setTogglingId(pendingToggle.id);
    const result = pendingToggle.is_active
      ? await subscriptionPlanAPI.deactivatePlan(pendingToggle.id)
      : await subscriptionPlanAPI.reactivatePlan(pendingToggle.id);
    setTogglingId(null);
    setPendingToggle(null);

    if (result.success) {
      onChanged();
    }
  };

  if (plans.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-16 text-center text-sm text-gray-500">
        No subscription plans yet. Create one to get started.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Base price</TableHead>
              <TableHead>Per employee</TableHead>
              <TableHead>Max employees</TableHead>
              <TableHead>Trial</TableHead>
              <TableHead>Features</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>
                  <div className="font-medium">{plan.name}</div>
                  <div className="text-xs text-gray-500">{plan.code}</div>
                </TableCell>
                <TableCell className="capitalize">{plan.billing_cycle}</TableCell>
                <TableCell>{currency.format(plan.base_price)}</TableCell>
                <TableCell>
                  {plan.price_per_employee !== null
                    ? currency.format(plan.price_per_employee)
                    : "—"}
                </TableCell>
                <TableCell>{plan.max_employees ?? "Unlimited"}</TableCell>
                <TableCell>
                  {plan.trial_days ? `${plan.trial_days} days` : "—"}
                </TableCell>
                <TableCell>
                  <FeaturesPreview features={plan.features} />
                </TableCell>
                <TableCell>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(plan)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPendingToggle(plan)}>
                        {plan.is_active ? (
                          <>
                            <Ban className="mr-2 h-4 w-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reactivate
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={Boolean(pendingToggle)} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle?.is_active ? "Deactivate plan?" : "Reactivate plan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.is_active
                ? `"${pendingToggle?.name}" will no longer be visible on pricing or sign-up pages. Organizations already on this plan are not affected.`
                : `"${pendingToggle?.name}" will become available again on pricing and sign-up pages.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} disabled={togglingId !== null}>
              {togglingId !== null ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FeaturesPreview({ features }: { features: string[] }) {
  if (features.length === 0) {
    return <span className="text-xs text-gray-400">None listed</span>;
  }

  const shown = features.slice(0, 2);
  const remaining = features.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1 max-w-[220px]">
      {shown.map((feature) => (
        <Badge key={feature} variant="outline" className="font-normal text-xs">
          {feature}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="font-normal text-xs text-gray-500">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
}