"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";
import { DemoCredentials, type DemoCredential } from "@/components/auth/demo-credentials";
import {
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from "@/components/auth/styles";

// Compiled away in production builds, so the demo panel (and its API call) never ships.
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV === "development";

/**
 * middleware.js redirects signed-out visitors to /login?from=/some/page.
 * Honour that, but only for same-site paths (blocks "//evil.com" style open redirects).
 */
function getSafeRedirectTarget(): string | null {
  if (typeof window === "undefined") return null;
  const from = new URLSearchParams(window.location.search).get("from");
  if (from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/\\")) {
    return from;
  }
  return null;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  // One sign-in path for the form and the demo panel.
  const signIn = async (nextEmail: string, nextPassword: string) => {
    setError("");
    setIsLoading(true);

    try {
      const loggedInUser = await login(nextEmail, nextPassword);

      if (!loggedInUser) {
        setError("We couldn't sign you in. Check your email and password, then try again.");
        return;
      }

      const destination =
        loggedInUser.setup_completed === 1 ? (getSafeRedirectTarget() ?? "/dashboard") : "/setup";
      router.push(destination);
    } catch (err) {
      console.error("Login exception:", err);
      setError("Something went wrong while signing in. Try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn(email, password);
  };

  const fillDemo = (c: DemoCredential) => {
    setEmail(c.email);
    setPassword(c.password);
    setError("");
  };

  const signInAsDemo = (c: DemoCredential) => {
    fillDemo(c);
    void signIn(c.email, c.password);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="auth-display text-[28px] font-semibold leading-tight tracking-tight text-auth-ink">
          Sign in to PayKe
        </h1>
        <p className="text-[15px] leading-relaxed text-auth-muted">
          Use your work email to continue to your organization&apos;s payroll.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className={authLabelClass}>
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className={authInputClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={authLabelClass}>
              Password
            </Label>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "Self-service password reset isn't available yet. Ask your organization's administrator to reset it.",
                )
              }
              className={`text-sm ${authLinkClass}`}
            >
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="text-sm text-auth-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className={authLinkClass}>
          Create one
        </Link>
      </p>

      {SHOW_DEMO_ACCOUNTS && (
        <DemoCredentials disabled={isLoading} onFill={fillDemo} onSignIn={signInAsDemo} />
      )}
    </div>
  );
}
