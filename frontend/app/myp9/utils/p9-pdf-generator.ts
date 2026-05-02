"use client";

import { P9FormType } from "@/services/api/p9";

const formatCurrency = (value: string) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(parseFloat(value));
};

export function generateP9PDF(form: P9FormType, employeeName?: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${form.p9number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          color: #000;
          background: #fff;
          padding: 20mm 15mm;
        }

        /* ── Header ── */
        .header {
          text-align: center;
          border: 2px solid #000;
          padding: 12px 16px;
          margin-bottom: 16px;
        }
        .header .kra-title {
          font-size: 13pt;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .header .form-title {
          font-size: 16pt;
          font-weight: bold;
          margin: 4px 0;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .header .form-subtitle {
          font-size: 10pt;
          color: #333;
        }

        /* ── Two-column employer / employee info ── */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .info-box {
          border: 1px solid #000;
          padding: 8px 10px;
        }
        .info-box h4 {
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #000;
          padding-bottom: 4px;
          margin-bottom: 6px;
          font-weight: bold;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 10pt;
        }
        .info-row .label { color: #444; }
        .info-row .value { font-weight: bold; }

        /* ── Summary table ── */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          font-size: 10.5pt;
        }
        thead tr {
          background: #000;
          color: #fff;
        }
        thead th {
          padding: 7px 10px;
          text-align: left;
          font-weight: bold;
          font-size: 9.5pt;
          letter-spacing: 0.3px;
        }
        thead th:not(:first-child) { text-align: right; }
        tbody tr { border-bottom: 1px solid #ccc; }
        tbody tr:nth-child(even) { background: #f5f5f5; }
        tbody td {
          padding: 7px 10px;
          vertical-align: middle;
        }
        tbody td:not(:first-child) { text-align: right; font-family: 'Courier New', monospace; }
        tfoot tr { border-top: 2px solid #000; background: #e8e8e8; }
        tfoot td {
          padding: 8px 10px;
          font-weight: bold;
        }
        tfoot td:not(:first-child) { text-align: right; font-family: 'Courier New', monospace; }

        /* ── Status badge ── */
        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 9pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1.5px solid #000;
        }
        .status-filed    { border-color: #16a34a; color: #16a34a; }
        .status-pending  { border-color: #ca8a04; color: #ca8a04; }
        .status-draft    { border-color: #6b7280; color: #6b7280; }

        /* ── Certification box ── */
        .certification {
          border: 1px solid #000;
          padding: 10px 12px;
          margin-bottom: 16px;
          font-size: 9.5pt;
          line-height: 1.6;
        }
        .certification strong { display: block; margin-bottom: 4px; text-transform: uppercase; font-size: 9pt; }

        /* ── Signature row ── */
        .signature-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-top: 24px;
        }
        .sig-block { border-top: 1px solid #000; padding-top: 6px; }
        .sig-block .sig-label { font-size: 9pt; color: #555; }
        .sig-block .sig-value { font-size: 10pt; font-weight: bold; margin-top: 2px; }

        /* ── Footer ── */
        .footer {
          text-align: center;
          font-size: 8.5pt;
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 8px;
          margin-top: 16px;
        }

        @media print {
          body { padding: 10mm; }
          @page { margin: 10mm; }
        }
      </style>
    </head>
    <body>

      <!-- Header -->
      <div class="header">
        <div class="kra-title">Kenya Revenue Authority</div>
        <div class="form-title">P9 Form</div>
        <div class="form-subtitle">Tax Deduction Card &mdash; Employee Annual Summary</div>
      </div>

      <!-- Info grid -->
      <div class="info-grid">
        <div class="info-box">
          <h4>Employee Details</h4>
          ${employeeName ? `
          <div class="info-row">
            <span class="label">Name</span>
            <span class="value">${employeeName}</span>
          </div>` : ""}
          <div class="info-row">
            <span class="label">PIN</span>
            <span class="value">${form.employee_pin}</span>
          </div>
        </div>
        <div class="info-box">
          <h4>Form Details</h4>
          <div class="info-row">
            <span class="label">Form Number</span>
            <span class="value">${form.p9number}</span>
          </div>
          <div class="info-row">
            <span class="label">Tax Year</span>
            <span class="value">${form.year}</span>
          </div>
          <div class="info-row">
            <span class="label">Status</span>
            <span class="value">
              <span class="status-badge status-${form.status}">${form.status}</span>
            </span>
          </div>
          <div class="info-row">
            <span class="label">Generated</span>
            <span class="value">${new Date(form.generatedat).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}</span>
          </div>
        </div>
      </div>

      <!-- Summary Table -->
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount (KES)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Basic Salary</td>
            <td>${formatCurrency(form.total_basic_salary)}</td>
          </tr>
          <tr>
            <td>Total Gross Pay</td>
            <td>${formatCurrency(form.total_gross_pay)}</td>
          </tr>
          <tr>
            <td>Total Taxable Pay</td>
            <td>${formatCurrency(form.total_taxable_pay)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total PAYE Tax Withheld</td>
            <td>${formatCurrency(form.total_paye)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Certification -->
      <div class="certification">
        <strong>Certification</strong>
        I certify that the above particulars are correct and that the tax shown above has been or will be duly remitted to the Kenya Revenue Authority in accordance with the Income Tax Act.
      </div>

      <!-- Signature row -->
      <div class="signature-row">
        <div class="sig-block">
          <div class="sig-label">Employer Signature</div>
          <div class="sig-value">&nbsp;</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">Designation</div>
          <div class="sig-value">&nbsp;</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">Date</div>
          <div class="sig-value">&nbsp;</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        This document was generated by the Payroll Management System &mdash; ${form.p9number} &mdash; Tax Year ${form.year}
      </div>

      <script>
        window.onload = function () {
          window.print();
          window.onafterprint = function () { window.close(); };
        };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}