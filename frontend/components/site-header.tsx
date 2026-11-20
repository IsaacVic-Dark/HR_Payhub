'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconBellFilled,
  IconBoltFilled,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarLeftExpandFilled,
  IconPlus,
  IconPlusFilled,
} from "@tabler/icons-react";
import {
  UserPlus,
  CalendarPlus,
  HandCoins,
  Banknote,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/components/nav/global-search";
import { NavIcon } from "@/components/nav/nav-icon";
import { UserMenu } from "@/components/nav/user-menu";
import { NotificationModal } from "@/components/NotificationModal";
import { notificationService } from "@/services/api/notification";
import { useAuth } from "@/lib/AuthContext";
import { getPageTitle } from "@/lib/nav-config";

// Quick-add menu. Roles match who can actually use each create form, so a user
// is never sent to a page where the form wouldn't open.
// Navigation opens the create form via ?drawer=add (employees) or
// ?modal=create (handled by hooks/use-url-modal.ts). Both are shareable URLs.
type QuickAdd = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
};

const QUICK_ADD_ITEMS: QuickAdd[] = [
  {
    label: "New Employee",
    description: "Add a team member",
    href: "/employees?drawer=add",
    icon: UserPlus,
    roles: ["admin", "hr_manager", "payroll_manager", "department_manager"],
  },
  {
    label: "Apply Leave",
    description: "Record a leave request",
    href: "/leaves?modal=create",
    icon: CalendarPlus,
    roles: ["admin", "hr_manager", "department_manager"],
  },
  {
    label: "New Loan",
    description: "Create an employee loan",
    href: "/loans?modal=create",
    icon: HandCoins,
    roles: ["admin", "hr_manager", "payroll_manager"],
  },
  {
    label: "New Advance",
    description: "Salary advance for an employee",
    href: "/advances?modal=create",
    icon: Banknote,
    roles: ["admin"],
  },
  {
    label: "New Reimbursement",
    description: "Submit an expense claim",
    href: "/reimbursements?modal=create",
    icon: ReceiptText,
    roles: ["admin", "hr_manager", "finance_manager"],
  },
];

// Square white button with a hairline border; the icon goes outline → solid on hover.
const iconButtonClass =
  "group/nav relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-field bg-white text-ink-soft outline-none transition-colors " +
  "hover:border-ink-soft/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40 " +
  "data-[state=open]:border-brand/50 data-[state=open]:text-brand";

export function SiteHeader() {
  const { user } = useAuth();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const isSuperAdmin = user?.user_type === 'super_admin';

  const pathname = usePathname();
  const title = getPageTitle(pathname);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Function to fetch notification count
  const fetchUnreadCount = async () => {
    if (loading || !user?.organization_id) return;

    setLoading(true);
    try {
      const response = await notificationService.getNotifications(user.organization_id);
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error('Error fetching notification count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count on mount — skipped for super_admin, since notifications
  // are organization-scoped and super_admin has no org context
  // (OrganizationAuthorizationMiddleware rejects it by design).
  // Re-runs once the organization id is known, in case the user loads after mount.
  useEffect(() => {
    if (isSuperAdmin) return;
    fetchUnreadCount();
  }, [isSuperAdmin, user?.organization_id]);

  // Handle notification read event
  const handleNotificationRead = () => {
    fetchUnreadCount();
  };

  const quickAddItems = QUICK_ADD_ITEMS.filter((item) =>
    item.roles.includes(user?.user_type ?? ""),
  );

  // Organizations still on their trial are the ones who can upgrade.
  const showUpgrade =
    user?.user_type === 'admin' && user?.subscription_status === 'trialing';

  // The sidebar header carries the collapse button; when the rail is collapsed
  // (or on mobile, where the sidebar is a drawer) the way back in lives here.
  const showSidebarTrigger = isMobile || state === 'collapsed';

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 bg-surface px-4 md:px-6">
      {/* Left: sidebar toggle (when needed) + page title */}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {showSidebarTrigger && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isMobile ? "Open navigation" : "Expand sidebar"}
            className="group/nav -ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft outline-none transition-colors hover:bg-field/60 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <NavIcon
              icon={{
                outline: IconLayoutSidebarLeftExpand,
                solid: IconLayoutSidebarLeftExpandFilled,
              }}
            />
          </button>
        )}
        <h1 className="truncate text-[15px] font-semibold text-ink">{title}</h1>
      </div>

      {/* Centre: page search */}
      <div className="hidden min-w-0 flex-1 justify-center md:flex">
        <GlobalSearch className="max-w-md" />
      </div>

      {/* Right: actions */}
      <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
        {showUpgrade && (
          <Link
            href="/billing"
            className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-sunbeam px-3.5 text-sm font-semibold text-brand-dark outline-none transition-colors hover:bg-brand-sunbeam/85 focus-visible:ring-2 focus-visible:ring-brand-dark/40 sm:inline-flex"
          >
            <IconBoltFilled aria-hidden className="size-4" />
            Upgrade
          </Link>
        )}

        {/* Quick add (+) — hidden when the user's role can't create anything */}
        {quickAddItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Quick add" className={iconButtonClass}>
                <NavIcon icon={{ outline: IconPlus, solid: IconPlusFilled }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-xl border-field p-1.5">
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Quick add
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-field" />
              {quickAddItems.map(({ label, description, href, icon: Icon }) => (
                <DropdownMenuItem
                  key={href}
                  asChild
                  className="cursor-pointer gap-3 rounded-lg px-2.5 py-2 focus:bg-field/60"
                >
                  <Link href={href}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Icon className="size-4 text-current" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium leading-tight text-ink">{label}</span>
                      <span className="text-xs text-ink-soft">{description}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notification bell — hidden for super_admin (no org-scoped notifications to show) */}
        {!isSuperAdmin && (
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
              className={iconButtonClass}
            >
              <NavIcon icon={{ outline: IconBell, solid: IconBellFilled }} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-burnt px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationModal
              open={isModalOpen}
              onOpenChange={setIsModalOpen}
              onNotificationRead={handleNotificationRead}
            />
          </>
        )}

        <UserMenu
          onOpenNotifications={
            isSuperAdmin
              ? undefined
              // Deferred so the menu finishes closing before the dialog takes focus.
              : () => setTimeout(() => setIsModalOpen(true), 0)
          }
        />
      </div>

      {/*
        Rounded top-left corner for the white content panel below. The header and
        sidebar share one grey frame; this quarter-circle of the same grey sits on
        the panel's corner, so the panel reads as rounded without a wrapper.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-full hidden size-4 bg-[radial-gradient(circle_at_100%_100%,transparent_1rem,var(--color-surface)_1rem)] md:block"
      />
    </header>
  );
}
