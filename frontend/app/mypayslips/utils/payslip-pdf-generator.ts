"use client";

import { PayslipType } from "@/services/api/payslip";

const fmt = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(value);

const fmtDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function generatePayslipPDF(payslip: PayslipType) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const { earnings, deductions, payrun, employee } = payslip;

  const earningsRows = [
    ["Basic Salary", earnings.basic_salary],
    ["Overtime", earnings.overtime_amount],
    ["Bonus", earnings.bonus_amount],
    ["Commission", earnings.commission_amount],
  ]
    .filter(([, v]) => (v as number) > 0)
    .map(
      ([label, value]) => `
      <tr>
        <td>${label}</td>
        <td>${fmt(value as number)}</td>
      </tr>`
    )
    .join("");

  const deductionRows = [
    ["NSSF", deductions.nssf],
    ["SHIF", deductions.shif],
    ["Housing Levy", deductions.housing_levy],
    ["PAYE", deductions.paye],
  ]
    .filter(([, v]) => (v as number) > 0)
    .map(
      ([label, value]) => `
      <tr>
        <td>${label}</td>
        <td>${fmt(value as number)}</td>
      </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${payslip.payslip_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: 'Arial', sans-serif;
          font-size: 11pt;
          color: #111;
          background: #fff;
          padding: 18mm 16mm;
        }

        /* ── Header banner ── */
        .header {
          background: #1e3a5f;
          color: #fff;
          padding: 16px 20px;
          border-radius: 4px 4px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0;
        }
        .header .company-block .company-name {
          font-size: 16pt;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .header .company-block .doc-label {
          font-size: 9pt;
          opacity: 0.8;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .header .slip-meta { text-align: right; font-size: 9.5pt; }
        .header .slip-meta .slip-number {
          font-size: 12pt;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .header .slip-meta span { display: block; opacity: 0.85; }

        /* ── Sub-header: pay period ── */
        .period-bar {
          background: #2c5282;
          color: #fff;
          font-size: 9pt;
          padding: 6px 20px;
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .period-bar span { opacity: 0.9; }

        /* ── Employee card ── */
        .employee-card {
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 12px 16px;
          margin-bottom: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
        }
        .employee-card .field-label {
          font-size: 8.5pt;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 2px;
        }
        .employee-card .field-value {
          font-size: 10.5pt;
          font-weight: 600;
        }

        /* ── Two-column earnings / deductions ── */
        .pay-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .pay-section h3 {
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 2px;
          margin-bottom: 0;
        }
        .pay-section.earnings h3 { background: #dbeafe; color: #1e40af; }
        .pay-section.deductions h3 { background: #fee2e2; color: #991b1b; }

        .pay-section table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        .pay-section table tr { border-bottom: 1px solid #e5e7eb; }
        .pay-section table tr:last-child { border-bottom: none; }
        .pay-section table td {
          padding: 6px 10px;
        }
        .pay-section table td:last-child {
          text-align: right;
          font-family: 'Courier New', monospace;
          font-size: 9.5pt;
        }
        .pay-section .section-total {
          display: flex;
          justify-content: space-between;
          padding: 7px 10px;
          font-weight: 700;
          font-size: 10pt;
          border-top: 2px solid #374151;
          margin-top: 2px;
        }
        .pay-section.earnings .section-total { color: #1e40af; }
        .pay-section.deductions .section-total { color: #991b1b; }
        .section-total .amount { font-family: 'Courier New', monospace; }

        /* ── Tax summary ── */
        .tax-summary {
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 10px 14px;
          margin-bottom: 16px;
          font-size: 9.5pt;
        }
        .tax-summary h3 {
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 8px;
        }
        .tax-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .tax-item .tax-label { font-size: 8pt; color: #6b7280; }
        .tax-item .tax-value { font-weight: 600; font-family: 'Courier New', monospace; }

        /* ── Net Pay banner ── */
        .net-pay-banner {
          background: #1e3a5f;
          color: #fff;
          border-radius: 4px;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .net-pay-banner .label {
          font-size: 11pt;
          font-weight: 600;
          opacity: 0.9;
        }
        .net-pay-banner .amount {
          font-size: 18pt;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.5px;
        }

        /* ── Status badge ── */
        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 8.5pt;
          font-weight: 700;
          text-transform: uppercase;
          border: 1.5px solid currentColor;
        }
        .status-sent     { color: #16a34a; }
        .status-draft    { color: #6b7280; }
        .status-pending  { color: #ca8a04; }

        /* ── Footer ── */
        .footer {
          text-align: center;
          font-size: 8pt;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
          padding-top: 8px;
        }

        @media print {
          body { padding: 8mm 10mm; }
          @page { margin: 8mm; }
        }
      </style>
    </head>
    <body>

      <!-- Header -->
      <div class="header">
        <div class="company-block">
          <div class="company-name">PAYROLL SYSTEM</div>
          <div class="doc-label">Employee Payslip</div>
        </div>
        <div class="slip-meta">
          <div class="slip-number">${payslip.payslip_number}</div>
          <span>Status: <span class="status-badge status-${payslip.status}">${payslip.status}</span></span>
          <span>Generated: ${fmtDate(payslip.generated_at)}</span>
        </div>
      </div>

      <!-- Period bar -->
      <div class="period-bar">
        <span><b>Pay Run:</b> ${payrun.payrun_name}</span>
        <span><b>Period:</b> ${fmtDate(payrun.pay_period_start)} &ndash; ${fmtDate(payrun.pay_period_end)}</span>
        <span><b>Frequency:</b> ${payrun.pay_frequency.charAt(0).toUpperCase() + payrun.pay_frequency.slice(1)}</span>
      </div>

      <!-- Employee details -->
      <div class="employee-card">
        <div>
          <div class="field-label">Employee Name</div>
          <div class="field-value">${employee.full_name}</div>
        </div>
        <div>
          <div class="field-label">Employee Number</div>
          <div class="field-value">${employee.employee_number}</div>
        </div>
        <div>
          <div class="field-label">Email</div>
          <div class="field-value" style="font-size:9.5pt">${employee.email}</div>
        </div>
      </div>

      <!-- Earnings & Deductions -->
      <div class="pay-grid">
        <!-- Earnings -->
        <div class="pay-section earnings">
          <h3>Earnings</h3>
          <table>
            <tbody>
              ${earningsRows}
            </tbody>
          </table>
          <div class="section-total">
            <span>Gross Pay</span>
            <span class="amount">${fmt(earnings.gross_pay)}</span>
          </div>
        </div>

        <!-- Deductions -->
        <div class="pay-section deductions">
          <h3>Deductions</h3>
          <table>
            <tbody>
              ${deductionRows}
            </tbody>
          </table>
          <div class="section-total">
            <span>Total Deductions</span>
            <span class="amount">${fmt(deductions.total_deductions)}</span>
          </div>
        </div>
      </div>

      <!-- Tax summary -->
      <div class="tax-summary">
        <h3>Tax Computation</h3>
        <div class="tax-grid">
          <div class="tax-item">
            <div class="tax-label">Taxable Income</div>
            <div class="tax-value">${fmt(deductions.taxable_income)}</div>
          </div>
          <div class="tax-item">
            <div class="tax-label">Tax Before Relief</div>
            <div class="tax-value">${fmt(deductions.tax_before_relief)}</div>
          </div>
          <div class="tax-item">
            <div class="tax-label">Personal Relief</div>
            <div class="tax-value">${fmt(deductions.personal_relief)}</div>
          </div>
        </div>
      </div>

      <!-- Net Pay -->
      <div class="net-pay-banner">
        <span class="label">Net Pay</span>
        <span class="amount">${fmt(payslip.net_pay)}</span>
      </div>

      <!-- Footer -->
      <div class="footer">
        This payslip is system-generated &mdash; ${payslip.payslip_number} &mdash; ${payrun.payrun_name}
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