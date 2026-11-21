"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Lock, RotateCcw, Save, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  templateAPI,
  type DocumentTemplate,
  type LayoutKey,
  type LogoValue,
  type TemplateDraftPayload,
  type TemplateMeta,
} from "@/services/api/template";
import { TemplateStatusBadge, PendingChangesBadge } from "./template-status-badge";
import { TemplateActivateDialog } from "./template-activate-dialog";
import { TemplatePreviewPanel } from "./template-preview-panel";
import { TemplateVersionsPanel } from "./template-versions-panel";

// ---------------------------------------------------------------------------
// Validation (mirrors the server rules so admins get instant feedback; the server
// remains the authority and its messages are shown too)
// ---------------------------------------------------------------------------
const HEX = /^#[0-9A-Fa-f]{6}$/;
const LABEL_RE = /^[\p{L}\p{N} .,&()/'’:%#+-]+$/u;
const BAD_TEXT = /[<>`]|\{\{|\}\}|\{%|\$\{|javascript\s*:/i;

type Errors = Record<string, string>;

function validate(form: TemplateDraftPayload, meta: TemplateMeta): Errors {
  const e: Errors = {};
  const { limits } = meta;
  if (!form.name.trim()) e.name = "Template name is required";
  else if (form.name.length > limits.name) e.name = `Maximum ${limits.name} characters`;
  else if (BAD_TEXT.test(form.name)) e.name = "Contains characters that are not allowed";

  if (!form.config.documentTitle.trim()) e["config.documentTitle"] = "Document title is required";
  else if (form.config.documentTitle.length > limits.document_title) e["config.documentTitle"] = `Maximum ${limits.document_title} characters`;
  else if (BAD_TEXT.test(form.config.documentTitle)) e["config.documentTitle"] = "Contains characters that are not allowed";

  if (form.primary_color && !HEX.test(form.primary_color)) e.primary_color = "Use a HEX colour like #1E3A8A";
  if (form.accent_color && !HEX.test(form.accent_color)) e.accent_color = "Use a HEX colour like #2563EB";

  if (form.config.footerText.length > limits.footer_text) e["config.footerText"] = `Maximum ${limits.footer_text} characters`;
  else if (BAD_TEXT.test(form.config.footerText)) e["config.footerText"] = "Contains characters that are not allowed";

  for (const [key, value] of Object.entries(form.config.labels)) {
    if (!value.trim()) e[`config.labels.${key}`] = "Label cannot be empty";
    else if (value.length > limits.label) e[`config.labels.${key}`] = `Maximum ${limits.label} characters`;
    else if (!LABEL_RE.test(value)) e[`config.labels.${key}`] = "Only letters, numbers and . , & ( ) / ' : % # + -";
  }
  return e;
}

function tabForError(key: string): string {
  if (key === "name" || key === "layout_key" || key === "config.documentTitle") return "general";
  if (key.startsWith("config.labels")) return "labels";
  if (key.startsWith("config.sections") || /^config\.show(?!Footer)/.test(key)) return "sections";
  return "branding";
}

const MANDATORY_LABELS: Record<string, string> = {
  showEmployeeDetails: "Employee details",
  showPaymentSummary: "Payment summary",
  showEarnings: "Earnings",
  showDeductions: "Deductions",
  showStatutoryDeductions: "Statutory deductions (PAYE, NSSF, SHIF, Housing Levy)",
};

const OPTIONAL_TOGGLES: { key: string; label: string; hint?: string }[] = [
  { key: "showCompanyHeader", label: "Company header", hint: "Name, address, KRA PIN and logo" },
  { key: "showAllowances", label: "Allowances", hint: "Itemised under earnings" },
  { key: "showReimbursements", label: "Reimbursements", hint: "Itemised under earnings" },
  { key: "showAdvances", label: "Advance recoveries" },
  { key: "showLoanDeductions", label: "Loan repayments" },
  { key: "showLeaveSummary", label: "Leave summary", hint: "Entitled, used and available days" },
  { key: "showBankDetails", label: "Bank details", hint: "Bank name and masked account number" },
  { key: "showPaymentDate", label: "Payment date" },
];

// Labels shown first in the editor; the rest follow alphabetically.
const PRIMARY_LABELS = ["employee", "employeeNumber", "payPeriod", "basicSalary", "grossPay", "totalDeductions", "netPay", "paye", "nssf", "shif", "housingLevy"];

// ---------------------------------------------------------------------------

function toForm(t: DocumentTemplate, meta: TemplateMeta): TemplateDraftPayload {
  return {
    name: t.name,
    layout_key: t.layout_key,
    primary_color: t.primary_color ?? t.resolved_colors.primary,
    accent_color: t.accent_color ?? t.resolved_colors.accent,
    logo: t.logo,
    // fill any label added after the template was saved
    config: { ...t.config, labels: { ...meta.label_defaults, ...t.config.labels } },
  };
}

function blankForm(meta: TemplateMeta): TemplateDraftPayload {
  const layout = meta.layouts[0];
  return {
    name: "",
    layout_key: layout.key,
    primary_color: layout.colors.primary,
    accent_color: layout.colors.accent,
    logo: { mode: "organization" },
    config: { ...meta.default_config, layout: layout.key },
  };
}

interface Props {
  /** omit for the "new template" page */
  templateId?: number;
}

export function TemplateEditor({ templateId }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [meta, setMeta] = useState<TemplateMeta | null>(null);
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [form, setForm] = useState<TemplateDraftPayload | null>(null);
  const [savedKey, setSavedKey] = useState("");
  const [carrierId, setCarrierId] = useState<number | null>(templateId ?? null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [tab, setTab] = useState("general");
  const [versionsKey, setVersionsKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- load -------------------------------------------------------------
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setLoadError(null);
    const [metaRes, tplRes, listRes] = await Promise.all([
      templateAPI.getMeta(orgId),
      templateId ? templateAPI.get(orgId, templateId) : Promise.resolve(null),
      templateId ? Promise.resolve(null) : templateAPI.list(orgId),
    ]);
    if (!metaRes.success || !metaRes.data) {
      setLoadError(metaRes.error ?? "Could not load template settings");
      setLoading(false);
      return;
    }
    setMeta(metaRes.data);
    if (templateId) {
      if (!tplRes?.success || !tplRes.data) {
        setLoadError(tplRes?.error ?? "Template not found");
        setLoading(false);
        return;
      }
      setTemplate(tplRes.data);
      const f = toForm(tplRes.data, metaRes.data);
      setForm(f);
      setSavedKey(JSON.stringify(f));
    } else {
      const f = blankForm(metaRes.data);
      setForm(f);
      setSavedKey(JSON.stringify(f));
      // new templates preview through the active template (the server renders the draft)
      const list = listRes?.data ?? [];
      setCarrierId((list.find((t) => t.status === "active") ?? list[0])?.id ?? null);
    }
    setLoading(false);
  }, [orgId, templateId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = form !== null && JSON.stringify(form) !== savedKey;
  const readOnly = template?.status === "archived";

  // warn before losing edits
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---- form helpers -----------------------------------------------------
  const patch = (p: Partial<TemplateDraftPayload>) => setForm((f) => (f ? { ...f, ...p } : f));
  const patchConfig = (p: Partial<TemplateDraftPayload["config"]>) =>
    setForm((f) => (f ? { ...f, config: { ...f.config, ...p } } : f));
  const setLabel = (key: string, value: string) =>
    setForm((f) => (f ? { ...f, config: { ...f.config, labels: { ...f.config.labels, [key]: value } } } : f));

  const changeLayout = (key: LayoutKey) => {
    if (!form || !meta) return;
    const prev = meta.layouts.find((l) => l.key === form.layout_key);
    const next = meta.layouts.find((l) => l.key === key)!;
    // keep custom colours; swap to the new layout's palette only if the colours were the old defaults
    const primary = form.primary_color?.toUpperCase() === prev?.colors.primary.toUpperCase() ? next.colors.primary : form.primary_color;
    const accent = form.accent_color?.toUpperCase() === prev?.colors.accent.toUpperCase() ? next.colors.accent : form.accent_color;
    setForm({ ...form, layout_key: key, primary_color: primary, accent_color: accent, config: { ...form.config, layout: key } });
  };

  const moveSection = (key: "earnings" | "deductions", dir: -1 | 1) => {
    if (!form) return;
    const other = key === "earnings" ? "deductions" : "earnings";
    const a = form.config.sections[key].order;
    const b = form.config.sections[other].order;
    const target = a + dir;
    if (target < 1 || target > 2) return;
    patchConfig({
      sections: {
        ...form.config.sections,
        [key]: { ...form.config.sections[key], order: target },
        [other]: { ...form.config.sections[other], order: b === target ? a : b },
      },
    });
  };

  const uploadLogo = async (file: File) => {
    if (!orgId || !meta) return;
    if (file.size > meta.limits.logo_bytes) {
      toast.error("Logo must be 1 MB or smaller");
      return;
    }
    setUploading(true);
    const res = await templateAPI.uploadLogo(orgId, file);
    setUploading(false);
    if (res.success && res.data?.logo) {
      patch({ logo: res.data.logo });
      toast.success("Logo uploaded");
    } else {
      toast.error(res.errors?.logo ?? res.error ?? "Could not upload the logo");
    }
  };

  // ---- save / activate --------------------------------------------------
  const showErrors = (errs: Errors) => {
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) setTab(tabForError(first));
  };

  const save = async (): Promise<boolean> => {
    if (!orgId || !form || !meta) return false;
    setAttempted(true);
    const clientErrors = validate(form, meta);
    if (Object.keys(clientErrors).length) {
      showErrors(clientErrors);
      toast.error("Please fix the highlighted fields");
      return false;
    }
    setSaving(true);
    const res = templateId ? await templateAPI.update(orgId, templateId, form) : await templateAPI.create(orgId, form);
    setSaving(false);
    if (!res.success || !res.data) {
      showErrors(res.errors ?? {});
      toast.error(res.error ?? "Could not save the template");
      return false;
    }
    setErrors({});
    toast.success(res.message ?? "Template saved");
    if (!templateId) {
      router.replace(`/templates/${res.data.id}`);
      return true;
    }
    setTemplate(res.data);
    setSavedKey(JSON.stringify(form));
    return true;
  };

  const activate = async () => {
    if (!orgId || !templateId) return;
    setActivating(true);
    const res = await templateAPI.activate(orgId, templateId);
    setActivating(false);
    setActivateOpen(false);
    if (!res.success || !res.data) {
      showErrors(res.errors ?? {});
      toast.error(res.error ?? "Could not activate the template");
      return;
    }
    toast.success(res.message ?? "Template activated");
    setTemplate(res.data);
    const f = toForm(res.data, meta!);
    setForm(f);
    setSavedKey(JSON.stringify(f));
    setVersionsKey((k) => k + 1);
  };

  const clientErrors = useMemo(() => (form && meta ? validate(form, meta) : {}), [form, meta]);
  const invalid = Object.keys(clientErrors).length > 0;
  // server errors win; client errors show live, except "required" on name until the first save attempt
  const fe = (k: string) => errors[k] ?? (attempted || k !== "name" ? clientErrors[k] : undefined);

  // ---- render -----------------------------------------------------------
  if (loading || !meta || !form) {
    if (loadError) {
      return (
        <div className="mx-6 mt-6">
          <Alert variant="destructive">
            <AlertTitle>{loadError}</AlertTitle>
            <AlertDescription>
              <Link href="/templates" className="underline">
                Back to templates
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    return (
      <div className="mx-6 mt-6 grid gap-6 lg:grid-cols-[minmax(340px,460px)_1fr]">
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-[700px]" />
      </div>
    );
  }

  const isActive = template?.status === "active";
  const pending = isActive && (dirty || template?.has_pending_changes);
  const showActivate = !!templateId && (template?.status !== "active" || !!pending);

  return (
    <div className="flex flex-1 flex-col">
      {/* header */}
      <div className="mt-4 mx-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/templates" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Templates
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium">{templateId ? form.name || "Payslip template" : "New payslip template"}</h1>
            {template && <TemplateStatusBadge status={template.status} />}
            {isActive && pending && <PendingChangesBadge />}
            {template?.active_version && (
              <span className="text-xs text-muted-foreground">Live version {template.active_version}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <Button variant="outline" onClick={save} disabled={saving || activating || (!dirty && !!templateId)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          )}
          {showActivate && (
            <Button
              onClick={() => setActivateOpen(true)}
              disabled={dirty || invalid || saving || activating}
              title={dirty ? "Save your changes before activating" : invalid ? "Fix the validation errors first" : undefined}
            >
              <Zap className="mr-2 h-4 w-4" /> {readOnly ? "Restore & Activate" : "Activate Template"}
            </Button>
          )}
        </div>
      </div>

      {/* banners */}
      <div className="mx-6 mt-3 space-y-2">
        {readOnly && (
          <Alert>
            <AlertTitle>This template is archived</AlertTitle>
            <AlertDescription>It cannot be edited. Restore it to make it the active template.</AlertDescription>
          </Alert>
        )}
        {isActive && (
          <Alert>
            <AlertTitle>This is your live template</AlertTitle>
            <AlertDescription>
              Changes are saved as a draft and do not affect new payslips until you click <strong>Activate Template</strong>.
            </AlertDescription>
          </Alert>
        )}
        {!templateId && (
          <Alert>
            <AlertTitle>Start from a layout</AlertTitle>
            <AlertDescription>
              Save the draft first. You can preview it with sample data or real payroll data, then activate it when you are happy.
            </AlertDescription>
          </Alert>
        )}
        {Object.keys(errors).length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Some settings need attention</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {Object.entries(errors).map(([k, m]) => (
                  <li key={k}>{m}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* two panels */}
      <div className="mx-6 my-4 grid gap-6 lg:grid-cols-[minmax(340px,460px)_1fr]">
        {/* LEFT: settings */}
        <div className="rounded-lg border bg-white p-4 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
          <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
                <TabsTrigger value="labels">Labels</TabsTrigger>
                {templateId && <TabsTrigger value="history">History</TabsTrigger>}
              </TabsList>

              {/* GENERAL */}
              <TabsContent value="general" className="pt-4">
                <Locked readOnly={readOnly} className="space-y-5">
                <Field label="Template name" error={fe("name")} hint={`${form.name.length}/${meta.limits.name}`}>
                  <Input
                    value={form.name}
                    maxLength={meta.limits.name}
                    placeholder="e.g. Standard Payslip 2026"
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </Field>

                <div className="space-y-2">
                  <Label>Layout</Label>
                  <div className="grid gap-2">
                    {meta.layouts.map((l) => (
                      <button
                        key={l.key}
                        type="button"
                        onClick={() => changeLayout(l.key)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                          form.layout_key === l.key ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "hover:bg-gray-50"
                        }`}
                      >
                        <LayoutThumb layout={l.key} primary={l.colors.primary} accent={l.colors.accent} />
                        <div>
                          <div className="text-sm font-medium">{l.label}</div>
                          <div className="text-xs text-muted-foreground">{l.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Field
                  label="Document title"
                  error={fe("config.documentTitle")}
                  hint={`${form.config.documentTitle.length}/${meta.limits.document_title}`}
                >
                  <Input
                    value={form.config.documentTitle}
                    maxLength={meta.limits.document_title}
                    onChange={(e) => patchConfig({ documentTitle: e.target.value })}
                  />
                </Field>
                </Locked>
              </TabsContent>

              {/* BRANDING */}
              <TabsContent value="branding" className="pt-4">
                <Locked readOnly={readOnly} className="space-y-5">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["none", "No logo"],
                        ["organization", "Organization logo"],
                        ["uploaded", "Upload new"],
                      ] as const
                    ).map(([mode, text]) => (
                      <Button
                        key={mode}
                        type="button"
                        size="sm"
                        variant={form.logo.mode === mode ? "default" : "outline"}
                        onClick={() => {
                          if (mode === "uploaded") fileRef.current?.click();
                          else patch({ logo: { mode } as LogoValue });
                        }}
                        disabled={uploading}
                      >
                        {mode === "uploaded" && (uploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />)}
                        {text}
                      </Button>
                    ))}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.logo.mode === "uploaded"
                      ? "Custom logo uploaded. Upload again to replace it."
                      : form.logo.mode === "organization"
                      ? "Uses the logo from your company profile."
                      : "PNG or JPEG, up to 1 MB."}
                  </p>
                  {(fe("logo") || fe("logo.token")) && (
                    <p className="text-xs text-red-600">{fe("logo.token") ?? fe("logo")}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ColorField
                    label="Primary colour"
                    value={form.primary_color ?? ""}
                    error={fe("primary_color")}
                    onChange={(v) => patch({ primary_color: v })}
                  />
                  <ColorField
                    label="Accent colour"
                    value={form.accent_color ?? ""}
                    error={fe("accent_color")}
                    onChange={(v) => patch({ accent_color: v })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Footer text</Label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      Show footer
                      <Switch checked={form.config.showFooter} onCheckedChange={(v) => patchConfig({ showFooter: v })} />
                    </div>
                  </div>
                  <Textarea
                    rows={3}
                    value={form.config.footerText}
                    maxLength={meta.limits.footer_text}
                    onChange={(e) => patchConfig({ footerText: e.target.value })}
                    placeholder="This is a system-generated payslip."
                  />
                  <div className="flex justify-between text-xs">
                    <span className="text-red-600">{fe("config.footerText")}</span>
                    <span className="text-muted-foreground">
                      {form.config.footerText.length}/{meta.limits.footer_text}
                    </span>
                  </div>
                </div>
                </Locked>
              </TabsContent>

              {/* SECTIONS */}
              <TabsContent value="sections" className="pt-4">
                <Locked readOnly={readOnly} className="space-y-5">
                <div className="space-y-2">
                  <Label>Required sections</Label>
                  <p className="text-xs text-muted-foreground">These are always shown so a payslip never hides mandatory payroll information. Net pay is always shown.</p>
                  <ul className="divide-y rounded-lg border">
                    {meta.mandatory_keys.map((k) => (
                      <li key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{MANDATORY_LABELS[k] ?? k}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" /> Required
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label>Optional sections</Label>
                  <ul className="divide-y rounded-lg border">
                    {OPTIONAL_TOGGLES.map((t) => (
                      <li key={t.key} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div>
                          <div className="text-sm">{t.label}</div>
                          {t.hint && <div className="text-xs text-muted-foreground">{t.hint}</div>}
                        </div>
                        <Switch
                          checked={Boolean((form.config as any)[t.key])}
                          onCheckedChange={(v) => patchConfig({ [t.key]: v } as any)}
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Hiding a section removes its itemised lines only. Totals still include them.</p>
                </div>

                <div className="space-y-2">
                  <Label>Section order</Label>
                  <ul className="divide-y rounded-lg border">
                    {(["earnings", "deductions"] as const)
                      .slice()
                      .sort((a, b) => form.config.sections[a].order - form.config.sections[b].order)
                      .map((key, idx) => (
                        <li key={key} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span>
                            {idx + 1}. {form.config.labels[key] || key}
                          </span>
                          <span className="flex gap-1">
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={idx === 0} onClick={() => moveSection(key, -1)} title="Move up">
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={idx === 1} onClick={() => moveSection(key, 1)} title="Move down">
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
                </Locked>
              </TabsContent>

              {/* LABELS */}
              <TabsContent value="labels" className="pt-4">
                <Locked readOnly={readOnly} className="space-y-3">
                <p className="text-xs text-muted-foreground">Change the wording shown on the payslip. Amounts and calculations are not affected.</p>
                {[...PRIMARY_LABELS, ...Object.keys(meta.label_defaults).filter((k) => !PRIMARY_LABELS.includes(k)).sort()].map((key) => {
                  const value = form.config.labels[key] ?? meta.label_defaults[key];
                  const err = fe(`config.labels.${key}`);
                  const changed = value !== meta.label_defaults[key];
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">{meta.label_defaults[key]}</Label>
                        {changed && (
                          <button type="button" className="flex items-center text-xs text-blue-600 hover:underline" onClick={() => setLabel(key, meta.label_defaults[key])}>
                            <RotateCcw className="mr-1 h-3 w-3" /> Reset
                          </button>
                        )}
                      </div>
                      <Input value={value} maxLength={meta.limits.label} onChange={(e) => setLabel(key, e.target.value)} className={err ? "border-red-500" : ""} />
                      {err && <p className="text-xs text-red-600">{err}</p>}
                    </div>
                  );
                })}
                </Locked>
              </TabsContent>

              {/* HISTORY */}
              {templateId && orgId && (
                <TabsContent value="history" className="pt-4">
                  <TemplateVersionsPanel orgId={orgId} templateId={templateId} refreshKey={versionsKey} />
                </TabsContent>
              )}
          </Tabs>
        </div>

        {/* RIGHT: live preview */}
        <div className="min-w-0 rounded-lg border bg-gray-50 p-4">
          {orgId && <TemplatePreviewPanel orgId={orgId} templateId={carrierId} draft={form} />}
        </div>
      </div>

      <TemplateActivateDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        templateName={form.name}
        isReactivation={isActive}
        loading={activating}
        onConfirm={activate}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// small pieces
// ---------------------------------------------------------------------------

function Locked({ readOnly, className, children }: { readOnly: boolean; className?: string; children: React.ReactNode }) {
  return (
    <fieldset disabled={readOnly} className={`min-w-0 disabled:opacity-70 ${className ?? ""}`}>
      {children}
    </fieldset>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ColorField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-10 cursor-pointer rounded border bg-white p-0.5"
          aria-label={label}
        />
        <Input value={value} maxLength={7} onChange={(e) => onChange(e.target.value.toUpperCase())} className={`font-mono text-xs ${error ? "border-red-500" : ""}`} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Tiny schematic of each layout, drawn with CSS so there are no image assets. */
function LayoutThumb({ layout, primary, accent }: { layout: LayoutKey; primary: string; accent: string }) {
  return (
    <div className="h-14 w-11 shrink-0 overflow-hidden rounded border bg-white p-1">
      {layout === "modern" && (
        <>
          <div className="h-3 rounded-sm" style={{ background: primary }} />
          <div className="mt-1 flex gap-0.5">
            <div className="h-2 flex-1 rounded-sm bg-gray-200" />
            <div className="h-2 flex-1 rounded-sm" style={{ background: accent }} />
          </div>
          <div className="mt-1 h-5 rounded-sm border" />
        </>
      )}
      {layout === "classic" && (
        <>
          <div className="mx-auto h-1 w-6 rounded-sm" style={{ background: primary }} />
          <div className="mt-1 h-px" style={{ background: primary }} />
          <div className="mt-1 grid grid-cols-2 gap-px">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-1.5 border" />
            ))}
          </div>
          <div className="mt-1 h-2" style={{ background: primary }} />
        </>
      )}
      {layout === "minimal" && (
        <>
          <div className="h-1 w-4 rounded-sm" style={{ background: primary }} />
          <div className="mt-1 space-y-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-px bg-gray-300" />
            ))}
          </div>
          <div className="mt-2 h-2 rounded-sm" style={{ background: primary }} />
        </>
      )}
    </div>
  );
}
