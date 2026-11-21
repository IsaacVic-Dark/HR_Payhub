"use client";

import { useRouter } from "next/navigation";
import {
  IconBell,
  IconBellFilled,
  IconChevronDown,
  IconCreditCard,
  IconCreditCardFilled,
  IconLogout,
  IconUser,
  IconUserFilled,
} from "@tabler/icons-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavIcon } from "@/components/nav/nav-icon";
import { useAuth } from "@/lib/AuthContext";

const itemClass =
  "group/nav cursor-pointer gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft focus:bg-field/60 focus:text-ink";

/** Avatar menu in the top nav (replaces the old sidebar footer user card). */
export function UserMenu({
  onOpenNotifications,
}: {
  /** Opens the notification modal. Omit to hide the item (e.g. super_admin has no org notifications). */
  onOpenNotifications?: () => void;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const employee = user.employee;
  const hasName = !!(employee?.firstname && employee?.surname);
  const name = hasName ? `${employee!.firstname} ${employee!.surname}` : user.email;
  const initials = hasName
    ? `${employee!.firstname[0]}${employee!.surname[0]}`.toUpperCase()
    : (user.email?.[0] ?? "U").toUpperCase();
  const role = user.user_type?.replace(/_/g, " ");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="group/nav flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 text-ink-soft outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40 data-[state=open]:text-ink"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-brand text-sm font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <IconChevronDown
            aria-hidden
            className="size-4 transition-transform duration-200 group-data-[state=open]/nav:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl border-field p-1.5">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="bg-brand text-sm font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-semibold text-ink">{name}</span>
              <span className="truncate text-xs text-ink-soft">{user.email}</span>
              <span className="mt-1 w-fit rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium capitalize text-brand">
                {role}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-field" />

        <DropdownMenuGroup>
          <DropdownMenuItem className={itemClass} onClick={() => router.push("/my-profile")}>
            <NavIcon icon={{ outline: IconUser, solid: IconUserFilled }} />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => router.push("/billing")}>
            <NavIcon icon={{ outline: IconCreditCard, solid: IconCreditCardFilled }} />
            Billing
          </DropdownMenuItem>
          {onOpenNotifications && (
            <DropdownMenuItem className={itemClass} onClick={onOpenNotifications}>
              <NavIcon icon={{ outline: IconBell, solid: IconBellFilled }} />
              Notifications
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-field" />

        <DropdownMenuItem
          onClick={handleLogout}
          className="group/nav cursor-pointer gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-brand-burnt focus:bg-brand-burnt/10 focus:text-brand-burnt"
        >
          <IconLogout aria-hidden stroke={1.75} className="size-[18px] text-current" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
