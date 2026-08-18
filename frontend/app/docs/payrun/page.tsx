"use client";
import React, { useEffect, useRef, useState } from "react";

const PURPLE = "#895bf5";
const PURPLE_DARK = "#7c4ee0";
const PURPLE_LIGHT = "#f4f0fe";

type NavGroup = {
  title: string;
  items: { id: string; label: string }[];
};

const NAV: NavGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "lifecycle", label: "Payrun lifecycle" },
    ],
  },
  {
    title: "Running a payrun",
    items: [
      { id: "creating", label: "Creating a payrun" },
      { id: "reviewing", label: "Reviewing & editing" },
      { id: "approvals", label: "Approval workflow" },
      { id: "disbursement", label: "Disbursement" },
    ],
  },
  {
    title: "Compliance",
    items: [
      { id: "statutory", label: "Statutory deductions" },
      { id: "filing", label: "Filing & remittance" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "payslips", label: "Payslips & notifications" },
      { id: "troubleshooting", label: "Troubleshooting" },
      { id: "faq", label: "FAQ" },
    ],
  },
];

const FLAT_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

function Callout({
  kind,
  title,
  children,
}: {
  kind: "note" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    kind === "note"
      ? { border: "border-l-4", borderColor: PURPLE, bg: PURPLE_LIGHT, dot: PURPLE }
      : { border: "border-l-4", borderColor: "#d97706", bg: "#fffaf0", dot: "#d97706" };
  return (
    <div
      className={`${styles.border} rounded-r-md p-4 my-6 text-sm leading-relaxed`}
      style={{ borderColor: styles.borderColor, backgroundColor: styles.bg }}
    >
      <p className="font-semibold mb-1 flex items-center gap-2" style={{ color: styles.dot }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: styles.dot }} />
        {title}
      </p>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-gray-100 rounded-md p-4 text-xs leading-relaxed overflow-x-auto my-6 font-mono">
      <code>{children}</code>
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">
      {children}
    </code>
  );
}

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: PURPLE }}>
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-[15px] leading-7 text-gray-600 space-y-4">{children}</div>
    </section>
  );
}

export default function PayrunDocsPage() {
  const [activeId, setActiveId] = useState<string>(FLAT_IDS[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headings = FLAT_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => !!el
    );

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((h) => observerRef.current?.observe(h));
    return () => observerRef.current?.disconnect();
  }, []);

  const navigateHome = () => {
    window.location.href = "/landing";
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={navigateHome}
              className="flex items-center gap-1.5 shrink-0"
              aria-label="Back to PayKe home"
            >
              <span className="text-xl font-bold" style={{ color: PURPLE }}>
                Pay<span className="text-gray-900">Ke</span>
              </span>
            </button>
            <span className="text-gray-300 hidden sm:inline">/</span>
            <span className="text-sm font-medium text-gray-500 hidden sm:inline">Docs</span>
          </div>

          <div className="flex-1 max-w-sm hidden md:block">
            <div className="flex items-center gap-2 text-sm text-gray-400 border border-gray-200 rounded-md px-3 py-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search docs…
              <span className="ml-auto text-xs border border-gray-200 rounded px-1.5 py-0.5 font-mono">⌘K</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="md:hidden text-sm font-medium text-gray-700 border border-gray-300 rounded-md px-3 py-1.5"
            >
              Menu
            </button>
            <button
              onClick={navigateHome}
              className="hidden md:inline text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Back to site
            </button>
            <button
              onClick={navigateHome}
              className="text-sm font-semibold text-white px-4 py-2 rounded-md transition-all hover:opacity-90"
              style={{ backgroundColor: PURPLE }}
            >
              Request a Demo
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 flex gap-10">
        {/* ─── LEFT SIDEBAR ─── */}
        <aside
          className={`${
            sidebarOpen ? "block" : "hidden"
          } md:block w-full md:w-56 shrink-0 border-r border-gray-100 md:sticky md:top-14 md:h-[calc(100vh-56px)] md:overflow-y-auto py-8 pr-4`}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
            Payrun handling
          </p>
          <nav className="space-y-6">
            {NAV.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold text-gray-900 mb-2">{group.title}</p>
                <ul className="space-y-1.5 border-l border-gray-100">
                  {group.items.map((item) => {
                    const active = activeId === item.id;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          onClick={() => setSidebarOpen(false)}
                          className="block pl-3 -ml-px text-[13px] py-1 transition-colors"
                          style={{
                            borderLeft: active ? `2px solid ${PURPLE}` : "2px solid transparent",
                            color: active ? PURPLE : "#6b7280",
                            fontWeight: active ? 600 : 500,
                            marginLeft: "-1px",
                          }}
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="min-w-0 flex-1 py-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: PURPLE }}>
            Documentation
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
            How PayKe handles a payrun
          </h1>
          <p className="text-gray-500 text-[15px] leading-7 mb-10">
            A payrun is the process PayKe runs to turn a pay period into paid, compliant
            salaries. This page walks through what happens end to end — from opening a
            payrun to statutory filing — so your finance and HR teams know exactly what to
            expect at each step.
          </p>

          <Section id="introduction" title="Introduction">
            <p>
              Every payrun in PayKe moves through the same guarded pipeline, regardless of
              company size: it is opened against a pay period, populated with the
              employees due to be paid, calculated, reviewed, approved, and disbursed. Each
              stage is logged, so you can always see who did what and when.
            </p>
            <p>
              This document describes the default flow. Approval steps and disbursement
              channels can be configured per organisation in{" "}
              <InlineCode>Settings → Payroll</InlineCode>.
            </p>
          </Section>

          <Section id="lifecycle" title="Payrun lifecycle" eyebrow="Overview">
            <p>A payrun always sits in exactly one of the following states:</p>
            <div className="grid sm:grid-cols-2 gap-3 my-6">
              {[
                { s: "Draft", d: "Created but not yet calculated. Employees can still be added or removed." },
                { s: "Calculated", d: "Gross pay, deductions and net pay have been computed for every employee." },
                { s: "In review", d: "Open for HR/finance to check line items before it moves to approval." },
                { s: "Pending approval", d: "Waiting on one or more approvers, per your approval workflow." },
                { s: "Approved", d: "Locked for editing. Queued for disbursement." },
                { s: "Disbursed", d: "Payments have been sent and payslips generated." },
              ].map((row) => (
                <div key={row.s} className="border border-gray-200 rounded-md p-3">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{row.s}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{row.d}</p>
                </div>
              ))}
            </div>
            <Callout kind="note" title="State changes are one-directional">
              A payrun cannot move backwards once approved. To correct an error after
              approval, PayKe creates a linked adjustment payrun rather than reopening the
              original — this keeps every disbursed run auditable.
            </Callout>
          </Section>

          <Section id="creating" title="Creating a payrun" eyebrow="Running a payrun">
            <p>Opening a new payrun requires three inputs:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>A <strong>pay period</strong> (e.g. monthly, bi-weekly) with start and end dates.</li>
              <li>The <strong>employee scope</strong> — all active employees by default, or a filtered subset (e.g. one branch or department).</li>
              <li>A <strong>pay date</strong>, which drives disbursement scheduling and payslip timestamps.</li>
            </ul>
            <p>
              PayKe pulls each employee's current contract, salary structure, active
              allowances, and any one-off adjustments (bonuses, loan deductions, leave
              without pay) submitted for that period.
            </p>
          </Section>

          <Section id="reviewing" title="Reviewing & editing">
            <p>
              Once calculated, the payrun opens for review. Every line item is editable at
              this stage — gross pay, allowances, deductions, and one-off adjustments — and
              PayKe recalculates statutory deductions automatically whenever a figure
              changes.
            </p>
            <p>The review screen flags anything that needs attention before approval:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Employees with no bank or mobile money details on file.</li>
              <li>Net pay that swings more than 20% from the prior period.</li>
              <li>Missing statutory numbers (PIN, NSSF, SHIF) required for filing.</li>
            </ul>
          </Section>

          <Section id="approvals" title="Approval workflow">
            <p>
              Approval routing is configurable, but most organisations use a two-step
              chain: a <strong>reviewer</strong> (typically HR) confirms the numbers, then
              an <strong>approver</strong> (typically finance or a director) authorises
              disbursement. Both actions are timestamped and tied to the approving user.
            </p>
            <Callout kind="warning" title="Approval is final">
              Approving a payrun locks every line item. If an error is found after
              approval but before disbursement, an approver can cancel the run, which
              returns it to draft — disbursed runs cannot be cancelled and require an
              adjustment payrun instead.
            </Callout>
          </Section>

          <Section id="disbursement" title="Disbursement">
            <p>
              Approved payruns are queued for disbursement on the scheduled pay date.
              PayKe supports batch bank transfers and mobile money payout, and will retry
              individual failed payments (e.g. an invalid account number) without blocking
              the rest of the batch.
            </p>
            <CodeBlock>{`POST /api/payruns/{id}/disburse
{
  "channel": "bank_batch",   // or "mobile_money"
  "pay_date": "2026-08-31"
}

→ 202 Accepted
  { "status": "processing", "batch_id": "pr_8f21c3" }`}</CodeBlock>
            <p>
              Disbursement status updates land on the payrun timeline in real time, and
              any failed line items are surfaced individually for a manual retry.
            </p>
          </Section>

          <Section id="statutory" title="Statutory deductions" eyebrow="Compliance">
            <p>
              PayKe calculates the standard Kenyan statutory deductions automatically for
              every payrun, using the current rate tables maintained centrally so
              individual companies never need to update them by hand:
            </p>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-semibold">Deduction</th>
                    <th className="px-4 py-2 font-semibold">Applies to</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">PAYE</td>
                    <td className="px-4 py-2 text-gray-500">Graduated income tax on taxable pay</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">NSSF</td>
                    <td className="px-4 py-2 text-gray-500">Pensionable pay, tiered contribution</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">SHIF</td>
                    <td className="px-4 py-2 text-gray-500">Gross pay, national health cover</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">Housing Levy</td>
                    <td className="px-4 py-2 text-gray-500">Gross pay, employer and employee share</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Reliefs (personal relief, insurance relief, mortgage interest) are applied
              per employee based on what's on file in their profile.
            </p>
          </Section>

          <Section id="filing" title="Filing & remittance">
            <p>
              After disbursement, PayKe generates the statutory returns for the period —
              PAYE (P10), NSSF, and SHIF schedules — in the format required for submission.
              Remittance itself is a finance-team action: PayKe prepares the figures and
              filing files, and marks the period as filed once you confirm submission.
            </p>
          </Section>

          <Section id="payslips" title="Payslips & notifications" eyebrow="Reference">
            <p>
              Payslips are generated the moment a payrun is disbursed and are immediately
              available to employees in the portal. Each employee is notified by email
              (and SMS, if enabled) with a link to their payslip for that period.
            </p>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  A payment failed during disbursement
                </p>
                <p>
                  Open the payrun's disbursement tab — failed items are listed with a
                  reason (e.g. invalid account, insufficient float). Fix the underlying
                  detail on the employee's profile, then retry just that line item.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Approved payrun has an error
                </p>
                <p>
                  If it hasn't disbursed yet, an approver can cancel it back to draft. If
                  it has already disbursed, create an adjustment payrun linked to the
                  original rather than editing history.
                </p>
              </div>
            </div>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Can I run payroll for a subset of employees?
                </p>
                <p>Yes — scope a payrun to a branch, department, or a manual selection when creating it.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Who can approve a payrun?
                </p>
                <p>
                  Any user with the Approver role for that organisation. Roles and
                  approval chains are managed in <InlineCode>Settings → Roles</InlineCode>.
                </p>
              </div>
            </div>
          </Section>
        </main>

        {/* ─── RIGHT TOC ─── */}
        <aside className="hidden xl:block w-56 shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto py-10 pl-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            On this page
          </p>
          <ul className="space-y-2 text-[13px]">
            {FLAT_IDS.map((id) => {
              const label = NAV.flatMap((g) => g.items).find((i) => i.id === id)?.label;
              const active = activeId === id;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block transition-colors"
                    style={{ color: active ? PURPLE : "#9ca3af", fontWeight: active ? 600 : 400 }}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-100 mt-10">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} PayKe LTD · The Pinnacle Building, 5th Floor,
            Nairobi, Kenya
          </p>
          <button
            onClick={navigateHome}
            className="text-xs font-semibold px-3 py-1.5 rounded-md text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: PURPLE_DARK }}
          >
            Back to site
          </button>
        </div>
      </footer>
    </div>
  );
}