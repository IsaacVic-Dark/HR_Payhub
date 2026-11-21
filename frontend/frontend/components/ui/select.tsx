"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/* -------------------------------------------------------------------------
 * Search helpers (used internally by SelectContent when searchable=true)
 * ---------------------------------------------------------------------- */

/** Extracts plain text from a React node tree (used for text matching). */
function nodeToText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join(" ");
  if (React.isValidElement(node)) {
    return nodeToText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Recursively walks Select children and drops SelectItems (and empty
 * SelectGroups) that don't match `term`. Labels/separators are dropped
 * while actively searching to avoid orphaned dividers.
 */
function filterSelectChildren(
  children: React.ReactNode,
  term: string,
): React.ReactNode {
  if (!term.trim()) return children;
  const lower = term.trim().toLowerCase();

  return React.Children.toArray(children).reduce<React.ReactNode[]>(
    (acc, child) => {
      if (!React.isValidElement(child)) return acc;

      if (child.type === SelectGroup) {
        const props = child.props as { children?: React.ReactNode };
        const filteredGroupChildren = filterSelectChildren(props.children, term);
        if (countSelectItems(filteredGroupChildren) > 0) {
          acc.push(
            React.cloneElement(
              child as React.ReactElement<{ children?: React.ReactNode }>,
              undefined,
              filteredGroupChildren,
            ),
          );
        }
        return acc;
      }

      if (child.type === SelectItem) {
        const props = child.props as {
          children?: React.ReactNode;
          value?: unknown;
          keywords?: string[];
        };
        const text = nodeToText(props.children).toLowerCase();
        const value = String(props.value ?? "").toLowerCase();
        const keywords = (props.keywords ?? []).join(" ").toLowerCase();
        if (
          text.includes(lower) ||
          value.includes(lower) ||
          keywords.includes(lower)
        ) {
          acc.push(child);
        }
        return acc;
      }

      // Drop labels/separators while a search term is active.
      if (child.type === SelectLabel || child.type === SelectSeparator) {
        return acc;
      }

      acc.push(child);
      return acc;
    },
    [],
  );
}

/** Counts how many SelectItem nodes exist in a (possibly grouped) tree. */
function countSelectItems(node: React.ReactNode): number {
  let count = 0;
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectItem) {
      count += 1;
      return;
    }
    const props = child.props as { children?: React.ReactNode };
    if (props?.children) count += countSelectItems(props.children);
  });
  return count;
}

type SelectContentProps = React.ComponentProps<typeof SelectPrimitive.Content> & {
  /** Turns on the search input at the top of the dropdown. Default: false. */
  searchable?: boolean;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /**
   * Provide this for server-driven / async search (large lists, e.g. 100+
   * countries). When set, the component will NOT filter children itself —
   * it just calls this (debounced) with the raw query, and you re-render
   * `children` with whatever results you fetched. Omit it to get automatic
   * client-side filtering instead.
   */
  onSearchChange?: (query: string) => void;
  /** Debounce delay in ms for onSearchChange. Default: 300. */
  searchDebounceMs?: number;
  /** Shows a loading state in the list (only meaningful with onSearchChange). */
  isLoading?: boolean;
  /** Message shown when there are zero matching items. */
  emptyText?: string;
};

function SelectContent({
  className,
  children,
  position = "popper",
  searchable = false,
  searchPlaceholder = "Search...",
  onSearchChange,
  searchDebounceMs = 300,
  isLoading = false,
  emptyText = "No results found.",
  ...props
}: SelectContentProps) {
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAsync = Boolean(onSearchChange);

  // Autofocus the search input as soon as the dropdown mounts (it mounts
  // fresh on every open since Radix unmounts closed content by default).
  React.useEffect(() => {
    if (!searchable) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [searchable]);

  // Debounced callback for async/server-driven search.
  React.useEffect(() => {
    if (!searchable || !onSearchChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(search);
    }, searchDebounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, searchable, searchDebounceMs]);

  const visibleChildren = React.useMemo(() => {
    if (!searchable || isAsync) return children;
    return filterSelectChildren(children, search);
  }, [children, searchable, isAsync, search]);

  const itemCount = React.useMemo(
    () => (searchable ? countSelectItems(visibleChildren) : 1),
    [visibleChildren, searchable],
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Let Escape bubble so Radix closes the dropdown as usual.
    if (e.key === "Escape") return;

    // Jump into the item list with ArrowDown instead of Radix's built-in
    // "type ahead" behaviour (which would otherwise hijack our typing).
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      contentRef.current
        ?.querySelector<HTMLElement>(
          '[data-slot="select-item"]:not([data-disabled])',
        )
        ?.focus();
      return;
    }

    // Enter with exactly one visible match selects it directly.
    if (e.key === "Enter" && itemCount === 1) {
      e.preventDefault();
      e.stopPropagation();
      contentRef.current
        ?.querySelector<HTMLElement>(
          '[data-slot="select-item"]:not([data-disabled])',
        )
        ?.click();
      return;
    }

    // Stop every other key (letters, space, etc.) from reaching Radix's
    // Content, which otherwise intercepts keystrokes for its own
    // type-ahead-select behaviour and steals focus from the input.
    e.stopPropagation();
  };

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={contentRef}
        data-slot="select-content"
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />

        {searchable && (
          <div
            className="flex items-center gap-2 border-b px-3 py-2"
            // Prevent Radix's pointerdown-based focus management from
            // closing/reopening the popup when clicking into the input.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SearchIcon className="text-muted-foreground size-4 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="placeholder:text-muted-foreground flex h-7 w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              autoComplete="off"
            />
          </div>
        )}

        <SelectPrimitive.Viewport
          className={cn(
            "p-1 max-h-[180px] overflow-y-auto",
            position === "popper" &&
              "w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          )}
        >
          {searchable && isLoading ? (
            <div className="text-muted-foreground py-6 text-center text-sm">
              Loading…
            </div>
          ) : searchable && itemCount === 0 ? (
            <div className="text-muted-foreground py-6 text-center text-sm">
              {emptyText}
            </div>
          ) : (
            visibleChildren
          )}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & { keywords?: string[] }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};