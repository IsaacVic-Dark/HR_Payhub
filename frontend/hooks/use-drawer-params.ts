"use client";

/**
 * useDrawerParams
 *
 * A thin hook that reads and writes drawer state via URL search params,
 * so that any open drawer can be bookmarked / shared by URL.
 *
 * URL shape:
 *   ?drawer=view&id=42     → view drawer for record 42
 *   ?drawer=edit&id=42     → edit drawer for record 42
 *   ?drawer=add            → create drawer (no id needed)
 *
 * Usage:
 *   const { drawerType, drawerId, openDrawer, closeDrawer } = useDrawerParams();
 *
 *   openDrawer("view", String(row.id));
 *   openDrawer("add");
 *   closeDrawer();
 *
 * The hook is a thin wrapper around Next.js App Router's
 * useSearchParams / useRouter — no external libraries required.
 */

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type DrawerType = "view" | "edit" | "add" | null;

export interface UseDrawerParamsReturn {
  /** Which drawer variant is open, or null if closed. */
  drawerType: DrawerType;
  /** The record id from the URL (string), or null. */
  drawerId: string | null;
  /**
   * Open a drawer and push the state into the URL.
   * @param type  - "view" | "edit" | "add"
   * @param id    - Record identifier (not required for "add")
   */
  openDrawer: (type: DrawerType, id?: string) => void;
  /** Close the drawer and remove the drawer params from the URL. */
  closeDrawer: () => void;
}

export function useDrawerParams(): UseDrawerParamsReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const drawerType = (searchParams.get("drawer") as DrawerType) ?? null;
  const drawerId = searchParams.get("id");

  const openDrawer = useCallback(
    (type: DrawerType, id?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (type) {
        params.set("drawer", type);
      } else {
        params.delete("drawer");
      }
      if (id !== undefined) {
        params.set("id", id);
      } else {
        params.delete("id");
      }
      // Use replace so the back-button doesn't loop through each open-drawer state
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const closeDrawer = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("drawer");
    params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return { drawerType, drawerId, openDrawer, closeDrawer };
}
