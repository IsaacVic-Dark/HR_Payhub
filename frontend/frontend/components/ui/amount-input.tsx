"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";

/**
 * AmountInput
 *
 * A money input that
 *  - shows the organization currency as a fixed prefix ("KES [ 150,000.00 ]"),
 *  - formats with thousand separators while the user types (150000 → 150,000),
 *  - hands the parent the RAW number string (no commas) so API payloads and
 *    existing validation (Number(value), parseFloat(value)) keep working.
 *
 * Drop-in replacement for `<input type="number" ... />`:
 *
 *   <AmountInput
 *     value={form.amount}
 *     onChange={(e) => setForm({ ...form, amount: e.target.value })}
 *   />
 *
 * `onChange` receives an event-like object whose `target.value` is the raw
 * numeric string ("150000.5"), so existing handlers need no changes. If you
 * prefer, use `onValueChange(raw)` instead.
 */

/** Event-like object handed to onChange: target.value is the RAW number string. */
export type AmountChangeEvent = React.ChangeEvent<HTMLInputElement>;

export interface AmountInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "onChange" | "type" | "min" | "max" | "step" | "defaultValue"
  > {
  value?: string | number | null;
  onChange?: (e: AmountChangeEvent) => void;
  onValueChange?: (raw: string) => void;
  /** Override the prefix; defaults to the organization currency. */
  currency?: string;
  /** Hide the prefix (e.g. for percentage-like fields). Default true. */
  showCurrency?: boolean;
  /** Allow a decimal part. Default true. */
  allowDecimals?: boolean;
  /** Max decimals when allowDecimals. Default 2. */
  maxDecimals?: number;
  min?: number;
  max?: number;
  /** Class for the outer wrapper. */
  wrapperClassName?: string;
}

const group = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** raw "1234.5" → "1,234.5"; keeps a trailing "." while typing. */
const toDisplay = (raw: string): string => {
  if (!raw) return "";
  const [i, d] = raw.split(".");
  const intPart = group(i.replace(/^0+(?=\d)/, ""));
  return d !== undefined ? `${intPart}.${d}` : intPart;
};

const sanitize = (text: string, allowDecimals: boolean, maxDecimals: number) => {
  let cleaned = text.replace(/[^\d.]/g, "");
  if (!allowDecimals) return cleaned.replace(/\./g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, maxDecimals);
  }
  if (cleaned.startsWith(".")) cleaned = `0${cleaned}`;
  return cleaned;
};

const numeric = (raw: string) => (raw === "" || raw === "." ? null : Number(raw));

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (
    {
      value,
      onChange,
      onValueChange,
      currency,
      showCurrency = true,
      allowDecimals = true,
      maxDecimals = 2,
      min,
      max,
      className,
      wrapperClassName,
      name,
      id,
      disabled,
      ...rest
    },
    forwardedRef,
  ) => {
    const { currency: orgCurrency } = useCurrency();
    const prefix = (currency || orgCurrency).toUpperCase();

    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    const externalRaw = value === null || value === undefined ? "" : String(value);
    const [text, setText] = React.useState(() => toDisplay(externalRaw));
    const caretRef = React.useRef<number | null>(null);

    // Sync when the parent changes the value (form reset, edit prefill, ...)
    // but not when it is just echoing what the user typed (e.g. "12." → 12).
    React.useEffect(() => {
      const current = numeric(text.replace(/,/g, ""));
      const incoming = numeric(externalRaw);
      if (current !== incoming) setText(toDisplay(externalRaw));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [externalRaw]);

    // Restore the caret after re-formatting so editing mid-number feels natural.
    React.useLayoutEffect(() => {
      if (caretRef.current !== null && innerRef.current) {
        innerRef.current.setSelectionRange(caretRef.current, caretRef.current);
        caretRef.current = null;
      }
    }, [text]);

    // Existing handlers read e.target.value — give them the raw (comma-free) value.
    const emit = (raw: string) => {
      onValueChange?.(raw);
      onChange?.({
        target: { name, id, value: raw },
        currentTarget: { name, id, value: raw },
      } as unknown as AmountChangeEvent);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const caret = input.selectionStart ?? input.value.length;
      const digitsBeforeCaret = input.value.slice(0, caret).replace(/[^\d.]/g, "").length;

      let raw = sanitize(input.value, allowDecimals, maxDecimals);
      const n = numeric(raw);
      if (max !== undefined && n !== null && n > max) raw = String(max);

      const display = toDisplay(raw);
      setText(display);

      // caret = position after the same number of digits/dots in the new text
      let seen = 0;
      let pos = display.length;
      for (let i = 0; i < display.length; i++) {
        if (seen === digitsBeforeCaret) { pos = i; break; }
        if (/[\d.]/.test(display[i])) seen++;
      }
      caretRef.current = seen < digitsBeforeCaret ? display.length : pos;

      emit(raw);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Tidy up on blur: "12." → "12", below-min → min.
      let raw = text.replace(/,/g, "");
      if (raw.endsWith(".")) raw = raw.slice(0, -1);
      const n = numeric(raw);
      if (min !== undefined && n !== null && n < min) raw = String(min);
      if (raw !== text.replace(/,/g, "")) {
        setText(toDisplay(raw));
        emit(raw);
      }
      rest.onBlur?.(e);
    };

    return (
      <div
        className={cn(
          "flex w-full items-stretch rounded-md shadow-xs",
          disabled && "opacity-50",
          wrapperClassName,
        )}
      >
        {showCurrency && (
          <span
            className="border-input bg-muted text-muted-foreground inline-flex select-none items-center rounded-l-md border border-r-0 px-3 text-sm font-medium"
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}
        <input
          {...rest}
          ref={innerRef}
          id={id}
          name={name}
          type="text"
          inputMode={allowDecimals ? "decimal" : "numeric"}
          autoComplete="off"
          disabled={disabled}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          data-slot="input"
          className={cn(
            "placeholder:text-muted-foreground border-input flex h-9 w-full min-w-0 border bg-transparent px-3 py-1 text-base outline-none transition-[color,box-shadow] md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:cursor-not-allowed",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            showCurrency ? "rounded-r-md" : "rounded-md",
            className,
          )}
        />
      </div>
    );
  },
);
AmountInput.displayName = "AmountInput";
