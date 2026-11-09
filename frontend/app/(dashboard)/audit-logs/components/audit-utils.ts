import type { AuditLogType } from "@/services/api/audit-log";

/** "advance_recovery_attached" -> "Advance Recovery Attached" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ENTITY_LABELS: Record<string, string> = {
  organization_config: "Org Config",
  payruns: "Payrun",
  payrun_details: "Payrun Details",
  departments: "Department",
  job_titles: "Job Title",
  reimbursements: "Reimbursement",
  overtime_approvals: "Overtime Approval",
  advance: "Advance",
};

export function entityLabel(type: string): string {
  return ENTITY_LABELS[type] ?? humanize(type);
}

/** MySQL "YYYY-MM-DD HH:mm:ss" -> Date (the space breaks Safari's parser). */
export function parseDbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

export function toApiDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Action badge styling
// ---------------------------------------------------------------------------

const RED = "bg-red-100 text-red-800";
const GREEN = "bg-green-100 text-green-800";
const BLUE = "bg-blue-100 text-blue-800";
const AMBER = "bg-amber-100 text-amber-800";
const PURPLE = "bg-purple-100 text-purple-800";
const GRAY = "bg-gray-100 text-gray-800";

export function actionBadgeClass(action: string): string {
  const a = action.toLowerCase();
  if (
    /(delete|reject|fail|cancel|revers|dispute|detach|skipped|locked)/.test(a)
  )
    return RED;
  if (/(approve|finalize|repaid|paid$)/.test(a)) return GREEN;
  if (/(create|submit|attached|bootstrap)/.test(a)) return GREEN;
  if (/(update|review|reopen|partially|carry_forward|linked)/.test(a))
    return BLUE;
  if (/(payment|schedul|disburse|recovery|payout)/.test(a)) return PURPLE;
  if (/(validated|policy)/.test(a)) return AMBER;
  return GRAY;
}

// ---------------------------------------------------------------------------
// Details parsing / diffing
// ---------------------------------------------------------------------------

export type DiffRow = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  /** added: only new, removed: only old, changed: both and different, unchanged: both and equal */
  kind: "added" | "removed" | "changed" | "unchanged";
};

export type ParsedDetails =
  | { mode: "diff"; rows: DiffRow[]; extra: Record<string, unknown> }
  | { mode: "flat"; data: Record<string, unknown> }
  | { mode: "empty" };

/** Fields that add noise rather than information in a diff. */
const NOISE_KEYS = new Set([
  "id",
  "organization_id",
  "created_at",
  "updated_at",
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Loose equality so MySQL decimals ("5.00") equal JSON numbers (5), and 1 equals "1". */
export function looselyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") {
    return na === nb;
  }
  return String(a) === String(b);
}

export function parseDetails(log: AuditLogType): ParsedDetails {
  const details = log.details;
  if (!isObject(details) || Object.keys(details).length === 0) {
    return { mode: "empty" };
  }

  const hasNew = "new_data" in details;
  const hasOld = "old_data" in details;

  // organization_config style: { action, user_id, new_data, old_data, timestamp }
  if (hasNew || hasOld) {
    const newData = isObject(details.new_data) ? details.new_data : null;
    const oldData = isObject(details.old_data) ? details.old_data : null;
    const rows: DiffRow[] = [];

    if (newData && !oldData) {
      for (const [k, v] of Object.entries(newData)) {
        if (k === "organization_id") continue;
        rows.push({ field: k, oldValue: undefined, newValue: v, kind: "added" });
      }
    } else if (!newData && oldData) {
      for (const [k, v] of Object.entries(oldData)) {
        if (NOISE_KEYS.has(k)) continue;
        rows.push({ field: k, oldValue: v, newValue: undefined, kind: "removed" });
      }
    } else if (newData && oldData) {
      // update: new_data holds only the submitted fields, old_data the full previous record
      for (const [k, v] of Object.entries(newData)) {
        const before = oldData[k];
        rows.push({
          field: k,
          oldValue: before,
          newValue: v,
          kind: looselyEqual(before, v) ? "unchanged" : "changed",
        });
      }
    }

    // Anything else stored beside the diff (timestamp excluded: shown as the event time)
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(details)) {
      if (["new_data", "old_data", "action", "user_id", "timestamp"].includes(k)) continue;
      extra[k] = v;
    }

    return { mode: "diff", rows, extra };
  }

  // Everything else: a flat bag of fields
  return { mode: "flat", data: details };
}

/** Best-effort display name for the record the log refers to. */
export function entityDisplayName(log: AuditLogType): string | null {
  if (log.entity_name) return log.entity_name;
  const d = log.details;
  if (!isObject(d)) return null;
  const candidates = [
    isObject(d.old_data) ? d.old_data : null,
    isObject(d.new_data) ? d.new_data : null,
    d,
  ];
  for (const src of candidates) {
    if (!src) continue;
    for (const key of [
      "name",
      "title",
      "payrun_name",
      "advance_number",
      "reimbursement_number",
    ]) {
      const v = src[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return null;
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function userDisplayName(log: AuditLogType): string {
  const full = (log.user_full_name ?? "").trim();
  return full || log.user_email || `User #${log.user_id}`;
}
