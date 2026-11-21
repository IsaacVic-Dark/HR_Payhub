import type { Icon } from "@tabler/icons-react";
import {
  IconAdjustmentsHorizontal,
  IconAdjustmentsHorizontalFilled,
  IconAffiliate,
  IconAffiliateFilled,
  IconBriefcase2,
  IconBriefcase2Filled,
  IconCalendar,
  IconCalendarEvent,
  IconCalendarEventFilled,
  IconCalendarFilled,
  IconChartPie,
  IconChartPieFilled,
  IconClipboardCheck,
  IconClipboardCheckFilled,
  IconClipboardList,
  IconClipboardListFilled,
  IconClock,
  IconClockFilled,
  IconClockHour4,
  IconClockHour4Filled,
  IconCoin,
  IconCoinFilled,
  IconCreditCard,
  IconCreditCardFilled,
  IconCrown,
  IconCrownFilled,
  IconFileDollar,
  IconFileDollarFilled,
  IconFileText,
  IconFileTextFilled,
  IconFolder,
  IconFolderFilled,
  IconGift,
  IconGiftFilled,
  IconHelp,
  IconHelpFilled,
  IconId,
  IconIdFilled,
  IconLayoutDashboard,
  IconLayoutDashboardFilled,
  IconLock,
  IconLockFilled,
  IconReceipt,
  IconReceiptFilled,
  IconReportMoney,
  IconReportMoneyFilled,
  IconScale,
  IconScaleFilled,
  IconSettings,
  IconSettingsFilled,
  IconShieldCheck,
  IconShieldCheckFilled,
  IconSitemap,
  IconSitemapFilled,
  IconTemplate,
  IconTemplateFilled,
  IconUser,
  IconUserFilled,
  IconWorld,
  IconWorldFilled,
} from "@tabler/icons-react";

/**
 * Single source of truth for navigation. Read by the sidebar, the top-nav page
 * title and the top-nav page search, so a route is declared once.
 *
 * Every item carries an outline icon (resting) and a solid icon (hover/active).
 * Role rules are unchanged from the previous sidebar.
 */

export interface NavIconPair {
  outline: Icon;
  solid: Icon;
}

export interface NavSubItem {
  title: string;
  url: string;
  roles: string[];
}

export interface NavItem {
  title: string;
  url: string;
  icon: NavIconPair;
  roles: string[];
  hasDropdown?: boolean;
  items?: NavSubItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const pair = (outline: Icon, solid: Icon): NavIconPair => ({ outline, solid });

const ALL_ROLES = [
  "super_admin",
  "admin",
  "hr_manager",
  "payroll_manager",
  "payroll_officer",
  "department_manager",
  "finance_manager",
  "auditor",
  "employee",
];

// Shown instead of the Dashboard until the organization finishes setup.
export const SETUP_NAV_ITEM: NavItem = {
  title: "Complete Setup",
  url: "/setup",
  icon: pair(IconSettings, IconSettingsFilled),
  roles: ["admin", "super_admin"],
};

export const CORE_NAV: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: pair(IconLayoutDashboard, IconLayoutDashboardFilled),
    roles: ALL_ROLES,
  },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "payroll",
    label: "Payroll Management",
    items: [
      {
        title: "Payrun",
        url: "/payrun",
        icon: pair(IconCoin, IconCoinFilled),
        roles: ["super_admin", "admin", "payroll_manager", "payroll_officer"],
        hasDropdown: true,
        items: [
          { title: "History", url: "/payrun/history", roles: ["super_admin", "admin", "payroll_manager"] },
          { title: "Process", url: "/payrun/process", roles: ["super_admin", "admin", "payroll_manager"] },
          { title: "Employees Payrun", url: "/payrun/employees", roles: ["super_admin", "admin", "payroll_manager"] },
        ],
      },
      {
        title: "Payslips",
        url: "/payslips",
        icon: pair(IconReceipt, IconReceiptFilled),
        roles: ["super_admin", "admin", "payroll_manager"],
      },
      {
        title: "Templates",
        url: "/templates",
        icon: pair(IconTemplate, IconTemplateFilled),
        roles: ["admin", "payroll_manager", "payroll_officer"],
      },
      {
        title: "P9 Forms",
        url: "/p9-forms",
        icon: pair(IconFileDollar, IconFileDollarFilled),
        roles: ["super_admin", "admin", "payroll_manager"],
      },
    ],
  },
  {
    id: "finance",
    label: "Finances",
    items: [
      {
        title: "Loans",
        url: "/loans",
        icon: pair(IconCreditCard, IconCreditCardFilled),
        roles: ["super_admin", "admin", "hr_manager", "department_manager"],
      },
      {
        title: "Advances",
        url: "/advances",
        icon: pair(IconClockHour4, IconClockHour4Filled),
        roles: ["super_admin", "admin"],
      },
      {
        title: "Overtime Approvals",
        url: "/payrun/overtime-approvals",
        icon: pair(IconClipboardCheck, IconClipboardCheckFilled),
        roles: ["super_admin", "admin", "payroll_manager"],
      },
      {
        title: "Reimbursements",
        url: "/reimbursements",
        icon: pair(IconReportMoney, IconReportMoneyFilled),
        roles: ["super_admin", "admin", "hr_manager", "finance_manager"],
      },
      {
        title: "Allowance",
        url: "/allowance",
        icon: pair(IconGift, IconGiftFilled),
        roles: ["super_admin", "admin", "hr_manager", "finance_manager"],
      },
    ],
  },
  {
    id: "employees",
    label: "Employee Management",
    items: [
      {
        title: "Employees",
        url: "/employees",
        icon: pair(IconId, IconIdFilled),
        roles: ["super_admin", "admin", "hr_manager", "payroll_manager", "department_manager"],
      },
      {
        title: "Leaves",
        url: "/leaves",
        icon: pair(IconCalendar, IconCalendarFilled),
        roles: ["super_admin", "admin", "hr_manager", "department_manager"],
      },
      {
        title: "Departments",
        url: "/employees/departments",
        icon: pair(IconSitemap, IconSitemapFilled),
        roles: ["super_admin", "admin", "hr_manager"],
      },
      {
        title: "My Leaves",
        url: "/myleave",
        icon: pair(IconCalendarEvent, IconCalendarEventFilled),
        roles: ["employee"],
      },
      {
        title: "My Reimbursement",
        url: "/myreimbursements",
        icon: pair(IconReportMoney, IconReportMoneyFilled),
        roles: ["employee"],
      },
      {
        title: "Attendance",
        url: "/attendance",
        icon: pair(IconClock, IconClockFilled),
        roles: ["super_admin", "admin", "hr_manager", "department_manager"],
      },
      {
        title: "My Team",
        url: "/team",
        icon: pair(IconAffiliate, IconAffiliateFilled),
        roles: ["department_manager"],
        hasDropdown: true,
        items: [
          { title: "Team Members", url: "/team/members", roles: ["department_manager"] },
          { title: "Leave Approvals", url: "/team/leave-approvals", roles: ["department_manager"] },
          { title: "Overtime Approvals", url: "/team/overtime-approvals", roles: ["department_manager"] },
          { title: "Expense Claims", url: "/team/expense-claims", roles: ["department_manager"] },
        ],
      },
    ],
  },
  {
    id: "self-service",
    label: "Self Service",
    items: [
      { title: "My Payslips", url: "/mypayslips", icon: pair(IconReceipt, IconReceiptFilled), roles: ["employee"] },
      { title: "My P9Form", url: "/myp9", icon: pair(IconFileDollar, IconFileDollarFilled), roles: ["employee"] },
      { title: "My Profile", url: "/my-profile", icon: pair(IconUser, IconUserFilled), roles: ["employee"] },
      { title: "My Documents", url: "/my-documents", icon: pair(IconFolder, IconFolderFilled), roles: ["employee"] },
      { title: "My Requests", url: "/my-requests", icon: pair(IconClipboardList, IconClipboardListFilled), roles: ["employee"] },
      { title: "My Loans", url: "/myloans", icon: pair(IconCreditCard, IconCreditCardFilled), roles: ["employee"] },
      { title: "My Advances", url: "/myadvances", icon: pair(IconClockHour4, IconClockHour4Filled), roles: ["employee"] },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    items: [
      {
        title: "Settings",
        url: "/company-settings",
        icon: pair(IconSettings, IconSettingsFilled),
        roles: ["super_admin", "admin"],
      },
      {
        title: "User Management",
        url: "/users",
        icon: pair(IconLock, IconLockFilled),
        roles: ["super_admin", "admin"],
      },
      {
        title: "Audit Logs",
        url: "/audit-logs",
        icon: pair(IconShieldCheck, IconShieldCheckFilled),
        roles: ["admin"],
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        title: "System Settings",
        url: "/system-settings",
        icon: pair(IconAdjustmentsHorizontal, IconAdjustmentsHorizontalFilled),
        roles: ["super_admin"],
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: pair(IconChartPie, IconChartPieFilled),
        roles: ["super_admin", "admin", "hr_manager", "payroll_manager", "finance_manager"],
      },
      {
        title: "Reports",
        url: "/reports",
        icon: pair(IconFileText, IconFileTextFilled),
        roles: ["super_admin", "admin", "hr_manager", "payroll_manager", "finance_manager", "auditor"],
        hasDropdown: true,
        items: [
          { title: "Payroll Reports", url: "/payroll-reports", roles: ["super_admin", "admin", "payroll_manager"] },
          { title: "HR Reports", url: "/hr-reports", roles: ["super_admin", "admin", "hr_manager"] },
          { title: "Financial Reports", url: "/financial-reports", roles: ["super_admin", "admin", "finance_manager"] },
          { title: "Audit Reports", url: "/audit/reports", roles: ["super_admin", "auditor"] },
        ],
      },
      {
        title: "Audit",
        url: "/audit/payroll-records",
        icon: pair(IconScale, IconScaleFilled),
        roles: ["super_admin", "auditor"],
        hasDropdown: true,
        items: [
          { title: "Payroll Records", url: "/audit/payroll-records", roles: ["super_admin", "auditor"] },
          { title: "User Activity", url: "/audit/user-activity", roles: ["super_admin", "auditor"] },
          { title: "Audit Trails", url: "/audit/audit-trails", roles: ["super_admin", "auditor"] },
          { title: "Compliance", url: "/audit/statutory-compliance", roles: ["super_admin", "auditor"] },
        ],
      },
    ],
  },
  {
    id: "platform",
    label: "Platform Administration",
    items: [
      { title: "Organizations", url: "/platform/organizations", icon: pair(IconBriefcase2, IconBriefcase2Filled), roles: ["super_admin"] },
      { title: "Subscriptions", url: "/platform/subscriptions", icon: pair(IconCreditCard, IconCreditCardFilled), roles: ["super_admin"] },
      { title: "Subscription Plans", url: "/subscription-plans", icon: pair(IconCrown, IconCrownFilled), roles: ["super_admin"] },
      { title: "Countries", url: "/platform/countries", icon: pair(IconWorld, IconWorldFilled), roles: ["super_admin"] },
      { title: "Public Holidays", url: "/public-holidays", icon: pair(IconCalendarEvent, IconCalendarEventFilled), roles: ["super_admin"] },
    ],
  },
];

// Pinned to the bottom of the sidebar.
export const OTHERS_NAV: NavItem[] = [
  {
    title: "Get Help",
    url: "/help",
    icon: pair(IconHelp, IconHelpFilled),
    roles: ALL_ROLES,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** True when `pathname` is `url` or a page below it (never a sibling like /payrun vs /payrunx). */
export function matchesUrl(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(url + "/");
}

/** The most specific url that matches, so /payrun/overtime-approvals wins over /payrun. */
export function findActiveUrl(pathname: string, urls: string[]): string | null {
  let best: string | null = null;
  for (const url of urls) {
    if (matchesUrl(pathname, url) && (!best || url.length > best.length)) best = url;
  }
  return best;
}

const prettify = (segment: string) =>
  segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Title for the top nav: the matching nav entry, else a tidy version of the last URL segment. */
export function getPageTitle(pathname: string): string {
  if (matchesUrl(pathname, SETUP_NAV_ITEM.url)) return "Company Setup";

  // url → title. Sub-items are written last so they win when a parent shares their url
  // (e.g. "Audit" and its first child both point at /audit/payroll-records).
  const titles = new Map<string, string>();
  const parents: NavItem[] = [...CORE_NAV, ...NAV_GROUPS.flatMap((g) => g.items), ...OTHERS_NAV];
  parents.forEach((item) => titles.set(item.url, item.title));
  parents.forEach((item) => item.items?.forEach((sub) => titles.set(sub.url, sub.title)));

  const active = findActiveUrl(pathname, [...titles.keys()]);
  if (active) return titles.get(active)!;

  const segment = pathname
    .split("/")
    .filter((s) => s && !/^\d+$/.test(s))
    .pop();
  return segment ? prettify(segment) : "Dashboard";
}
