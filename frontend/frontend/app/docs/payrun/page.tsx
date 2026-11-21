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
      { id: "processing", label: "Processing & reviewing" },
      { id: "reopening", label: "Reopening a payrun" },
      { id: "finalizing", label: "Finalizing" },
    ],
  },
  {
    title: "Salary advances",
    items: [
      { id: "advances-overview", label: "How advances reach a payrun" },
      { id: "advance-payouts", label: "Advance payouts" },
      { id: "advance-recoveries", label: "Advance recoveries" },
      { id: "advances-changes", label: "Reprocessing & reopening" },
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
            payrun to finalizing it — including how salary advances are paid out and
            recovered along the way, so your finance and HR teams know exactly what to
            expect at each step.
          </p>

          <Section id="introduction" title="Introduction">
            <p>
              Every payrun in PayKe moves through the same guarded pipeline, regardless of
              company size: it is opened against a pay period, calculated for every active
              employee, reviewed, and finalized. Each stage records who did it and when, and
              the change is written to the audit log.
            </p>
            <p>
              Payrun amounts are built from the employee's salary and everything attached to
              the period: overtime, bonuses and commission, allowances, reimbursements, loan
              instalments, attendance deductions and salary advances. Statutory deductions are
              then calculated from your organisation's approved tax configuration.
            </p>
          </Section>

          <Section id="lifecycle" title="Payrun lifecycle" eyebrow="Overview">
            <p>A payrun is always in exactly one of the following states:</p>
            <div className="grid sm:grid-cols-3 gap-3 my-6">
              {[
                { s: "Draft", d: "Open for changes. It can be calculated again, and salary advances can still be added to it or removed from it." },
                { s: "Reviewed", d: "Calculated and stamped with the reviewer and time. It can be reopened until payslips have been sent." },
                { s: "Finalized", d: "Locked for good. Payslips are generated, advance payouts become paid and advance recoveries are applied." },
              ].map((row) => (
                <div key={row.s} className="border border-gray-200 rounded-md p-3">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{row.s}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{row.d}</p>
                </div>
              ))}
            </div>
            <CodeBlock>{`draft ──process / review──▶ reviewed ──finalize──▶ finalized
  ▲                            │
  └────────── reopen ──────────┘   (blocked once payslips have been sent)`}</CodeBlock>
            <Callout kind="note" title="A finalized payrun is permanent">
              A finalized payrun cannot be reopened or reprocessed. To correct an error after
              finalizing, use an off-cycle adjustment payrun (or carry-forward for late
              overtime) rather than editing history — this keeps every finalized run auditable.
            </Callout>
            <p>
              Payruns are either <strong>regular</strong> (the monthly run) or{" "}
              <strong>off-cycle</strong> (an adjustment). Finalizing a regular payrun opens the
              next month's draft automatically; finalizing an off-cycle run does not.
            </p>
          </Section>

          <Section id="creating" title="Creating a payrun" eyebrow="Running a payrun">
            <p>Opening a new payrun requires:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>A <strong>name</strong>, for example “November 2026 Payrun”.</li>
              <li>A <strong>pay period start</strong> and <strong>end</strong> date. The start cannot be after the end.</li>
            </ul>
            <p>
              You rarely need to do this by hand. When a regular payrun is finalized, PayKe
              creates the next month's draft for you (the same days, one month forward), and a
              brand-new organisation gets its first payrun created automatically.
            </p>
            <p>
              Every active employee (including those on probation) is included. For each one,
              PayKe pulls the current salary and whatever has been attached to the period,
              such as approved overtime, allowances, reimbursements, loan instalments,
              attendance deductions and salary advances.
            </p>
          </Section>

          <Section id="processing" title="Processing & reviewing">
            <p>
              Processing calculates the payrun. Each employee is calculated in their own
              transaction, so one employee's error never blocks the rest. Processing recalculates
              gross pay, statutory deductions, other deductions and net pay, and then marks the
              payrun as reviewed with your name and the time.
            </p>
            <CodeBlock>{`POST /api/v1/organizations/{org_id}/payrun/{payrun_id}/process

→ 200 OK
  { "data": { "payrun_id": 7, "employee_count": 42, "total_gross_pay": 4120000,
              "total_deductions": 910000, "total_net_pay": 3210000,
              "status": "reviewed", "errors": [] } }

→ 207 Multi-Status when some employees failed; their errors are listed in "errors".`}</CodeBlock>
            <p>
              Processing needs an approved, active tax configuration (NSSF, SHIF, Housing Levy
              and personal relief). Without one it stops with an error, and a finalized payrun
              cannot be processed at all.
            </p>
            <Table
              head={["Action", "Who can do it"]}
              rows={[
                ["Process (calculate)", "Admin, payroll manager, payroll officer"],
                ["Review (draft → reviewed)", "Admin, payroll manager, HR manager, payroll officer"],
              ]}
            />
            <p>
              Reviewed and finalized payruns are locked against direct edits. To change a
              reviewed payrun, reopen it first.
            </p>
          </Section>

          <Section id="reopening" title="Reopening a payrun">
            <p>
              A reviewed payrun can be sent back to draft — for example to add late overtime,
              fix an input, or let a newly approved salary advance join the run. Reopening only
              changes the status and clears the review stamp. It does not recalculate anything,
              so process the payrun again afterwards.
            </p>
            <CodeBlock>{`POST /api/v1/organizations/{org_id}/payrun/{payrun_id}/reopen
{ "reason": "Late overtime approved" }`}</CodeBlock>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Only reviewed payruns can be reopened.</li>
              <li>It is blocked once any payslip for the payrun has been sent to an employee.</li>
              <li>Who can reopen: admin, payroll manager, HR manager, payroll officer.</li>
            </ul>
          </Section>

          <Section id="finalizing" title="Finalizing">
            <p>
              Finalizing locks the payrun. Only a reviewed payrun can be finalized, by an
              admin, payroll manager or finance manager. The first three steps below happen in
              one transaction, so either all of them are applied or none of them are. The last
              two follow straight after, and a problem there does not undo the finalize:
            </p>
            <Steps
              items={[
                { t: "The payrun is locked", d: "Its status becomes finalized and the finalizer and time are recorded." },
                { t: "Salary advances are settled", d: "Advance recoveries planned in this payrun are applied to each advance's balance, and advance payouts in this payrun become paid." },
                { t: "The next draft is opened", d: "For a regular payrun, next month's draft is created." },
                { t: "Waiting advances move on", d: "Advances waiting for a payrun join the new draft straight away." },
                { t: "Payslips are generated", d: "A payslip is created for every employee in the payrun, ready to be sent." },
              ]}
            />
            <CodeBlock>{`POST /api/v1/organizations/{org_id}/payrun/{payrun_id}/finalize`}</CodeBlock>
            <p>
              Payments themselves are made outside PayKe — PayKe calculates what each employee
              is owed and produces the payslips. Finalizing does not send money.
            </p>
          </Section>

          <Section id="advances-overview" title="How advances reach a payrun" eyebrow="Salary advances">
            <p>
              Salary advances touch a payrun in two ways. A <strong>payout</strong> adds money to
              an employee's pay when the advance's method is Payroll. A <strong>recovery</strong>{" "}
              takes an instalment back as a deduction. Both are placed in a draft payrun
              automatically, and both only become final when the payrun is finalized.
            </p>
            <Table
              head={["Payrun event", "What happens to advances"]}
              rows={[
                ["A draft payrun is processed", "Advances waiting for a payrun are attached to it first. Then each employee is calculated with their payout included in gross pay and their recovery planned as a deduction."],
                ["The payrun is reviewed", "Nothing changes. Recalculating a reviewed payrun keeps the advance deductions exactly as planned."],
                ["The payrun is reopened", "The advance ledger is untouched. Advances approved in the meantime can now be added; process again to recalculate."],
                ["The payrun is finalized", "Payouts become paid (the advance is Paid Out). Planned recoveries are applied and the advance balance and status update."],
                ["The next draft is created", "Advances still waiting for a payrun join it right away."],
              ]}
            />
            <Callout kind="note" title="Only draft payruns can take advances">
              A payout or recovery can only be added to, or removed from, a draft regular
              payrun. If the current payrun is already reviewed, the admin is offered a{" "}
              <em>Reopen payrun</em> button when approving an advance, or the advance simply
              joins the next payrun. The full advance workflow is in the{" "}
              <a href="/docs/advance" className="font-medium underline" style={{ color: PURPLE }}>
                salary advances documentation
              </a>
              .
            </Callout>
          </Section>

          <Section id="advance-payouts" title="Advance payouts">
            <p>
              When a payroll-method advance is approved, its payout is scheduled in the current
              draft payrun. On that employee's payrun row it appears as a{" "}
              <strong>Salary Advance Payout</strong> earning, and the payrun detail drawer lists
              it under <em>Salary Advances</em> as “Paid out in this payrun”.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The payout is added to <strong>gross pay and net pay</strong>, so the employee receives it with their normal pay.</li>
              <li>It is <strong>not taxable</strong>. PAYE, NSSF, SHIF and Housing Levy are unaffected.</li>
              <li>It shows on the employee's payslip as its own line.</li>
              <li>When the payrun is finalized the advance becomes Paid Out, with the reference “Payrun: &lt;payrun name&gt;” and the last day of the pay period as its date.</li>
            </ul>
            <p>
              An advance is never recovered in the same payrun that pays it out. Its first
              instalment comes in the next payrun.
            </p>
          </Section>

          <Section id="advance-recoveries" title="Advance recoveries">
            <p>
              Once an advance is Paid Out, one repayment instalment is placed in each upcoming
              draft payrun until the balance is cleared. When the payrun is calculated, PayKe
              works out the instalment for every employee:
            </p>
            <Steps
              items={[
                { t: "Project net pay", d: "Net pay is calculated before the advance, from gross pay, statutory deductions, loans and attendance deductions." },
                { t: "Cap the instalment", d: "The instalment is limited so net pay stays at or above the minimum set in the advance policy. With partial recovery allowed, the shortfall stays on the balance for a later payrun." },
                { t: "Add the deduction", d: "The recovery is added as a deduction line on the payslip and in total deductions. It is a post-tax deduction: taxable income and statutory deductions do not change." },
              ]}
            />
            <Callout kind="note" title="Planned in draft, applied at finalize">
              While the payrun is a draft the recovery is only <em>planned</em>: the payslip
              shows the deduction and the payrun detail drawer says the advance balance updates
              when the payrun is finalized. Finalizing applies it, moving the advance to
              Repaying or Fully repaid.
            </Callout>
            <p>
              If the policy forbids partial recovery and the full instalment would push net pay
              below the minimum, the calculation for that employee stops with an error (the
              payrun still processes everyone else, and returns a 207 listing the failures).
              If an employee's net pay is already at or below the minimum, that instalment is
              skipped and an audit entry records why.
            </p>
          </Section>

          <Section id="advances-changes" title="Reprocessing & reopening">
            <p>
              You can safely calculate a draft payrun more than once. Each time, PayKe first
              undoes what the payrun previously planned for advances — planned repayments are
              marked reversed and their lines return to attached — and then recalculates from
              scratch, so nothing is ever counted twice.
            </p>
            <Table
              head={["Situation", "What PayKe does"]}
              rows={[
                ["Process a draft payrun again", "Planned advance recoveries are rolled back and recalculated. Payouts are re-read from the advances currently scheduled in this payrun."],
                ["Process a reviewed payrun again", "The advance ledger is not touched. Already-planned recoveries are carried onto the payslip so they are not dropped."],
                ["Advance approved while the payrun is reviewed", "Nothing is changed. Reopen the payrun and the advance is added, or leave it for the next payrun."],
                ["Admin detaches a payout", "The employee's row is recalculated straight away, and that advance will not be added to this payrun automatically again."],
                ["Admin detaches a recovery instalment", "The line is removed and that advance will not be added to this payrun automatically again. The deduction drops out of the employee's row the next time the payrun is processed."],
                ["Advance cancelled", "A scheduled payout is removed and the employee's row recalculated. Attached recovery lines are detached and drop out the next time the payrun is processed."],
              ]}
            />
            <Callout kind="warning" title="After finalizing, advance deductions are final">
              A finalized payrun cannot be reprocessed, so its payouts and recoveries cannot be
              rolled back. If an advance deduction was wrong, record the correction against the
              advance (for example a manual repayment) or use an off-cycle adjustment payrun.
            </Callout>
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
            <p>
              Salary advances do not change any of these figures. An advance payout is
              non-taxable, and an advance recovery is deducted after tax.
            </p>
          </Section>

          <Section id="filing" title="Filing & remittance">
            <p>
              After the payrun is finalized, PayKe generates the statutory returns for the period —
              PAYE (P10), NSSF, and SHIF schedules — in the format required for submission.
              Remittance itself is a finance-team action: PayKe prepares the figures and
              filing files, and marks the period as filed once you confirm submission.
            </p>
          </Section>

          <Section id="payslips" title="Payslips & notifications" eyebrow="Reference">
            <p>
              Payslips are generated for every employee the moment a payrun is finalized.
              Sending them to employees is a separate step, done one at a time or in bulk, and
              a payrun can no longer be reopened once any payslip has been sent.
            </p>
            <p>
              Each payslip itemises the employee's earnings and deductions. A salary advance
              payout appears as its own earning, and an advance recovery as a deduction. The
              itemised deductions behind a payrun line (PAYE, NSSF, SHIF, Housing Levy, loans,
              advances and attendance deductions) can also be listed for each employee row.
            </p>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Processing says no approved tax configuration was found
                </p>
                <p>
                  An admin needs to set up and approve the NSSF rate, SHIF rate, Housing Levy
                  rate and personal relief in the organisation's tax configuration, then
                  process again.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Processing finished but some employees show errors
                </p>
                <p>
                  The payrun returns a 207 with each failure listed. Fix the cause for that
                  employee and process again. One common cause is a salary advance recovery
                  that would drop net pay below the minimum while partial recovery is switched
                  off in the advance policy.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  I can't reopen a payrun
                </p>
                <p>
                  Only reviewed payruns can be reopened, and not once a payslip has been sent.
                  A finalized payrun can never be reopened. Use an off-cycle adjustment instead.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  An advance is not in the payrun
                </p>
                <p>
                  The payrun may already be reviewed (reopen it, then process again), there may
                  be no draft payrun yet (the advance joins the next one automatically), or an
                  admin may have detached the advance from this payrun.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  The advance balance has not changed after processing
                </p>
                <p>
                  Expected. Recoveries are planned while the payrun is a draft and applied
                  when it is finalized.
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
                <p>
                  A regular payrun covers every active employee. Use an off-cycle adjustment
                  payrun for one-off corrections.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Who can finalize a payrun?
                </p>
                <p>Admins, payroll managers and finance managers.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Is a salary advance payout taxed?
                </p>
                <p>
                  No. It is added to gross and net pay only, and never to taxable income.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Can an advance be paid out and repaid in the same payrun?
                </p>
                <p>
                  No. The payout comes in one payrun and the first repayment instalment in the
                  next.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Can I reprocess a payrun?
                </p>
                <p>
                  Yes, as long as it is not finalized. Reprocessing a draft rolls back and
                  recalculates planned advance recoveries. Reprocessing a reviewed payrun keeps
                  them as they are.
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