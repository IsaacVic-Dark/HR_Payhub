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
      { id: "lifecycle", label: "Template lifecycle" },
      { id: "versions", label: "Versions & live changes" },
    ],
  },
  {
    title: "Managing templates",
    items: [
      { id: "templates-list", label: "The Templates page" },
      { id: "creating", label: "Creating a template" },
      { id: "editing", label: "Editing & saving drafts" },
      { id: "previewing", label: "Previewing" },
      { id: "activating", label: "Activating" },
      { id: "archiving", label: "Archiving & restoring" },
    ],
  },
  {
    title: "Customising a payslip",
    items: [
      { id: "layouts", label: "Layouts" },
      { id: "branding", label: "Logo, colours & footer" },
      { id: "sections", label: "Sections & visibility" },
      { id: "labels", label: "Labels" },
      { id: "validation", label: "Limits & validation" },
    ],
  },
  {
    title: "Payslips",
    items: [
      { id: "generation", label: "How payslips use a template" },
      { id: "regenerating", label: "Regenerating payslips" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "access", label: "Access & security" },
      { id: "api", label: "API reference" },
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

function Swatch({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3.5 h-3.5 rounded-full border border-gray-200"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-xs">{color}</span>
    </span>
  );
}

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-gray-900 text-sm mb-1">{q}</p>
      <p>{children}</p>
    </div>
  );
}

export default function TemplatesDocsPage() {
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
            Payslip templates
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
            How PayKe handles payslip templates
          </h1>
          <p className="text-gray-500 text-[15px] leading-7 mb-10">
            Templates control how your payslips look: the layout, your logo and colours, which
            sections appear and the wording used. This page explains how to create, preview and
            activate a template, how versions protect payslips you have already issued, and what a
            template can and cannot change.
          </p>

          <Section id="introduction" title="Introduction">
            <p>
              Every organisation has a payslip template. When you first open the Templates page,
              PayKe creates one for you automatically — <strong>Default Modern</strong>, using your
              company logo — and makes it active, so payslips can be generated from day one. You can
              leave it as it is, or build your own and switch to it whenever you are ready.
            </p>
            <p>
              A template changes <strong>presentation only</strong>. Payroll figures — gross pay,
              statutory deductions, net pay — always come from the payrun and are never altered by a
              template. Hiding a section, renaming a label or changing a colour cannot change what an
              employee is paid.
            </p>
            <Callout kind="note" title="Payslip templates today">
              Payslips are the only document type that can be customised at the moment. The
              Templates page lists and manages payslip templates only.
            </Callout>
          </Section>

          <Section id="lifecycle" title="Template lifecycle" eyebrow="Overview">
            <p>A template is always in exactly one of these states:</p>
            <div className="grid sm:grid-cols-3 gap-3 my-6">
              {[
                { s: "Draft", d: "A work in progress. It can be edited, previewed and archived, but is not used for any payslip yet." },
                { s: "Active", d: "The template payslips are generated from. There is only ever one active payslip template per organisation." },
                { s: "Archived", d: "Retired. It cannot be edited, but it can be restored by activating it again." },
              ].map((row) => (
                <div key={row.s} className="border border-gray-200 rounded-md p-3">
                  <p className="text-sm font-semibold text-gray-900 mb-1">{row.s}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{row.d}</p>
                </div>
              ))}
            </div>
            <CodeBlock>{`draft ──activate──▶ active ──another template activated──▶ archived
  │                                                         │
  └──────────── archive ───────────────────────────────────▶│
  ▲                                                         │
  └──────────────── activate (restore) ◀────────────────────┘`}</CodeBlock>
            <p>
              Activating a template automatically archives the one that was active before it, so
              there is never more than one live template. The active template cannot be archived
              directly — activate a different one first.
            </p>
          </Section>

          <Section id="versions" title="Versions & live changes">
            <p>
              PayKe keeps two things for every template: the <strong>working copy</strong> you edit,
              and a series of <strong>versions</strong> — unchangeable snapshots of how the template
              looked each time it was activated.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Payslips are always generated from the <strong>active version</strong>, never from the working copy.</li>
              <li>Saving an active template only changes the working copy. New payslips keep using the active version until you activate again.</li>
              <li>Each activation saves a new version (Version 1, 2, 3 …). Versions are never edited or deleted.</li>
              <li>Every payslip remembers the template and version it was generated with.</li>
            </ul>
            <p>
              When an active template has saved changes that are not live yet, the Templates page
              shows an <strong>Unactivated changes</strong> badge next to its name. Saved changes
              are not used for new payslips until the template is activated.
            </p>
            <Callout kind="note" title="Payslips you have already issued do not change">
              Editing or replacing a template never rewrites a payslip that already exists. Each
              keeps the design it was created with, unless you explicitly regenerate it (see{" "}
              <a href="#regenerating" className="font-medium underline" style={{ color: PURPLE }}>
                Regenerating payslips
              </a>
              ).
            </Callout>
          </Section>

          <Section id="templates-list" title="The Templates page" eyebrow="Managing templates">
            <p>
              Open <strong>Templates</strong> from the dashboard to see every payslip template in your
              organisation. Each row shows:
            </p>
            <Table
              head={["Column", "What it shows"]}
              rows={[
                ["Type", "The document type. Currently always Payslip."],
                ["Name", "The template name. Select it to open the editor. An Unactivated changes badge appears here when saved edits are not live."],
                ["Layout", "Modern, Classic or Minimal."],
                ["Status", "Draft, Active or Archived."],
                ["Active version", "The version payslips are generated from, for example v3. Shown as a dash when the template has never been activated."],
                ["Last updated", "When the template was last saved or activated."],
              ]}
            />
            <p>The action buttons at the end of each row are:</p>
            <Table
              head={["Action", "When it appears"]}
              rows={[
                ["Edit (or View)", "Always. Archived templates open read-only."],
                ["Preview", "Always. Shows the saved version of the template."],
                ["Activate / Restore & activate", "On drafts and archived templates, and on an active template that has unactivated changes."],
                ["Archive", "On draft templates only."],
              ]}
            />
          </Section>

          <Section id="creating" title="Creating a template">
            <p>
              Select <strong>New Template</strong>. Pick a layout, give the template a name and
              adjust it using the editor tabs. Nothing is live while you work.
            </p>
            <Steps
              items={[
                { t: "Name it and choose a layout", d: "On the General tab, enter a unique name (for example “Standard Payslip 2026”) and pick Modern, Classic or Minimal." },
                { t: "Brand it", d: "On the Branding tab, choose a logo, set the primary and accent colours and write the footer text." },
                { t: "Choose what appears", d: "On the Sections tab, switch optional sections on or off and set the order of earnings and deductions." },
                { t: "Reword it", d: "On the Labels tab, change any wording you want to see on the payslip." },
                { t: "Save the draft", d: "Select Save Draft. The template is created as a draft. Once it is saved you can preview it against sample or real payroll data." },
              ]}
            />
            <p>
              A template name must be unique within your organisation. Saving a name that is already
              taken is rejected with “A template with this name already exists”.
            </p>
          </Section>

          <Section id="editing" title="Editing & saving drafts">
            <p>
              The editor has up to five tabs: <strong>General</strong>, <strong>Branding</strong>,{" "}
              <strong>Sections</strong>, <strong>Labels</strong> and, for a saved template,{" "}
              <strong>History</strong>. The live preview sits beside the form and follows your
              changes as you make them.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Save Draft</strong> is enabled only when something has changed. If you try to
                leave the page with unsaved changes, the browser asks you to confirm.
              </li>
              <li>
                Fields are checked as you type. If a save is rejected, the editor highlights the
                fields at fault and opens the tab that contains the first error.
              </li>
              <li>
                <strong>Activate Template</strong> is disabled while you have unsaved changes or
                validation errors — save first, then activate.
              </li>
              <li>
                Editing the active template shows a “This is your live template” notice: changes are
                saved as a draft and do not affect new payslips until you activate.
              </li>
              <li>An archived template is read-only. Restore it to make it active again.</li>
            </ul>
            <p>
              The <strong>History</strong> tab lists every version with its number, who activated it,
              when, and which one is currently in use.
            </p>
          </Section>

          <Section id="previewing" title="Previewing">
            <p>
              Previewing shows exactly how a payslip will look, and it <strong>never saves anything</strong>
              — no payslip record is created, no PDF is stored and no status changes. You can preview
              from the editor (including changes you have not saved yet) or from the preview button
              on the Templates page, which shows the saved template.
            </p>
            <Table
              head={["Preview data", "What you see"]}
              rows={[
                ["Sample data", "A made-up employee and payrun. The page carries a SAMPLE DATA ribbon so it can never be mistaken for a real payslip."],
                ["A real payrun and employee", "A real employee's figures from one of your 24 most recent payruns. If a payslip already exists for that employee, its payslip number is reused so the preview matches it."],
              ]}
            />
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The on-screen preview refreshes automatically a moment after you stop typing. Use <strong>Refresh</strong> to reload it yourself.</li>
              <li><strong>Preview PDF</strong> opens the real A4 PDF in a new tab, so you can check the final result before activating.</li>
              <li>
                Previewing is limited to 30 requests a minute. If you go faster, the preview pauses
                with a short countdown and resumes by itself.
              </li>
            </ul>
            <Callout kind="note" title="Who can preview which employees">
              Admins and payroll managers can preview any employee in the organisation. A payroll
              officer can only preview employees in their own department.
            </Callout>
          </Section>

          <Section id="activating" title="Activating">
            <p>
              Activating makes a template the one that new payslips are generated from. PayKe checks
              the template again first, and refuses to activate one that is invalid. In one step it:
            </p>
            <Steps
              items={[
                { t: "Snapshots the template", d: "The current working copy is saved as a new, unchangeable version." },
                { t: "Archives the previous template", d: "Whichever template was active before becomes archived, so only one is ever live." },
                { t: "Points payslip generation at the new version", d: "Payslips generated from now on use it." },
              ]}
            />
            <p>
              Payslips that were already generated are not affected. If you activate a template that
              is already active and has no unactivated changes, nothing happens and PayKe tells you
              so.
            </p>
            <Callout kind="note" title="Activating your changes to a live template">
              Activating an active template that has pending changes saves a new version of the same
              template. It does not archive anything, and the confirmation reads “Activate your
              changes?”.
            </Callout>
          </Section>

          <Section id="archiving" title="Archiving & restoring">
            <p>
              Archive a draft you no longer need to remove it from everyday use. Archived templates
              stay in the list, and payslips already generated with them are not affected.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Only draft templates show the Archive button.</li>
              <li>The active template cannot be archived. Activate another template first — the old one is archived for you.</li>
              <li>An archived template cannot be edited. Use <strong>Restore &amp; activate</strong> to bring it back; it becomes the active template and the current one is archived.</li>
            </ul>
          </Section>

          <Section id="layouts" title="Layouts" eyebrow="Customising a payslip">
            <p>
              The layout sets the overall structure of the payslip. Each layout comes with its own
              default colours, which are used whenever you have not chosen your own.
            </p>
            <Table
              head={["Layout", "Best for", "Default colours"]}
              rows={[
                ["Modern", "Clean card-based layout with strong visual hierarchy.", <span key="m" className="flex flex-col gap-1"><Swatch color="#1E3A8A" /><Swatch color="#2563EB" /></span>],
                ["Classic", "Traditional formal layout, suited to printing.", <span key="c" className="flex flex-col gap-1"><Swatch color="#111827" /><Swatch color="#4B5563" /></span>],
                ["Minimal", "Compact one-page layout for email and mobile viewing.", <span key="n" className="flex flex-col gap-1"><Swatch color="#0F766E" /><Swatch color="#14B8A6" /></span>],
              ]}
            />
            <p>
              When you switch layout, colours you have customised are kept. Only colours that were
              still the previous layout's defaults move to the new layout's defaults.
            </p>
          </Section>

          <Section id="branding" title="Logo, colours & footer">
            <p>On the Branding tab you can set three things.</p>
            <p className="font-semibold text-gray-900 text-sm">Logo</p>
            <Table
              head={["Option", "Result"]}
              rows={[
                ["No logo", "The payslip is printed without a logo."],
                ["Organization logo", "Uses the logo from your company profile. This is the default for new templates."],
                ["Upload", "Upload a logo just for this template. Upload again to replace it."],
              ]}
            />
            <p>
              Uploaded logos must be <strong>PNG or JPEG</strong>, <strong>1 MB or smaller</strong>,
              and between 16 and 2400 pixels on each side. The logo is embedded directly in the
              payslip, so it keeps working even if you later change your company profile.
            </p>
            <p className="font-semibold text-gray-900 text-sm">Colours</p>
            <p>
              The primary and accent colours are entered as HEX values such as{" "}
              <InlineCode>#1E3A8A</InlineCode>. Leave them as the layout defaults or choose your brand
              colours.
            </p>
            <p className="font-semibold text-gray-900 text-sm">Footer</p>
            <p>
              The footer is a short text shown at the bottom of the payslip, up to 1,000 characters.
              The default is “This is a system-generated payslip.” Switch <strong>Show footer</strong>{" "}
              off to hide it.
            </p>
          </Section>

          <Section id="sections" title="Sections & visibility">
            <p>
              Some parts of a payslip are required, so a template can never hide information an
              employee is entitled to see.
            </p>
            <p className="font-semibold text-gray-900 text-sm">Always shown</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Employee details</li>
              <li>Payment summary</li>
              <li>Earnings</li>
              <li>Deductions</li>
              <li>Statutory deductions (PAYE, NSSF, SHIF, Housing Levy)</li>
              <li>Net pay — you can reword it, but it is always rendered</li>
            </ul>
            <p className="font-semibold text-gray-900 text-sm">Optional</p>
            <Table
              head={["Section", "Notes", "Default"]}
              rows={[
                ["Company header", "Company name, address, KRA PIN and logo.", "On"],
                ["Allowances", "Itemised under earnings.", "On"],
                ["Reimbursements", "Itemised under earnings.", "On"],
                ["Advance recoveries", "Salary advance instalments deducted in the payrun.", "On"],
                ["Loan repayments", "Loan instalments deducted in the payrun.", "On"],
                ["Leave summary", "Entitled, used and available leave days.", "Off"],
                ["Bank details", "Bank name and a masked account number — the full number is never printed.", "Off"],
                ["Payment date", "The date the employee is paid.", "On"],
              ]}
            />
            <Callout kind="note" title="Hiding a section never changes the totals">
              Switching a section off removes its itemised lines only. Gross pay, total deductions and
              net pay still include everything, so the figures on the payslip always add up.
            </Callout>
            <p className="font-semibold text-gray-900 text-sm">Order</p>
            <p>
              You can choose whether <strong>Earnings</strong> or <strong>Deductions</strong> comes
              first using the up and down arrows under <em>Section order</em>.
            </p>
          </Section>

          <Section id="labels" title="Labels">
            <p>
              Labels are the words printed on the payslip — “Gross Pay”, “Net Pay”, “Employee No.” and
              so on. Change them to match your own terminology, for example “Take-home pay” instead of
              “Net Pay”. Every label has a default, and a <strong>Reset</strong> button appears next to
              any label you have changed.
            </p>
            <Table
              head={["Label", "Default wording"]}
              rows={[
                ["employee", "Employee"],
                ["employeeNumber", "Employee No."],
                ["payPeriod", "Pay Period"],
                ["basicSalary", "Basic Salary"],
                ["grossPay", "Gross Pay"],
                ["totalDeductions", "Total Deductions"],
                ["netPay", "Net Pay"],
                ["paye / nssf / shif / housingLevy", "PAYE / NSSF / SHIF / Housing Levy"],
                ["payslipNumber / paymentDate", "Payslip No. / Payment Date"],
              ]}
            />
            <p>
              Beyond these, the editor lets you reword the section titles and extra lines such as
              Job Title, Department, Date Hired, Allowances, Overtime, Bonus, Commission and Taxable
              Income. Labels only change wording — amounts and calculations are not affected.
            </p>
          </Section>

          <Section id="validation" title="Limits & validation">
            <p>
              The editor checks your input as you type, and the server applies the same rules when you
              save, so a template can never be stored in an unsafe or unusable state.
            </p>
            <Table
              head={["Field", "Rule"]}
              rows={[
                ["Template name", "Required, up to 100 characters, unique in your organisation."],
                ["Document title", "Required, up to 100 characters. Shown at the top of the payslip."],
                ["Footer text", "Up to 1,000 characters."],
                ["Labels", "Cannot be empty. Up to 40 characters. Letters, numbers, spaces and . , & ( ) / ' : % # + - only."],
                ["Colours", "HEX format, for example #1E3A8A."],
                ["Logo upload", "PNG or JPEG, 1 MB or smaller, 16–2400 px per side."],
              ]}
            />
            <p>
              Text fields cannot contain angle brackets, backticks, template expressions such as{" "}
              <InlineCode>{"{{ }}"}</InlineCode>, script links or control characters. Required
              sections cannot be switched off, and earnings and deductions must each hold a different
              position in the section order.
            </p>
          </Section>

          <Section id="generation" title="How payslips use a template" eyebrow="Payslips">
            <p>
              Payslips are generated from a <strong>finalized</strong> payrun, using the organisation's
              active template version. For each employee, PayKe builds the payslip from the payrun
              figures, lays it out with the template and stores it as an A4 PDF.
            </p>
            <CodeBlock>{`POST /api/v1/organizations/{org_id}/payruns/{payrun_id}/payslips/generate
{ "employee_ids": [12, 15], "regenerate": false }   // both fields optional`}</CodeBlock>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Leave out <InlineCode>employee_ids</InlineCode> to generate for everyone in the payrun, or send a list to generate in batches.</li>
              <li>An employee who already has a payslip PDF is skipped, so generating twice is safe.</li>
              <li>A failure for one employee is reported in the response and does not stop the others.</li>
              <li>Each payslip records the template and version it was made with, and the response names the template used.</li>
              <li>Who can generate: admin, payroll manager, payroll officer. Generation is limited to 5 requests a minute.</li>
            </ul>
            <p>
              PDFs are never publicly linked. They are stored privately and delivered only through
              the payslip download, which checks that the person asking is allowed to see that
              employee's payslip.
            </p>
          </Section>

          <Section id="regenerating" title="Regenerating payslips">
            <p>
              Changing the active template does not touch payslips that already exist. If you want
              existing payslips to pick up a new design, generate them again with{" "}
              <InlineCode>regenerate</InlineCode> set to true.
            </p>
            <Callout kind="warning" title="Regenerating resets a payslip's status">
              A regenerated payslip is rendered from the template version that is active{" "}
              <em>now</em>, and its status goes back to <em>generated</em> with the sent time cleared.
              If you had already sent the payslip, it will need to be sent again.
            </Callout>
            <p>
              Regeneration only changes the design. The figures are the finalized payrun figures and
              are identical to before.
            </p>
          </Section>

          <Section id="access" title="Access & security" eyebrow="Reference">
            <p>
              Templates are available to <strong>admins</strong>, <strong>payroll managers</strong> and{" "}
              <strong>payroll officers</strong>. Platform administrators cannot open an organisation's
              templates, and you can only ever work with your own organisation's templates — a request
              for another organisation is refused and recorded.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Templates hold no payroll data. They are a set of choices from a fixed list — layout, switches, labels, colours and a logo — not custom code.</li>
              <li>Everything typed into a template is escaped before it reaches a payslip.</li>
              <li>A payslip can only show an approved set of payroll fields; anything else is dropped before it is rendered.</li>
              <li>Bank account numbers are always masked on the payslip.</li>
              <li>PDFs are generated without any network access, so nothing is fetched from outside while a payslip is built.</li>
            </ul>
            <p>The audit log records:</p>
            <Table
              head={["Event", "When"]}
              rows={[
                ["Template created", "A template is created, including the automatic default."],
                ["Template updated", "Draft changes are saved."],
                ["Template activated", "A template becomes active. The version number and any archived template are recorded."],
                ["Template archived", "A template is archived, including when another template replaces it."],
                ["Template previewed", "A PDF preview is opened. Automatic on-screen refreshes are not recorded."],
                ["Payslips generated / regenerated", "Payslips are generated, with the template version used."],
                ["Access denied", "A request was refused because of role or organisation."],
              ]}
            />
          </Section>

          <Section id="api" title="API reference">
            <p>
              All endpoints sit under <InlineCode>/api/v1/organizations/{"{org_id}"}/templates</InlineCode>{" "}
              and respond with the standard <InlineCode>{"{ success, data, message }"}</InlineCode>{" "}
              envelope. Validation problems return 422 with a field-by-field{" "}
              <InlineCode>errors</InlineCode> object.
            </p>
            <Table
              head={["Method & path", "Purpose"]}
              rows={[
                [<InlineCode key="1">GET /templates?template_type=payslip&amp;status=</InlineCode>, "List templates, optionally filtered by status."],
                [<InlineCode key="2">GET /templates/meta</InlineCode>, "Layouts, default settings, label defaults and limits used by the editor."],
                [<InlineCode key="3">GET /templates/{"{id}"}</InlineCode>, "One template, with its resolved colours and version information."],
                [<InlineCode key="4">POST /templates</InlineCode>, "Create a template as a draft."],
                [<InlineCode key="5">PUT /templates/{"{id}"}</InlineCode>, "Save the working copy. An active template keeps generating from its active version."],
                [<InlineCode key="6">POST /templates/{"{id}"}/activate</InlineCode>, "Snapshot a new version and make the template active."],
                [<InlineCode key="7">POST /templates/{"{id}"}/archive</InlineCode>, "Archive a draft template."],
                [<InlineCode key="8">GET /templates/{"{id}"}/versions</InlineCode>, "All versions of a template."],
                [<InlineCode key="9">GET /templates/{"{id}"}/versions/{"{version_id}"}</InlineCode>, "One version."],
                [<InlineCode key="10">POST /templates/{"{id}"}/preview</InlineCode>, "Render a preview as HTML or PDF. Limited to 30 a minute."],
                [<InlineCode key="11">GET /templates/preview-options?payrun_id=</InlineCode>, "Payruns, and the employees of one payrun, available to preview."],
                [<InlineCode key="12">POST /templates/logo</InlineCode>, "Upload a logo (multipart, field “logo”). Returns a token to use in the template."],
              ]}
            />
            <CodeBlock>{`POST /api/v1/organizations/{org_id}/templates/{id}/preview
{
  "format": "html",            // "html" or "pdf"
  "payrun_id": 7,              // optional — omit both for sample data
  "employee_id": 42,           // optional — required together with payrun_id
  "draft": { "name": "…", "layout_key": "classic", "config": { … } },   // optional unsaved changes
  "live": true                 // optional — marks an automatic editor refresh
}

→ 200 OK
  { "data": { "format": "html", "sample": false, "html": "<!doctype html>…" } }`}</CodeBlock>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-4">
              <QA q="“A template with this name already exists”">
                Template names must be unique within your organisation, including archived ones.
                Choose a different name.
              </QA>
              <QA q="I saved changes but new payslips look the same">
                Saving only updates the draft working copy. Activate the template — look for the
                Unactivated changes badge — and new payslips will use the changes.
              </QA>
              <QA q="Activate Template is greyed out">
                You have unsaved changes or a validation error. Save the draft first and fix any
                highlighted fields.
              </QA>
              <QA q="“The active template cannot be archived”">
                Activate another template first. The current one is archived automatically.
              </QA>
              <QA q="“Archived templates cannot be edited”">
                Restore the template by activating it. It becomes the active template and can then be
                edited as usual.
              </QA>
              <QA q="Logo upload is rejected">
                The file must be a PNG or JPEG of 1 MB or less, between 16 and 2400 pixels on each
                side. If a saved template says the logo file cannot be found, upload it again.
              </QA>
              <QA q="Preview paused">
                You hit the limit of 30 previews a minute. It resumes automatically after the
                countdown.
              </QA>
              <QA q="I can't pick an employee to preview">
                Payroll officers only see employees in their own department. Choose a payrun that
                includes them, or ask an admin or payroll manager.
              </QA>
              <QA q="Payslips can't be generated">
                Payslips are only generated from finalized payruns. Finalize the payrun first.
              </QA>
            </div>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-4">
              <QA q="Can a template change an employee's pay?">
                No. Templates control presentation only. Every amount comes from the payrun.
              </QA>
              <QA q="Can I hide statutory deductions or net pay?">
                No. Employee details, payment summary, earnings, deductions, statutory deductions and
                net pay are always shown. You can reword them.
              </QA>
              <QA q="Can I have more than one active template?">
                No. There is one active payslip template per organisation. Activating another
                archives the current one.
              </QA>
              <QA q="Will changing the template alter payslips I've already sent?">
                No. Each payslip keeps the design it was generated with unless you regenerate it.
              </QA>
              <QA q="Can I go back to an earlier design?">
                Versions are a permanent record of every activation. To return to an older design,
                restore a template that matches it, or recreate those settings and activate.
              </QA>
              <QA q="Who can manage templates?">
                Admins, payroll managers and payroll officers.
              </QA>
              <QA q="Will other documents, such as P9s or letters, become customisable?">
                Payslips are the first document type. Other document types are planned but are not
                available yet.
              </QA>
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