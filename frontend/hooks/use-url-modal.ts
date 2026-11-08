"use client";

/**
 * useUrlModal — URL-synced create modal (?modal=create).
 *
 *   const createModal = useUrlModal("create", canCreate);
 *   <Button onClick={createModal.show}>Add</Button>
 *   <Dialog open={createModal.open} onOpenChange={createModal.onOpenChange}>
 *
 * Also understands the legacy header "+" deep link (?new=1) and converts it
 * into ?modal=create so the URL is shareable.
 *
 * Use a different `name` when a page has more than one create modal
 * (e.g. "create-type", "import").
 */

import { useCallback, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDrawerParams } from "@/hooks/use-drawer-params";

export function useUrlModal(name: string = "create", enabled: boolean = true) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { modalType, openModal, closeModal } = useDrawerParams();

  const legacyNew = searchParams.get("new") === "1";

  // ?new=1 → ?modal=<name>  (only the page's primary "create" modal claims it)
  useEffect(() => {
    if (!legacyNew || name !== "create") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    if (enabled) params.set("modal", name);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [legacyNew, enabled, name, pathname, router, searchParams]);

  // Not allowed to create? Strip the param instead of opening a dead modal.
  useEffect(() => {
    if (!enabled && modalType === name) closeModal();
  }, [enabled, modalType, name, closeModal]);

  const open = enabled && modalType === name;
  const show = useCallback(() => openModal(name), [openModal, name]);
  const close = useCallback(() => closeModal(), [closeModal]);
  const onOpenChange = useCallback(
    (next: boolean) => (next ? openModal(name) : closeModal()),
    [openModal, closeModal, name],
  );

  return { open, show, close, onOpenChange };
}
