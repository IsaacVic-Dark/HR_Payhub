'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
    'Company Details',
    'Location',
    'Payroll Settings',
    'Banking',
    'Admin Profile',
    'Review & Submit',
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

// ─── Form shape ───────────────────────────────────────────────────────────────

interface WizardData {
    // Step 1
    kra_pin: string;
    legal_type: string;
    registration_number: string;
    // Step 2
    physical_address: string;
    postal_address: string;
    county_id: string;
    location: string;
    // Step 3
    payroll_schedule: string;
    default_payday: string;
    currency: string;
    // Step 4
    bank_account_name: string;
    bank_account_number: string;
    bank_branch: string;
    swift_code: string;
    // Step 5 — Admin employee profile
    admin_firstname: string;
    admin_surname: string;
    admin_email: string;
    admin_hire_date: string;
    admin_start_date: string;
    admin_base_salary: string;
}

const EMPTY: WizardData = {
    kra_pin: '', legal_type: '', registration_number: '',
    physical_address: '', postal_address: '', county_id: '', location: '',
    payroll_schedule: '', default_payday: '', currency: 'KES',
    bank_account_name: '', bank_account_number: '', bank_branch: '', swift_code: '',
    admin_firstname: '', admin_surname: '', admin_email: '',
    admin_hire_date: '', admin_start_date: '', admin_base_salary: '',
};

// ─── Validation per step ──────────────────────────────────────────────────────

type FieldErrors = Partial<Record<keyof WizardData, string>>;

function validateStep(step: StepIndex, data: WizardData): FieldErrors {
    const e: FieldErrors = {};
    if (step === 0) {
        if (!data.kra_pin.trim()) e.kra_pin = 'KRA PIN is required.';
        if (!data.legal_type) e.legal_type = 'Legal type is required.';
    }
    if (step === 1) {
        if (!data.physical_address.trim()) e.physical_address = 'Physical address is required.';
        if (!data.location.trim()) e.location = 'Location is required.';
        if (!data.county_id) e.county_id = 'County is required.';
    }
    if (step === 2) {
        if (!data.payroll_schedule) e.payroll_schedule = 'Payroll schedule is required.';
        const day = parseInt(data.default_payday, 10);
        if (!data.default_payday || isNaN(day) || day < 1 || day > 31) {
            e.default_payday = 'Payday must be between 1 and 31.';
        }
        if (!data.currency.trim()) e.currency = 'Currency is required.';
    }
    if (step === 3) {
        if (!data.bank_account_name.trim()) e.bank_account_name = 'Account name is required.';
        if (!data.bank_account_number.trim()) e.bank_account_number = 'Account number is required.';
    }
    if (step === 4) {
        const e: FieldErrors = {};
        if (!data.admin_firstname.trim()) e.admin_firstname = 'First name is required.';
        if (!data.admin_surname.trim()) e.admin_surname = 'Surname is required.';
        if (!data.admin_email.trim()) e.admin_email = 'Email is required.';
        if (!data.admin_hire_date) e.admin_hire_date = 'Hire date is required.';
        if (!data.admin_start_date) e.admin_start_date = 'Start date is required.';
        if (!data.admin_base_salary || isNaN(Number(data.admin_base_salary)) || Number(data.admin_base_salary) < 0)
            e.admin_base_salary = 'A valid salary is required.';
    }
    return e;
}

function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGAL_TYPES = ['LTD', 'PLC', 'Sole_Proprietor', 'Partnership', 'NGO', 'Government', 'School', 'Other'];
const SCHEDULES = ['Monthly', 'Bi-Monthly', 'Weekly'];
const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF'];

const COUNTIES = [
    { id: 1, name: 'Mombasa' }, { id: 2, name: 'Kwale' }, { id: 3, name: 'Kilifi' },
    { id: 4, name: 'Tana River' }, { id: 5, name: 'Lamu' }, { id: 6, name: 'Taita Taveta' },
    { id: 7, name: 'Garissa' }, { id: 8, name: 'Wajir' }, { id: 9, name: 'Mandera' },
    { id: 10, name: 'Marsabit' }, { id: 11, name: 'Isiolo' }, { id: 12, name: 'Meru' },
    { id: 13, name: 'Tharaka-Nithi' }, { id: 14, name: 'Embu' }, { id: 15, name: 'Kitui' },
    { id: 16, name: 'Machakos' }, { id: 17, name: 'Makueni' }, { id: 18, name: 'Nyandarua' },
    { id: 19, name: 'Nyeri' }, { id: 20, name: 'Kirinyaga' }, { id: 21, name: "Murang'a" },
    { id: 22, name: 'Kiambu' }, { id: 23, name: 'Turkana' }, { id: 24, name: 'West Pokot' },
    { id: 25, name: 'Samburu' }, { id: 26, name: 'Trans Nzoia' }, { id: 27, name: 'Uasin Gishu' },
    { id: 28, name: 'Elgeyo-Marakwet' }, { id: 29, name: 'Nandi' }, { id: 30, name: 'Baringo' },
    { id: 31, name: 'Laikipia' }, { id: 32, name: 'Nakuru' }, { id: 33, name: 'Narok' },
    { id: 34, name: 'Kajiado' }, { id: 35, name: 'Kericho' }, { id: 36, name: 'Bomet' },
    { id: 37, name: 'Kakamega' }, { id: 38, name: 'Vihiga' }, { id: 39, name: 'Bungoma' },
    { id: 40, name: 'Busia' }, { id: 41, name: 'Siaya' }, { id: 42, name: 'Kisumu' },
    { id: 43, name: 'Homa Bay' }, { id: 44, name: 'Migori' }, { id: 45, name: 'Kisii' },
    { id: 46, name: 'Nyamira' }, { id: 47, name: 'Nairobi' },
];

// ─── Component ────────────────────────────────────────────────────────────────

function clampStep(raw: string | null): StepIndex {
    const n = parseInt(raw ?? '0', 10);
    if (isNaN(n) || n < 0 || n > 5) return 0;
    return n as StepIndex;
}

function SetupWizard() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { markSetupComplete } = useAuth();

    // The URL (`?step=`) is the source of truth so the sidebar can read and
    // link directly to a step. `currentStep` mirrors it in state for renders.
    const [currentStep, setCurrentStepState] = useState<StepIndex>(() => clampStep(searchParams.get('step')));

    useEffect(() => {
        setCurrentStepState(clampStep(searchParams.get('step')));
    }, [searchParams]);

    const setCurrentStep = (updater: StepIndex | ((s: StepIndex) => StepIndex)) => {
        setCurrentStepState(prev => {
            const next = typeof updater === 'function' ? (updater as (s: StepIndex) => StepIndex)(prev) : updater;
            router.replace(`${pathname}?step=${next}`, { scroll: false });
            return next;
        });
    };

    const [data, setData] = useState<WizardData>(EMPTY);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Field helpers ───────────────────────────────────────────────────────────
    const field = (key: keyof WizardData) => ({
        value: data[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setData(d => ({ ...d, [key]: e.target.value })),
        'aria-invalid': !!errors[key],
    });

    const set = (key: keyof WizardData, value: string) =>
        setData(d => ({ ...d, [key]: value }));

    // ── Navigation ──────────────────────────────────────────────────────────────
    const goNext = () => {
        const stepErrors = validateStep(currentStep, data);
        if (Object.keys(stepErrors).length) {
            setErrors(stepErrors);
            return;
        }
        setErrors({});
        setCurrentStep(s => Math.min(s + 1, 5) as StepIndex);
    };

    const goBack = () => {
        setErrors({});
        setCurrentStep(s => Math.max(s - 1, 0) as StepIndex);
    };

    // ── Final submit ────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/organization/complete-setup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(getCookie('access_token') && {
                        'Authorization': `Bearer ${getCookie('access_token')}`,
                    }),
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...data,
                    county_id: parseInt(data.county_id, 10),
                    default_payday: parseInt(data.default_payday, 10),
                    admin_base_salary:  parseFloat(data.admin_base_salary),
                }),
            });

            const json = await res.json();

            if (!res.ok) {
                if (json.errors) setErrors(json.errors);
                toast.error(json.message ?? 'Setup failed. Please try again.');
                return;
            }

            markSetupComplete();
            toast.success('Setup complete! Welcome to PayHub.');
            router.push('/dashboard');
        } catch {
            toast.error('Network error. Please check your connection.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render steps ────────────────────────────────────────────────────────────
    const renderStep = () => {
        if (currentStep === 0) return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                    <Label>KRA PIN *</Label>
                    <Input {...field('kra_pin')} placeholder="A000000000A" />
                    {errors.kra_pin && <p className="text-xs text-destructive">{errors.kra_pin}</p>}
                </div>
                <div className="space-y-1">
                    <Label>Legal Type *</Label>
                    <Select value={data.legal_type} onValueChange={v => set('legal_type', v)}>
                        <SelectTrigger aria-invalid={!!errors.legal_type}><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{LEGAL_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.legal_type && <p className="text-xs text-destructive">{errors.legal_type}</p>}
                </div>
                <div className="space-y-1 md:col-span-2">
                    <Label>Registration Number</Label>
                    <Input {...field('registration_number')} placeholder="CPR/2024/XXXXX (optional)" />
                </div>
            </div>
        );

        if (currentStep === 1) return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1 md:col-span-2">
                    <Label>Physical Address *</Label>
                    <Input {...field('physical_address')} placeholder="123 Moi Avenue, Nairobi" />
                    {errors.physical_address && <p className="text-xs text-destructive">{errors.physical_address}</p>}
                </div>
                {/* <div className="space-y-1">
                    <Label>Location / City *</Label>
                    <Input {...field('location')} placeholder="Nairobi" />
                    {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
                </div>
                <div className="space-y-1">
                    <Label>County *</Label>
                    <Select value={data.county_id} onValueChange={v => set('county_id', v)}>
                        <SelectTrigger aria-invalid={!!errors.county_id}><SelectValue placeholder="Select county…" /></SelectTrigger>
                        <SelectContent>
                            {COUNTIES.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {errors.county_id && <p className="text-xs text-destructive">{errors.county_id}</p>}
                </div> */}
                <div className="space-y-1 md:col-span-2">
                    <Label>Postal Address</Label>
                    <Input {...field('postal_address')} placeholder="P.O. Box 1234-00100 Nairobi (optional)" />
                </div>
            </div>
        );

        if (currentStep === 2) return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                    <Label>Payroll Schedule *</Label>
                    <Select value={data.payroll_schedule} onValueChange={v => set('payroll_schedule', v)}>
                        <SelectTrigger aria-invalid={!!errors.payroll_schedule}><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{SCHEDULES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.payroll_schedule && <p className="text-xs text-destructive">{errors.payroll_schedule}</p>}
                </div>
                <div className="space-y-1">
                    <Label>Default Payday (1–31) *</Label>
                    <Input {...field('default_payday')} type="number" min={1} max={31} placeholder="28" />
                    {errors.default_payday && <p className="text-xs text-destructive">{errors.default_payday}</p>}
                </div>
                <div className="space-y-1">
                    <Label>Currency *</Label>
                    <Select value={data.currency} onValueChange={v => set('currency', v)}>
                        <SelectTrigger aria-invalid={!!errors.currency}><SelectValue /></SelectTrigger>
                        <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.currency && <p className="text-xs text-destructive">{errors.currency}</p>}
                </div>
            </div>
        );

        if (currentStep === 3) return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                    <Label>Account Name *</Label>
                    <Input {...field('bank_account_name')} placeholder="Acme Ltd" />
                    {errors.bank_account_name && <p className="text-xs text-destructive">{errors.bank_account_name}</p>}
                </div>
                <div className="space-y-1">
                    <Label>Account Number *</Label>
                    <Input {...field('bank_account_number')} placeholder="1234567890" />
                    {errors.bank_account_number && <p className="text-xs text-destructive">{errors.bank_account_number}</p>}
                </div>
                <div className="space-y-1">
                    <Label>Branch</Label>
                    <Input {...field('bank_branch')} placeholder="Nairobi (optional)" />
                </div>
                <div className="space-y-1">
                    <Label>SWIFT / BIC Code</Label>
                    <Input {...field('swift_code')} placeholder="KCBLKENX (optional)" />
                </div>
            </div>
        );

        if (currentStep === 4) return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                    <Label>First Name *</Label>
                    <Input {...field('admin_firstname')} placeholder="John" />
                    {errors.admin_firstname && <p className="text-red-500 text-xs mt-1">{errors.admin_firstname}</p>}
                </div>
                <div>
                    <Label>Surname *</Label>
                    <Input {...field('admin_surname')} placeholder="Doe" />
                    {errors.admin_surname && <p className="text-red-500 text-xs mt-1">{errors.admin_surname}</p>}
                </div>
                <div className="md:col-span-2">
                    <Label>Personal Email *</Label>
                    <Input {...field('admin_email')} type="email" placeholder="john@personal.com" />
                    {errors.admin_email && <p className="text-red-500 text-xs mt-1">{errors.admin_email}</p>}
                </div>
                <div>
                    <Label>Hire Date *</Label>
                    <Input {...field('admin_hire_date')} type="date" />
                    {errors.admin_hire_date && <p className="text-red-500 text-xs mt-1">{errors.admin_hire_date}</p>}
                </div>
                <div>
                    <Label>Start Date *</Label>
                    <Input {...field('admin_start_date')} type="date" />
                    {errors.admin_start_date && <p className="text-red-500 text-xs mt-1">{errors.admin_start_date}</p>}
                </div>
                <div>
                    <Label>Base Salary (KES) *</Label>
                    <Input {...field('admin_base_salary')} type="number" min={0} placeholder="50000" />
                    {errors.admin_base_salary && <p className="text-red-500 text-xs mt-1">{errors.admin_base_salary}</p>}
                </div>
            </div>
        )

        // Step 4 — Review
        const reviewRows: { label: string; value: string }[] = [
            { label: 'KRA PIN', value: data.kra_pin },
            { label: 'Legal Type', value: data.legal_type.replace('_', ' ') },
            { label: 'Reg. Number', value: data.registration_number || '—' },
            { label: 'Physical Address', value: data.physical_address },
            { label: 'Location', value: data.location },
            { label: 'Postal Address', value: data.postal_address || '—' },
            { label: 'County', value: COUNTIES.find(c => String(c.id) === data.county_id)?.name ?? data.county_id },
            { label: 'Payroll Schedule', value: data.payroll_schedule },
            { label: 'Default Payday', value: data.default_payday },
            { label: 'Currency', value: data.currency },
            { label: 'Account Name', value: data.bank_account_name },
            { label: 'Account Number', value: data.bank_account_number },
            { label: 'Bank Branch', value: data.bank_branch || '—' },
            { label: 'SWIFT Code', value: data.swift_code || '—' },
            { label: 'Admin First Name', value: data.admin_firstname },
            { label: 'Admin Surname', value: data.admin_surname },
            { label: 'Admin Email', value: data.admin_email },
            { label: 'Hire Date', value: data.admin_hire_date },
            { label: 'Start Date', value: data.admin_start_date },
            { label: 'Base Salary', value: `KES ${Number(data.admin_base_salary).toLocaleString()}` },
        ];

        return (
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-2">
                    Please review your details before submitting. Click <strong>Back</strong> to make changes.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 text-sm rounded-lg border overflow-hidden">
                    {reviewRows.map(r => (
                        <div
                            key={r.label}
                            className="flex justify-between gap-4 px-4 py-2.5 border-b border-border last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0"
                        >
                            <span className="text-muted-foreground">{r.label}</span>
                            <span className="font-medium text-right max-w-[60%] truncate">{r.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ── Full render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="mt-4 px-6 space-y-2">
                    <h1 className="text-2xl font-medium">Organisation Setup</h1>
                    <p className="text-base text-muted-foreground">
                        Complete your organisation profile to get started.
                    </p>
                </div>

                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-6">
                    <div className="w-full">
                        <div className="space-y-1 mb-6">
                            <h2 className="text-base font-semibold">
                                Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep]}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {currentStep < 5
                                    ? 'Fill in the required fields, then click Next.'
                                    : 'Review everything before submitting.'}
                            </p>
                        </div>

                        <div className="min-h-[280px]">
                            {renderStep()}
                        </div>

                        <div className="mt-8 flex justify-between gap-3">
                            {currentStep > 0 && (
                                <Button variant="outline" onClick={goBack} disabled={isSubmitting}>
                                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                                </Button>
                            )}
                            <div className="ml-auto">
                                {currentStep < 5 && (
                                    <Button
                                        onClick={goNext}
                                        className="bg-[#be2ed6] hover:bg-[#a526bc] text-white"
                                    >
                                        Next <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                )}
                                {currentStep === 5 && (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="bg-[#be2ed6] hover:bg-[#a526bc] text-white"
                                    >
                                        {isSubmitting
                                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                                            : 'Confirm & Finish Setup'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SetupPage() {
    return (
        <Suspense fallback={<div className="px-6 py-6 text-sm text-muted-foreground">Loading…</div>}>
            <SetupWizard />
        </Suspense>
    );
}