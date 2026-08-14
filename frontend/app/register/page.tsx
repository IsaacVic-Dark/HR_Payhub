'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Building2, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const PURPLE = "#895bf5";

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

export default function RegisterPage() {
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
    } else if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      errs.password = 'Min. 8 chars, with an uppercase letter and a number';
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
    <>
      <div className="pt-4 px-6">
        <a href="#" className="flex items-center gap-1.5 shrink-0">
          <span className="text-xl font-bold" style={{ color: PURPLE }}>
            Pay<span className="text-gray-900">Ke</span>
          </span>
        </a>
      </div>
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-2xl border-0 shadow-none bg-transparent">
          <CardHeader className="">
            <div className="flex justify-center gap-2">
              <CardTitle className="text-xl">Create your PayHub account</CardTitle>
            </div>
          </CardHeader>

          <CardContent>
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
                      <StepperTrigger className="flex flex-col gap-2.5">
                        <StepperIndicator>{stepNum}</StepperIndicator>
                        <StepperTitle>{s.title}</StepperTitle>
                        <StepperDescription>{s.description}</StepperDescription>
                      </StepperTrigger>

                      {STEPS.length > stepNum && (
                        <StepperSeparator className="group-data-[state=completed]/step:bg-primary absolute inset-x-0 top-2.5 left-[calc(50%+0.875rem)] m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none" />
                      )}
                    </StepperItem>
                  );
                })}
              </StepperNav>

              <form onSubmit={handleSubmit} noValidate>
                <StepperPanel className="text-sm">

                  {/* ── Step 1: Account ───────────────────────────────────────── */}
                  <StepperContent value={1} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPw ? 'text' : 'password'}
                          placeholder="Min. 8 chars, uppercase, number"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          aria-invalid={!!errors.password}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="johndoe"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        aria-invalid={!!errors.username}
                      />
                      {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
                    </div>
                  </StepperContent>

                  {/* ── Step 2: Company ───────────────────────────────────────── */}
                  <StepperContent value={2} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        placeholder="Acme Ltd"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        aria-invalid={!!errors.company_name}
                      />
                      {errors.company_name && <p className="text-xs text-destructive">{errors.company_name}</p>}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+254 7XX XXX XXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        aria-invalid={!!errors.phone}
                      />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                    </div>

                    <div className={`grid w-full gap-4 ${showCountyField ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <div className="space-y-1">
                        <Label htmlFor="country">Country</Label>
                        <Select
                          value={countryId ? String(countryId) : ''}
                          onValueChange={v => setCountryId(Number(v))}
                          disabled={countriesLoading}
                        >
                          <SelectTrigger id="country" className="w-full" aria-invalid={!!errors.country_id}>
                            <SelectValue placeholder={countriesLoading ? 'Loading…' : 'Select your country'} />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.country_id && <p className="text-xs text-destructive">{errors.country_id}</p>}
                      </div>

                      {showCountyField && (
                        <div className="space-y-1">
                          <Label htmlFor="county">County</Label>
                          <Select
                            value={countyId ? String(countyId) : ''}
                            onValueChange={v => setCountyId(Number(v))}
                            disabled={countiesLoading}
                          >
                            <SelectTrigger id="county" className="w-full" aria-invalid={!!errors.county_id}>
                              <SelectValue placeholder={countiesLoading ? 'Loading…' : 'Select your county'} />
                            </SelectTrigger>
                            <SelectContent>
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
                      <p className="text-sm text-muted-foreground">Loading plans…</p>
                    ) : (
                      <>
                        {/* Billing toggle — only shown if the backend returned more than one cycle */}
                        {availableCycles.length > 1 && (
                          <div className="flex justify-center">
                            <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
                              <button
                                type="button"
                                onClick={() => handleBillingCycleChange('monthly')}
                                className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${billingCycle === 'monthly'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-500 hover:text-gray-700'
                                  }`}
                              >
                                Monthly
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBillingCycleChange('annual')}
                                className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${billingCycle === 'annual'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-500 hover:text-gray-700'
                                  }`}
                              >
                                Annual
                                <span
                                  className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: PURPLE }}
                                >
                                  15% off
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Cards */}
                        <div className="grid gap-4 sm:grid-cols-3 items-stretch">
                          {visiblePlans.map(p => {
                            const highlight = p.code.startsWith('professional');
                            const isSelected = selectedPlanCode === p.code;
                            return (
                              <button
                                key={p.code}
                                type="button"
                                onClick={() => setSelectedPlanCode(p.code)}
                                className={`relative text-left rounded-2xl border flex flex-col transition-all ${highlight
                                    ? 'border-transparent shadow-2xl'
                                    : 'border-gray-200 shadow-sm'
                                  } ${isSelected ? 'ring-2 ring-offset-2' : ''}`}
                                style={{
                                  ...(highlight
                                    ? { background: '#1a1a2e', color: 'white' }
                                    : { background: 'white' }),
                                  ...(isSelected ? ({ '--tw-ring-color': PURPLE } as React.CSSProperties) : {}),
                                }}
                              >
                                {highlight && (
                                  <div
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold text-white px-3 py-1 rounded-full shadow"
                                    style={{ backgroundColor: PURPLE }}
                                  >
                                    Most Popular
                                  </div>
                                )}

                                {isSelected && (
                                  <div
                                    className="absolute top-3 right-3 rounded-full p-1"
                                    style={{ backgroundColor: PURPLE }}
                                  >
                                    <CheckIcon className="h-3.5 w-3.5 text-white" />
                                  </div>
                                )}

                                <div className="p-5 flex flex-col flex-1">
                                  {/* Plan name */}
                                  <div className="mb-2">
                                    <span
                                      className="text-xs font-semibold uppercase tracking-widest"
                                      style={{ color: highlight ? '#a78bfa' : PURPLE }}
                                    >
                                      {p.name}
                                    </span>
                                  </div>

                                  {/* Price */}
                                  <div className="mb-1 flex items-end gap-1">
                                    <span className={`text-3xl font-extrabold ${highlight ? 'text-white' : 'text-gray-900'}`}>
                                      {p.base_price === 0 ? 'Free' : `KES ${p.base_price.toLocaleString()}`}
                                    </span>
                                    {p.base_price !== 0 && (
                                      <span className={`text-sm mb-1.5 ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                                        /{p.billing_cycle === 'annual' ? 'yr' : 'mo'}
                                      </span>
                                    )}
                                  </div>

                                  {/* Per-employee */}
                                  {p.price_per_employee != null ? (
                                    <p className={`text-xs mb-1 ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                                      + KES {p.price_per_employee}/employee/{p.billing_cycle === 'annual' ? 'yr' : 'mo'}
                                    </p>
                                  ) : (
                                    <p className="text-xs mb-1 invisible">placeholder</p>
                                  )}

                                  {/* Employee cap */}
                                  <p className={`text-xs mb-3 ${highlight ? 'text-gray-400' : 'text-gray-400'}`}>
                                    {p.max_employees ? `Up to ${p.max_employees} employees` : 'Unlimited employees'}
                                  </p>

                                  {/* Trial badge */}
                                  {p.trial_days ? (
                                    <div className="mb-3">
                                      <span
                                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                        style={{
                                          backgroundColor: `${PURPLE}20`,
                                          color: highlight ? '#c4b5fd' : PURPLE,
                                        }}
                                      >
                                        {p.trial_days}-day free trial
                                      </span>
                                    </div>
                                  ) : null}

                                  {/* Divider */}
                                  <div className={`border-t mb-3 ${highlight ? 'border-white/10' : 'border-gray-100'}`} />

                                  {/* Features */}
                                  <ul className="space-y-1.5 flex-1 mb-4">
                                    {p.features.map(feat => (
                                      <li key={feat} className="flex items-start gap-2">
                                        <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="none">
                                          <circle cx="10" cy="10" r="10" fill={highlight ? '#895bf520' : `${PURPLE}18`} />
                                          <path
                                            d="M6 10l3 3 5-5"
                                            stroke={highlight ? '#a78bfa' : PURPLE}
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                        <span className={`text-xs leading-snug ${highlight ? 'text-gray-300' : 'text-gray-600'}`}>
                                          {feat}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>

                                  {/* Select indicator */}
                                  <div
                                    className="w-full py-2 rounded-lg text-sm font-semibold text-center transition-all"
                                    style={
                                      isSelected
                                        ? { backgroundColor: PURPLE, color: 'white' }
                                        : highlight
                                          ? { backgroundColor: 'rgba(255,255,255,0.08)', color: 'white', border: '1.5px solid rgba(255,255,255,0.2)' }
                                          : { backgroundColor: 'transparent', color: PURPLE, border: `1.5px solid ${PURPLE}` }
                                    }
                                  >
                                    {isSelected ? 'Selected' : 'Select plan'}
                                  </div>
                                </div>
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
                    variant="outline"
                    className="mt-4 w-full text-muted-foreground"
                    onClick={fillDummy}
                  >
                    Fill dummy data
                  </Button>
                )}

                <div className="mt-6 flex items-center justify-between gap-3">
                  {step > 1 ? (
                    <Button type="button" variant="outline" onClick={handleBack}>
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}

                  {step < STEPS.length ? (
                    <Button key="nav-next" type="button" onClick={handleNext} className="ml-auto">
                      Next
                    </Button>
                  ) : (
                    <Button key="nav-submit" type="submit" disabled={isLoading} className="ml-auto">
                      {isLoading
                        ? 'Creating account…'
                        : selectedPlanCode.startsWith('starter')
                          ? 'Start Free Trial'
                          : 'Continue to Payment — M-Pesa'}
                    </Button>
                  )}
                </div>
              </form>
            </Stepper>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-primary underline underline-offset-2">Sign in</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}