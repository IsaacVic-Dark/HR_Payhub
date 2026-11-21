"use client";

import React, { useState } from "react";
import {
    calculateNetPay,
    formatCurrency,
    parseSalaryInput,
    InvalidSalaryError,
    PERSONAL_RELIEF,
    NSSF_MAX_CONTRIBUTION,
    type TaxCalculationResult,
} from "@/utils/tax";

const PURPLE = "#895bf5";
const PURPLE_DARK = "#7c4ee0";

const PAYE_BANDS = [
    { band: "Up to 24,000", rate: "10%" },
    { band: "24,001 – 32,333", rate: "25%" },
    { band: "32,334 – 500,000", rate: "30%" },
    { band: "500,001 – 800,000", rate: "32.5%" },
    { band: "Above 800,000", rate: "35%" },
];

/** A single row in the results panel. */
function ResultRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900">KES {value}</span>
        </div>
    );
}

/** A labeled horizontal bar used for the payment-breakdown visualization. */
function BreakdownBar({
    label,
    percent,
    color,
}: {
    label: string;
    percent: number;
    color: string;
}) {
    const clamped = Math.min(100, Math.max(0, percent));
    return (
        <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {label}
                </span>
                <span className="text-xs font-semibold text-gray-700">
                    {Math.round(clamped)}%
                </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${clamped}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

const navigateToPortal = () => {
    window.location.href = "http://localhost:3000/#contact";
};

const navigateToLogin = () => {
    window.location.href = "/login";
};

const CalculatorPage = () => {
    const [rawInput, setRawInput] = useState("");
    const [result, setResult] = useState<TaxCalculationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const cursorPosition = input.selectionStart ?? input.value.length;
        const originalLength = input.value.length;

        // Keep only digits and a single dot
        let value = input.value.replace(/[^\d.]/g, "");
        const parts = value.split(".");
        if (parts.length > 2) {
            value = `${parts[0]}.${parts[1]}`;
        }

        const [intPart, decimalPart] = value.split(".");
        let formatted = intPart ? Number(intPart).toLocaleString("en-KE") : "";
        if (decimalPart !== undefined) {
            formatted += `.${decimalPart}`;
        }

        setRawInput(formatted);

        // Restore cursor position after re-formatting
        requestAnimationFrame(() => {
            const diff = formatted.length - originalLength;
            const pos = cursorPosition + diff;
            input.setSelectionRange(pos, pos);
        });
    };

    const handleCalculate = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const salary = parseSalaryInput(rawInput);
            setResult(calculateNetPay(salary));
            setError(null);
        } catch (err) {
            setResult(null);
            setError(
                err instanceof InvalidSalaryError
                    ? err.message
                    : "Something went wrong calculating your tax. Please try again."
            );
        }
    };

    const handleReset = () => {
        setRawInput("");
        setResult(null);
        setError(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* ─── NAV ─── */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
                <div className="max-w-7xl px-6 h-14 flex items-center justify-between mx-auto">
                    <a href="/landing" className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xl font-bold" style={{ color: PURPLE }}>
                            Pay<span className="text-gray-900">Ke</span>
                        </span>
                    </a>
                    <a
                        href="/landing"
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                    >
                        ← Back to Home
                    </a>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10 md:py-14">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                        Kenya PAYE Tax Calculator
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Estimate your net monthly pay after NSSF, SHIF, Housing Levy and PAYE.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Panel — Input Form */}
                    <div className="w-full md:w-3/5 bg-white rounded-lg shadow-md p-6">
                        <form onSubmit={handleCalculate}>
                            <div className="mb-6">
                                <label
                                    htmlFor="monthlyIncome"
                                    className="block text-gray-700 mb-2 text-sm font-medium"
                                >
                                    Monthly Income (KES)
                                </label>
                                <div className="relative flex items-center">
                                    <span className="absolute left-3 text-gray-500 text-sm border-r pr-2">
                                        KES
                                    </span>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        id="monthlyIncome"
                                        name="salary"
                                        value={rawInput}
                                        onChange={handleInputChange}
                                        className="w-full p-3 pl-14 border border-gray-300 rounded-md focus:outline-none focus:ring-2 placeholder:text-sm"
                                        style={{ ["--tw-ring-color" as string]: PURPLE }}
                                        placeholder="Enter your monthly income"
                                        required
                                    />
                                </div>
                                {error && (
                                    <p className="text-red-600 text-sm mt-2">{error}</p>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="submit"
                                    className="text-white py-3 px-6 rounded-md transition-all hover:opacity-90 w-full font-semibold text-sm"
                                    style={{ backgroundColor: PURPLE }}
                                >
                                    Calculate Tax
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="bg-white text-gray-700 border border-gray-300 py-3 px-6 rounded-md hover:bg-gray-50 transition duration-300 w-full text-sm font-semibold"
                                >
                                    Reset
                                </button>
                            </div>
                        </form>

                        {/* Tax Bands Information */}
                        <div className="mt-8">
                            <h2 className="text-sm font-bold text-gray-800 mb-4">
                                Kenyan PAYE Tax Bands (2026)
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Income Band (KES)
                                            </th>
                                            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Tax Rate
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {PAYE_BANDS.map((b) => (
                                            <tr key={b.band}>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                    {b.band}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                                    {b.rate}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                                    Other Statutory Deductions
                                </h3>
                                <ul className="list-disc pl-5 space-y-1 text-gray-600 text-sm">
                                    <li>Monthly Personal Relief: KES {formatCurrency(PERSONAL_RELIEF)}</li>
                                    <li>
                                        NSSF Contribution: tiered 6% of pensionable pay (max KES{" "}
                                        {formatCurrency(NSSF_MAX_CONTRIBUTION)} monthly)
                                    </li>
                                    <li>SHIF Contribution: flat 2.75% of gross monthly income</li>
                                    <li>Housing Levy: 1.5% of gross monthly income</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel — Results */}
                    <div className="w-full md:w-2/5 bg-white rounded-lg shadow-md p-6 border border-gray-100">
                        <div className="text-center mb-8 pb-6 border-b border-gray-100">
                            <h2 className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                                Estimated Net Pay
                            </h2>
                            <div className="mt-2">
                                <span className="text-3xl font-bold text-gray-900">
                                    KES {result ? formatCurrency(result.netPay) : "0"}
                                </span>
                                <span className="text-gray-400 text-sm">/month</span>
                            </div>
                        </div>

                        <div className="space-y-3 mb-8">
                            <ResultRow
                                label="Gross Salary"
                                value={result ? formatCurrency(result.basicPay) : "0"}
                            />
                            <ResultRow
                                label="Taxable Income"
                                value={result ? formatCurrency(result.taxableIncome) : "0"}
                            />
                            <ResultRow
                                label="Personal Relief"
                                value={result ? formatCurrency(result.personalRelief) : "0"}
                            />
                            <ResultRow
                                label="PAYE"
                                value={result ? formatCurrency(result.paye) : "0"}
                            />
                            <ResultRow
                                label="SHIF Contribution"
                                value={result ? formatCurrency(result.shif) : "0"}
                            />
                            <ResultRow
                                label="NSSF Contribution"
                                value={result ? formatCurrency(result.nssf) : "0"}
                            />
                            <ResultRow
                                label="Housing Levy"
                                value={result ? formatCurrency(result.housingLevy) : "0"}
                            />
                        </div>

                        <div>
                            <h3 className="text-center mb-4 text-xs uppercase tracking-wide text-gray-500 font-medium">
                                Payment Breakdown
                            </h3>
                            <BreakdownBar
                                label="Take Home Pay"
                                percent={result?.netPayPercent ?? 0}
                                color={PURPLE}
                            />
                            <BreakdownBar
                                label="PAYE"
                                percent={result?.payePercent ?? 0}
                                color="#dc2626"
                            />
                            <BreakdownBar
                                label="Tax (before relief)"
                                percent={result?.taxPercent ?? 0}
                                color="#eab308"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center mt-6 pt-6 border-t border-gray-100">
                            <div>
                                <div
                                    className="w-3 h-3 rounded-full mx-auto"
                                    style={{ backgroundColor: PURPLE }}
                                />
                                <p className="text-xs mt-1 text-gray-500">Net Pay</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {Math.round(result?.netPayPercent ?? 0)}%
                                </p>
                            </div>
                            <div>
                                <div className="w-3 h-3 bg-red-600 rounded-full mx-auto" />
                                <p className="text-xs mt-1 text-gray-500">PAYE</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {Math.round(result?.payePercent ?? 0)}%
                                </p>
                            </div>
                            <div>
                                <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto" />
                                <p className="text-xs mt-1 text-gray-500">Tax</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {Math.round(result?.taxPercent ?? 0)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ─── FOOTER ─── */}
            <footer className="bg-[#12121f] text-white pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-5 gap-8 mb-12">
                        {/* Brand */}
                        <div className="md:col-span-1">
                            <div className="text-xl font-bold mb-3" style={{ color: PURPLE }}>
                                Pay<span className="text-white">Ke</span>
                            </div>
                            <p className="text-gray-400 text-xs leading-relaxed mb-4">
                                Streamline processes, eliminate obstacles, and foster meaning
                                with integrated HR software.
                            </p>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={navigateToPortal}
                                    className="text-xs font-semibold text-white text-center py-2 rounded-md hover:opacity-90 transition-all"
                                    style={{ backgroundColor: PURPLE }}
                                >
                                    Access Portal
                                </button>
                                <button
                                    onClick={navigateToLogin}
                                    className="text-xs font-semibold text-gray-300 text-center py-2 rounded-md border border-gray-700 hover:border-gray-500 transition-all"
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                        {/* Links */}
                        {[
                            {
                                title: "Our products",
                                links: [
                                    "Payroll",
                                    "Benefits",
                                    "HR Suite",
                                    "Talent Management",
                                    "Workforce Mgmt",
                                ],
                            },
                            {
                                title: "Resources",
                                links: [
                                    "Blog",
                                    "Case Studies",
                                    "Compare platforms",
                                    "Request a Demo",
                                    "Careers",
                                    "About Us",
                                ],
                            },
                            {
                                title: "Contact",
                                links: [
                                    "Get started",
                                    "Help Center",
                                    "Request a Demo",
                                    "Careers",
                                    "Investors",
                                ],
                            },
                        ].map((col, i) => (
                            <div key={i}>
                                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
                                    {col.title}
                                </h3>
                                <ul className="space-y-2.5">
                                    {col.links.map((l) => (
                                        <li key={l}>
                                            <a
                                                href="#"
                                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                {l}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        {/* Social */}
                        <div>
                            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
                                Follow Us
                            </h3>
                            <div className="flex flex-col gap-2">
                                {[
                                    { name: "LinkedIn", icon: "in" },
                                    { name: "Twitter", icon: "𝕏" },
                                    { name: "Facebook", icon: "f" },
                                    { name: "Instagram", icon: "◎" },
                                ].map((s) => (
                                    <a
                                        key={s.name}
                                        href="#"
                                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-xs font-bold">
                                            {s.icon}
                                        </div>
                                        {s.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-gray-600">
                            &copy; {new Date().getFullYear()} PayKe LTD · The Pinnacle
                            Building, 5th Floor, Nairobi, Kenya
                        </p>
                        <div className="flex gap-4">
                            <a
                                href="#"
                                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                            >
                                Privacy Policy
                            </a>
                            <a
                                href="#"
                                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                            >
                                Terms of Service
                            </a>
                        </div>
                        {/* Git version info */}
                        <p className="text-xs text-gray-700 font-mono">v1.4.2 · a3f9c1d</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default CalculatorPage;