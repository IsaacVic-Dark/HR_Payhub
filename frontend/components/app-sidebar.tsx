"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftCollapseFilled,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavIcon } from "@/components/nav/nav-icon";
import { useVisibleNav } from "@/components/nav/use-visible-nav";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import {
  CORE_NAV,
  NAV_GROUPS,
  findActiveUrl,
  matchesUrl,
  type NavItem,
} from "@/lib/nav-config";

// ─── Styling ───────────────────────────────────────────────────────────────────
// Text and icons are ink-soft (#65646a) at rest, ink (#4b4b53) on hover, and the
// brand purple when active. Icons inherit the text colour.

const itemClass = cn(
  "group/nav h-9 gap-3 rounded-lg px-3 text-sm font-medium text-ink-soft",
  "hover:bg-field/60 hover:text-ink active:bg-field/80 active:text-ink",
  "data-[active=true]:bg-white data-[active=true]:font-semibold data-[active=true]:text-brand",
  "data-[active=true]:shadow-xs data-[active=true]:ring-1 data-[active=true]:ring-field",
  "data-[active=true]:hover:bg-white data-[active=true]:hover:text-brand",
  "data-[state=open]:hover:bg-field/60 data-[state=open]:hover:text-ink",
  "focus-visible:ring-2 focus-visible:ring-brand/40",
  // Icon-only rail: a square 36px button with the 18px icon centred.
  "group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-[9px]!",
);

const subMenuClass =
  "ml-[21px] mr-0 translate-x-0 gap-0.5 border-field px-0 pl-3 py-0.5";

const subItemClass = cn(
  "h-8 rounded-lg px-3 text-[13.5px] font-medium text-ink-soft",
  "hover:bg-field/60 hover:text-ink active:bg-field/80 active:text-ink",
  "data-[active=true]:bg-white data-[active=true]:font-semibold data-[active=true]:text-brand",
  "data-[active=true]:shadow-xs data-[active=true]:ring-1 data-[active=true]:ring-field",
  "data-[active=true]:hover:bg-white data-[active=true]:hover:text-brand",
  "focus-visible:ring-2 focus-visible:ring-brand/40",
);

const groupLabelClass =
  "px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft";

// ─── Setup wizard steps ───────────────────────────────────────────────────────

// Mirrors the STEPS array in app/(dashboard)/setup/page.tsx — keep in sync.
const SETUP_STEPS = [
  "Company Details",
  "Location",
  "Payroll Settings",
  "Banking",
  "Admin Profile",
  "Review & Submit",
];

// Reads ?step= from the URL. Isolated in its own component + Suspense
// boundary so useSearchParams() doesn't force dynamic rendering on every
// route that mounts the sidebar — only this small subtree opts in.
function SetupStepsSubNav({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const isSetupActive = pathname === "/setup" || pathname.startsWith("/setup/");
  const raw = parseInt(searchParams.get("step") || "0", 10);
  const activeStep = isNaN(raw) || raw < 0 || raw > SETUP_STEPS.length - 1 ? 0 : raw;

  return (
    <SidebarMenuSub className={subMenuClass}>
      {SETUP_STEPS.map((label, idx) => {
        const isCurrent = isSetupActive && idx === activeStep;
        const isPast = isSetupActive && idx < activeStep;
        return (
          <SidebarMenuSubItem key={label}>
            <SidebarMenuSubButton asChild isActive={isCurrent} className={subItemClass}>
              <Link href={`/setup?step=${idx}`} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                    isCurrent && "bg-brand text-white",
                    isPast && "bg-brand-emerald text-white",
                    !isCurrent && !isPast && "border border-ink-soft/40 text-ink-soft",
                  )}
                >
                  {isPast ? "✓" : idx + 1}
                </span>
                <span>{label}</span>
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </SidebarMenuSub>
  );
}

// ─── Brand header ──────────────────────────────────────────────────────────────

function BrandHeader() {
  const { isMobile, toggleSidebar } = useSidebar();

  return (
    <SidebarHeader className="h-14 flex-row items-center justify-between gap-2 px-4 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <Link
        href="/dashboard"
        aria-label="PayKe dashboard"
        className="flex min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {/* Full wordmark when open, compact mark when the rail is collapsed */}
        <span className="truncate text-[19px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          <span className="text-brand">Pay</span>
          <span className="text-brand-dark">Ke</span>
        </span>
        <span
          aria-hidden
          className="hidden size-8 items-center justify-center rounded-lg bg-brand text-[15px] font-bold text-white group-data-[collapsible=icon]:flex"
        >
          P
        </span>
      </Link>

      {!isMobile && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          className="group/nav flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-soft outline-none transition-colors hover:bg-field/60 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40 group-data-[collapsible=icon]:hidden"
        >
          <NavIcon
            icon={{
              outline: IconLayoutSidebarLeftCollapse,
              solid: IconLayoutSidebarLeftCollapseFilled,
            }}
          />
        </button>
      )}
    </SidebarHeader>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

// Parents that expand to show children. Module-level: derived from static config only.
const DROPDOWN_ITEMS = [...CORE_NAV, ...NAV_GROUPS.flatMap((g) => g.items)].filter(
  (item) => item.hasDropdown && item.items,
);

const dropdownsForPath = (pathname: string) =>
  DROPDOWN_ITEMS.filter((item) => item.items!.some((sub) => matchesUrl(pathname, sub.url))).map(
    (item) => item.title,
  );

export function AppSidebar({
  // Callers still pass variant="inset" from the old layout; the shell now draws
  // its own frame (see site-header.tsx), so the variant is ignored on purpose.
  variant: _variant,
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();
  const { state, isMobile } = useSidebar();
  const { setupComplete, coreItems, groups, otherItems } = useVisibleNav();

  const [openDropdowns, setOpenDropdowns] = React.useState<string[]>(() =>
    dropdownsForPath(pathname),
  );

  // Landing on a child route (link, search, back button) opens its parent.
  React.useEffect(() => {
    const toOpen = dropdownsForPath(pathname);
    if (toOpen.length === 0) return;
    setOpenDropdowns((prev) => {
      const next = Array.from(new Set([...prev, ...toOpen]));
      return next.length === prev.length ? prev : next;
    });
  }, [pathname]);

  const sidebarProps = {
    collapsible: "icon" as const,
    ...props,
    variant: "sidebar" as const,
    className: cn("group-data-[side=left]:border-r-0", className),
  };

  // Minimal sidebar while auth is loading
  if (isLoading) {
    return (
      <Sidebar {...sidebarProps}>
        <BrandHeader />
        <SidebarContent>
          <div className="space-y-2 px-3 py-3" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-field/60" />
            ))}
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  // If no user, don't show sidebar
  if (!user) {
    return null;
  }

  // Most specific match wins, so /payrun/overtime-approvals doesn't also light up "Payrun".
  const allUrls = [...coreItems, ...groups.flatMap((g) => g.items), ...otherItems].flatMap(
    (item) => [item.url, ...(item.items?.map((sub) => sub.url) ?? [])],
  );
  const activeUrl = findActiveUrl(pathname, allUrls);
  const isItemActive = (item: NavItem) =>
    item.url === activeUrl || !!item.items?.some((sub) => sub.url === activeUrl);

  const toggleDropdown = (title: string) => {
    setOpenDropdowns((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const isCollapsedRail = state === "collapsed" && !isMobile;

  const renderItem = (item: NavItem) => {
    const active = isItemActive(item);
    const isOpen = openDropdowns.includes(item.title);

    const label = (
      <>
        <NavIcon icon={item.icon} />
        <span>{item.title}</span>
      </>
    );

    // Setup wizard: show the step list under "Complete Setup", always expanded.
    if (item.title === "Complete Setup" && !setupComplete) {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={active} tooltip={item.title} className={itemClass}>
            <Link href={item.url}>{label}</Link>
          </SidebarMenuButton>
          <React.Suspense fallback={null}>
            <SetupStepsSubNav pathname={pathname} />
          </React.Suspense>
        </SidebarMenuItem>
      );
    }

    if (item.hasDropdown && item.items) {
      // Icon-only rail: children can't expand inline, so open them as a flyout.
      if (isCollapsedRail) {
        return (
          <SidebarMenuItem key={item.title}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton isActive={active} aria-label={item.title} className={itemClass}>
                  {label}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={12}
                className="min-w-52 rounded-xl border-field p-1.5"
              >
                <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {item.title}
                </DropdownMenuLabel>
                {item.items.map((sub) => (
                  <DropdownMenuItem
                    key={sub.url}
                    asChild
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft focus:bg-field/60 focus:text-ink",
                      sub.url === activeUrl && "bg-brand/10 text-brand focus:bg-brand/10 focus:text-brand",
                    )}
                  >
                    <Link href={sub.url}>{sub.title}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        );
      }

      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleDropdown(item.title)}
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={active} className={itemClass}>
                {label}
                <IconChevronDown
                  aria-hidden
                  className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/nav:rotate-180"
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className={cn(subMenuClass, "mt-0.5")}>
                {item.items.map((sub) => (
                  <SidebarMenuSubItem key={sub.url}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={sub.url === activeUrl}
                      className={subItemClass}
                    >
                      <Link
                        href={sub.url}
                        aria-current={sub.url === activeUrl ? "page" : undefined}
                      >
                        {sub.title}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.title} className={itemClass}>
          <Link href={item.url} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (id: string, label: string | undefined, items: NavItem[], rule: boolean) => (
    <SidebarGroup key={id} className="px-3 py-2 group-data-[collapsible=icon]:px-1.5">
      {/* In the icon rail the labels fade out; a hairline separates the groups instead. */}
      {rule && (
        <div
          aria-hidden
          className="mx-auto mb-2 hidden h-px w-5 bg-field group-data-[collapsible=icon]:block"
        />
      )}
      {label && <SidebarGroupLabel className={groupLabelClass}>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">{items.map(renderItem)}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar {...sidebarProps}>
      <BrandHeader />

      <SidebarContent className="nav-scroll gap-0 overflow-y-auto overflow-x-hidden">
        {coreItems.length > 0 && renderGroup("core", undefined, coreItems, false)}
        {groups.map((group) => renderGroup(group.id, group.label, group.items, true))}
      </SidebarContent>

      {otherItems.length > 0 && (
        <SidebarFooter className="gap-0 border-t border-field p-0">
          {renderGroup("others", undefined, otherItems, false)}
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
