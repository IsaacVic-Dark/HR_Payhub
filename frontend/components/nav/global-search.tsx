"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconX } from "@tabler/icons-react";

import { NavIcon } from "@/components/nav/nav-icon";
import { useVisibleNav } from "@/components/nav/use-visible-nav";
import type { NavIconPair } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

interface SearchEntry {
  key: string;
  title: string;
  url: string;
  context: string;
  icon: NavIconPair;
}

const MAX_RESULTS = 8;

/** Bold the part of `text` that matches `query`. */
function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-ink">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

/**
 * Top-nav search. Jumps to any page the user is allowed to open.
 *
 * It searches navigation only; there is no backend search endpoint yet, so it
 * does not look up employees, payslips or other records.
 * Shortcut: Ctrl/⌘ + K focuses it from anywhere.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { coreItems, groups, otherItems } = useVisibleNav();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [shortcut, setShortcut] = React.useState("Ctrl K");

  // Platform-specific hint, set after mount so server and client markup match.
  React.useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘ K");
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const entries = React.useMemo<SearchEntry[]>(() => {
    const out: SearchEntry[] = [];
    const seen = new Set<string>();
    const add = (entry: Omit<SearchEntry, "key">) => {
      const key = `${entry.url}|${entry.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ ...entry, key });
      }
    };

    const sections = [
      { label: "General", items: coreItems },
      ...groups.map((g) => ({ label: g.label, items: g.items })),
      { label: "Help", items: otherItems },
    ];

    sections.forEach(({ label, items }) =>
      items.forEach((item) => {
        add({ title: item.title, url: item.url, context: label, icon: item.icon });
        item.items?.forEach((sub) =>
          add({ title: sub.title, url: sub.url, context: `${label} · ${item.title}`, icon: item.icon }),
        );
      }),
    );
    return out;
  }, [coreItems, groups, otherItems]);

  const trimmed = query.trim();

  const results = React.useMemo(() => {
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    return entries
      .map((entry) => {
        const title = entry.title.toLowerCase();
        // 0 = starts with, 1 = contains in title, 2 = matches the section name only
        const rank = title.startsWith(q) ? 0 : title.includes(q) ? 1 : entry.context.toLowerCase().includes(q) ? 2 : -1;
        return { entry, rank };
      })
      .filter((r) => r.rank !== -1)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, MAX_RESULTS)
      .map((r) => r.entry);
  }, [entries, trimmed]);

  const showPanel = open && trimmed.length > 0;

  const go = (entry: SearchEntry) => {
    router.push(entry.url);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
      setOpen(false);
      return;
    }
    if (!results.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[Math.min(activeIndex, results.length - 1)]);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <IconSearch
        aria-hidden
        stroke={1.75}
        className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-soft"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && results.length ? `${listId}-${activeIndex}` : undefined}
        aria-label="Search pages"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search pages…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-10 w-full rounded-lg border border-transparent bg-field pl-10 pr-16 text-sm font-medium text-ink outline-none transition-[background-color,border-color,box-shadow]",
          "placeholder:font-normal placeholder:text-ink-soft",
          "hover:bg-field/80 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15",
        )}
      />

      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-field hover:text-ink"
        >
          <IconX className="size-4" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-ink-soft/25 bg-white/70 px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-soft lg:block">
          {shortcut}
        </kbd>
      )}

      {showPanel && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-field bg-white p-2 shadow-lg shadow-brand-dark/5">
          <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-ink-soft">
            {results.length > 0
              ? `Pages · ${results.length} result${results.length === 1 ? "" : "s"}`
              : "Pages"}
          </p>

          {results.length > 0 ? (
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto">
              {results.map((entry, i) => (
                <li
                  key={entry.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  data-active={i === activeIndex}
                  // mousedown (not click) so the input keeps focus and the panel doesn't close first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(entry);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "group/nav flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-ink-soft",
                    "data-[active=true]:bg-field/60 data-[active=true]:text-ink",
                  )}
                >
                  <NavIcon icon={entry.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      <Highlight text={entry.title} query={trimmed} />
                    </span>
                    <span className="block truncate text-xs text-ink-soft">{entry.context}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2.5 py-4 text-sm text-ink-soft">
              No pages match <span className="font-medium text-ink">“{trimmed}”</span>.
            </p>
          )}

          <p className="mt-1 border-t border-field px-2.5 pb-1 pt-2 text-xs text-ink-soft">
            Searches pages you can open. Searching employees and records isn&apos;t available yet.
          </p>
        </div>
      )}
    </div>
  );
}
