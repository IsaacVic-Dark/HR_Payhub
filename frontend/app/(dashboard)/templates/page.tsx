"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Archive, Eye, FileText, Pencil, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { DataTable, ColumnDef } from "@/components/table";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { templateAPI, type DocumentTemplate } from "@/services/api/template";
import { TemplateStatusBadge, PendingChangesBadge } from "./components/template-status-badge";
import { TemplateActivateDialog } from "./components/template-activate-dialog";
import { TemplatePreviewPanel } from "./components/template-preview-panel";

const LAYOUT_LABEL: Record<string, string> = { modern: "Modern", classic: "Classic", minimal: "Minimal" };
const TYPE_LABEL: Record<string, string> = { payslip: "Payslip" };

const formatDate = (value: string) => {
  const d = new Date(value.replace(" ", "T"));
  return isNaN(d.getTime()) ? "—" : format(d, "d MMM yyyy, HH:mm");
};

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewTarget, setPreviewTarget] = useState<DocumentTemplate | null>(null);
  const [activateTarget, setActivateTarget] = useState<DocumentTemplate | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<DocumentTemplate | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const res = await templateAPI.list(orgId);
    if (res.success) {
      setTemplates(res.data ?? []);
      setError(null);
    } else {
      setError(res.error ?? "Failed to load templates");
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const confirmActivate = async () => {
    if (!orgId || !activateTarget) return;
    setActivateLoading(true);
    const res = await templateAPI.activate(orgId, activateTarget.id);
    setActivateLoading(false);
    if (res.success) {
      toast.success(res.message ?? "Template activated");
      setActivateTarget(null);
      fetchTemplates();
    } else {
      toast.error(res.error ?? "Could not activate the template");
      if (res.errors && Object.keys(res.errors).length) {
        toast.error(Object.values(res.errors)[0]);
      }
    }
  };

  const confirmArchive = async () => {
    if (!orgId || !archiveTarget) return;
    setArchiveLoading(true);
    const res = await templateAPI.archive(orgId, archiveTarget.id);
    setArchiveLoading(false);
    if (res.success) {
      toast.success("Template archived");
      setArchiveTarget(null);
      fetchTemplates();
    } else {
      toast.error(res.error ?? "Could not archive the template");
    }
  };

  const columns: ColumnDef<DocumentTemplate>[] = [
    { key: "type", header: "Type", cell: (r) => TYPE_LABEL[r.template_type] ?? r.template_type },
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="font-medium text-left hover:underline" onClick={() => router.push(`/templates/${r.id}`)}>
            {r.name}
          </button>
          {r.has_pending_changes && <PendingChangesBadge />}
        </div>
      ),
    },
    { key: "layout", header: "Layout", cell: (r) => LAYOUT_LABEL[r.layout_key] ?? r.layout_key },
    { key: "status", header: "Status", cell: (r) => <TemplateStatusBadge status={r.status} /> },
    {
      key: "version",
      header: "Active version",
      cell: (r) => (r.active_version ? `v${r.active_version}` : <span className="text-muted-foreground">—</span>),
    },
    { key: "updated", header: "Last updated", cell: (r) => formatDate(r.updated_at) },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title={r.status === "archived" ? "View" : "Edit"} onClick={() => router.push(`/templates/${r.id}`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Preview" onClick={() => setPreviewTarget(r)}>
            <Eye className="h-4 w-4" />
          </Button>
          {(r.status !== "active" || r.has_pending_changes) && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-700 hover:text-green-800 hover:bg-green-50" title={r.status === "archived" ? "Restore & activate" : "Activate"} onClick={() => setActivateTarget(r)}>
              <Zap className="h-4 w-4" />
            </Button>
          )}
          {r.status === "draft" && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" title="Archive" onClick={() => setArchiveTarget(r)}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="mt-4 mx-6 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h1 className="text-2xl font-medium">Templates</h1>
              <p className="text-base text-muted-foreground">
                Customize how your payslips look: layout, logo, colours, sections and wording. Payroll figures never change.
              </p>
            </div>
            <Button onClick={() => router.push("/templates/new")}>
              <Plus className="mr-2 h-4 w-4" /> New Template
            </Button>
          </div>

          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="mx-6">
              {!loading && !error && templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
                  <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
                  <h2 className="text-lg font-medium">No payslip templates yet</h2>
                  <p className="mb-4 mt-1 max-w-md text-sm text-muted-foreground">
                    Create your first template to brand your payslips with your logo and colours.
                  </p>
                  <Button onClick={() => router.push("/templates/new")}>
                    <Plus className="mr-2 h-4 w-4" /> Create template
                  </Button>
                </div>
              ) : (
                <DataTable
                  data={templates}
                  columns={columns}
                  loading={loading}
                  error={error}
                  emptyMessage="No payslip templates yet"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* preview */}
      <Dialog open={!!previewTarget} onOpenChange={(o) => !o && setPreviewTarget(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewTarget?.name}</DialogTitle>
            <DialogDescription>
              Saved version of this template. Nothing is generated or stored by previewing.
            </DialogDescription>
          </DialogHeader>
          {previewTarget && orgId && <TemplatePreviewPanel orgId={orgId} templateId={previewTarget.id} />}
        </DialogContent>
      </Dialog>

      {/* activate */}
      <TemplateActivateDialog
        open={!!activateTarget}
        onOpenChange={(o) => !o && setActivateTarget(null)}
        templateName={activateTarget?.name ?? ""}
        isReactivation={activateTarget?.status === "active"}
        loading={activateLoading}
        onConfirm={confirmActivate}
      />

      {/* archive */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive template</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.name} will be archived. Payslips already generated with it are not affected, and you can
              restore it later by activating it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} disabled={archiveLoading} className="bg-red-600 hover:bg-red-700 text-white">
              {archiveLoading ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
