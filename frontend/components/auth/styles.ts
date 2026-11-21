/**
 * Shared class strings for the auth screens so login and register stay in
 * lockstep. Colours come from the `auth-*` tokens declared in globals.css.
 */

export const authInputClass =
  "h-11 rounded-lg border-auth-line bg-white px-3.5 text-[15px] shadow-none " +
  "placeholder:text-auth-muted/70 md:text-[15px] " +
  "focus-visible:border-auth-accent focus-visible:ring-auth-accent/20";

export const authSelectTriggerClass =
  "w-full rounded-lg border-auth-line bg-white px-3.5 text-[15px] shadow-none " +
  "data-[size=default]:h-11 " +
  "focus-visible:border-auth-accent focus-visible:ring-auth-accent/20";

export const authLabelClass = "text-sm font-medium text-auth-ink";

export const authPrimaryButtonClass =
  "h-11 w-full rounded-lg bg-auth-ink text-[15px] font-medium text-white shadow-none " +
  "hover:bg-auth-ink-hover focus-visible:ring-auth-accent/30";

export const authSecondaryButtonClass =
  "h-11 rounded-lg border-auth-line bg-white px-5 text-[15px] font-medium text-auth-ink shadow-none " +
  "hover:bg-auth-canvas hover:text-auth-ink focus-visible:ring-auth-accent/30";

export const authLinkClass =
  "font-medium text-auth-accent-strong underline-offset-4 hover:underline " +
  "focus-visible:outline-none focus-visible:underline";
