"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { templateAPI, type DocumentTemplateVersion } from "@/services/api/template";

interface Props {
  orgId: number;
  templateId: number;
  /** bump to reload (e.g. after activation) */
  refreshKey?: number;
}

export function TemplateVersionsPanel({ orgId, templateId, refreshKey }: Props) {
  const [versions, setVersions] = useState<DocumentTemplateVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVersions(null);
    templateAPI.versions(orgId, templateId).then((res) => {
      if (cancelled) return;
      if (res.success) setVersions(res.data ?? []);
      else setError(res.error ?? "Could not load versions");
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, templateId, refreshKey]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!versions)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading versions...
      </div>
    );
  if (versions.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No versions yet. A version is saved each time the template is activated.
      </p>
    );

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Every activation saves an unchangeable version. Payslips remember the version they were generated with.
      </p>
      <ul className="divide-y rounded-lg border">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div>
              <span className="font-medium">Version {v.version}</span>
              {v.is_active && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  In use
                </span>
              )}
              <div className="text-xs text-muted-foreground">
                {v.created_by_name ? `${v.created_by_name} · ` : ""}
                {format(new Date(v.created_at.replace(" ", "T")), "d MMM yyyy, HH:mm")}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: v.primary_color ?? "#1E3A8A" }}
                title="Primary colour"
              />
              <span className="text-xs text-muted-foreground capitalize">{v.config?.layout}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
