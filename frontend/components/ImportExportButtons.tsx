/**
 * ImportExportButtons.tsx
 *
 * A self-contained, reusable component that renders an Import button and an
 * Export button for any supported payroll module. The Import button opens a
 * 3-step wizard (Upload → Map → Review & Confirm) against
 * GET  /organizations/{org_id}/{module}/import/fields
 * POST /organizations/{org_id}/{module}/import
 * The Export button downloads a CSV directly (no dialog — CSV is currently
 * the only supported export format) from
 * GET  /organizations/{org_id}/{module}/export?format=csv
 *
 * organization_id is read internally via useAuth() — callers just pass
 * `module`, they don't need to know or supply the org id.
 *
 * Auth is handled the same way employee.ts does it: a plain fetch() with
 * credentials: "include" plus a manually-attached Bearer token read from the
 * access_token cookie — no axios, no shared authAPI instance. This means
 * (like employee.ts) there's no automatic 401 → refresh → retry here; if
 * that's ever needed, it should be added to both files the same way at once.
 *
 * Supported modules: employees
 * TODO: extend SupportedModule + add matching backend endpoints for other
 * modules (departments, payruns, job-titles, org configs, ...) as they're
 * built — this component doesn't need any other changes to support them.
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    Check,
    ChevronRight,
    Columns,
    Download,
    Eye,
    FileDown,
    FileText,
    FileUp,
    Info,
    Loader2,
    RefreshCw,
    ShieldAlert,
    Upload,
    X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType, DragEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedModule = "employees"; // TODO: add more modules here as backend support lands

export type ExportFormat = "csv"; // TODO: extend once the backend supports more formats
export type WizardStep = "upload" | "map" | "review";

/** A single validation rule string as returned by the backend, e.g. "max:255". */
export type ValidationRule = string;

/** Shape of one field returned by GET /import/fields. */
export interface ImportField {
  name: string;
  required: boolean;
  validation: ValidationRule[];
}

/** Full shape of the GET /import/fields response. */
export interface ImportFieldsResponse {
  module: string;
  fields: ImportField[];
}

/**
 * Maps a field name to a stringified column index from the user's file
 * (e.g. "0", "3") or the sentinel "__skip__".
 * A key absent from the map means the field has not been touched yet.
 */
export type ColumnMapping = Record<string, string | undefined>;

/** Shape of a successful import API response. */
export interface ImportResult {
  imported: number;
  updated?: number;
  skipped?: number;
  /** Rows skipped because a matching record already existed and "replace existing" was off. */
  duplicates?: Array<{ row: number; employee_number: string }>;
  errors?: string[];
}

/** Props for the top-level ImportExportButtons component. */
export interface ImportExportButtonsProps {
  /** Lower-case module name, e.g. "employees". */
  module: SupportedModule;
  /** Called after a successful import with the server result. */
  onImportSuccess?: (result: ImportResult) => void;
  /** Called after a successful export (file download has started). */
  onExportSuccess?: () => void;
  /** Custom label override for the Import button. */
  importLabel?: string;
  /** Custom label override for the Export button. */
  exportLabel?: string;
}

/** Shape of every JSON response from this backend (see responseJson() on the PHP side). */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// ── Auth helpers ────────────────────────────────────────────────────────────
// Deliberately mirrors employee.ts's private getCookie()/getAuthHeaders()
// methods exactly, rather than sharing a module or using axios, per request —
// this file's auth handling should look and behave the same as employee.ts's.

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

/** For JSON requests (GET fields, GET export). */
function getAuthHeaders(): HeadersInit {
  const token = getCookie("access_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * For multipart/form-data requests (POST import) — deliberately omits
 * Content-Type so the browser can set its own boundary; Authorization is
 * still attached manually, same as employee.ts's importEmployees().
 */
function getAuthHeadersForFormData(): HeadersInit {
  const token = getCookie("access_token");
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

/** Builds the base API path for a module, scoped to the current organization. */
function buildBasePath(orgId: number, module: SupportedModule): string {
  return `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organizations/${orgId}/${module}`;
}

function fieldsUrl(orgId: number, module: SupportedModule): string {
  return `${buildBasePath(orgId, module)}/import/fields`;
}

function importUrl(orgId: number, module: SupportedModule): string {
  return `${buildBasePath(orgId, module)}/import`;
}

function exportUrl(orgId: number, module: SupportedModule): string {
  return `${buildBasePath(orgId, module)}/export?format=csv`;
}

// ─── Validation rule → human-readable hint ────────────────────────────────────

/**
 * Converts a Laravel-style validation rule array into short, friendly hints
 * shown in the mapping UI so users know what their data must look like.
 *
 * Examples:
 *   ["required", "string", "max:255"] → "Text · max 255 chars"
 *   ["required", "numeric"]           → "Number"
 *   ["nullable", "date"]              → "Optional · Date (YYYY-MM-DD)"
 *   ["required", "email"]             → "Valid email address"
 *   ["boolean"]                       → "true or false"
 */
export function rulestoHints(rules: ValidationRule[]): string {
  const hints: string[] = [];
  const ruleSet = new Set(rules.map((r) => r.split(":")[0].toLowerCase()));

  if (ruleSet.has("nullable") && !ruleSet.has("required")) {
    hints.push("Optional");
  }

  if (ruleSet.has("string")) hints.push("Text");
  else if (ruleSet.has("numeric") || ruleSet.has("integer")) {
    hints.push(ruleSet.has("integer") ? "Integer" : "Number");
  } else if (ruleSet.has("boolean")) {
    hints.push("true / false");
  } else if (ruleSet.has("date")) {
    hints.push("Date (YYYY-MM-DD)");
  } else if (ruleSet.has("email")) {
    hints.push("Valid email");
  } else if (ruleSet.has("url")) {
    hints.push("Valid URL");
  } else if (ruleSet.has("array")) {
    hints.push("List");
  }

  for (const rule of rules) {
    const [key, val] = rule.split(":");
    switch (key.toLowerCase()) {
      case "max":
        hints.push(`max ${val} chars`);
        break;
      case "min":
        hints.push(`min ${val}`);
        break;
      case "in":
        hints.push(`one of: ${val.split(",").join(", ")}`);
        break;
      case "digits":
        hints.push(`${val} digits`);
        break;
      case "digits_between":
        hints.push(`${val} digits`);
        break;
      case "between":
        hints.push(`between ${val}`);
        break;
    }
  }

  return hints.join(" · ") || "Any value";
}

/**
 * Returns the severity of a validation rule set for badge colouring.
 * "error"   → required, missing would break import
 * "warning" → has constraints the user should know about (max, in, etc.)
 * "info"    → optional / nullable, safe to skip
 */
function ruleSeverity(
  rules: ValidationRule[],
  required: boolean,
): "error" | "warning" | "info" {
  if (required) return "error";
  const hasConstraints = rules.some((r) =>
    ["max", "min", "in", "digits", "between", "email", "url", "date"].some(
      (k) => r.startsWith(k),
    ),
  );
  return hasConstraints ? "warning" : "info";
}

// ─── CSV utilities ────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function buildMappedCSV(
  originalRows: string[][],
  mapping: ColumnMapping,
  fields: ImportField[],
): string {
  const fieldOrder = fields.map((f) => f.name);
  const headerRow = fieldOrder.join(",");
  const dataRows = originalRows.map((row) =>
    fieldOrder
      .map((fieldName) => {
        const colIdx = mapping[fieldName];
        if (colIdx === undefined || colIdx === "__skip__") return "";
        const val = row[parseInt(colIdx, 10)] ?? "";
        return /[,"\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
      })
      .join(","),
  );
  return [headerRow, ...dataRows].join("\n");
}

function csvToFile(csvString: string, originalName: string): File {
  const blob = new Blob([csvString], { type: "text/csv" });
  const mappedName = originalName.replace(/\.[^.]+$/, "_mapped.csv");
  return new File([blob], mappedName, { type: "text/csv" });
}

// ─── Sample CSV generation ────────────────────────────────────────────────────

/**
 * Produces a plausible placeholder value for a field based on its validation
 * rules, so the sample CSV row gives users a concrete, correct-format example.
 */
function generateSampleValue(field: ImportField): string {
  const rules = field.validation.map((r) => r.toLowerCase());
  const ruleSet = new Set(rules.map((r) => r.split(":")[0]));

  if (ruleSet.has("email"))   return "example@email.com";
  if (ruleSet.has("url"))     return "https://example.com";
  if (ruleSet.has("boolean")) return "true";
  if (ruleSet.has("date"))    return "2024-01-15";

  if (ruleSet.has("in")) {
    const inRule = rules.find((r) => r.startsWith("in:"));
    if (inRule) {
      const first = inRule.split(":")[1]?.split(",")[0];
      if (first) return first;
    }
  }

  if (ruleSet.has("integer") || ruleSet.has("numeric")) {
    const minRule = rules.find((r) => r.startsWith("min:"));
    const min = minRule ? parseInt(minRule.split(":")[1] ?? "1", 10) : 1;
    return String(isNaN(min) ? 1 : Math.max(min, 1));
  }

  if (ruleSet.has("digits")) {
    const d = rules.find((r) => r.startsWith("digits:"));
    const len = d ? parseInt(d.split(":")[1] ?? "6", 10) : 6;
    return "1".padEnd(isNaN(len) ? 6 : len, "0");
  }

  // Generic string - derive a readable example from the field name
  const name = field.name.replace(/[_-]/g, " ");
  const maxRule = rules.find((r) => r.startsWith("max:"));
  const max = maxRule ? parseInt(maxRule.split(":")[1] ?? "50", 10) : 50;
  const sample = `Sample ${name}`;
  return sample.length <= max ? sample : sample.slice(0, max);
}

/**
 * Builds and immediately downloads a two-row CSV (header + one example row)
 * using the field definitions fetched from the backend.
 */
function downloadSampleCSV(fields: ImportField[], module: string): void {
  const headers = fields.map((f) => f.name);
  const sampleRow = fields.map((f) => {
    const val = generateSampleValue(f);
    return /[,"\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
  });
  const csv = [headers.join(","), sampleRow.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${module}-sample.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface StepIndicatorProps {
  step: WizardStep;
}

function StepIndicator({ step }: StepIndicatorProps) {
  const steps: Array<{
    id: WizardStep;
    label: string;
    Icon: ComponentType<{ className?: string }>;
  }> = [
    { id: "upload", label: "Upload", Icon: FileUp },
    { id: "map", label: "Map Columns", Icon: Columns },
    { id: "review", label: "Review & Import", Icon: Eye },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center">
      {steps.map(({ id, label, Icon }, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={id} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              {label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface DropZoneProps {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
}

function DropZone({ file, onFile, onClear }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile],
  );

  const open = () => inputRef.current?.click();

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
        dragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : file
            ? "border-primary/40 bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file != null ? (
        <div className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(file.size / 1024).toFixed(1)} KB · CSV
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={open} className="text-xs h-8">
              <RefreshCw className="h-3 w-3 mr-1" /> Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-xs h-8 text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          className="w-full p-4 flex flex-col items-center gap-3 cursor-pointer"
        >
          <div
            className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors ${
              dragging ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            <FileUp className="h-7 w-7" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">
              Drop your CSV here, or{" "}
              <span className="text-primary underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">CSV only · Max 10 MB</p>
          </div>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PreviewTableProps {
  headers: string[];
  rows: string[][];
}

function PreviewTable({ headers, rows }: PreviewTableProps) {
  if (headers.length === 0) return null;
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto max-h-48">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              {headers.map((h, i) => (
                <TableHead key={i} className="text-xs font-semibold whitespace-nowrap py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded text-[10px] bg-primary/10 text-primary font-mono">
                      {i + 1}
                    </span>
                    {h}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, ri) => (
              <TableRow key={ri} className="hover:bg-muted/30">
                {row.map((cell, ci) => (
                  <TableCell key={ci} className="text-xs py-2 text-muted-foreground max-w-[160px] truncate">
                    {cell !== "" ? cell : (
                      <span className="text-muted-foreground/40 italic">empty</span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Showing first {rows.length} row{rows.length !== 1 ? "s" : ""}
        </span>
        <Badge variant="secondary" className="text-xs">{headers.length} columns</Badge>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Severity badge shown next to field labels in the mapping step. */
function SeverityIcon({ severity }: { severity: "error" | "warning" | "info" }) {
  if (severity === "error") {
    return <ShieldAlert className="h-3 w-3 text-destructive shrink-0" />;
  }
  if (severity === "warning") {
    return <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />;
  }
  return <Info className="h-3 w-3 text-muted-foreground/60 shrink-0" />;
}

// ─────────────────────────────────────────────────────────────────────────────

interface MappingRowProps {
  field: ImportField;
  headers: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  firstRow: string[] | undefined;
}

function MappingRow({ field, headers, value, onChange, firstRow }: MappingRowProps) {
  const selectedIdx =
    value !== undefined && value !== "__skip__" ? parseInt(value, 10) : null;
  const previewVal: string | undefined =
    selectedIdx !== null ? firstRow?.[selectedIdx] : undefined;

  const isMapped = value !== undefined && value !== "__skip__";
  const isError = field.required && !isMapped;
  const severity = ruleSeverity(field.validation, field.required);
  const hint = rulestoHints(field.validation);

  // Client-side value validation against rules
  let valueWarning: string | null = null;
  if (isMapped && previewVal !== undefined && previewVal !== "") {
    for (const rule of field.validation) {
      const [key, val] = rule.split(":");
      if (key === "numeric" || key === "integer") {
        if (isNaN(Number(previewVal))) {
          valueWarning = `Sample value "${previewVal}" doesn't look like a number`;
          break;
        }
      }
      if (key === "max" && previewVal.length > parseInt(val, 10)) {
        valueWarning = `Sample value exceeds max length of ${val}`;
        break;
      }
      if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(previewVal)) {
        valueWarning = `Sample value doesn't look like a valid email`;
        break;
      }
      if (key === "in") {
        const allowed = val.split(",");
        if (!allowed.includes(previewVal)) {
          valueWarning = `Sample value must be one of: ${allowed.join(", ")}`;
          break;
        }
      }
      if ((key === "boolean") && !["true","false","1","0"].includes(previewVal.toLowerCase())) {
        valueWarning = `Expected true/false or 1/0`;
        break;
      }
    }
  }

  return (
    <div
      className={`grid grid-cols-12 gap-3 items-start py-3 px-4 rounded-lg transition-colors ${
        isError
          ? "bg-destructive/5 border border-destructive/20"
          : isMapped
            ? valueWarning
              ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40"
              : "bg-primary/3 border border-primary/10"
            : "border border-transparent hover:bg-muted/30"
      }`}
    >
      {/* Field label + hint */}
      <div className="col-span-4 pt-1 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SeverityIcon severity={severity} />
          <p className="text-sm font-medium leading-none">
            {field.name}
            {field.required && <span className="text-destructive ml-1 text-xs">*</span>}
          </p>
          {isMapped && !isError && !valueWarning && (
            <Check className="h-3.5 w-3.5 text-primary" />
          )}
          {valueWarning != null && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
      </div>

      {/* Arrow */}
      <div className="col-span-1 flex justify-center pt-2">
        <ArrowRight
          className={`h-4 w-4 transition-colors ${
            isMapped ? "text-primary" : "text-muted-foreground/30"
          }`}
        />
      </div>

      {/* Column selector */}
      <div className="col-span-4">
        <Select value={value ?? "__none__"} onValueChange={onChange}>
          <SelectTrigger className={`h-9 text-sm ${isError ? "border-destructive/50" : ""}`}>
            <SelectValue placeholder="Select column…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__skip__">
              <span className="text-muted-foreground">- Skip -</span>
            </SelectItem>
            {headers.map((h, i) => (
              <SelectItem key={i} value={String(i)}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  Col {i + 1}
                </span>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sample value + inline warning */}
      <div className="col-span-3 pt-1 space-y-1">
        {previewVal !== undefined ? (
          <div
            className={`px-2 py-1 rounded text-xs font-mono truncate ${
              valueWarning != null
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {previewVal !== "" ? (
              previewVal
            ) : (
              <span className="italic opacity-50">empty</span>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground/40 italic pt-1">no preview</div>
        )}
        {valueWarning != null && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
            {valueWarning}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ReviewSummaryProps {
  fields: ImportField[];
  mapping: ColumnMapping;
  headers: string[];
  rowCount: number;
}

function ReviewSummary({ fields, mapping, headers, rowCount }: ReviewSummaryProps) {
  const mappedCount = fields.filter(
    (f) => mapping[f.name] != null && mapping[f.name] !== "__skip__",
  ).length;

  const stats = [
    { label: "Rows to import", value: rowCount, color: "text-primary" },
    { label: "Mapped fields", value: mappedCount, color: "text-emerald-600" },
    { label: "Skipped fields", value: fields.length - mappedCount, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-card p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Field Mapping Summary
          </p>
        </div>
        <div className="divide-y max-h-56 overflow-y-auto">
          {fields.map((field) => {
            const colIdx = mapping[field.name];
            const isMapped = colIdx != null && colIdx !== "__skip__";
            const colName =
              isMapped && colIdx !== undefined
                ? (headers[parseInt(colIdx, 10)] ?? `Col ${parseInt(colIdx, 10) + 1}`)
                : null;
            const severity = ruleSeverity(field.validation, field.required);

            return (
              <div
                key={field.name}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  {isMapped ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <SeverityIcon severity={severity} />
                  )}
                  <span className={isMapped ? "" : "text-muted-foreground"}>
                    {field.name}
                    {field.required && (
                      <span className="text-destructive ml-1 text-xs">*</span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60">
                    {rulestoHints(field.validation)}
                  </span>
                </div>
                {isMapped && colName != null ? (
                  <Badge variant="secondary" className="text-xs font-mono">{colName}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground italic">skipped</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  module: SupportedModule;
  onSuccess?: (result: ImportResult) => void;
}

function ImportDialog({
  isOpen,
  onClose,
  module,
  onSuccess,
}: ImportDialogProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  // Wizard state
  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [allDataRows, setAllDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // Field loading
  const [fields, setFields] = useState<ImportField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const [replaceExisting, setReplaceExisting] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ImportResult | null>(null);

  const unmappedRequired = fields.filter(
    (f) => f.required && (mapping[f.name] == null || mapping[f.name] === "__skip__"),
  );

  // ── Fetch fields when dialog opens ─────────────────────────────────────────

  const fetchFields = useCallback(async () => {
    if (!orgId) {
      setFieldsError("No organization found — please sign in again.");
      return;
    }
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const res = await fetch(fieldsUrl(orgId, module), {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      let body: ApiEnvelope<ImportFieldsResponse>;
      try {
        body = await res.json();
      } catch {
        throw new Error(`Server returned ${res.status} with no JSON body.`);
      }

      if (!res.ok || body.success === false) {
        throw new Error(body.message ?? `Failed to load fields (${res.status}).`);
      }
      if (!Array.isArray(body.data?.fields)) {
        throw new Error("Unexpected response shape from fields endpoint.");
      }

      setFields(body.data.fields);
      return body.data.fields;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load field definitions.";
      setFieldsError(message);
      throw err;
    } finally {
      setFieldsLoading(false);
    }
  }, [module, orgId]);

  // Fetch fields immediately when the dialog opens (driven by the isOpen prop,
  // not the internal onOpenChange event, so it works regardless of how the
  // dialog is opened).
  useEffect(() => {
    if (isOpen) {
      fetchFields().catch(() => {
        // Error is already captured in fieldsError state
      });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle the dialog's own open/close events (e.g. pressing Escape or the ✕ button)
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      onClose();
    }
    // Opening via onOpenChange is handled by the useEffect above
  };

  // Auto-map when both fields and headers are available
  useEffect(() => {
    if (fields.length > 0 && headers.length > 0) {
      autoMap(fields, headers);
    }
  }, [fields, headers]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function autoMap(fieldDefs: ImportField[], hdrs: string[]) {
    const auto: ColumnMapping = {};
    fieldDefs.forEach((field) => {
      const idx = hdrs.findIndex(
        (h) => h.toLowerCase().trim() === field.name.toLowerCase(),
      );
      if (idx !== -1) auto[field.name] = String(idx);
    });
    setMapping(auto);
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setAllDataRows([]);
    setMapping({});
    setFields([]);
    setFieldsError(null);
    setError(null);
    setSuccess(null);
    setReplaceExisting(false);
  }

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFileSelect = (f: File) => {
    setError(null);
    if (f.size > 10 * 1024 * 1024) {
      setError("File exceeds the 10 MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result;
      if (typeof raw !== "string") { setError("Could not read file."); return; }
      try {
        const rows = parseCSV(raw);
        if (rows.length < 2) {
          setError("File must have a header row and at least one data row.");
          return;
        }
        const [hdr, ...data] = rows;
        if (hdr == null || hdr.length === 0) {
          setError("Could not detect column headers.");
          return;
        }
        setFile(f);
        setHeaders(hdr);
        setPreviewRows(data.slice(0, 5));
        setAllDataRows(data);
        
        // Auto-map with current fields if available
        if (fields.length > 0) {
          autoMap(fields, hdr);
        }
      } catch {
        setError("Could not parse file. Please upload a valid CSV.");
      }
    };
    reader.onerror = () => setError("Failed to read the file.");
    reader.readAsText(f);
  };

  // ── Upload ───────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!orgId) { setError("No organization found — please sign in again."); return; }
    if (file == null) { setError("No file selected."); return; }
    if (unmappedRequired.length > 0) { setError("Map all required fields first."); return; }

    setUploading(true);
    setError(null);

    try {
      const csvString = buildMappedCSV(allDataRows, mapping, fields);
      const mappedFile = csvToFile(csvString, file.name);

      const formData = new FormData();
      formData.append("file", mappedFile);
      formData.append("replace_existing", String(replaceExisting));

      const res = await fetch(importUrl(orgId, module), {
        method: "POST",
        credentials: "include",
        // No Content-Type here — the browser sets its own multipart
        // boundary for FormData; only Authorization is attached manually.
        headers: getAuthHeadersForFormData(),
        body: formData,
      });

      let body: ApiEnvelope<ImportResult>;
      try {
        body = await res.json();
      } catch {
        throw new Error(`Server returned ${res.status} with no JSON body.`);
      }

      if (!res.ok || body.success === false) {
        throw new Error(body.message ?? `Import failed (${res.status}).`);
      }

      const result: ImportResult = body.data ?? { imported: 0 };
      setSuccess(result);
      onSuccess?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setUploading(false);
    }
  };

  // ── Download preview ─────────────────────────────────────────────────────────

  const handleDownloadMapped = () => {
    if (file == null || fields.length === 0) return;
    const csvString = buildMappedCSV(allDataRows, mapping, fields);
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.[^.]+$/, "_mapped.csv");
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const moduleLabel = module.replace(/-/g, " ");

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="min-w-5xl h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base capitalize">
                  Import {moduleLabel}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {step === "upload"
                    ? "Upload a CSV file to begin"
                    : step === "map"
                      ? "Map your columns to the expected fields"
                      : "Review your mapping and confirm"}
                </DialogDescription>
              </div>
            </div>
            <StepIndicator step={step} />
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* STEP: Upload */}
          {step === "upload" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <DropZone
                file={file}
                onFile={handleFileSelect}
                onClear={() => {
                  setFile(null);
                  setHeaders([]);
                  setPreviewRows([]);
                  setAllDataRows([]);
                  setMapping({});
                }}
              />

              {/* Import options - universal for all modules */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Import Options
                  </p>
                  {/* Sample CSV download - only available once fields are loaded */}
                  {fields.length > 0 && (
                    <button
                      type="button"
                      onClick={() => downloadSampleCSV(fields, module)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      <FileDown className="h-3 w-3" />
                      Download sample CSV
                    </button>
                  )}
                  {fieldsLoading && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Preparing sample…
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="replace" className="text-sm font-medium">
                      Replace existing records
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Overwrite records with matching identifiers
                    </p>
                  </div>
                  <Switch
                    id="replace"
                    checked={replaceExisting}
                    onCheckedChange={setReplaceExisting}
                  />
                </div>
              </div>

              {/* File preview */}
              {file != null && previewRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">File Preview</h4>
                    <span className="text-xs text-muted-foreground">
                      · {allDataRows.length} data rows
                    </span>
                  </div>
                  <PreviewTable headers={headers} rows={previewRows} />
                </div>
              )}

              {error != null && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* STEP: Map */}
          {step === "map" && (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Left sidebar – user's columns */}
              <div className="w-52 shrink-0 border-r bg-muted/20 flex flex-col">
                <div className="px-4 py-3 border-b">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Columns
                  </p>
                </div>
                <div className="overflow-y-auto flex-1 py-2">
                  {headers.map((h, i) => {
                    const isMapped = Object.values(mapping).includes(String(i));
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-4 py-2 text-xs ${
                          isMapped ? "text-primary font-medium" : "text-muted-foreground"
                        }`}
                      >
                        <span className="inline-flex items-center justify-center h-4 w-4 rounded text-[10px] bg-muted font-mono shrink-0">
                          {i + 1}
                        </span>
                        <span className="truncate">{h}</span>
                        {isMapped && <Check className="h-3 w-3 shrink-0 ml-auto" />}
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">
                      {Object.values(mapping).filter((v) => v != null && v !== "__skip__").length}
                    </span>{" "}
                    of {headers.length} mapped
                  </p>
                </div>
              </div>

              {/* Right – mapping rows */}
              <div className="flex-1 overflow-y-auto p-5 space-y-1.5">
                {/* Legend */}
                <div className="flex items-center gap-4 px-4 mb-3 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" /> Required
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" /> Has constraints
                  </div>
                  <div className="flex items-center gap-1">
                    <Info className="h-3 w-3 text-muted-foreground/60" /> Optional
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-12 gap-3 px-4 mb-1">
                  <div className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Expected Field
                  </div>
                  <div className="col-span-1" />
                  <div className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Column
                  </div>
                  <div className="col-span-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sample Value
                  </div>
                </div>

                {fields.map((field) => (
                  <MappingRow
                    key={field.name}
                    field={field}
                    headers={headers}
                    value={mapping[field.name]}
                    onChange={(val) =>
                      setMapping((prev) => ({ ...prev, [field.name]: val }))
                    }
                    firstRow={previewRows[0]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP: Review */}
          {step === "review" && (
            <div className="flex-1 overflow-y-auto p-6">
              {success != null ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <Check className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">Import Successful!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {success.imported} record{success.imported !== 1 ? "s" : ""} created
                      {success.updated != null && success.updated > 0
                        ? `, ${success.updated} updated`
                        : ""}
                      {success.skipped != null && success.skipped > 0
                        ? `, ${success.skipped} skipped`
                        : ""}
                      .
                    </p>
                    {(success.duplicates ?? []).length > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        {success.duplicates!.length} duplicate employee number
                        {success.duplicates!.length !== 1 ? "s" : ""} skipped — enable "Replace
                        existing records" and re-import to update them instead.
                      </p>
                    )}
                    {(success.errors ?? []).length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto text-left rounded-md border bg-muted/40 p-2">
                        {success.errors!.map((line, i) => (
                          <p key={i} className="text-xs text-amber-600">{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      reset();
                      onClose();
                    }}
                    className="mt-2"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-6 px-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Replace existing:</span>
                      <Badge variant={replaceExisting ? "default" : "outline"}>
                        {replaceExisting ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                  <ReviewSummary
                    fields={fields}
                    mapping={mapping}
                    headers={headers}
                    rowCount={allDataRows.length}
                  />
                  {error != null && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {success == null && (
          <div className="border-t px-6 py-4 flex items-center justify-between shrink-0 bg-muted/20">
            <div className="flex items-center gap-3">
              {step !== "upload" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(step === "review" ? "map" : "upload")}
                  disabled={uploading}
                >
                  ← Back
                </Button>
              )}
              {unmappedRequired.length > 0 && step === "map" && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {unmappedRequired.length} required field
                  {unmappedRequired.length !== 1 ? "s" : ""} not mapped
                </span>
              )}
              {step === "upload" && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {fieldsLoading && (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      <span>Fetching field definitions…</span>
                    </span>
                  )}
                  {fieldsError != null && (
                    <span className="flex items-center gap-1.5 text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>Failed to load fields</span>
                      <button
                        className="underline hover:no-underline ml-0.5"
                        onClick={() => fetchFields().catch(() => {})}
                      >
                        Retry
                      </button>
                    </span>
                  )}
                  {fields.length > 0 && !fieldsLoading && !fieldsError && (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      <span>{fields.length} fields ready</span>
                    </span>
                  )}
                  {file != null && (
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>File loaded</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={uploading}>
                Cancel
              </Button>

              {step === "upload" && (
                <Button
                  onClick={() => setStep("map")}
                  disabled={
                    file == null ||
                    previewRows.length === 0 ||
                    fieldsLoading ||
                    fields.length === 0 ||
                    fieldsError != null
                  }
                >
                  {fieldsLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading fields…</>
                  ) : fieldsError != null ? (
                    <>Fix errors first</>
                  ) : file == null ? (
                    <>Upload file first</>
                  ) : previewRows.length === 0 ? (
                    <>Invalid file format</>
                  ) : fields.length === 0 ? (
                    <>No field definitions</>
                  ) : (
                    <>Map Columns <ChevronRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              )}

              {step === "map" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadMapped}
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Mapped CSV
                  </Button>
                  <Button
                    onClick={() => setStep("review")}
                    disabled={unmappedRequired.length > 0}
                  >
                    Review & Import <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              )}

              {step === "review" && (
                <Button onClick={handleUpload} disabled={uploading} className="min-w-32">
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Confirm Import</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function ImportExportButtons({
  module,
  onImportSuccess,
  onExportSuccess,
  importLabel,
  exportLabel,
}: ImportExportButtonsProps) {
  const { user } = useAuth();
  const orgId = user?.organization_id;

  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportClick = async () => {
    if (!orgId) {
      toast.error("No organization found — please sign in again.");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch(exportUrl(orgId, module), {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        // Error responses are JSON, not CSV — safe to parse here.
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Export failed (${res.status}).`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${module}-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      onExportSuccess?.();
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
          className="gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          {importLabel ?? "Import"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportClick}
          disabled={exporting}
          className="gap-1.5"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {exportLabel ?? "Export"}
        </Button>
      </div>

      <ImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        module={module}
        onSuccess={(result) => {
          setImportOpen(false);
          onImportSuccess?.(result);
        }}
      />
    </>
  );
}