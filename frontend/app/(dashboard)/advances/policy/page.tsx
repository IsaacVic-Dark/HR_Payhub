"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdvancePolicyForm } from "@/app/(dashboard)/advances/policy/components/advance-policy-form";

export default function AdvancePolicyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="mt-4 mx-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Advance Policy</h1>
            <p className="text-sm text-muted-foreground">
              Set the limits, approval steps and recovery rules for salary advances.
            </p>
          </div>
          <Button asChild variant="outline" className="flex items-center gap-1.5 shrink-0">
            <Link href="/advances">
              <ArrowLeft className="w-4 h-4" />
              Back to Advances
            </Link>
          </Button>
        </div>
        <div className="mx-6 py-4 md:py-6 max-w-4xl">
          <AdvancePolicyForm />
        </div>
      </div>
    </div>
  );
}