"use client";

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
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  /** true when the template is already active and only has unactivated edits */
  isReactivation?: boolean;
  loading: boolean;
  onConfirm: () => void;
}

export function TemplateActivateDialog({
  open,
  onOpenChange,
  templateName,
  isReactivation,
  loading,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isReactivation ? "Activate your changes?" : "Activate this template?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{templateName}</span> will be used for{" "}
                <span className="font-medium">all payslips generated from now on</span>.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Payslips that were already generated keep the design they were created with.</li>
                {!isReactivation && <li>The template that is currently active will be archived.</li>}
                <li>Only the look changes. Payroll figures are never affected.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating...
              </>
            ) : (
              "Activate"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
