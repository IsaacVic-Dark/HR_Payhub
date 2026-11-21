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
      { id: "lifecycle", label: "Advance lifecycle" },
      { id: "roles", label: "Roles & permissions" },
    ],
  },
  {
    title: "For employees",
    items: [
      { id: "requesting", label: "Requesting an advance" },
      { id: "tracking", label: "Tracking, editing & cancelling" },
    ],
  },
  {
    title: "For administrators",
    items: [
      { id: "policy", label: "Advance policy" },
      { id: "validation", label: "Automatic policy checks" },
      { id: "max-allowed", label: "Maximum allowed amount" },
      { id: "managing", label: "Managing advances" },
      { id: "approval", label: "Approval & rejection" },
      { id: "payroll-payout", label: "Paying out through a payrun" },
      { id: "disbursement", label: "Marking an advance paid out" },
    ],
  },
  {
    title: "Recovery",
    items: [
      { id: "recovery-schedule", label: "Recovery schedule" },
      { id: "payroll-recovery", label: "Recovery in a payrun" },
      { id: "recovery-maths", label: "How each recovery is calculated" },
      { id: "manual-repayment", label: "Manual repayments & reversals" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "notifications", label: "Notifications & audit trail" },
      { id: "api", label: "API reference" },
      { id: "data-model", label: "Data model" },
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

/** Simple striped reference table: first column is emphasised. */
function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
        <thead>
          <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 py-2 align-top ${j === 0 ? "font-medium text-gray-800" : "text-gray-500"}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Steps({ items }: { items: { t: string; d: React.ReactNode }[] }) {
  return (
    <ol className="space-y-3 my-6">
      {items.map((s, i) => (
        <li key={s.t} className="flex gap-3">
          <span
            className="shrink-0 w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center mt-0.5"
            style={{ backgroundColor: PURPLE }}
          >
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{s.t}</p>
            <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
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

const STATUSES = [
  { s: "Draft", d: "Saved but not submitted. The employee can still edit, submit or delete it." },
  { s: "Awaiting approval", d: "Passed the automatic policy checks (stored as pending). Waiting for an admin decision." },
  { s: "System rejected", d: "Failed the policy checks. The reasons are shown; editing returns it to draft for resubmission." },
  { s: "Approved", d: "An admin approved it, possibly for a lower amount. Waiting to be paid out. Payroll-method advances are placed in the current draft payrun automatically." },
  { s: "Payout in Payrun", d: "Stored as scheduled. A payroll-method advance sitting in a draft payrun as a payout. It becomes Paid Out when that payrun is finalized." },
  { s: "Rejected", d: "An admin declined it and gave a reason. Final." },
  { s: "Paid Out", d: "Stored as disbursed. The money has been paid. The full approved amount is now the outstanding balance." },
  { s: "Repaying", d: "Stored as partially_recovered. At least one repayment has been applied, but a balance remains." },
  { s: "Fully repaid", d: "Balance reached zero. Final." },
  { s: "Cancelled", d: "Withdrawn before it was paid out. Final." },
];

export default function AdvanceDocsPage() {
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
            Salary advances
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
            How PayKe handles salary advances
          </h1>
          <p className="text-gray-500 text-[15px] leading-7 mb-10">
            A salary advance lets an employee draw part of their pay early and repay it
            through upcoming payruns. This page covers the whole journey — requesting,
            automatic policy checks, approval, disbursement and recovery — for employees,
            payroll teams and administrators.
          </p>

          <Section id="introduction" title="Introduction">
            <p>
              Every advance in PayKe is checked against your organisation's advance policy,
              approved by an admin, paid out, and then recovered as a deduction on payruns.
              Payruns do most of the work: a payroll-method advance is paid out as part of an
              employee's pay, and repayment instalments are placed in upcoming draft payruns
              automatically. Payroll staff can still adjust the schedule by hand. Each step is
              recorded in the audit log and the employee is notified at the key moments.
            </p>
            <p>The module has three screens:</p>
            <Table
              head={["Screen", "Who uses it", "What it does"]}
              rows={[
                [<InlineCode key="a">/myadvances</InlineCode>, "Employees", "Request an advance, edit drafts, cancel requests and follow recovery."],
                [<InlineCode key="b">/advances</InlineCode>, "Admins, payroll, finance, auditors", "Review every request, approve, disburse, schedule recovery and record repayments."],
                [<InlineCode key="c">/company-settings</InlineCode>, "Admins", "Settings → Advances: set the limits and rules every request is checked against."],
              ]}
            />
            <Callout kind="note" title="One approval step">
              In this version approval is a single admin decision. The
              <InlineCode>approval_workflow</InlineCode> and <InlineCode>finance_approval_threshold</InlineCode>{" "}
              policy fields are stored for a future multi-step flow but are not enforced yet.
            </Callout>
          </Section>

          <Section id="lifecycle" title="Advance lifecycle" eyebrow="Overview">
            <p>
              An advance is always in exactly one of these states. The names below are the ones
              shown on screen; the stored status code is given where it differs.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 my-6">
              {STATUSES.map((row) => (
                <div key={row.s} className="border border-gray-200 rounded-md p-3">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{row.s}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{row.d}</p>
                </div>
              ))}
            </div>
            <CodeBlock>{`draft ──submit──▶ (policy check) ──fail──▶ system_rejected ──edit──▶ draft
                       │
                       └─pass─▶ pending ──approve──▶ approved ──┬─ payroll method ─▶ scheduled ─ payrun finalized ─▶ disbursed
                                   │                    │       └─ "Mark as Paid Out" ────────────────────────────▶ disbursed
                                   ├─reject─▶ rejected  └─cancel─▶ cancelled
                                   └─cancel─▶ cancelled

disbursed ──repayment applied──▶ partially_recovered ──balance 0──▶ repaid`}</CodeBlock>
            <Callout kind="note" title="Repayments change the balance when the payrun is finalized">
              A payrun recovery is only planned while the payrun is a draft. The advance moves
              to <em>Repaying</em> or <em>Fully repaid</em> when that payrun is finalized, not
              when it is calculated. See Recovery in a payrun.
            </Callout>
            <Callout kind="note" title="Reserved statuses">
              The database also defines <InlineCode>validated</InlineCode>,{" "}
              <InlineCode>reversed</InlineCode> and <InlineCode>failed</InlineCode>. The current
              workflow never leaves an advance in <InlineCode>validated</InlineCode> (it moves
              straight to pending), and the screens treat it like <InlineCode>pending</InlineCode>{" "}
              in case it is ever stored.
            </Callout>
          </Section>

          <Section id="roles" title="Roles & permissions">
            <p>
              Access is checked on every request, and every advance is scoped to the
              caller's organisation. Employees can only see and act on their own advances.
              Super admins have no access to organisation advance data.
            </p>
            <Table
              head={["Action", "Roles allowed"]}
              rows={[
                ["View list / details / repayments", "Admin, payroll manager, payroll officer, finance manager, auditor, employee (own only)"],
                ["View recovery lines", "Admin, payroll manager, payroll officer, finance manager, auditor"],
                ["Create, edit, delete, submit", "Admin; employee (own advances only)"],
                ["Cancel", "Admin; employee (own advances only)"],
                ["Approve, reject, disburse", "Admin"],
                ["Attach / detach recovery to a payrun", "Admin, payroll manager, payroll officer"],
                ["Place an advance in the current payrun, or add / remove its payout (auto-attach, attach-payout, detach-payout)", "Admin, payroll manager, payroll officer. The Detach button on the advance details drawer is shown to admins."],
                ["View an employee's advance payout and recoveries on a payrun row", "Admin, payroll manager, payroll officer, finance manager, auditor"],
                ["List draft payruns for recovery", "Admin, payroll manager, payroll officer"],
                ["Record or reverse a manual repayment", "Admin, finance manager"],
                ["View policy", "Everyone above"],
                ["Edit policy", "Admin"],
              ]}
            />
          </Section>

          <Section id="requesting" title="Requesting an advance" eyebrow="For employees">
            <p>
              Open <strong>My Advances</strong> and choose <strong>Request Advance</strong>.
              If your organisation has switched employee requests off, the button is disabled
              and a notice explains why.
            </p>
            <Table
              head={["Field", "Notes"]}
              rows={[
                ["Amount (KES)", "Required. Must sit inside the policy limits (see Automatic policy checks)."],
                ["Recovery periods", "How many payruns the advance is spread over, from 1 up to the policy maximum."],
                ["Disbursement method", "Payroll, bank transfer, M-Pesa, cash or cheque — limited to what the policy enables. Payroll means the advance is paid to you as part of your pay in a payrun."],
                ["Reason", "Required unless the policy turns it off."],
                ["Supporting document", "A document reference, required only when the policy asks for one."],
                ["Recovery start / end dates (optional)", "Cannot be in the past; the end date cannot precede the start date."],
              ]}
            />
            <Steps
              items={[
                { t: "Submit or save as draft", d: "Submitting runs the policy checks immediately. Saving as a draft keeps the request private so you can finish it later." },
                { t: "Automatic checks", d: "If anything fails, the request is marked System rejected with the exact reasons, and you are notified." },
                { t: "Admin decision", d: "If the checks pass, the request moves to Awaiting approval and every admin is notified." },
              ]}
            />
            <p>
              Each request receives a number in the form <InlineCode>ADV-2026-000001</InlineCode>,
              numbered per organisation and year.
            </p>
          </Section>

          <Section id="tracking" title="Tracking, editing & cancelling">
            <p>
              The My Advances page shows your total requests, outstanding balance, how many
              are awaiting approval and how many are being recovered. Open any row to see its
              details and repayment history.
            </p>
            <Table
              head={["Status", "What you can do"]}
              rows={[
                ["Draft", "Edit, submit, or delete it."],
                ["System rejected", "Edit (returns it to draft, clears the rejection reason), then resubmit — or delete it."],
                ["Awaiting approval", "Cancel it."],
                ["Approved, Payout in Payrun or later", "View only. Ask your admin if the advance needs to be withdrawn."],
              ]}
            />
            <Callout kind="note" title="Deleting versus cancelling">
              Only drafts and system-rejected requests can be deleted; they disappear but the
              deletion is logged. Anything that has been submitted is cancelled instead, which
              keeps the record.
            </Callout>
          </Section>

          <Section id="policy" title="Advance policy" eyebrow="For administrators">
            <p>
              The policy lives in <InlineCode>Advances → Policy Settings</InlineCode> and is
              stored once per organisation. If none exists yet, saving the form creates one.
              A snapshot of the policy and the calculated limits is saved on each advance when it
              is validated, as a record of what applied at the time. Note that recovery and
              disbursement rules are read from the live policy, so changes to settings such as
              minimum net pay or disbursement methods also affect advances already in flight.
            </p>
            <Table
              head={["Setting", "Default", "Meaning"]}
              rows={[
                ["Max % of basic pay", "50", "Cap as a percentage of the employee's basic salary."],
                ["Max % of net pay", "Off", "Optional cap as a percentage of estimated net pay."],
                ["Minimum amount (KES)", "0", "Smallest request accepted."],
                ["Maximum amount (KES)", "No limit", "Largest request accepted. Must be at least the minimum."],
                ["Max active advances", "1", "How many unfinished advances one employee may hold at a time."],
                ["Request cut-off day", "None", "Employees (not admins) can only request up to this day of the month (1–31)."],
                ["Default recovery periods", "1", "Pre-filled on new requests. Cannot exceed the maximum."],
                ["Maximum recovery periods", "1", "Highest number of recoveries an employee may choose."],
                ["Allow partial recovery", "Yes", "Whether a recovery may be reduced to protect minimum net pay."],
                ["Minimum net pay after recovery (KES)", "0", "Floor for the employee's net pay after the deduction."],
                ["Allow employees to request", "Yes", "Turns self-service requests on or off."],
                ["Require a reason", "Yes", "Makes the reason field mandatory."],
                ["Require supporting document", "No", "Makes a document reference mandatory."],
                ["Disbursement methods", "Payroll", "Which payout methods are available."],
                ["Allowed employee statuses", "Active", "Employee statuses eligible to request."],
              ]}
            />
            <Callout kind="warning" title="Check what employees are told">
              The blue banner on My Advances quotes the <strong>Max % of net pay</strong> figure.
              If you leave that setting empty and rely on the basic-pay cap, the banner will
              not reflect your real limit, so tell employees the limit that applies.
            </Callout>
          </Section>

          <Section id="validation" title="Automatic policy checks">
            <p>
              When a request is submitted, PayKe validates it against the policy before an
              admin ever sees it. All failures are collected and shown together.
            </p>
            <Table
              head={["Check", "Fails when"]}
              rows={[
                ["Policy exists", "The organisation has no active, approved advance policy."],
                ["Own request only", "A non-admin requests for someone else."],
                ["Self-service enabled", "A non-admin requests while employee requests are off."],
                ["Cut-off day", "A non-admin requests after the cut-off day of the month."],
                ["Employee in organisation", "The employee does not belong to the organisation."],
                ["Employee status", "The employee's status is not in the allowed list (active by default)."],
                ["Amount", "Not a number, zero or negative, below the minimum or above the maximum."],
                ["Basic-pay cap", "Amount is more than the % of basic salary allowed."],
                ["Net-pay cap", "Amount is more than the % of estimated net pay allowed."],
                ["Active advances", "The employee already holds the maximum number of unfinished advances."],
                ["Recovery periods", "Not a whole number between 1 and the maximum."],
                ["Recovery dates", "Start date before today, or end date before the start date."],
                ["Requested payrun", "Belongs to another organisation, or is not in draft."],
                ["Reason / document", "Missing when the policy requires them."],
                ["Disbursement method", "Unknown, or not enabled by the policy."],
              ]}
            />
            <p>
              Advances count towards the active limit while they are{" "}
              <em>awaiting approval, approved, payout in payrun, paid out or repaying</em>. Drafts, rejected, cancelled
              and repaid advances do not.
            </p>
          </Section>

          <Section id="max-allowed" title="Maximum allowed amount">
            <p>
              The most an employee can request is the <strong>lowest</strong> of every limit
              that applies: the policy maximum amount, the % of basic salary, and the % of
              estimated net pay. If no limit is configured the maximum is treated as zero, so
              set at least one.
            </p>
            <p>
              Estimated net pay is calculated on the employee's <strong>basic salary only</strong>,
              using the organisation's tax configuration — the same engine the payrun uses:
            </p>
            <Table
              head={["Component", "How it is calculated"]}
              rows={[
                ["NSSF", "Tiered: NSSF rate on earnings up to Tier I, plus the rate on earnings between Tier I and Tier II."],
                ["SHIF", "The greater of the SHIF rate × basic salary and the SHIF minimum (a floor, not an extra charge)."],
                ["Housing Levy", "Housing Levy rate × basic salary."],
                ["PAYE", "Progressive bands on (basic − NSSF − SHIF − Housing Levy), less personal relief, never below zero."],
              ]}
            />
            <p>
              Worked example with the standard rates (NSSF 6%, SHIF 2.75%, Housing Levy 1.5%,
              personal relief KES 2,400) for a basic salary of KES 60,000 and a policy of 50% of
              basic and 60% of net:
            </p>
            <CodeBlock>{`NSSF          = 9,000 × 6% + (60,000 − 9,000) × 6%  =  3,600.00
SHIF          = max(60,000 × 2.75%, 300)            =  1,650.00
Housing Levy  = 60,000 × 1.5%                       =    900.00
Taxable pay   = 60,000 − 3,600 − 1,650 − 900        = 53,850.00
Tax           = 2,400 + 2,083.25 + 21,517 × 30%     = 10,938.35
PAYE          = 10,938.35 − 2,400 relief            =  8,538.35
Estimated net = 60,000 − 3,600 − 1,650 − 900 − 8,538.35 = 45,311.65

Limit (50% of basic) = 30,000.00
Limit (60% of net)   = 27,186.99   ← lowest, so this is the maximum`}</CodeBlock>
            <Callout kind="note" title="Rates come from your tax configuration">
              Rates are read from the organisation's approved, active <InlineCode>tax</InlineCode>{" "}
              configuration. If a rate is missing, PayKe falls back to built-in defaults — which
              also means the NSSF Tier I and Tier II limits currently fall back to KES 9,000 and
              KES 108,000 unless you have configured them. If the estimate fails for any reason,
              the net-pay cap is skipped and the other limits still apply.
            </Callout>
          </Section>

          <Section id="managing" title="Managing advances">
            <p>
              The <strong>Advances</strong> page gives admins and payroll staff a single view of
              every request. Summary cards show total advances, the outstanding balance
              (with the amount already recovered), requests in approval, and active advances
              (with the number awaiting payout, which includes advances already placed in a
              payrun). The cards are not affected by the table filters.
            </p>
            <p>
              Filter the table by employee name, employee number or advance number, status,
              month and year. Each row offers a details drawer (Details and Repayments tabs)
              and the actions available to your role at the advance's current status:
            </p>
            <Table
              head={["Status", "Admin", "Payroll manager / officer", "Finance manager"]}
              rows={[
                ["Draft", "Cancel", "—", "—"],
                ["Awaiting approval", "Approve, Reject, Cancel", "—", "—"],
                ["Approved", "Mark as Paid Out, Cancel", "—", "—"],
                ["Payout in Payrun", "Cancel. Detach the payout from the details drawer.", "—", "—"],
                ["Paid Out / Repaying", "Repayment Schedule, Record Repayment, Reverse Repayment", "Repayment Schedule", "Record Repayment, Reverse Repayment"],
                ["Closed (repaid, rejected, cancelled)", "—", "—", "—"],
              ]}
            />
            <p>
              Auditors have read-only access. Admins also reach <strong>Policy Settings</strong>{" "}
              from this page. The details drawer shows a <strong>Payroll Payout</strong> section
              (payrun name and status) for any advance paid out through a payrun.
            </p>
          </Section>

          <Section id="approval" title="Approval & rejection">
            <p>
              An admin reviews each request in Awaiting approval. The system can only act on
              advances that are pending — once decided, a request cannot be approved or
              rejected again.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Approve</strong> — optionally enter a lower <em>amount approved</em>. It
                must be greater than zero and cannot exceed the amount requested. The approved
                amount becomes the balance to recover. For a payroll-method advance, PayKe then
                tries to place the payout in the current draft payrun (next section). That
                step never blocks the approval.
              </li>
              <li>
                <strong>Reject</strong> — a reason is required and is shown to the employee.
              </li>
              <li>
                <strong>Cancel</strong> — admins can cancel an advance that is a draft, awaiting
                approval, approved, or has its payout in a payrun. Employees can only cancel
                their own advance while it is awaiting approval. Cancelling detaches any attached
                recovery lines; if the payout was in a payrun, it is removed and that
                employee's payrun row is recalculated.
              </li>
            </ul>
            <p>The employee is notified of every decision.</p>
          </Section>

          <Section id="payroll-payout" title="Paying out through a payrun">
            <p>
              When an advance's disbursement method is <strong>Payroll</strong>, PayKe pays it
              out with the employee's pay instead of as a separate transfer. The amount appears
              on the employee's payrun row as a <strong>Salary Advance Payout</strong> earning,
              and on their payslip.
            </p>
            <Steps
              items={[
                { t: "Approve", d: "As soon as an admin approves the advance, PayKe looks for the current payrun: the earliest draft, regular payrun." },
                { t: "Payout in Payrun", d: "The advance becomes Payout in Payrun and that employee's payrun row is recalculated straight away, so the payout shows in gross and net pay." },
                { t: "Finalize the payrun", d: "When the payrun is finalized the advance becomes Paid Out. The amount paid equals the approved amount, the reference is “Payrun: <payrun name>”, the date is the last day of the pay period, and the employee is notified." },
                { t: "Repayment starts", d: "Recovery instalments begin in later payruns. An advance is never recovered in the same payrun that pays it out." },
              ]}
            />
            <Callout kind="note" title="The payout is not taxable">
              The payout is added to gross and net pay only. It never enters taxable income, so
              PAYE, NSSF, SHIF and Housing Levy are calculated exactly as if the advance did not
              exist.
            </Callout>
            <p>
              After approving, the admin sees one of these outcomes. The same outcomes apply
              when a disbursed advance's first recovery instalment is placed.
            </p>
            <Table
              head={["Outcome", "What it means", "What to do"]}
              rows={[
                [<InlineCode key="o1">attached</InlineCode>, "The payout (or recovery) was added to the named draft payrun.", "Nothing."],
                [<InlineCode key="o2">waiting_no_payrun</InlineCode>, "There is no draft payrun, or the advance was detached from the current one. It joins the next draft payrun automatically, when one is processed or created after a finalize.", "Nothing. Or use Mark as Paid Out to pay it another way."],
                [<InlineCode key="o3">payrun_reviewed</InlineCode>, "The current payrun is already reviewed, so nothing was changed. A warning offers a Reopen payrun button.", "Reopen the payrun and PayKe retries, or leave it to join the next payrun."],
                [<InlineCode key="o4">not_applicable</InlineCode>, "There is nothing to add to a payrun, for example the advance is not a payroll-method advance.", "Nothing."],
                [<InlineCode key="o5">error</InlineCode>, "The approval was saved but the advance could not be added yet. It is retried the next time the payrun is processed.", "Process the payrun again, or contact support if it persists."],
              ]}
            />
            <p>
              <strong>Detaching a payout.</strong> While the payrun is still a draft, an admin
              can choose <strong>Detach</strong> in the advance's Payroll Payout section. The
              advance returns to Approved, the employee's payrun row is recalculated, and PayKe
              remembers not to add it to that payrun again. It joins the next draft payrun
              instead. A payout cannot be detached from a reviewed payrun: reopen the payrun
              first.
            </p>
            <Callout kind="note" title="Other disbursement methods">
              Bank transfer, M-Pesa, cash and cheque advances are not paid through payroll. Pay
              them yourself, then record it with Mark as Paid Out (next section).
            </Callout>
          </Section>

          <Section id="disbursement" title="Marking an advance paid out">
            <p>
              An advance becomes <em>Paid Out</em> in one of two ways, and recovery can only be
              scheduled once it is:
            </p>
            <Table
              head={["Way", "How it works"]}
              rows={[
                ["Through a payrun", "Payroll-method advances only. Automatic when the payrun holding the payout is finalized."],
                ["Mark as Paid Out", "An admin records a payout made outside PayKe (bank transfer, M-Pesa, cash, cheque), or pays a payroll-method advance another way when no payrun is available."],
              ]}
            />
            <p>
              Mark as Paid Out is available on <strong>Approved</strong> advances. It records
              the payout and moves the advance to <em>Paid Out</em>.
            </p>
            <Table
              head={["Field", "Rule"]}
              rows={[
                ["Method", "Defaults to the advance's method; must be one the policy enables."],
                ["Reference", "Required for bank transfer, M-Pesa and cheque (for example the M-Pesa code)."],
                ["Date", "Defaults to today; format YYYY-MM-DD."],
                ["Amount", "Always equals the approved amount; a different amount is rejected."],
              ]}
            />
            <Callout kind="warning" title="Not available once the payout is in a payrun">
              An advance in Payout in Payrun cannot be marked as paid out by hand: it is
              disbursed when that payrun is finalized. To pay it another way, detach the payout
              first, which returns it to Approved.
            </Callout>
            <Callout kind="note" title="Recording, not sending">
              Mark as Paid Out records that the money has been paid. It does not send a bank or
              M-Pesa payment itself. Make the payment, then enter the reference here. Once an
              advance is Paid Out, its first recovery instalment is placed in the current draft
              payrun automatically.
            </Callout>
          </Section>

          <Section id="recovery-schedule" title="Recovery schedule" eyebrow="Recovery">
            <p>
              Advances are recovered one instalment per payrun, and PayKe schedules them for
              you. The moment an advance is Paid Out, its first instalment is placed in the
              current draft payrun. After that, every time a draft payrun is processed (or a
              new draft is created after a finalize), each advance still waiting for an
              instalment gets one.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>An advance gets at most one instalment per payrun.</li>
              <li>A second instalment is not added while an earlier one is still attached.</li>
              <li>A payroll advance is not recovered in the payrun that paid it out.</li>
              <li>Only regular, draft payruns are used. Off-cycle runs are never picked automatically.</li>
            </ul>
            <p>
              Payroll staff can also manage the schedule by hand. Choose{" "}
              <strong>Repayment Schedule</strong> on a Paid Out or Repaying advance, pick a
              draft payrun, and PayKe creates one recovery line for that advance and payrun.
            </p>
            <Table
              head={["Mode", "How the amount is set"]}
              rows={[
                ["Equal (default)", "Approved amount ÷ number of recoveries, rounded to the cent. You can attach at most as many payruns as the planned number of recoveries."],
                ["Custom", "You enter the amount to recover in that payrun."],
              ]}
            />
            <p>Rules that apply when attaching:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The advance must be Paid Out or Repaying.</li>
              <li>The payrun must belong to your organisation and still be in draft.</li>
              <li>An advance can only be attached to a given payrun once.</li>
              <li>The total scheduled across attached payruns cannot exceed the remaining balance.</li>
              <li>Once recovery has started, the mode (equal or custom) cannot be changed.</li>
            </ul>
            <p>
              A recovery can be <strong>detached</strong> from a draft payrun at any time before
              the payrun is reviewed. PayKe then remembers not to add that advance to that payrun
              automatically again, but you can still attach it later by hand.
            </p>
          </Section>

          <Section id="payroll-recovery" title="Recovery in a payrun">
            <p>
              Recovery happens in two stages: it is <strong>planned</strong> when the payrun is
              calculated, and <strong>applied</strong> when the payrun is finalized. For each
              employee, calculating a draft payrun works in a single all-or-nothing step:
            </p>
            <Steps
              items={[
                { t: "Pick up waiting advances", d: "Before anything is calculated, advances waiting for a payrun are attached to this draft." },
                { t: "Undo the earlier plan (reprocessing)", d: "If the draft is being recalculated, any recovery it planned before is marked reversed and its line returns to attached, so nothing is counted twice." },
                { t: "Project net pay", d: "Net pay is worked out from gross pay (including any advance payout), statutory deductions and other deductions such as loans and attendance — before the advance recovery." },
                { t: "Calculate the recovery", d: "The amount for each attached advance is calculated and capped so net pay stays above the policy minimum (next section)." },
                { t: "Plan it", d: "A deduction line is added to the payslip, a repayment is recorded against the advance as Scheduled in payrun, and the recovery line is marked processed. The advance's balance and status do not change yet." },
              ]}
            />
            <p>
              <strong>When the payrun is finalized</strong>, each planned repayment is applied:
              the advance's recovered amount and balance are updated, its status becomes{" "}
              <em>Repaying</em> or <em>Fully repaid</em>, the change is written to the audit log,
              and the employee is notified when the balance reaches zero. A fully repaid
              advance has its other attached lines detached. If an advance can no longer take
              the repayment at that point (for example it was cancelled), that repayment is
              marked failed and is not applied.
            </p>
            <Callout kind="note" title="A post-tax deduction">
              The recovery never changes taxable income. PAYE, NSSF, SHIF and Housing Levy are
              calculated exactly as if there were no advance; the recovery simply reduces net pay.
              It appears as a deduction on the payslip and in total deductions.
            </Callout>
            <p>
              The repayment is dated the <strong>last day of the pay period</strong>. If a
              payrun is already reviewed, recalculating it never touches the advance ledger — the
              recoveries already planned are carried onto the payslip so they are not lost.
            </p>
            <Callout kind="warning" title="When a recovery is skipped or blocks the run">
              If the advance is no longer recoverable, or net pay is already at or below the
              minimum, that line is marked <em>failed</em> and an audit entry records why; the
              payrun continues. If the policy forbids partial recovery and the deduction would
              push net pay below the minimum, the calculation for that employee stops with an
              error instead of reducing the amount. Other employees are still calculated.
            </Callout>
          </Section>

          <Section id="recovery-maths" title="How each recovery is calculated">
            <p>All money is handled in whole cents, so there is no rounding drift.</p>
            <CodeBlock>{`planned   = equal  : min(balance, approved ÷ recoveries)
            custom : the scheduled amount on the line
            final equal instalment : the whole remaining balance

requested = min(planned, balance)
max safe  = max(0, projected net pay − minimum net pay after recovery)
recovery  = min(requested, max safe)`}</CodeBlock>
            <p>
              <strong>Rounding true-up.</strong> On the last instalment of an equal schedule the
              entire remaining balance is recovered, so rounding never leaves a few cents
              behind. For example, KES 25,000 over three recoveries is deducted as
              8,333.33 + 8,333.33 + 8,333.34.
            </p>
            <p>
              <strong>Net-pay protection.</strong> If paying the planned amount would take net
              pay below the minimum, the deduction is reduced to what is safe (when partial
              recovery is allowed). The remainder simply stays on the balance and is picked up
              by a later payrun.
            </p>
          </Section>

          <Section id="manual-repayment" title="Manual repayments & reversals">
            <p>
              Repayments made outside payroll — an employee paying back in cash or by M-Pesa,
              for instance — are recorded by an admin or finance manager from the
              advance's actions.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The advance must be Paid Out or Repaying.</li>
              <li>The amount must be greater than zero and cannot exceed the remaining balance.</li>
              <li>The date defaults to today (YYYY-MM-DD); notes are optional.</li>
              <li>The balance and status update immediately; a full repayment closes the advance.</li>
            </ul>
            <p>
              A <strong>manual</strong> repayment can be reversed with a mandatory reason. The
              original is marked reversed, a reversal entry is added to the ledger, and the
              balance and status are recalculated — a repaid advance returns to recovering or
              disbursed.
            </p>
            <Callout kind="note" title="Payroll recoveries are not reversed here">
              Deductions made through a payrun cannot be reversed individually. While the payrun
              is still a draft, reprocess it and the planned recovery is rolled back before being
              recalculated. Once the payrun is finalized, the deduction is final.
            </Callout>
          </Section>

          <Section id="notifications" title="Notifications & audit trail" eyebrow="Reference">
            <p>Employees receive an in-app notification when their advance is:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>rejected by the policy checks, approved, rejected or cancelled;</li>
              <li>paid out, either marked as paid by an admin or paid through a finalized payrun;</li>
              <li>fully repaid.</li>
            </ul>
            <p>
              Every admin in the organisation is notified when a new request is awaiting
              approval.
            </p>
            <p>
              Each change is written to the audit log in the same transaction as the change
              itself, so if the log entry cannot be saved the change is rolled back. Recorded
              events include:
            </p>
            <Table
              head={["Event", "When"]}
              rows={[
                [<InlineCode key="1">advance_created</InlineCode>, "A request is created as a draft."],
                [<InlineCode key="2">advance_policy_validated / advance_policy_failed</InlineCode>, "The automatic checks pass or fail."],
                [<InlineCode key="3">advance_submitted</InlineCode>, "The request moves to pending."],
                [<InlineCode key="4">advance_approved / advance_rejected / advance_cancelled</InlineCode>, "An admin or employee decision."],
                [<InlineCode key="5">advance_payout_scheduled / advance_payout_detached</InlineCode>, "A payroll payout is placed in, or removed from, a draft payrun."],
                [<InlineCode key="6">advance_disbursed</InlineCode>, "The payout is recorded, by an admin or when the payrun holding it is finalized."],
                [<InlineCode key="7">advance_recovery_attached / _detached</InlineCode>, "Recovery is scheduled or removed for a payrun."],
                [<InlineCode key="8">advance_recovery_processed / _skipped</InlineCode>, "A finalized payrun applies a recovery, or a line is skipped during calculation."],
                [<InlineCode key="9">advance_manual_repayment</InlineCode>, "A manual repayment is recorded."],
                [<InlineCode key="10">advance_partially_recovered / advance_repaid</InlineCode>, "The balance falls, or reaches zero."],
                [<InlineCode key="11">advance_reversed</InlineCode>, "A manual repayment is reversed, or an already-applied recovery is undone by reprocessing."],
              ]}
            />
            <p>Policy changes are logged too, with the settings before and after.</p>
          </Section>

          <Section id="api" title="API reference">
            <p>
              All endpoints live under <InlineCode>/api/v1</InlineCode> and require an
              authenticated user. The organisation always comes from the login token, never
              from the URL.
            </p>
            <Table
              head={["Method & path", "Purpose"]}
              rows={[
                ["GET /advances", "List advances. Filters: status, employee_id, name, month, year, from, to, page, per_page (default 10, max 100). Employees only ever see their own. Statistics are returned in metadata. Each advance includes its payout payrun (id, name, status) when it has one."],
                ["POST /advances", "Create (and by default submit) an advance."],
                ["GET /advances/{id}", "Details, including recovery lines and repayments."],
                ["PUT /advances/{id}", "Edit a draft or system-rejected advance; it returns to draft."],
                ["DELETE /advances/{id}", "Delete a draft or system-rejected advance."],
                ["POST /advances/{id}/submit", "Run the policy checks and submit."],
                ["POST /advances/{id}/approve", "Approve, optionally with amount_approved. The response includes payroll_sync."],
                ["POST /advances/{id}/reject", "Reject with reason."],
                ["POST /advances/{id}/cancel", "Cancel, optionally with reason."],
                ["POST /advances/{id}/disburse", "Record disbursement (Mark as Paid Out). The response includes payroll_sync."],
                ["POST /advances/{id}/auto-attach", "Retry placing the advance (payout or next recovery) in the current draft payrun, for example after reopening a reviewed payrun. Returns a payroll_sync result."],
                ["POST /advances/{id}/attach-payout", "Body: payrun_id. Schedule a payroll-method advance's payout in a chosen draft payrun. The screens place payouts automatically, so this is for integrations."],
                ["POST /advances/{id}/detach-payout", "Remove a scheduled payout from its draft payrun; the advance returns to approved."],
                ["POST /advances/{id}/attach-payrun", "Schedule a recovery instalment in a draft payrun."],
                ["POST /advances/{id}/detach-payrun", "Remove a recovery instalment from a draft payrun."],
                ["GET /advances/{id}/payrun-lines", "Recovery lines for the advance."],
                ["GET /advance-payruns", "Draft payruns available for recovery."],
                ["GET /payruns/{payrun}/employees/{employee}/advances", "Everything advance-related on one employee's payrun row: payouts, recovery instalments (planned or applied) and their totals."],
                ["POST /advances/{id}/manual-repayment", "Record a repayment made outside payroll."],
                ["GET /advances/{id}/repayments", "Repayment ledger."],
                ["POST /advances/{id}/repayments/{repaymentId}/reverse", "Reverse a manual repayment."],
                ["GET /employees/{id}/advances", "One employee's advances."],
                ["GET /employees/{id}/advance-balance", "Outstanding balance, active count, the most they can request, and whether they can request now."],
                ["GET /advance-policy", "Current policy (404 if none is configured)."],
                ["PUT /advance-policy", "Update settings, creating the policy if needed (admin only)."],
              ]}
            />
            <p>Creating an advance:</p>
            <CodeBlock>{`POST /api/v1/advances
{
  "amount_requested": 20000,
  "reason": "School fees",
  "number_of_recoveries": 2,
  "disbursement_method": "payroll",
  "submit": true            // false saves a draft
}

→ 201 Created   { "success": true, "message": "Advance request submitted successfully", "data": { "advance_number": "ADV-2026-000001", "status": "pending", ... } }

→ 422 (policy failed)
  { "success": false,
    "message": "Advance request failed policy validation",
    "errors": { "amount_requested": "Amount exceeds 50% of basic salary (max KES 30,000.00)" },
    "data": { "advance": { "status": "system_rejected", ... }, "max_allowed": "27186.99" } }`}</CodeBlock>
            <p>
              Approving or disbursing returns the advance together with a{" "}
              <InlineCode>payroll_sync</InlineCode> block describing what happened when PayKe
              tried to place it in the current draft payrun:
            </p>
            <CodeBlock>{`POST /api/v1/advances/42/approve
{ "amount_approved": 18000 }

→ 200 OK   { "success": true,
             "data": {
               "advance_number": "ADV-2026-000042",
               "status": "approved",          // the state at approval; it becomes "scheduled" right after
               ...,
               "payroll_sync": {
                 "outcome": "attached",       // attached | waiting_no_payrun | payrun_reviewed | not_applicable | error
                 "kind": "payout",            // payout | recovery
                 "payrun_id": 7,
                 "payrun_name": "November 2026 Payrun",
                 "message": "Advance payout added to November 2026 Payrun."
               } } }

// when outcome is "payrun_reviewed":  "actions": ["reopen_payrun", "wait_for_next_payrun"]`}</CodeBlock>
            <p>
              Admins may also pass <InlineCode>employee_id</InlineCode> to request on behalf of
              someone else. Responses use a standard envelope; failures return{" "}
              <InlineCode>422</InlineCode> for invalid input (with a field-by-field{" "}
              <InlineCode>errors</InlineCode> map), <InlineCode>409</InlineCode> when the advance
              is in the wrong status for the action, <InlineCode>403</InlineCode> for permission
              or ownership, and <InlineCode>404</InlineCode> when the record is not found in the
              organisation.
            </p>
          </Section>

          <Section id="data-model" title="Data model">
            <p>Three tables hold advance data, all scoped by organisation:</p>
            <Table
              head={["Table", "Holds"]}
              rows={[
                [<InlineCode key="a">advances</InlineCode>, "The request itself: number, amounts requested / approved / disbursed / recovered, balance remaining, status, recovery settings, disbursement details, who approved / rejected / disbursed / cancelled and when, the payrun that pays it out (payout_payrun_id), plus a JSON metadata field with the supporting document, recovery mode, payruns it was detached from, and the policy snapshot."],
                [<InlineCode key="b">advance_payrun_lines</InlineCode>, "One row per advance and payrun: the scheduled recovery amount and its status (attached, processed, detached, failed)."],
                [<InlineCode key="c">advance_repayments</InlineCode>, "The ledger: each payroll deduction, manual repayment or reversal, with the balance after it and its status (pending, applied, reversed, failed)."],
              ]}
            />
            <p>
              The policy itself is a row in <InlineCode>organization_configs</InlineCode> with
              type <InlineCode>advance</InlineCode>, its settings stored as JSON. Payroll
              recoveries are also written to <InlineCode>payrun_deductions</InlineCode> so they
              show on payslips. A payroll payout is stored on the employee's{" "}
              <InlineCode>payrun_details</InlineCode> row in <InlineCode>advance_payout</InlineCode>{" "}
              (with <InlineCode>advance_payout_metadata</InlineCode> listing the advances), and is
              part of gross and net pay.
            </p>
            <p>
              The balance is always <em>amount approved − amount recovered</em>, and the status
              follows from it: balance zero means repaid, some recovered means repaying,
              nothing recovered means paid out. Only <em>applied</em> repayments count as
              recovered. A payroll recovery stays <em>pending</em> until its payrun is finalized.
            </p>
            <Callout kind="note" title="Database migration">
              The payout feature needs <InlineCode>database/advance_payrun_integration.sql</InlineCode>,
              which adds <InlineCode>advances.payout_payrun_id</InlineCode>,{" "}
              <InlineCode>payrun_details.advance_payout</InlineCode> and{" "}
              <InlineCode>payrun_details.advance_payout_metadata</InlineCode>. Run it once on
              top of <InlineCode>updated.sql</InlineCode>.
            </Callout>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <Table
              head={["Symptom", "Likely cause and fix"]}
              rows={[
                ["“No active salary advance policy is configured”", "The organisation has no approved, active advance policy. An admin saves one under Advances → Policy Settings."],
                ["Request is System rejected", "Open the request to read the reasons. Edit it to fix the amount or other fields, then resubmit."],
                ["Maximum allowed shows as zero", "No amount or percentage limit is set in the policy. Set at least one."],
                ["Request button is disabled", "Employee requests are turned off in the policy."],
                ["Approved advance is not in any payrun", "There is no draft payrun yet, or the advance was detached from the current one. It joins the next draft payrun automatically. If a payrun is open, use Reopen payrun on the warning, or process the payrun again."],
                ["Warning: payrun is already reviewed", "Nothing was changed. Reopen the payrun (the warning has a button) and PayKe retries, or leave the advance for the next payrun."],
                ["Cannot mark as paid out", "The advance is not Approved, its payout is already in a payrun (detach it first), the method is not enabled by the policy, a reference is missing for a bank, M-Pesa or cheque payout, or the amount differs from the approved amount."],
                ["Cannot detach a payout", "The payrun is no longer a draft. Reopen the payrun first."],
                ["Balance did not change after the payrun was calculated", "Expected. Recoveries are only planned while the payrun is a draft. The balance and status update when the payrun is finalized."],
                ["Cannot attach to a payrun", "The advance is not Paid Out, the payrun is not in draft, it is already attached to that payrun, or the total scheduled would exceed the balance."],
                ["Recovery line shows failed", "The advance was no longer recoverable, or net pay was already at the minimum. Check the audit log, then re-attach to a later payrun."],
                ["Payrun calculation stops for an employee", "Partial recovery is off and the deduction would drop net pay below the minimum. Allow partial recovery, lower the instalment, or change the minimum."],
                ["Cannot reverse a repayment", "Only applied manual repayments can be reversed. Reprocess the draft payrun to undo a planned payroll recovery. A finalized payrun's deduction is final."],
                ["Employee sees “No employee profile is linked”", "The login is not linked to an employee record. Link it in employee management."],
              ]}
            />
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-6">
              {[
                {
                  q: "Can an employee have more than one advance at once?",
                  a: "Only up to the policy's “Max active advances”, which is 1 by default. Pending, approved, payout-in-payrun, paid out and repaying advances all count.",
                },
                {
                  q: "How does an employee actually receive a payroll advance?",
                  a: "It is added to their pay as a Salary Advance Payout in the payrun it is placed in. It shows on their payrun row and payslip, and the advance becomes Paid Out when the payrun is finalized.",
                },
                {
                  q: "Is the advance payout taxed?",
                  a: "No. It reaches gross and net pay only, and never taxable income, so PAYE, NSSF, SHIF and Housing Levy are unchanged.",
                },
                {
                  q: "Does the advance reduce my PAYE or NSSF?",
                  a: "No. Recovery is deducted after tax. Statutory deductions are calculated as normal and the advance only lowers take-home pay.",
                },
                {
                  q: "What if there is no draft payrun when I approve?",
                  a: "The approval still goes through. The advance waits and joins the next draft payrun automatically, as soon as one is processed or created after a finalize.",
                },
                {
                  q: "When does the advance balance go down?",
                  a: "When the payrun holding the recovery is finalized. While it is a draft, the deduction shows on the payslip but is only planned. Reprocessing a draft rolls it back and recalculates it.",
                },
                {
                  q: "Can I pay a payroll-method advance another way?",
                  a: "Yes, while it is still Approved: use Mark as Paid Out. If its payout is already in a payrun, detach it first.",
                },
                {
                  q: "What if an employee's pay is too low to recover the full instalment?",
                  a: "With partial recovery allowed, PayKe deducts what keeps net pay at or above the minimum and carries the rest to the next payrun. Without it, the payrun calculation stops for that employee with an error.",
                },
                {
                  q: "Can an approved advance be for less than requested?",
                  a: "Yes. The admin can approve any amount above zero up to the amount requested. The approved amount is what is paid out and recovered.",
                },
                {
                  q: "Do policy changes affect advances already submitted?",
                  a: "Eligibility is checked against the policy at submission, and a snapshot is saved on the advance. Recovery and disbursement rules (minimum net pay, partial recovery, enabled methods) are read from the live policy, so edits to them apply to advances already in flight.",
                },
                {
                  q: "Is the finance approval threshold used?",
                  a: "Not yet. It is stored for a planned multi-step approval, but approval is currently a single admin step.",
                },
                {
                  q: "Does PayKe send the money?",
                  a: "Not by itself. For a payroll-method advance the payout is part of the employee's pay in the payrun, which you pay out as usual. For other methods, make the payment yourself and record it with Mark as Paid Out, adding the bank or M-Pesa reference.",
                },
              ].map((f) => (
                <div key={f.q}>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{f.q}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              For how payruns move through draft, reviewed and finalized, see the{" "}
              <a href="/docs/payrun" className="font-medium underline" style={{ color: PURPLE }}>
                payrun documentation
              </a>
              .
            </p>
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