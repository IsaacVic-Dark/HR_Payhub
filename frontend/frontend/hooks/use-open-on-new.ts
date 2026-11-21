"use client";

/**
 * useOpenOnNew
 *
 * Lets the header "+" quick-add menu deep-link into a page's create form.
 * When the URL contains `?new=1` (and `enabled` is true) it calls `open()`
 * once, then removes the param so a refresh doesn't re-open the form.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useOpenOnNew(open: () => void, enabled: boolean = true) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openRef = useRef(open);
  openRef.current = open;

  const wantsNew = searchParams.get("new") === "1";

  useEffect(() => {
    if (!wantsNew || !enabled) return;
    openRef.current();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [wantsNew, enabled, pathname, router, searchParams]);
}
