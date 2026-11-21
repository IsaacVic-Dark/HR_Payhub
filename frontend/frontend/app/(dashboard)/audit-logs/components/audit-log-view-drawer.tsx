"use client";

import { useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, FileText, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { AuditLogType } from "@/services/api/audit-log";
import {
  actionBadgeClass,
  entityDisplayName,
  entityLabel,
  formatValue,
  humanize,
  parseDbDate,
  parseDetails,
  userDisplayName,
  type DiffRow,
} from "./audit-utils";

interface AuditLogViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLogType | null;
}

function ValueCell({ value, tone }: { value: unknown; tone?: "old" | "new" }) {
  const text = formatValue(value);
  const isEmpty = text === "—";
  const isMultiline = text.includes("\n");
  const toneClass =
    tone === "old"
      ? "bg-red-50 text-red-800"
      : tone === "new"
        ? "bg-green-50 text-green-800"
        : "";

  if (isEmpty) return <span className="text-gray-400 italic">—</span>;

  return isMultiline ? (
    <pre
      className={`whitespace-pre-wrap break-all rounded px-2 py-1 text-xs font-mono ${toneClass}`}
    >
      {text}
    </pre>
  ) : (
    <span className={`rounded px-1.5 py-0.5 break-words ${toneClass}`}>
      {text}
    </span>
  );
}

function DiffTable({ rows }: { rows: DiffRow[] }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const visible = rows.filter((r) => showUnchanged || r.kind !== "unchanged");
  const hiddenCount = rows.length - rows.filter((r) => r.kind !== "unchanged").length;

  return (
    <div>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">No field changes recorded.</p>
      ) : (
        <div className="rounded-lg border divide-y text-sm">
          {visible.map((row) => (
            <div key={row.field} className="p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {humanize(row.field)}
                </span>
                {row.kind === "unchanged" && (
                  <span className="text-xs text-gray-400">unchanged</span>
                )}
              </div>
              {row.kind === "added" && (
                <ValueCell value={row.newValue} tone="new" />
              )}
              {row.kind === "removed" && (
                <ValueCell value={row.oldValue} tone="old" />
              )}
              {row.kind === "changed" && (
                <div className="flex flex-wrap items-start gap-2">
                  <ValueCell value={row.oldValue} tone="old" />
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <ValueCell value={row.newValue} tone="new" />
                </div>
              )}
              {row.kind === "unchanged" && <ValueCell value={row.newValue} />}
            </div>
          ))}
        </div>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowUnchanged((s) => !s)}
          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {showUnchanged
            ? "Hide unchanged fields"
            : `Show ${hiddenCount} unchanged field${hiddenCount > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border divide-y text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-3 p-3">
          <span className="text-gray-600">{humanize(k)}</span>
          <div className="col-span-2 font-medium">
            <ValueCell value={v} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditLogViewDrawer({
  open,
  onOpenChange,
  log,
}: AuditLogViewDrawerProps) {
  const parsed = useMemo(() => (log ? parseDetails(log) : null), [log]);
  const [showRaw, setShowRaw] = useState(false);

  if (!log || !parsed) return null;

  const when = parseDbDate(log.created_at);
  const name = entityDisplayName(log);
  const rawJson = JSON.stringify(log.details, null, 2);

  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent
        className="h-full min-w-xl ml-auto bg-white"
        onInteractOutside={() => onOpenChange(false)}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DrawerHeader className="border-b">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DrawerTitle className="text-xl font-semibold">
                Audit Log #{log.id}
              </DrawerTitle>
              <DrawerDescription>
                {when ? format(when, "dd MMM yyyy, HH:mm:ss") : log.created_at}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Event */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Event
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Action</span>
                <div className="mt-1">
                  <Badge className={actionBadgeClass(log.action)}>
                    {humanize(log.action)}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Record Type</span>
                <p className="font-medium">{entityLabel(log.entity_type)}</p>
              </div>
              <div>
                <span className="text-gray-600">Record</span>
                <p className="font-medium">
                  {name ?? <span className="text-gray-400">—</span>}
                  <span className="ml-1 text-gray-500 font-normal">
                    #{log.entity_id}
                  </span>
                </p>
                {!log.entity_name && name && (
                  <p className="text-xs text-gray-400">
                    Name taken from the log (record may have been deleted)
                  </p>
                )}
              </div>
              <div>
                <span className="text-gray-600">Entity Table Key</span>
                <p className="font-mono text-xs mt-0.5">{log.entity_type}</p>
              </div>
            </div>
          </div>

          {/* Actor */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Performed By
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name</span>
                <p className="font-medium">{userDisplayName(log)}</p>
              </div>
              <div>
                <span className="text-gray-600">Email</span>
                <p className="font-medium">{log.user_email || "—"}</p>
              </div>
              <div>
                <span className="text-gray-600">Role</span>
                <p className="font-medium">{humanize(log.user_role)}</p>
              </div>
              <div>
                <span className="text-gray-600">User ID</span>
                <p className="font-medium">{log.user_id}</p>
              </div>
            </div>
          </div>

          {/* Changes */}
          <div>
            <h3 className="font-semibold mb-4">
              {parsed.mode === "diff" ? "Changes" : "Details"}
            </h3>

            {parsed.mode === "empty" && (
              <p className="text-sm text-gray-500">
                No additional details were recorded for this event.
              </p>
            )}

            {parsed.mode === "diff" && (
              <div className="space-y-4">
                <DiffTable rows={parsed.rows} />
                {Object.keys(parsed.extra).length > 0 && (
                  <KeyValueList data={parsed.extra} />
                )}
              </div>
            )}

            {parsed.mode === "flat" && <KeyValueList data={parsed.data} />}
          </div>

          {/* Raw JSON */}
          {log.details && (
            <div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowRaw((s) => !s)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  {showRaw ? "Hide raw JSON" : "Show raw JSON"}
                </button>
                {showRaw && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyRaw}
                    className="h-7 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                )}
              </div>
              {showRaw && (
                <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-gray-50 border p-3 text-xs font-mono">
                  {rawJson}
                </pre>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
