"use client";

/**
 * useDrawerParams
 *
 * Reads and writes drawer / modal state via URL search params so that any open
 * drawer or create modal can be copied, shared and bookmarked.
 *
 * URL shape:
 *   ?drawer=view&id=42              → view drawer for record 42
 *   ?drawer=edit&id=42              → edit drawer for record 42
 *   ?drawer=add                     → create drawer
 *   ?modal=create                   → create modal (dialog)
 *   ?drawer=view&id=42&detail=7     → a drawer nested inside the view drawer
 *                                     (e.g. a payrun's employee detail)
 *
 * Approve / reject / cancel / delete confirmation dialogs deliberately do NOT
 * use the URL.
 *
 * All writes use router.replace so the Back button doesn't step through every
 * open/close.
 */

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type DrawerType = "view" | "edit" | "add" | null;

export const DRAWER_PARAM_KEYS = ["drawer", "id", "modal", "detail"] as const;

export interface UseDrawerParamsReturn {
  drawerType: DrawerType;
  drawerId: string | null;
  /** Current create-modal name from ?modal=..., e.g. "create". */
  modalType: string | null;
  /** Nested drawer record id from ?detail=... */
  detailId: string | null;
  openDrawer: (type: DrawerType, id?: string) => void;
  closeDrawer: () => void;
  openModal: (name?: string) => void;
  closeModal: () => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
}

export function useDrawerParams(): UseDrawerParamsReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const drawerType = (searchParams.get("drawer") as DrawerType) ?? null;
  const drawerId = searchParams.get("id");
  const modalType = searchParams.get("modal");
  const detailId = searchParams.get("detail");

  const write = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      // Read the live URL (not the render-time snapshot) so two quick updates
      // don't overwrite each other.
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : searchParams.toString(),
      );
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const openDrawer = useCallback(
    (type: DrawerType, id?: string) =>
      write((p) => {
        p.delete("modal");
        p.delete("detail");
        if (type) p.set("drawer", type);
        else p.delete("drawer");
        if (id !== undefined) p.set("id", id);
        else p.delete("id");
      }),
    [write],
  );

  const closeDrawer = useCallback(
    () =>
      write((p) => {
        p.delete("drawer");
        p.delete("id");
        p.delete("detail");
      }),
    [write],
  );

  const openModal = useCallback(
    (name: string = "create") =>
      write((p) => {
        p.delete("drawer");
        p.delete("id");
        p.delete("detail");
        p.set("modal", name);
      }),
    [write],
  );

  const closeModal = useCallback(() => write((p) => p.delete("modal")), [write]);

  const openDetail = useCallback((id: string) => write((p) => p.set("detail", id)), [write]);
  const closeDetail = useCallback(() => write((p) => p.delete("detail")), [write]);

  return {
    drawerType,
    drawerId,
    modalType,
    detailId,
    openDrawer,
    closeDrawer,
    openModal,
    closeModal,
    openDetail,
    closeDetail,
  };
}
