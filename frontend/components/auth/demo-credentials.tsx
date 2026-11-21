"use client";

import { useCallback, useState } from "react";
import { ChevronDown, KeyRound, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { authService } from "@/services/api/auth";
import { cn } from "@/lib/utils";

/**
 * Development-only list of real accounts, read from the database through
 * GET /api/v1/dev/demo-credentials (see backend/Controllers/DevController.php).
 *
 * Collapsed by default. The request is only made the first time it is opened.
 * The parent decides whether to render this at all (login-form.tsx renders it
 * only when NODE_ENV === "development").
 */

export interface DemoCredential {
  role: string;
  email: string;
  password: string;
  name: string | null;
  organization: string | null;
  job_title: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  hr_manager: "HR manager",
  hr_officer: "HR officer",
  payroll_manager: "Payroll manager",
  payroll_officer: "Payroll officer",
  finance_manager: "Finance manager",
  auditor: "Auditor",
  department_manager: "Department manager",
  employee: "Employee",
};

const roleLabel = (role: string) =>
  ROLE_LABELS[role] ?? role.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

type Status = "idle" | "loading" | "ready" | "error";

interface DemoCredentialsProps {
  disabled?: boolean;
  /** Fill the email and password fields. */
  onFill: (credential: DemoCredential) => void;
  /** Fill the fields and sign in straight away. */
  onSignIn: (credential: DemoCredential) => void;
}

export function DemoCredentials({ disabled, onFill, onSignIn }: DemoCredentialsProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<DemoCredential[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    try {
      const res = await authService.getDemoCredentials();
      const credentials = res?.data?.credentials;

      if (!Array.isArray(credentials)) {
        setMessage("The API returned an unexpected response.");
        setStatus("error");
        return;
      }

      setItems(credentials as DemoCredential[]);
      setMessage(typeof res?.message === "string" ? res.message : "");
      setStatus("ready");
    } catch (err) {
      const httpStatus = (err as { response?: { status?: number } })?.response?.status;
      setMessage(
        httpStatus === 404
          ? "Demo accounts are switched off on the API. Set DEV_DEMO_CREDENTIALS=true in the backend .env (development only)."
          : "Couldn't reach the API to load demo accounts.",
      );
      setStatus("error");
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && (status === "idle" || status === "error")) void load();
  };

  const sharedPassword =
    items.length > 0 && new Set(items.map((i) => i.password)).size === 1
      ? items[0].password
      : null;

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="rounded-lg border border-dashed border-auth-line bg-auth-canvas/60"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-auth-accent/40">
        <span className="flex min-w-0 items-center gap-2.5">
          <KeyRound className="size-4 shrink-0 text-auth-muted" aria-hidden />
          <span className="text-sm font-medium text-auth-ink">Demo accounts</span>
          <span className="rounded-full border border-auth-line bg-white px-2 py-0.5 text-xs text-auth-muted">
            Development only
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-auth-muted transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="auth-collapsible overflow-hidden">
        {status === "loading" && (
          <p className="flex items-center gap-2 border-t border-dashed border-auth-line px-4 py-3 text-sm text-auth-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading accounts from the database…
          </p>
        )}

        {status === "error" && (
          <div className="space-y-2 border-t border-dashed border-auth-line px-4 py-3 text-sm text-auth-muted">
            <p>{message}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="font-medium text-auth-accent-strong underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <p className="border-t border-dashed border-auth-line px-4 py-3 text-sm text-auth-muted">
            {message || "No accounts in the database match DEV_DEMO_PASSWORD."}
          </p>
        )}

        {status === "ready" && items.length > 0 && (
          <>
            <ul className="max-h-72 divide-y divide-auth-line overflow-y-auto border-t border-dashed border-auth-line">
              {items.map((c) => (
                <li key={`${c.role}-${c.email}`} className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => onFill(c)}
                    disabled={disabled}
                    className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-auth-accent/40 disabled:opacity-60"
                  >
                    <span className="block text-sm font-medium text-auth-ink">
                      {roleLabel(c.role)}
                    </span>
                    <span className="block truncate text-xs text-auth-muted">{c.email}</span>
                    {(c.name || c.organization) && (
                      <span className="block truncate text-xs text-auth-muted">
                        {[c.name, c.organization].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {!sharedPassword && (
                      <span className="block truncate text-xs text-auth-muted">
                        Password: {c.password}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSignIn(c)}
                    disabled={disabled}
                    aria-label={`Sign in as ${roleLabel(c.role)}`}
                    className="shrink-0 rounded-md border border-auth-line bg-white px-2.5 py-1 text-xs font-medium text-auth-accent-strong outline-none transition-colors hover:bg-auth-accent-soft focus-visible:ring-2 focus-visible:ring-auth-accent/40 disabled:opacity-60"
                  >
                    Sign in
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-dashed border-auth-line px-4 py-2.5 text-xs text-auth-muted">
              {sharedPassword ? (
                <>
                  Password for every account: <span className="font-medium text-auth-body">{sharedPassword}</span>.{" "}
                </>
              ) : null}
              Select a row to fill the form, or use Sign in to log in directly.
            </p>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
