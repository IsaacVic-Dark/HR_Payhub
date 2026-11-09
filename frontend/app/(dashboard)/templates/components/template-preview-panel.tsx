"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  templateAPI,
  type PreviewOptions,
  type PreviewRequest,
  type TemplateDraftPayload,
} from "@/services/api/template";

// A4 at 96 dpi
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const SAMPLE = "sample";

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  orgId: number;
  /**
   * Any template of this organisation. When `draft` is supplied the server renders the
   * draft (it only borrows defaults from this template), so an unsaved "new" template can
   * still be previewed by passing the active template's id.
   */
  templateId: number | null;
  /** Unsaved editor state. Omit to preview the saved template. */
  draft?: TemplateDraftPayload | null;
  className?: string;
}

export function TemplatePreviewPanel({ orgId, templateId, draft, className }: Props) {
  const [options, setOptions] = useState<PreviewOptions | null>(null);
  const [payrunId, setPayrunId] = useState<string>(SAMPLE);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [html, setHtml] = useState<string>("");
  const [isSample, setIsSample] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rateLimited, setRateLimited] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // manual refresh

  // ---- A4 scaling -------------------------------------------------------
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1.25, Math.max(0.3, el.clientWidth / A4_WIDTH)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- payrun / employee options ----------------------------------------
  useEffect(() => {
    templateAPI.previewOptions(orgId).then((res) => {
      if (res.success && res.data) setOptions((prev) => ({ payruns: res.data!.payruns, employees: prev?.employees ?? [] }));
    });
  }, [orgId]);

  useEffect(() => {
    if (payrunId === SAMPLE) {
      setEmployeeId("");
      setOptions((prev) => (prev ? { ...prev, employees: [] } : prev));
      return;
    }
    templateAPI.previewOptions(orgId, Number(payrunId)).then((res) => {
      if (res.success && res.data) {
        setOptions((prev) => ({ payruns: prev?.payruns ?? res.data!.payruns, employees: res.data!.employees }));
        setEmployeeId(res.data.employees[0] ? String(res.data.employees[0].id) : "");
      }
    });
  }, [orgId, payrunId]);

  // ---- request body -----------------------------------------------------
  const usingReal = payrunId !== SAMPLE && employeeId !== "";
  const draftKey = useMemo(() => JSON.stringify(draft ?? null), [draft]);
  const debouncedDraftKey = useDebounced(draftKey, 900);

  const buildBody = useCallback(
    (live: boolean): PreviewRequest => {
      const body: PreviewRequest = { live };
      if (usingReal) {
        body.payrun_id = Number(payrunId);
        body.employee_id = Number(employeeId);
      }
      const d = debouncedDraftKey === "null" ? null : (JSON.parse(debouncedDraftKey) as TemplateDraftPayload);
      if (d) body.draft = { ...d, name: d.name?.trim() ? d.name : "Untitled template" };
      return body;
    },
    [usingReal, payrunId, employeeId, debouncedDraftKey]
  );

  // ---- live preview -----------------------------------------------------
  useEffect(() => {
    if (!templateId) return;
    if (payrunId !== SAMPLE && employeeId === "") return; // wait for the employee list
    let cancelled = false;
    setLoading(true);
    templateAPI.previewHtml(orgId, templateId, buildBody(true)).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data) {
        setHtml(res.data.html);
        setIsSample(res.data.sample);
        setError(null);
        setFieldErrors({});
        setRateLimited(null);
      } else if (res.status === 429) {
        setRateLimited(res.retryAfter ?? 30);
        setError(null);
      } else {
        setError(res.error ?? "Preview failed");
        setFieldErrors(res.errors ?? {});
      }
    });
    return () => {
      cancelled = true;
    };
    // buildBody already depends on the debounced draft + selection
  }, [orgId, templateId, buildBody, tick, payrunId, employeeId]);

  // countdown for the rate-limit notice
  useEffect(() => {
    if (rateLimited === null) return;
    if (rateLimited <= 0) {
      setRateLimited(null);
      setTick((t) => t + 1);
      return;
    }
    const t = setTimeout(() => setRateLimited((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimited]);

  // ---- real PDF ---------------------------------------------------------
  const openPdf = async () => {
    if (!templateId) return;
    // open the tab synchronously so the popup blocker allows it, then point it at the blob
    const tab = window.open("", "_blank");
    setPdfLoading(true);
    const res = await templateAPI.previewPdf(orgId, templateId, buildBody(false));
    setPdfLoading(false);
    if (!res.success || !res.data) {
      tab?.close();
      if (res.status === 429) toast.error(`Too many previews. Try again in ${res.retryAfter ?? 30}s`);
      else toast.error(res.error ?? "Could not generate the PDF preview");
      setFieldErrors(res.errors ?? {});
      return;
    }
    const url = URL.createObjectURL(res.data);
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const errorList = Object.entries(fieldErrors);

  return (
    <div className={className}>
      {/* data source */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={payrunId} onValueChange={setPayrunId}>
          <SelectTrigger className="h-9 w-[210px] text-xs">
            <SelectValue placeholder="Preview data" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SAMPLE}>Sample data</SelectItem>
            {options?.payruns.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.payrun_name} ({p.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {payrunId !== SAMPLE && (
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-9 w-[210px] text-xs">
              <SelectValue placeholder={options?.employees.length === 0 ? "No employees" : "Select employee"} />
            </SelectTrigger>
            <SelectContent>
              {options?.employees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.full_name} ({e.employee_number})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)} disabled={loading || !templateId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={openPdf} disabled={pdfLoading || !templateId}>
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Preview PDF
          </Button>
        </div>
      </div>

      {/* notices */}
      {rateLimited !== null && (
        <Alert className="mb-3">
          <AlertTitle>Preview paused</AlertTitle>
          <AlertDescription>
            You are previewing very quickly. It will refresh automatically in {rateLimited}s.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>{error}</AlertTitle>
          {errorList.length > 0 && (
            <AlertDescription>
              <ul className="mt-1 list-disc pl-5">
                {errorList.map(([field, message]) => (
                  <li key={field}>
                    <span className="font-medium">{prettyField(field)}:</span> {message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
      {!templateId && (
        <p className="mb-3 text-sm text-muted-foreground">Preview becomes available once a template exists.</p>
      )}

      {/* A4 sheet */}
      <div ref={wrapRef} className="w-full">
        <div
          className="relative mx-auto overflow-hidden rounded-md border bg-white shadow-sm"
          style={{ height: A4_HEIGHT * scale, width: A4_WIDTH * scale, maxWidth: "100%" }}
        >
          {html ? (
            <iframe
              title="Payslip preview"
              // sandbox="" = no scripts, no forms, no same-origin: the preview HTML is inert
              sandbox=""
              srcDoc={html}
              style={{
                width: A4_WIDTH,
                height: A4_HEIGHT,
                border: 0,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                background: "#fff",
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {loading ? "Rendering preview..." : "No preview yet"}
            </div>
          )}
          {loading && html && (
            <div className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {isSample ? "Showing sample data" : "Showing real payroll data (account numbers are masked)"} · nothing is saved or
          generated by previewing
        </p>
      </div>
    </div>
  );
}

function prettyField(key: string) {
  return key
    .replace(/^config\./, "")
    .replace(/\./g, " › ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}
