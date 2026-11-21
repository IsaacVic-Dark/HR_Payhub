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
      { id: "lifecycle", label: "Payslip lifecycle" },
    ],
  },
  {
    title: "Working with payslips",
    items: [
      { id: "generating", label: "Generating payslips" },
      { id: "sending", label: "Sending to employees" },
      { id: "viewing", label: "Viewing & downloading" },
      { id: "acknowledging", label: "Acknowledgement" },
    ],
  },
  {
    title: "Access",
    items: [
      { id: "permissions", label: "Who can do what" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "contents", label: "What a payslip shows" },
      { id: "api", label: "API endpoints" },
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

export default function PayslipDocsPage() {
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
            Payslips
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
            How PayKe handles payslips
          </h1>
          <p className="text-gray-500 text-[15px] leading-7 mb-10">
            A payslip is the record each employee receives for a finalized payrun. This
            page explains how payslips are created, sent and acknowledged, who can see
            them, and what they contain, so your payroll, HR and finance teams know
            exactly what to expect at each step.
          </p>

          <Section id="introduction" title="Introduction">
            <p>
              PayKe creates one payslip per employee for every finalized payrun. The
              payslip is a lightweight record that points back to the payrun's
              calculation, so the figures an employee sees are always the figures that
              were calculated, never a separate copy that can drift out of sync.
            </p>
            <p>
              Payroll staff generate and send payslips from the{" "}
              <InlineCode>Payslips</InlineCode> page. Employees view, download and
              acknowledge theirs from <InlineCode>My Payslips</InlineCode>.
            </p>
          </Section>

          <Section id="lifecycle" title="Payslip lifecycle" eyebrow="Overview">
            <p>A payslip always sits in exactly one of the following states:</p>
            <div className="grid sm:grid-cols-3 gap-3 my-6">
              {[
                { s: "Generated", d: "Created from a finalized payrun. Not yet sent to the employee." },
                { s: "Sent", d: "Delivered to the employee, who is notified in the app." },
                { s: "Acknowledged", d: "The employee has confirmed they received it." },
              ].map((row) => (
                <div key={row.s} className="border border-gray-200 rounded-md p-3">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{row.s}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{row.d}</p>
                </div>
              ))}
            </div>
            <Callout kind="note" title="State changes are one-directional">
              A payslip moves from Generated to Sent to Acknowledged and never backwards.
              The only way to return a payslip to Generated is to regenerate it, which
              clears its sent time and stored PDF path.
            </Callout>
          </Section>

          <Section id="generating" title="Generating payslips" eyebrow="Working with payslips">
            <p>
              Payslips can only be generated from a payrun whose status is{" "}
              <strong>finalized</strong>. Generating from any other payrun is rejected.
            </p>
            <p>When you generate, PayKe:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Creates a payslip for every employee in the payrun, or only the employees you select.</li>
              <li>
                Assigns each payslip a number in the format{" "}
                <InlineCode>PAYSLIP-2026-10-EMP133</InlineCode> (year, month of the pay
                period, then the employee ID).
              </li>
              <li>Skips employees who already have a payslip for that payrun, so running it twice is safe.</li>
              <li>Carries on if one employee fails, and reports the failures at the end.</li>
            </ul>
            <CodeBlock>{`POST /api/v1/organizations/{org_id}/payruns/{payrun_id}/payslips/generate
{
  "employee_ids": [133, 134],   // optional, defaults to everyone in the payrun
  "regenerate": false            // optional
}

→ 201 Created
  { "generated": 12, "skipped": 1, "errors": [] }`}</CodeBlock>
            <Callout kind="warning" title="Regenerating resets the payslip">
              Setting <InlineCode>regenerate</InlineCode> to true rebuilds an existing
              payslip and puts it back to Generated, even if it was already sent or
              acknowledged. The employee is not notified, so send it again afterwards.
            </Callout>
          </Section>

          <Section id="sending" title="Sending to employees">
            <p>
              A payslip becomes visible as sent once you send it. You can send one at a
              time, or send every generated payslip in a payrun in a single action.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Send</strong> works on one payslip and requires its status to be
                Generated.
              </li>
              <li>
                <strong>Bulk send</strong> sends all Generated payslips in the payrun at
                once. If there is nothing left to send, you are told so.
              </li>
            </ul>
            <p>
              Both actions record the sent time and notify each employee. On the
              Payslips page, a confirmation dialog appears before anything is sent.
            </p>
            <CodeBlock>{`POST /api/v1/organizations/{org_id}/payruns/{payrun_id}/payslips/bulk-send

→ 200 OK
  { "sent_count": 12, "payslip_ids": [15, 16, 17] }`}</CodeBlock>
          </Section>

          <Section id="viewing" title="Viewing & downloading">
            <p>
              Payroll staff see payslips on the <InlineCode>Payslips</InlineCode> page,
              which shows summary cards (total payslips, gross pay, net pay, and counts
              by status) above a table. You can filter by status, month and year, and
              open any row to see the full breakdown.
            </p>
            <p>
              Employees see only their own payslips on{" "}
              <InlineCode>My Payslips</InlineCode>, filtered by year and status.
            </p>
            <p>
              Downloading opens a print-ready payslip in a new window. Choose{" "}
              <strong>Save as PDF</strong> in your browser's print dialog to keep a copy.
              Your browser must allow pop-ups for PayKe for this to open.
            </p>
            <Callout kind="note" title="Name search covers the current page">
              The search box on the Payslips page filters the rows already loaded. To
              find someone on another page, narrow the list with the status, month or
              year filters first.
            </Callout>
          </Section>

          <Section id="acknowledging" title="Acknowledgement">
            <p>
              Once a payslip is Sent, the employee can acknowledge it to confirm
              receipt. Only the employee the payslip belongs to can acknowledge it, no
              matter what role anyone else holds, and only payslips in the Sent state
              can be acknowledged.
            </p>
            <p>
              Acknowledged payslips are counted separately in the summary cards, so
              payroll can see at a glance who has not yet confirmed.
            </p>
          </Section>

          <Section id="permissions" title="Who can do what" eyebrow="Access">
            <p>
              Access depends on the user's role. Every request is also limited to the
              user's own organisation.
            </p>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-semibold">Role</th>
                    <th className="px-4 py-2 font-semibold">Can see</th>
                    <th className="px-4 py-2 font-semibold">Can do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["Admin", "All payslips in the organisation", "Generate, send, bulk send, store PDF path, statistics"],
                    ["Payroll manager", "All payslips in the organisation", "Generate, send, bulk send, store PDF path, statistics"],
                    ["Payroll officer", "Own department", "Generate, send, store PDF path"],
                    ["HR manager", "Own department", "View, statistics"],
                    ["HR officer", "Own department", "View, send"],
                    ["Finance manager", "All payslips in the organisation", "View, statistics"],
                    ["Auditor", "All payslips, read-only", "View, statistics"],
                    ["Department manager", "Own and direct reports", "View"],
                    ["Employee", "Own payslips only", "View, acknowledge"],
                  ].map(([role, see, can]) => (
                    <tr key={role}>
                      <td className="px-4 py-2 font-medium text-gray-800">{role}</td>
                      <td className="px-4 py-2 text-gray-500">{see}</td>
                      <td className="px-4 py-2 text-gray-500">{can}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              "Own department" means employees who share the user's department.
              "Direct reports" means employees who report to that manager. Every role
              except Auditor can acknowledge its own payslips, and super admins have
              read-only access across organisations.
            </p>
          </Section>

          <Section id="notifications" title="Notifications">
            <p>
              Each time a payslip is sent, whether singly or in bulk, PayKe adds an
              in-app notification for that employee: "Your payslip has been sent and is
              ready to view". The notification links back to the payslip.
            </p>
            <p>
              A notification problem never blocks sending. If the notification cannot be
              created, the payslip is still marked as sent.
            </p>
          </Section>

          <Section id="contents" title="What a payslip shows" eyebrow="Reference">
            <p>Every payslip is built from the payrun calculation and includes:</p>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-semibold">Section</th>
                    <th className="px-4 py-2 font-semibold">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">Header</td>
                    <td className="px-4 py-2 text-gray-500">Payslip number, status, pay period, pay frequency, employee name, number and email</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">Earnings</td>
                    <td className="px-4 py-2 text-gray-500">Basic salary, overtime, bonus, commission, gross pay</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">Deductions</td>
                    <td className="px-4 py-2 text-gray-500">NSSF, SHIF, Housing Levy, PAYE, total deductions</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">Tax summary</td>
                    <td className="px-4 py-2 text-gray-500">Taxable income, tax before relief, personal relief</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-gray-800">Net pay</td>
                    <td className="px-4 py-2 text-gray-500">Take-home amount in KES</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              The printed payslip hides any earnings or deduction line whose amount is
              zero, and formats every amount as Kenyan shillings.
            </p>
            <Callout kind="note" title="Total deductions can be higher than the lines shown">
              The Total Deductions figure includes every deduction applied in the
              payrun. Payslips currently itemise only NSSF, SHIF, Housing Levy and
              PAYE, so other deductions, such as loan or advance recoveries, are
              reflected in the total and in net pay but not listed as their own line.
            </Callout>
          </Section>

          <Section id="api" title="API endpoints">
            <p>
              All endpoints live under <InlineCode>/api/v1</InlineCode>, require
              authentication, and return the standard response envelope with{" "}
              <InlineCode>success</InlineCode>, <InlineCode>data</InlineCode> and{" "}
              <InlineCode>message</InlineCode>.
            </p>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2 font-semibold">Method</th>
                    <th className="px-4 py-2 font-semibold">Path</th>
                    <th className="px-4 py-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 align-top">
                  {[
                    ["GET", "/organizations/{org_id}/payslips", "List payslips with filters and summary statistics"],
                    ["GET", "/organizations/{org_id}/payslips/statistics", "Totals grouped by year"],
                    ["GET", "/organizations/{org_id}/payslips/{id}", "Fetch one payslip"],
                    ["POST", "/organizations/{org_id}/payslips/{id}/acknowledge", "Employee confirms receipt"],
                    ["PATCH", "/organizations/{org_id}/payslips/{id}/pdf-path", "Store a PDF path for a payslip"],
                    ["GET", "/organizations/{org_id}/employees/{id}/payslips", "One employee's payslip history"],
                    ["GET", "/organizations/{org_id}/payruns/{payrun_id}/payslips", "Payslips in one payrun"],
                    ["POST", "/organizations/{org_id}/payruns/{payrun_id}/payslips/generate", "Generate payslips"],
                    ["POST", "/organizations/{org_id}/payruns/{payrun_id}/payslips/bulk-send", "Send all generated payslips"],
                    ["POST", "/organizations/{org_id}/payruns/{payrun_id}/payslips/{id}/send", "Send one payslip"],
                  ].map(([method, path, purpose]) => (
                    <tr key={method + path}>
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-800">{method}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600 break-all">{path}</td>
                      <td className="px-4 py-2 text-gray-500">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>The list endpoint accepts these query parameters:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><InlineCode>page</InlineCode> and <InlineCode>per_page</InlineCode> (default 10, maximum 100)</li>
              <li><InlineCode>status</InlineCode>: <InlineCode>generated</InlineCode>, <InlineCode>sent</InlineCode> or <InlineCode>acknowledged</InlineCode></li>
              <li><InlineCode>payrun_id</InlineCode> and <InlineCode>employee_id</InlineCode></li>
              <li><InlineCode>month</InlineCode> (1 to 12) and <InlineCode>year</InlineCode>, matched against the pay period start</li>
            </ul>
            <CodeBlock>{`GET /api/v1/organizations/1/payslips?status=sent&year=2026&per_page=20

→ 200 OK
  {
    "success": true,
    "data": [ { "payslip_id": 15, "payslip_number": "PAYSLIP-2026-10-EMP133", "status": "sent", ... } ],
    "metadata": {
      "pagination": { "current_page": 1, "per_page": 20, "total": 42, "total_pages": 3 },
      "statistics": { "total_payslips": 42, "total_gross_pay": 0, "total_net_pay": 0,
                      "by_status": { "generated": 0, "sent": 42, "acknowledged": 0 } }
    }
  }`}</CodeBlock>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  "Payslips can only be generated from a finalized payrun"
                </p>
                <p>
                  The payrun has not been finalized yet. Complete the payrun workflow,
                  then generate again.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  "Only payslips with status 'generated' can be sent"
                </p>
                <p>
                  The payslip was already sent or acknowledged. Check its status on the
                  Payslips page. To send it again, regenerate it first.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  "No payslips with status 'generated' found in this payrun"
                </p>
                <p>
                  Everything in the payrun has already been sent. Nothing needs to be
                  done.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Download does not open
                </p>
                <p>
                  The payslip opens in a new window, which browsers often block. Allow
                  pop-ups for PayKe and try again.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  "Access denied to this payslip" (403)
                </p>
                <p>
                  The payslip is outside your scope, for example a different department
                  or a person who does not report to you. Ask an administrator if you
                  need wider access.
                </p>
              </div>
            </div>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Can I generate payslips for just some employees?
                </p>
                <p>
                  Yes. Pass a list of <InlineCode>employee_ids</InlineCode> when
                  generating and only those employees are processed.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  What happens if I generate twice?
                </p>
                <p>
                  Existing payslips are skipped and reported in the{" "}
                  <InlineCode>skipped</InlineCode> count, so nothing is duplicated.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Can an employee see someone else's payslip?
                </p>
                <p>
                  No. Employees can only open their own payslips, and every request is
                  also limited to their organisation.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">
                  Who can send payslips in bulk?
                </p>
                <p>Admins and payroll managers. Other roles that can send do so one payslip at a time.</p>
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