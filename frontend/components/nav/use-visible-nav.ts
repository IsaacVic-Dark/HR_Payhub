"use client";

import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import {
  CORE_NAV,
  NAV_GROUPS,
  OTHERS_NAV,
  SETUP_NAV_ITEM,
  type NavGroup,
  type NavItem,
} from "@/lib/nav-config";

export interface VisibleNav {
  setupComplete: boolean;
  coreItems: NavItem[];
  groups: NavGroup[];
  otherItems: NavItem[];
}

/**
 * The navigation the signed-in user may see. Used by the sidebar and by the
 * top-nav search so both always agree.
 *
 * Rules are the same as before: an item shows when the role is listed OR the
 * user can access the page path; dropdown parents show only while at least one
 * child is visible. Unlike the old sidebar this never mutates the shared config,
 * so switching users in one session can't leave stale, pre-filtered menus behind.
 */
export function useVisibleNav(): VisibleNav {
  const { canAccessPage, userRole } = usePermissions();
  const { user } = useAuth();

  const hasAccess = (item: { roles: string[]; url: string }) => {
    if (!userRole) return false;
    if (item.roles.includes(userRole)) return true;
    return canAccessPage(item.url);
  };

  const filterItems = (items: NavItem[]): NavItem[] =>
    items.flatMap((item) => {
      if (!hasAccess(item)) return [];

      if (item.hasDropdown && item.items) {
        const subs = item.items.filter((sub) =>
          sub.roles && userRole ? sub.roles.includes(userRole) : canAccessPage(sub.url),
        );
        return subs.length > 0 ? [{ ...item, items: subs }] : [];
      }

      return [item];
    });

  const setupComplete = user?.setup_completed === 1;

  return {
    setupComplete,
    coreItems: setupComplete
      ? filterItems(CORE_NAV)
      : [SETUP_NAV_ITEM].filter((item) => hasAccess(item)),
    groups: NAV_GROUPS.map((group) => ({ ...group, items: filterItems(group.items) })).filter(
      (group) => group.items.length > 0,
    ),
    otherItems: filterItems(OTHERS_NAV),
  };
}
