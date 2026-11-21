/**
 * Static sample payslip shown beside the login form.
 *
 * The figures are illustrative but internally consistent with backend/helpers/tax.php
 * for a KES 150,000 basic salary:
 *   NSSF         6% of pensionable pay, capped at the Tier II limit (108,000) → 6,480.00
 *   SHIF         2.75% of basic                                               → 4,125.00
 *   Housing Levy 1.5% of basic                                                → 2,250.00
 *   Taxable pay  150,000 − 6,480 − 4,125 − 2,250                              → 137,145.00
 *   Tax          10% · 24,000 + 25% · 8,333 + 30% · remainder                 → 35,926.85
 *   PAYE         tax − 2,400 personal relief                                  → 33,526.85
 */

const earnings = [{ label: "Basic salary", amount: "150,000.00" }];

const deductions = [
  { label: "PAYE (after personal relief)", amount: "33,526.85" },
  { label: "NSSF", amount: "6,480.00" },
  { label: "SHIF", amount: "4,125.00" },
  { label: "Housing Levy", amount: "2,250.00" },
];

function Row({
  label,
  amount,
  strong = false,
}: {
  label: string;
  amount: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2">
      <dt className={strong ? "font-medium text-auth-ink" : "text-auth-body"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-medium text-auth-ink" : "text-auth-body"}`}>
        {amount}
      </dd>
    </div>
  );
}

export function PayslipPreview() {
  return (
    <div className="w-full max-w-[460px]">
      <h2 className="auth-display text-[26px] font-semibold leading-[1.25] tracking-tight text-auth-ink">
        Statutory deductions, calculated on every pay run.
      </h2>
      <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-auth-muted">
        PAYE, NSSF, SHIF and the Housing Levy are worked out per employee, then carried
        straight into payslips and P9 forms.
      </p>

      <figure
        aria-label="Sample payslip"
        className="mt-10 overflow-hidden rounded-xl border border-auth-line border-t-2 border-t-auth-accent bg-white"
      >
        <figcaption className="flex items-center justify-between border-b border-auth-line px-6 py-4">
          <div>
            <p className="auth-display text-[15px] font-semibold text-auth-ink">Payslip</p>
            <p className="text-xs text-auth-muted">October 2026 · Monthly</p>
          </div>
          <span className="rounded-full bg-auth-accent-soft px-2.5 py-1 text-xs font-medium text-auth-accent-strong">
            Sample
          </span>
        </figcaption>

        <div className="px-6 py-3 text-sm">
          <dl className="divide-y divide-auth-line">
            {earnings.map((r) => (
              <Row key={r.label} {...r} />
            ))}
            <Row label="Gross pay" amount="150,000.00" strong />
          </dl>

          <p className="mt-4 text-xs font-medium text-auth-muted">Deductions</p>
          <dl className="mt-1 divide-y divide-auth-line">
            {deductions.map((r) => (
              <Row key={r.label} {...r} />
            ))}
            <Row label="Total deductions" amount="46,381.85" strong />
          </dl>
        </div>

        <div className="flex items-baseline justify-between border-t border-auth-line bg-auth-canvas/70 px-6 py-4">
          <span className="text-sm font-medium text-auth-ink">Net pay</span>
          <span className="auth-display text-xl font-semibold tabular-nums text-auth-ink">
            KES 103,618.15
          </span>
        </div>
      </figure>

      <p className="mt-3 text-xs text-auth-muted">
        Sample figures for illustration. Your rates come from your organization&apos;s payroll settings.
      </p>
    </div>
  );
}
