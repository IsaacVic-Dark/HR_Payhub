"use client";

import type { TemplateStatus } from "@/services/api/template";

const STATUS_CONFIG: Record<TemplateStatus, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-800", label: "Draft" },
  active: { color: "bg-green-100 text-green-800", label: "Active" },
  archived: { color: "bg-gray-100 text-gray-500", label: "Archived" },
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const config = STATUS_CONFIG[status] ?? { color: "bg-gray-100 text-gray-800", label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export function PendingChangesBadge() {
  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
      title="Saved changes are not live until the template is activated"
    >
      Unactivated changes
    </span>
  );
}
