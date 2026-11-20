import { cn } from "@/lib/utils";
import type { NavIconPair } from "@/lib/nav-config";

/**
 * Outline icon at rest, solid icon on hover and when active.
 *
 * Both icons are stacked and cross-faded with CSS, so there is no re-render and
 * no layout shift. They inherit `currentColor`, which keeps the icon the same
 * colour as its label. The parent element must carry the `group/nav` class
 * (and `data-active` where it can be the current page).
 *
 * `text-current` matters: some primitives (e.g. dropdown items) paint any svg
 * without a `text-*` class in muted-foreground, which would break the rule that
 * an icon is the same colour as its text.
 */
export function NavIcon({ icon, className }: { icon: NavIconPair; className?: string }) {
  const { outline: Outline, solid: Solid } = icon;

  return (
    <span aria-hidden className={cn("relative block size-[18px] shrink-0", className)}>
      <Outline
        stroke={1.75}
        className="absolute inset-0 size-full text-current transition-opacity duration-150 group-hover/nav:opacity-0 group-focus-visible/nav:opacity-0 group-data-[active=true]/nav:opacity-0 group-data-[state=open]/nav:opacity-0"
      />
      <Solid className="absolute inset-0 size-full text-current opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100 group-data-[active=true]/nav:opacity-100 group-data-[state=open]/nav:opacity-100" />
    </span>
  );
}
