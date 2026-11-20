'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { countryAPI, countyAPI, MinimalCountryType, MinimalCountyType } from '@/services/api/countries-counties';
import {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/reui/stepper';
import { AuthBrand } from '@/components/auth/auth-brand';
import { PasswordInput } from '@/components/auth/password-input';
import { authFontClasses } from '@/components/auth/auth-fonts';
import {
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
  authSelectTriggerClass,
} from '@/components/auth/styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = 'starter' | 'professional' | 'enterprise';

interface PlanOption {
  id: number;
  code: string;
  name: string;
  billing_cycle: string;
  base_price: number;
  price_per_employee?: number | null;
  trial_days: number | null;
  max_employees: number | null;
  requires_card: boolean;
  features: string[];
}

interface FieldErrors {
  email?: string;
  username?: string;
  password?: string;
  phone?: string;
  country_id?: string;
  county_id?: string;
  company_name?: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Account', description: 'Email, password & username' },
  { title: 'Company', description: 'Business & contact details' },
  { title: 'Plan', description: 'Choose your pricing' },
];

// ─── Component ────────────────────────────────────────────────────────────────

function RegisterPageContent() {
  const router = useRouter();
  const { checkAuthStatus } = useAuth();
  const searchParams = useSearchParams();

  // Resolve plan from URL query string, default to starter
  const rawPlan = (searchParams.get('plan') ?? 'starter').toLowerCase() as Plan;

  // Plans
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Only worth showing the Monthly/Annual toggle if the backend actually
  // returned plans on more than one cycle.
  const availableCycles = Array.from(new Set(plans.map(p => p.billing_cycle)));
  const visiblePlans = availableCycles.length > 1
    ? plans.filter(p => p.billing_cycle === billingCycle)
    : plans;

  const handleBillingCycleChange = (cycle: 'monthly' | 'annual') => {
    setBillingCycle(cycle);
    // keep the same tier selected, just on the new cycle
    const current = plans.find(p => p.code === selectedPlanCode);
    if (current) {
      const match = plans.find(p => p.name === current.name && p.billing_cycle === cycle);
      if (match) setSelectedPlanCode(match.code);
    }
  };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription/plans`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setPlans(d.data);
          // default to the plan from URL or first available
          const urlPlan = d.data.find((p: PlanOption) =>
            p.code.startsWith(rawPlan)
          );
          setSelectedPlanCode(urlPlan?.code ?? d.data[0]?.code ?? '');
        }
      })
      .catch(() => {/* silently ignore — user can still pick */ });
  }, []);

  // Step state
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);

  // Form state
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Country / county — sourced from the backend
  const [countries, setCountries] = useState<MinimalCountryType[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countryId, setCountryId] = useState<number | ''>('');
  const [counties, setCounties] = useState<MinimalCountyType[]>([]);
  const [countiesLoading, setCountiesLoading] = useState(false);
  const [countyId, setCountyId] = useState<number | ''>('');
  const [pendingDummyCounty, setPendingDummyCounty] = useState<string | null>(null);

  useEffect(() => {
    countryAPI.getCountries({}, true).then(res => {
      if (res.success && Array.isArray(res.data)) {
        setCountries(res.data as MinimalCountryType[]);
      }
      setCountriesLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!countryId) {
      setCounties([]);
      setCountyId('');
      return;
    }
    setCountiesLoading(true);
    setCountyId('');
    countyAPI.getCounties(countryId, {}, true).then(res => {
      const list = res.success && Array.isArray(res.data) ? (res.data as MinimalCountyType[]) : [];
      setCounties(list);
      setCountiesLoading(false);
      if (pendingDummyCounty) {
        const match = list.find(c => c.name === pendingDummyCounty);
        setCountyId(match ? match.id : list[0]?.id ?? '');
        setPendingDummyCounty(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // Whether the County field should require a value.
  const countyRequired = counties.length > 0;
  // Whether the County field slot should render at all (while loading, keep the
  // slot so the side-by-side layout doesn't jump).
  const showCountyField = !!countryId && (countiesLoading || counties.length > 0);

  const fillDummy = () => {
    const n = Math.floor(Math.random() * 90) + 1; // 1–90
    setCompanyName(`Airproof Test ${String(n).padStart(2, '0')}`);
    setEmail(`isaac@airprooftest${String(n).padStart(2, '0')}.com`);
    setUsername('isaac');
    setPassword('Password123');
    setPhone('+25471234567');
    const kenya = countries.find(c => c.iso2 === 'KE' || c.name === 'Kenya');
    if (kenya) {
      setPendingDummyCounty('Nairobi');
      setCountryId(kenya.id);
    }
  };

  // ── Step validation ─────────────────────────────────────────────────────────

  const validateStep1 = () => {
    const errs: FieldErrors = {};
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a valid email address';
    }
    if (!username.trim()) errs.username = 'Username is required';
    if (!password) {
      errs.password = 'Password is required';
    } else if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      // Mirrors ValidationService::validatePassword() on the backend.
      errs.password = 'Use at least 8 characters, with an uppercase letter, a lowercase letter and a number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: FieldErrors = {};
    if (!companyName.trim()) errs.company_name = 'Company name is required';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    if (!countryId) errs.country_id = 'Please select a country';
    if (countryId && countyRequired && !countyId) errs.county_id = 'Please select a county';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToStep = (target: number) => {
    setErrors({});
    setStep(target);
    setMaxStepReached(prev => Math.max(prev, target));
  };

  const handleNext = () => {
    const isValid = step === 1 ? validateStep1() : step === 2 ? validateStep2() : true;
    if (!isValid) {
      toast.error('Please fix the errors below.');
      return;
    }
    goToStep(Math.min(step + 1, STEPS.length));
  };

  const handleBack = () => {
    setErrors({});
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleStepNavChange = (value: number) => {
    // Only allow jumping back to steps already visited — forward progress
    // still has to go through the validated Next button.
    if (value <= maxStepReached) setStep(value);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enter key (or any submit) while on an earlier step just advances it.
    if (step < STEPS.length) {
      handleNext();
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          username,
          password,
          phone,
          country_id: countryId,
          county_id: countyRequired ? countyId : undefined,
          company_name: companyName,
          plan_code: selectedPlanCode,          // full code e.g. "professional_monthly"
          plan: selectedPlanCode.split('_')[0], // base name for backward compat
        }),
      });

      const data = await res.json();

      // ── Field-level validation errors (422) ─────────────────────────────────
      if (!res.ok && data.errors) {
        setErrors(data.errors);
        toast.error('Please fix the errors below.');
        // Route the user back to whichever step owns the first error.
        if (data.errors.email || data.errors.username || data.errors.password) {
          goToStep(1);
        } else if (data.errors.company_name || data.errors.phone || data.errors.country_id || data.errors.county_id) {
          goToStep(2);
        }
        return;
      }

      if (!res.ok) {
        toast.error(data.message ?? 'Registration failed. Please try again.');
        return;
      }

      // ── Paid plan — redirect to payment waiting screen ───────────────────────
      if (data.requires_payment) {
        const params = new URLSearchParams({
          checkout_request_id: '',            // not known yet — will be set after initiate-payment
          organization_id: String(data.organization_id),
          subscription_id: String(data.subscription_id),
          phone: data.phone,
          amount: String(data.amount),
          plan_name: data.plan_name ?? rawPlan,
        });

        // Kick off the STK push immediately then redirect
        try {
          const payRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription/initiate-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organization_id: data.organization_id,
              subscription_id: data.subscription_id,
              phone: data.phone,
              amount: data.amount,
            }),
          });
          const payData = await payRes.json();

          if (!payRes.ok || !payData.checkout_request_id) {
            toast.error(payData.message ?? 'Failed to send payment prompt. Please try again.');
            return;
          }

          params.set('checkout_request_id', payData.checkout_request_id);
          router.push(`/register/payment?${params.toString()}`);
        } catch {
          toast.error('Failed to initiate payment. Please try again.');
        }
        return;
      }

      // ── Starter plan — JWT already set in cookie; redirect to dashboard ──────
      if (data.token) {
        toast.success('Account created! Redirecting…');
        await checkAuthStatus();   // hydrates AuthContext from the cookie before navigating
        router.push('/setup');
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-auth-canvas text-auth-ink">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <AuthBrand />
        <p className="text-sm text-auth-muted">
          Already have an account?{' '}
          <Link href="/login" className={authLinkClass}>
            Sign in
          </Link>
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-8 space-y-2">
          <h1 className="auth-display text-[28px] font-semibold leading-tight tracking-tight">
            Create your PayKe account
          </h1>
          <p className="text-[15px] text-auth-muted">
            Three short steps: your account, your company, and a plan.
          </p>
        </div>

        <div className="rounded-xl border border-auth-line bg-white p-5 sm:p-8">
          <Stepper
            value={step}
            onValueChange={handleStepNavChange}
            indicators={{
              completed: <CheckIcon className="size-3.5" />,
            }}
            className="w-full space-y-8"
          >
            <StepperNav>
              {STEPS.map((s, index) => {
                const stepNum = index + 1;
                const isClickable = stepNum <= maxStepReached;
                return (
                  <StepperItem
                    key={stepNum}
                    step={stepNum}
                    className={`relative flex-1 items-start ${isClickable ? '' : 'pointer-events-none opacity-60'}`}
                  >
                    <StepperTrigger className="flex flex-col gap-2.5 text-left">
                      <StepperIndicator className="data-[state=active]:bg-auth-accent data-[state=active]:text-white data-[state=completed]:bg-auth-ink data-[state=completed]:text-white">
                        {stepNum}
                      </StepperIndicator>
                      <StepperTitle className="text-sm font-medium text-auth-ink">{s.title}</StepperTitle>
                      <StepperDescription className="text-xs text-auth-muted">{s.description}</StepperDescription>
                    </StepperTrigger>

                    {STEPS.length > stepNum && (
                      <StepperSeparator className="bg-auth-line group-data-[state=completed]/step:bg-auth-ink absolute inset-x-0 top-2.5 left-[calc(50%+0.875rem)] m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none" />
                    )}
                  </StepperItem>
                );
              })}
            </StepperNav>

            <form onSubmit={handleSubmit} noValidate>
              <StepperPanel className="text-sm">

                {/* ── Step 1: Account ───────────────────────────────────────── */}
                <StepperContent value={1} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className={authLabelClass}>Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      aria-invalid={!!errors.email}
                      className={authInputClass}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username" className={authLabelClass}>Username</Label>
                    <Input
                      id="username"
                      placeholder="johndoe"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      aria-invalid={!!errors.username}
                      className={authInputClass}
                    />
                    {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className={authLabelClass}>Password</Label>
                    <PasswordInput
                      id="password"
                      autoComplete="new-password"
                      placeholder="Create a password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      aria-invalid={!!errors.password}
                    />
                    {errors.password ? (
                      <p className="text-xs text-destructive">{errors.password}</p>
                    ) : (
                      <p className="text-xs text-auth-muted">
                        At least 8 characters, with an uppercase letter, a lowercase letter and a number.
                      </p>
                    )}
                  </div>
                </StepperContent>

                {/* ── Step 2: Company ───────────────────────────────────────── */}
                <StepperContent value={2} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="company_name" className={authLabelClass}>Company name</Label>
                    <Input
                      id="company_name"
                      autoComplete="organization"
                      placeholder="Acme Ltd"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      aria-invalid={!!errors.company_name}
                      className={authInputClass}
                    />
                    {errors.company_name && <p className="text-xs text-destructive">{errors.company_name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className={authLabelClass}>Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+254 7XX XXX XXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      aria-invalid={!!errors.phone}
                      className={authInputClass}
                    />
                    {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                  </div>

                  <div className={`grid w-full gap-5 ${showCountyField ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="space-y-2">
                      <Label htmlFor="country" className={authLabelClass}>Country</Label>
                      <Select
                        value={countryId ? String(countryId) : ''}
                        onValueChange={v => setCountryId(Number(v))}
                        disabled={countriesLoading}
                      >
                        <SelectTrigger id="country" className={authSelectTriggerClass} aria-invalid={!!errors.country_id}>
                          <SelectValue placeholder={countriesLoading ? 'Loading…' : 'Select your country'} />
                        </SelectTrigger>
                        <SelectContent className={authFontClasses} searchable searchPlaceholder="Search countries...">
                          {countries.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.country_id && <p className="text-xs text-destructive">{errors.country_id}</p>}
                    </div>

                    {showCountyField && (
                      <div className="space-y-2">
                        <Label htmlFor="county" className={authLabelClass}>County</Label>
                        <Select
                          value={countyId ? String(countyId) : ''}
                          onValueChange={v => setCountyId(Number(v))}
                          disabled={countiesLoading}
                        >
                          <SelectTrigger id="county" className={authSelectTriggerClass} aria-invalid={!!errors.county_id}>
                            <SelectValue placeholder={countiesLoading ? 'Loading…' : 'Select your county'} />
                          </SelectTrigger>
                          <SelectContent className={authFontClasses} searchable searchPlaceholder="Search counties...">
                            {counties.map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.county_id && <p className="text-xs text-destructive">{errors.county_id}</p>}
                      </div>
                    )}
                  </div>
                </StepperContent>

                {/* ── Step 3: Plan ──────────────────────────────────────────── */}
                <StepperContent value={3} className="space-y-6">
                  {plans.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-auth-muted">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Loading plans…
                    </p>
                  ) : (
                    <>
                      {/* Billing toggle — only shown if the backend returned more than one cycle */}
                      {availableCycles.length > 1 && (
                        <div className="flex justify-center">
                          <div
                            role="group"
                            aria-label="Billing cycle"
                            className="inline-flex items-center gap-1 rounded-lg border border-auth-line bg-auth-canvas p-1"
                          >
                            {(['monthly', 'annual'] as const).map(cycle => (
                              <button
                                key={cycle}
                                type="button"
                                aria-pressed={billingCycle === cycle}
                                onClick={() => handleBillingCycleChange(cycle)}
                                className={cn(
                                  'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium outline-none transition-colors',
                                  'focus-visible:ring-2 focus-visible:ring-auth-accent/40',
                                  billingCycle === cycle
                                    ? 'bg-white text-auth-ink shadow-sm'
                                    : 'text-auth-muted hover:text-auth-ink',
                                )}
                              >
                                {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                                {cycle === 'annual' && (
                                  <span className="rounded-full bg-auth-accent-soft px-1.5 py-0.5 text-xs font-medium text-auth-accent-strong">
                                    15% off
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Plan cards */}
                      <div role="radiogroup" aria-label="Subscription plan" className="grid items-stretch gap-4 sm:grid-cols-3">
                        {visiblePlans.map(p => {
                          const popular = p.code.startsWith('professional');
                          const isSelected = selectedPlanCode === p.code;
                          const unit = p.billing_cycle === 'annual' ? 'yr' : 'mo';
                          return (
                            <button
                              key={p.code}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setSelectedPlanCode(p.code)}
                              className={cn(
                                'relative flex flex-col rounded-xl border bg-white p-5 text-left outline-none transition-colors',
                                'focus-visible:ring-2 focus-visible:ring-auth-accent/40',
                                isSelected
                                  ? 'border-auth-accent ring-1 ring-auth-accent'
                                  : 'border-auth-line hover:border-auth-ink/30',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1.5">
                                  <span className="auth-display block text-[15px] font-semibold text-auth-ink">{p.name}</span>
                                  {popular && (
                                    <span className="inline-block rounded-full bg-auth-accent-soft px-2 py-0.5 text-[11px] font-medium text-auth-accent-strong">
                                      Most popular
                                    </span>
                                  )}
                                </div>
                                <span
                                  aria-hidden
                                  className={cn(
                                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                                    isSelected ? 'border-auth-accent bg-auth-accent text-white' : 'border-auth-line bg-white',
                                  )}
                                >
                                  {isSelected && <CheckIcon className="size-3" />}
                                </span>
                              </div>

                              <div className="mt-4 flex items-baseline gap-1">
                                <span className="auth-display text-2xl font-semibold text-auth-ink">
                                  {p.base_price === 0 ? 'Free' : `KES ${p.base_price.toLocaleString()}`}
                                </span>
                                {p.base_price !== 0 && (
                                  <span className="text-sm text-auth-muted">/{unit}</span>
                                )}
                              </div>

                              <p className="mt-1 min-h-4 text-xs text-auth-muted">
                                {p.price_per_employee != null
                                  ? `+ KES ${p.price_per_employee}/employee/${unit}`
                                  : ''}
                              </p>
                              <p className="text-xs text-auth-muted">
                                {p.max_employees ? `Up to ${p.max_employees} employees` : 'Unlimited employees'}
                              </p>
                              {p.trial_days ? (
                                <p className="mt-2 text-xs font-medium text-auth-body">
                                  {p.trial_days}-day free trial
                                </p>
                              ) : null}

                              <ul className="mt-4 flex-1 space-y-2 border-t border-auth-line pt-4">
                                {p.features.map(feat => (
                                  <li key={feat} className="flex items-start gap-2">
                                    <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-auth-muted" aria-hidden />
                                    <span className="text-xs leading-snug text-auth-body">{feat}</span>
                                  </li>
                                ))}
                              </ul>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </StepperContent>
              </StepperPanel>

              {process.env.NODE_ENV === 'development' && step === 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-full border border-dashed border-auth-line text-xs text-auth-muted hover:bg-auth-canvas"
                  onClick={fillDummy}
                >
                  Fill sample data (development only)
                </Button>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={handleBack} className={authSecondaryButtonClass}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}

                {step < STEPS.length ? (
                  <Button key="nav-next" type="button" onClick={handleNext} className={cn(authPrimaryButtonClass, 'ml-auto w-auto px-6')}>
                    Continue
                  </Button>
                ) : (
                  <Button key="nav-submit" type="submit" disabled={isLoading} className={cn(authPrimaryButtonClass, 'ml-auto w-auto px-6')}>
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden />
                        Creating account…
                      </>
                    ) : selectedPlanCode.startsWith('starter') ? (
                      'Start free trial'
                    ) : (
                      'Continue to payment (M-Pesa)'
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Stepper>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-auth-canvas text-sm text-auth-muted">Loading…</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}