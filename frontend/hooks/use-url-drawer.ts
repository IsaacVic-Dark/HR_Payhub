"use client";

/**
 * useUrlDrawer — a URL-synced view/edit drawer for a single record.
 *
 *   const drawer = useUrlDrawer<Loan>({
 *     rows: loans,
 *     getId: (l) => l.id,
 *     fetchById: async (id) => (await loanAPI.getLoanById(orgId, Number(id))).data,
 *   });
 *
 *   <Row onClick={() => drawer.show(loan)} />
 *   <LoanViewDrawer open={drawer.open} onOpenChange={drawer.onOpenChange} loan={drawer.record} />
 *
 * - Clicking a row writes ?drawer=view&id=<id> to the URL.
 * - Opening a shared link (?drawer=view&id=42) loads the record: from the
 *   already-loaded rows if present, otherwise by calling `fetchById`.
 * - If the record can't be fetched (403 / 401 / 404 / error) the user is sent
 *   to /unauthorized.
 * - Without `fetchById` (module has no get-by-id endpoint yet), the drawer
 *   opens once the record shows up in `rows`; if rows have finished loading
 *   (`rowsReady`) and it isn't there, the drawer param is removed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDrawerParams, DrawerType } from "@/hooks/use-drawer-params";

interface Options<T> {
  rows?: T[];
  getId: (row: T) => string | number;
  fetchById?: (id: string) => Promise<T | null | undefined>;
  /** Which ?drawer= value this instance owns. Default "view". */
  type?: Exclude<DrawerType, "add" | null>;
  /** True once `rows` has finished loading (only needed without fetchById). */
  rowsReady?: boolean;
  /** Hold off fetching until prerequisites (e.g. the signed-in user) are ready. */
  enabled?: boolean;
  /** Where to send people who can't open the record. */
  unauthorizedPath?: string;
}

export function useUrlDrawer<T>({
  rows = [],
  getId,
  fetchById,
  type = "view",
  rowsReady = true,
  enabled = true,
  unauthorizedPath = "/unauthorized",
}: Options<T>) {
  const router = useRouter();
  const { drawerType, drawerId, openDrawer, closeDrawer } = useDrawerParams();

  const isMine = drawerType === type && !!drawerId;
  const [fetched, setFetched] = useState<{ id: string; record: T } | null>(null);
  const [clicked, setClicked] = useState<{ id: string; record: T } | null>(null);
  const [loading, setLoading] = useState(false);

  // keep latest callbacks without retriggering the effect
  const fetchRef = useRef(fetchById);
  fetchRef.current = fetchById;
  const getIdRef = useRef(getId);
  getIdRef.current = getId;

  const fromRows =
    isMine ? rows.find((r) => String(getId(r)) === drawerId) ?? null : null;
  const fromClick = isMine && clicked?.id === drawerId ? clicked.record : null;
  const fromFetch = isMine && fetched?.id === drawerId ? fetched.record : null;

  // Prefer fresh list data → fetched → what was clicked
  const record: T | null = fromRows ?? fromFetch ?? fromClick ?? null;

  useEffect(() => {
    if (!isMine || !drawerId || !enabled) return;
    if (fromRows || fromClick || fromFetch) return;

    if (fetchRef.current) {
      let cancelled = false;
      setLoading(true);
      fetchRef
        .current(drawerId)
        .then((rec) => {
          if (cancelled) return;
          if (rec) setFetched({ id: drawerId, record: rec });
          else router.replace(unauthorizedPath);
        })
        .catch(() => {
          if (!cancelled) router.replace(unauthorizedPath);
        })
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }

    // No fetcher: wait for the list, then give up gracefully.
    if (rowsReady) closeDrawer();
  }, [isMine, drawerId, enabled, fromRows, fromClick, fromFetch, rowsReady, router, unauthorizedPath, closeDrawer]);

  const show = useCallback(
    (row: T) => {
      const id = String(getIdRef.current(row));
      setClicked({ id, record: row });
      openDrawer(type, id);
    },
    [openDrawer, type],
  );

  const close = useCallback(() => closeDrawer(), [closeDrawer]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) closeDrawer();
    },
    [closeDrawer],
  );

  return {
    /** Pass to the drawer's `open` prop. */
    open: isMine,
    record,
    loading,
    id: isMine ? drawerId : null,
    show,
    close,
    onOpenChange,
  };
}
