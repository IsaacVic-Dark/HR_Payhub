"use client";

import { useState } from "react";
import {
  IconMail,
  IconPhone,
  IconMapPin,
  IconBrandWhatsapp,
  IconChevronDown,
  IconChevronUp,
  IconSend,
  IconHeadset,
  IconClock,
  IconCircleCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

// ─── Dummy Data ────────────────────────────────────────────────────────────────

const contactChannels = [
  {
    id: "email",
    icon: IconMail,
    label: "Email Support",
    value: "support@payhub.co.ke",
    sub: "We reply within 24 hours",
    href: "mailto:support@payhub.co.ke",
    accent: "#be2ed6",
  },
  {
    id: "phone",
    icon: IconPhone,
    label: "Phone Support",
    value: "+254 700 123 456",
    sub: "Mon – Fri, 8 AM – 6 PM EAT",
    href: "tel:+254700123456",
    accent: "#7c3aed",
  },
  {
    id: "whatsapp",
    icon: IconBrandWhatsapp,
    label: "WhatsApp",
    value: "+254 712 987 654",
    sub: "Quick replies on business days",
    href: "https://wa.me/254712987654",
    accent: "#16a34a",
  },
  {
    id: "office",
    icon: IconMapPin,
    label: "Visit Our Office",
    value: "Westlands, Nairobi",
    sub: "Delta Corner Tower, 4th Floor, Ring Road Westlands",
    href: "https://maps.google.com/?q=Delta+Corner+Tower+Westlands+Nairobi",
    accent: "#ea580c",
  },
];

const faqs = [
  {
    question: "How do I process a payrun for my organisation?",
    answer:
      "Navigate to Payroll Management → Payrun → Process. Select the pay period, verify the employee list, and click 'Generate Payrun'. You will be prompted to review the summary before finalising. Only users with the Payroll Manager role can execute this action.",
  },
  {
    question: "How can an employee apply for leave?",
    answer:
      "Employees can apply via Self Service → My Leaves → New Application. Select the leave type, specify dates, attach any required documents, and submit. The department manager will receive an automatic notification for approval.",
  },
  {
    question: "Why is a payslip not visible to an employee?",
    answer:
      "Payslips only appear once a payrun has been finalised and the payslip distribution has been triggered by a Payroll Manager or Admin. Check the payrun status under Payroll Management → Payrun → History and ensure the specific employee is included in the payrun.",
  },
  {
    question: "How do I reset a user's password?",
    answer:
      "Go to Configuration → User Management, find the user, and select 'Reset Password'. An email with a temporary password will be sent to the user's registered address. For admin account resets, contact our support team directly.",
  },
  {
    question: "What file format is required for bulk employee imports?",
    answer:
      "Bulk employee imports use a CSV template which can be downloaded from Employees → Import Employees → Download Template. Ensure all required fields (Full Name, ID Number, Department, Gross Salary) are populated before uploading.",
  },
  {
    question: "How are P9 forms generated at year end?",
    answer:
      "Navigate to Payroll Management → P9 Forms and click 'Generate P9 Forms' for the relevant tax year. The system consolidates all approved payruns for that year. Individual employees can also download their own P9 via Self Service → My P9 Form.",
  },
  {
    question: "Can I customise leave types for my organisation?",
    answer:
      "Yes. Go to Configuration → Leave Types to add, edit, or deactivate leave categories. Custom leave types will immediately appear in the employee leave application form and the HR Leaves management table.",
  },
];

type SubmitStatus = "idle" | "sending" | "success" | "error";

// ─── Component ─────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  const toggleFaq = (index: number) =>
    setOpenFaq((prev) => (prev === index ? null : index));

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("sending");
    // Simulate API call — replace with your actual endpoint
    await new Promise((res) => setTimeout(res, 1500));
    setSubmitStatus("success");
    setForm({ name: "", email: "", subject: "", message: "" });
    setTimeout(() => setSubmitStatus("idle"), 4000);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="mt-4 mx-6 space-y-2">
          <h1 className="text-2xl font-medium">Help &amp; Support</h1>
          <p className="text-base text-muted-foreground">
            Need assistance? Reach our team through any of the channels below or
            browse common questions.
          </p>
        </div>

        <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 mx-6">

          {/* ── Support Hours Banner ─────────────────────────────────────── */}
          <div className="flex items-center gap-3 rounded-xl border border-[#be2ed6]/30 bg-[#be2ed6]/5 px-5 py-3">
            <IconClock className="h-5 w-5 shrink-0 text-[#be2ed6]" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Support hours:</span>{" "}
              Monday – Friday, 8:00 AM – 6:00 PM East Africa Time (EAT).
              Urgent issues are escalated within 2 hours during business hours.
            </p>
          </div>

          {/* ── Contact Channels ─────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-medium mb-4">Contact Us</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {contactChannels.map((ch) => {
                const Icon = ch.icon;
                return (
                  <a
                    key={ch.id}
                    href={ch.href}
                    target={ch.id === "office" || ch.id === "whatsapp" ? "_blank" : undefined}
                    rel="noreferrer"
                    className="group relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* Accent line */}
                    <span
                      className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl transition-all duration-200 group-hover:h-1"
                      style={{ backgroundColor: ch.accent }}
                    />

                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${ch.accent}18` }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: ch.accent }}
                      />
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {ch.label}
                      </p>
                      <p className="text-sm font-semibold text-foreground break-words">
                        {ch.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{ch.sub}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* ── Main Two-Column: FAQ + Form ───────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* FAQ Accordion */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <IconHeadset className="h-5 w-5 text-[#be2ed6]" />
                <h2 className="text-lg font-medium">Frequently Asked Questions</h2>
              </div>

              <div className="space-y-2">
                {faqs.map((faq, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border bg-card shadow-sm transition-all duration-200 ${
                        isOpen ? "border-[#be2ed6]/40" : ""
                      }`}
                    >
                      <button
                        onClick={() => toggleFaq(i)}
                        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                        aria-expanded={isOpen}
                      >
                        <span className="text-sm font-medium leading-snug">
                          {faq.question}
                        </span>
                        {isOpen ? (
                          <IconChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-[#be2ed6]" />
                        ) : (
                          <IconChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-4">
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Support Ticket Form */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <IconSend className="h-5 w-5 text-[#be2ed6]" />
                <h2 className="text-lg font-medium">Submit a Support Ticket</h2>
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-sm">
                {submitStatus === "success" ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                      <IconCircleCheck className="h-8 w-8 text-green-500" />
                    </div>
                    <p className="text-base font-medium">Ticket Submitted!</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Our team has received your request and will respond to your
                      email within 24 hours.
                    </p>
                  </div>
                ) : submitStatus === "error" ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                      <IconAlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <p className="text-base font-medium">Something went wrong</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      We couldn't submit your ticket. Please try again or reach us
                      directly via email.
                    </p>
                    <button
                      onClick={() => setSubmitStatus("idle")}
                      className="mt-2 rounded-lg border px-4 py-2 text-sm transition hover:bg-accent"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Your Name
                        </label>
                        <input
                          id="name"
                          name="name"
                          required
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Jane Mwangi"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#be2ed6] focus:ring-1 focus:ring-[#be2ed6]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Email Address
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={form.email}
                          onChange={handleChange}
                          placeholder="jane@company.co.ke"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#be2ed6] focus:ring-1 focus:ring-[#be2ed6]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="subject" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Subject / Category
                      </label>
                      <select
                        id="subject"
                        name="subject"
                        required
                        value={form.subject}
                        onChange={handleChange}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-[#be2ed6] focus:ring-1 focus:ring-[#be2ed6]"
                      >
                        <option value="" disabled>
                          Select a category…
                        </option>
                        <option value="payroll">Payroll Processing</option>
                        <option value="leaves">Leave Management</option>
                        <option value="employees">Employee Records</option>
                        <option value="payslips">Payslips &amp; P9 Forms</option>
                        <option value="access">Access &amp; Permissions</option>
                        <option value="billing">Billing &amp; Subscription</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="message" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Describe your issue in as much detail as possible…"
                        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#be2ed6] focus:ring-1 focus:ring-[#be2ed6]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitStatus === "sending"}
                      className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                      style={{ backgroundColor: "#be2ed6" }}
                    >
                      {submitStatus === "sending" ? (
                        <>
                          <svg
                            className="h-4 w-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                            />
                          </svg>
                          Sending…
                        </>
                      ) : (
                        <>
                          <IconSend className="h-4 w-4" />
                          Send Ticket
                        </>
                      )}
                    </button>

                    <p className="text-center text-xs text-muted-foreground">
                      We typically respond within{" "}
                      <span className="font-medium text-foreground">24 business hours</span>.
                    </p>
                  </form>
                )}
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}