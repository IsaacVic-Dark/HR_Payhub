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
      { id: "what-is-recorded", label: "What an entry contains" },
      { id: "access", label: "Who can see it" },
    ],
  },
  {
    title: "Using the page",
    items: [
      { id: "log-table", label: "Reading the log" },
      { id: "filtering", label: "Searching & filtering" },
      { id: "entry-details", label: "Opening an entry" },
      { id: "reading-changes", label: "Reading changes" },
      { id: "sharing-links", label: "Linking to an entry" },
    ],
  },
  {
    title: "What is tracked",
    items: [
      { id: "tracked-modules", label: "Modules & record types" },
      { id: "actions", label: "Actions & colours" },
    ],
  },
  {
    title: "Reference",
    items: [
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

export default function AuditLogsDocsPage() {
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
            Audit logs
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
            How PayKe records and reviews audit logs
          </h1>
          <p className="text-gray-500 text-[15px] leading-7 mb-10">
            The audit log is PayKe’s record of who changed what, and when, across your
            organisation. This page explains what each entry contains, who can see the log,
            how to search and filter it, how to read the changes inside an entry, and which
            parts of PayKe write to it today.
          </p>

          <Section id="introduction" title="Introduction">
            <p>
              Whenever someone in your organisation takes an important action, such as
              finalizing a payrun, approving a reimbursement or changing a department,
              PayKe writes one entry to the audit log. Each entry says who did it, what they
              did, which record it applied to and, where relevant, what the record looked like
              before and after.
            </p>
            <p>
              You can find it under <strong>Audit Logs</strong> in the dashboard
              (<InlineCode>/audit-logs</InlineCode>). The page is read-only: you can search,
              filter and inspect entries, but there is no way to edit or remove them from the
              app.
            </p>
            <Callout kind="note" title="Newest first">
              Entries are always listed with the most recent at the top. Entries recorded in
              the same second are ordered by their internal ID, so the order is stable between
              refreshes.
            </Callout>
          </Section>

          <Section id="what-is-recorded" title="What an entry contains" eyebrow="Getting started">
            <p>Every audit log entry carries the same core fields:</p>
            <Table
              head={["Field", "What it tells you"]}
              rows={[
                ["When", "The date and time the action was recorded, shown as dd MMM yyyy and HH:mm:ss."],
                ["User", "The person who performed the action: their name, email and role."],
                ["Action", "What happened, for example Create, Finalize or Advance Approved."],
                ["Record type", "The kind of record affected, such as Payrun, Department or Reimbursement."],
                ["Record", "The affected record’s name and its numeric ID, for example “November 2026 Payrun · #7”."],
                ["Details", "A snapshot of the relevant fields. Depending on the module this is either a before/after comparison or a simple list of values."],
              ]}
            />
            <p>
              The user’s name comes from their employee profile. If the user has no employee
              profile, PayKe falls back to their username, then their email, then{" "}
              <InlineCode>User #id</InlineCode>.
            </p>
          </Section>

          <Section id="access" title="Who can see it">
            <p>
              Audit logs are visible to <strong>organisation admins only</strong>. The
              restriction is enforced in two places: the page redirects anyone else to the{" "}
              <InlineCode>/unauthorized</InlineCode> screen, and the API refuses their requests
              with a <InlineCode>403</InlineCode> even if they call it directly.
            </p>
            <Table
              head={["Role", "Audit Logs"]}
              rows={[
                ["Admin", "Full read access to your organisation’s log"],
                ["HR manager, payroll manager, payroll officer, finance manager, department manager, employee", "No access"],
                ["Auditor", "No access to this page"],
                ["Super admin (platform)", "No access: platform administrators do not see organisation data"],
              ]}
            />
            <p>
              Every request is also scoped to the organisation in your session. An admin can
              only read entries that belong to their own organisation.
            </p>
          </Section>

          <Section id="log-table" title="Reading the log" eyebrow="Using the page">
            <p>The main table has four columns plus a view button on each row:</p>
            <Table
              head={["Column", "Shows"]}
              rows={[
                ["When", "Date on the first line, time on the second."],
                ["User", "The person’s name, with their role underneath."],
                ["Action", "A coloured badge with the action in plain words, e.g. “Advance Recovery Attached”."],
                ["Record", "The record’s name, with its type and ID underneath. If PayKe cannot find a name it shows the type and ID, e.g. “Payrun #12”."],
              ]}
            />
            <p>
              The table shows 10 entries per page by default. Use the page-size control at the
              bottom to change it; the API allows up to 100 per page. Use{" "}
              <strong>Refresh</strong> to reload the entries and the filter lists after new
              activity.
            </p>
          </Section>

          <Section id="filtering" title="Searching & filtering">
            <p>
              Use the search box and the filter panel together. Every change returns you to
              page 1 so you never land on an empty page.
            </p>
            <Steps
              items={[
                { t: "Search", d: "Type in the search box. Results update about half a second after you stop typing." },
                { t: "Open the filters", d: "Click Filters to show or hide the panel. It is open by default." },
                { t: "Narrow down", d: "Choose an Action, a Record Type, a User and/or a Date Range. Filters combine, so an entry must match all of them." },
                { t: "Clear", d: "Click Clear Filters to reset the search and every filter at once." },
              ]}
            />
            <Table
              head={["Filter", "How it works"]}
              rows={[
                ["Search", "Matches the user’s name, username or email; the record type; the action; the record ID; and any text inside the entry’s details."],
                ["Action", "Exact action. The list only contains actions that actually appear in your log."],
                ["Record Type", "Exact record type, such as Payrun or Department. Also limited to types present in your log."],
                ["User", "Everyone who has at least one entry in your log, listed by name."],
                ["Date Range", "Inclusive of both days. Clicking a single day means that day only. Future dates cannot be selected."],
              ]}
            />
            <Callout kind="note" title="Search looks inside details">
              Because search also reads the stored details, you can find an entry by a value that
              changed, such as a payrun name, an advance number or a rejection reason, even if it
              is not visible in the table.
            </Callout>
          </Section>

          <Section id="entry-details" title="Opening an entry">
            <p>
              Click the eye icon on any row to open the entry in a side drawer. The drawer is
              titled <strong>Audit Log #id</strong> and shows the exact time of the event. It is
              split into sections:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Event</strong>: the action badge, the record type, the record’s name and
                ID, and the internal record-type key (for example{" "}
                <InlineCode>payruns</InlineCode>).
              </li>
              <li>
                <strong>Performed By</strong>: the user’s name, email, role and user ID.
              </li>
              <li>
                <strong>Changes</strong> or <strong>Details</strong>: what was recorded for the
                event. See the next section.
              </li>
              <li>
                <strong>Raw JSON</strong>: a toggle that reveals the stored details exactly as
                saved, with a Copy button.
              </li>
            </ul>
            <p>
              If the record has since been deleted, the drawer shows the name that was saved in
              the entry itself and notes that the record may no longer exist.
            </p>
          </Section>

          <Section id="reading-changes" title="Reading changes">
            <p>
              Different modules record different amounts of information, so the drawer presents
              details in one of three ways.
            </p>
            <Table
              head={["Layout", "When you see it", "What it looks like"]}
              rows={[
                ["Changes (before / after)", "Entries that store both old and new data, currently organisation configuration records.", "One row per field. Changed values show the old value in red, an arrow, then the new value in green."],
                ["Details (list)", "Every other module.", "A simple list of the fields that were recorded, such as a reason, an amount or a payrun ID."],
                ["No details", "Events with nothing extra to record.", "A note saying no additional details were recorded."],
              ]}
            />
            <p>In the before / after layout:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Created</strong> records list every field in green.</li>
              <li><strong>Deleted</strong> records list the final values in red.</li>
              <li>
                <strong>Updated</strong> records list only the fields that were submitted.
                Fields that were submitted but ended up with the same value are hidden behind a{" "}
                <em>Show unchanged fields</em> link.
              </li>
              <li>
                Numbers are compared by value, so <InlineCode>5.00</InlineCode> and{" "}
                <InlineCode>5</InlineCode> are not flagged as a change.
              </li>
            </ul>
            <CodeBlock>{`// Before / after layout (organisation configuration)
{
  "action": "update",
  "timestamp": "2026-11-09 10:42:17",
  "user_id": 4,
  "new_data": { "...only the submitted fields..." },
  "old_data": { "...the full previous record..." }
}

// List layout (most other modules)
{ "reason": "Duplicate request", "stage": "hr" }`}</CodeBlock>
            <Callout kind="note" title="Field names are tidied for display">
              Stored names such as <InlineCode>advance_number</InlineCode> are shown as “Advance
              Number”. Empty values appear as a dash, true/false as Yes/No, and nested values as
              formatted JSON.
            </Callout>
          </Section>

          <Section id="sharing-links" title="Linking to an entry">
            <p>
              Opening an entry adds it to the page address, in the form{" "}
              <InlineCode>/audit-logs?drawer=view&amp;id=123</InlineCode>. Copy that address to
              send a colleague straight to the same entry. If the entry is not on the page that
              is currently loaded, PayKe fetches it by its ID, so the link still works. Closing
              the drawer removes it from the address.
            </p>
            <p>
              The recipient must still be an admin of the same organisation to see it.
            </p>
          </Section>

          <Section id="tracked-modules" title="Modules & record types" eyebrow="What is tracked">
            <p>
              These are the parts of PayKe that write to the audit log today. Record types are
              what you will see in the Record Type filter.
            </p>
            <Table
              head={["Module", "Record type", "Events recorded"]}
              rows={[
                ["Departments", "Department", "Created, updated, deleted, and department-head changes."],
                ["Job titles", "Job Title", "Created, updated, deleted."],
                ["Payruns", "Payrun, Payrun Details", "Created, updated, reviewed, reopened, finalized, deleted; next-month draft auto-created; carry-forward applied; off-cycle adjustments linked; processing results."],
                ["Overtime approvals", "Overtime Approval", "Locked-period detected, carry-forward queued. Related payrun effects are logged against the payrun."],
                ["Reimbursements", "Reimbursement", "Submission, policy validation or failure, updates, stage approvals, rejection, cancellation, disputes, scheduling, payment and reversal."],
                ["Salary advances", "Advance", "Full lifecycle from creation to repayment: submission, policy checks, approval or rejection, disbursement, recovery and reversal."],
                ["Organisation configuration", "Org Config", "Created, updated, deleted, approved, rejected."],
                ["Payslip templates", "Document Template", "Created, updated, activated, archived, previewed."],
                ["Payslip generation", "Payrun", "Payslips generated, payslip regenerated, access denied."],
              ]}
            />
            <Callout kind="warning" title="Not every module is covered yet">
              Employees, attendance, leave, loans, allowances and user management do not
              currently write to this log. If you cannot find an event from one of those areas,
              it was not recorded here.
            </Callout>
          </Section>

          <Section id="actions" title="Actions & colours">
            <p>
              Actions are shown in plain words and colour-coded so you can scan the log quickly.
              The colour is a hint based on the action’s name; it is not a status.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 my-6">
              {[
                { cls: "bg-green-100 text-green-800", name: "Green", d: "Something was created, submitted, approved, finalized or paid." },
                { cls: "bg-blue-100 text-blue-800", name: "Blue", d: "Something was updated, reviewed, reopened, partially approved, carried forward or linked." },
                { cls: "bg-purple-100 text-purple-800", name: "Purple", d: "Money movement: payments, scheduling, disbursements, recoveries and payouts." },
                { cls: "bg-amber-100 text-amber-800", name: "Amber", d: "A policy check ran or was validated." },
                { cls: "bg-red-100 text-red-800", name: "Red", d: "Deleted, rejected, failed, cancelled, reversed, disputed, detached, skipped or locked." },
                { cls: "bg-gray-100 text-gray-800", name: "Grey", d: "Anything else, such as template archives or access denied." },
              ].map((c) => (
                <div key={c.name} className="border border-gray-200 rounded-md p-3">
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md mb-2 ${c.cls}`}>
                    {c.name}
                  </span>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.d}</p>
                </div>
              ))}
            </div>
            <Table
              head={["Group", "Actions"]}
              rows={[
                ["General", "Create, Update, Delete, Review, Finalize, Reopen, Approve, Reject, Bootstrap Create"],
                ["Payruns", "Auto Create, Carry Forward Applied, Carry Forward Queued, Off Cycle Adjustment Linked, Locked Period Detected"],
                ["Reimbursements", "Submit, Policy Validated, Policy Failed, Manager / HR / Finance Approved, Partially Approved, Rejected, Cancelled, Disputed, Scheduled, Payment Initiated, Paid, Payment Failed, Reversed"],
                ["Salary advances", "Advance Created, Submitted, Policy Validated, Policy Failed, Approved, Rejected, Cancelled, Disbursed, Recovery Attached / Detached / Processed / Skipped, Partially Recovered, Repaid, Manual Repayment, Payout Scheduled / Detached, Reversed"],
                ["Templates & payslips", "Template Created, Updated, Activated, Archived, Previewed, Payslips Generated, Payslip Regenerated, Access Denied"],
              ]}
            />
          </Section>

          <Section id="api" title="API endpoints" eyebrow="Reference">
            <p>
              The audit log is read-only. All three endpoints require a signed-in organisation
              admin and only return entries for the organisation in the URL.
            </p>
            <CodeBlock>{`GET /api/v1/organizations/{org_id}/audit-logs
    ?entity_type=payruns
    &entity_id=7
    &action=finalize
    &user_id=4
    &date_from=2026-11-01
    &date_to=2026-11-30
    &search=november
    &page=1
    &per_page=10          (max 100)

→ 200 OK
  { "data": [ { "id": 981, "user_id": 4, "entity_type": "payruns", "entity_id": 7,
                "entity_name": "November 2026 Payrun", "action": "finalize",
                "details": { ... }, "created_at": "2026-11-30 17:05:12",
                "user_full_name": "Jane Wanjiru", "user_email": "jane@example.com",
                "user_role": "admin" } ],
    "metadata": { "pagination": { "current_page": 1, "per_page": 10, "total": 1,
                                   "total_pages": 1, "has_next": false, "has_prev": false } } }`}</CodeBlock>
            <Table
              head={["Endpoint", "Purpose"]}
              rows={[
                [<InlineCode key="a">GET …/audit-logs</InlineCode>, "Paged list with all of the filters above. All filters are optional and combine."],
                [<InlineCode key="b">GET …/audit-logs/{"{id}"}</InlineCode>, "A single entry, used when opening a shared link."],
                [<InlineCode key="c">GET …/audit-logs/filters</InlineCode>, "The distinct actions, record types and users in your log, used to fill the filter dropdowns."],
              ]}
            />
            <p>Invalid filter values are rejected with <InlineCode>422</InlineCode>:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><InlineCode>entity_id</InlineCode> and <InlineCode>user_id</InlineCode> must be whole numbers.</li>
              <li><InlineCode>date_from</InlineCode> and <InlineCode>date_to</InlineCode> must be real dates in <InlineCode>YYYY-MM-DD</InlineCode> format. The end date is inclusive.</li>
            </ul>
            <p>
              Other responses: <InlineCode>401</InlineCode> when not signed in,{" "}
              <InlineCode>403</InlineCode> for non-admins or another organisation’s data, and{" "}
              <InlineCode>404</InlineCode> when the organisation or entry does not exist.
            </p>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-5">
              {[
                {
                  q: "I’m sent to the Unauthorized page.",
                  a: "Only organisation admins can open Audit Logs. Ask an admin in your organisation to check the log for you, or to review your role.",
                },
                {
                  q: "The filter dropdowns are empty.",
                  a: "They only list values that exist in your log, so a brand-new organisation will have none. If you expect values, click Refresh to reload them.",
                },
                {
                  q: "A row shows “Payrun #12” instead of a name.",
                  a: "The record was deleted, or its type has no name lookup. Open the entry: if a name was saved in the details, the drawer shows it there.",
                },
                {
                  q: "I can’t find an event I expected.",
                  a: "Check the Modules & record types list: some areas, such as employees and leave, are not recorded yet. Also clear all filters and widen the date range, because filters combine.",
                },
                {
                  q: "The date range shows nothing.",
                  a: "Both days are included, and future dates are disabled. For a single day, click it once.",
                },
                {
                  q: "An entry says no details were recorded.",
                  a: "Some events, such as deleting a job title, only record the fact that they happened. The who, what and when are still shown.",
                },
              ].map((item) => (
                <div key={item.q}>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{item.q}</p>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Who can view audit logs?</p>
                <p>Organisation admins only. Other roles, including auditors and platform super admins, cannot open the page or call the API.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Can I edit or delete an entry?</p>
                <p>No. The app and API only offer read access to audit logs.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Can I export the log?</p>
                <p>Not from the Audit Logs page. You can copy the raw JSON of an individual entry from its drawer.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Why is a user shown as “User #8”?</p>
                <p>That account has no name, username or email PayKe can display. The ID still identifies them.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">What time zone are the times in?</p>
                <p>Times are shown as they were stored when the event was recorded.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Does a deleted record disappear from the log?</p>
                <p>No. Its entries remain, including the deletion itself, and the Record column falls back to the name saved at the time or to the type and ID.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Where do I see the history of a single payrun?</p>
                <p>Set Record Type to Payrun and search for the payrun’s name or ID, or use the API’s <InlineCode>entity_type</InlineCode> and <InlineCode>entity_id</InlineCode> filters.</p>
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