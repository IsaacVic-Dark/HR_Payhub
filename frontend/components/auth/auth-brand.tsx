import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark shared by the auth screens. Matches the landing page lockup. */
export function AuthBrand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="PayKe home"
      className={cn(
        "auth-display inline-flex items-baseline rounded-sm text-[22px] font-semibold tracking-tight",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-auth-accent/40",
        className,
      )}
    >
      <span className="text-auth-accent">Pay</span>
      <span className="text-auth-ink">Ke</span>
    </Link>
  );
}
