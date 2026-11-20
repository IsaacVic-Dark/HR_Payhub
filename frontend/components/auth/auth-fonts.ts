import { Instrument_Sans, Sora } from "next/font/google";

/**
 * Typefaces for the public auth screens (/login, /register).
 *
 *  - Sora            → headings and the wordmark (geometric, clear numerals)
 *  - Instrument Sans → form labels, inputs, body copy
 *
 * They are only loaded on routes whose layout uses `authFontClasses`, so the
 * rest of the app keeps Geist and pays no extra font cost.
 */
export const authBodyFont = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-auth-body",
  display: "swap",
});

export const authDisplayFont = Sora({
  subsets: ["latin"],
  variable: "--font-auth-display",
  display: "swap",
});

/**
 * Put this on the wrapper of any auth page. Radix portals (e.g. Select menus)
 * render outside that wrapper, so pass it to their content element as well.
 */
export const authFontClasses = `${authBodyFont.variable} ${authDisplayFont.variable} auth-font`;
