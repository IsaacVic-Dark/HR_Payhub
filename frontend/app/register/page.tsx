'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Building2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = 'starter' | 'professional' | 'enterprise';

interface PlanOption {
  id: number;
  code: string;
  name: string;
  billing_cycle: string;
  base_price: number;
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
  country?: string;
  company_name?: string;
}

// ─── Plan badge config ────────────────────────────────────────────────────────

const PLAN_META: Record<Plan, { label: string; variant: 'default' | 'secondary' | 'outline'; color: string }> = {
  starter: { label: 'Starter — Free Trial', variant: 'secondary', color: 'bg-emerald-100 text-emerald-800' },
  professional: { label: 'Professional Plan', variant: 'default', color: 'bg-blue-100 text-blue-800' },
  enterprise: { label: 'Enterprise Plan', variant: 'default', color: 'bg-violet-100 text-violet-800' },
};

const COUNTRIES = [
  'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Ethiopia',
  'Nigeria', 'South Africa', 'Ghana', 'Egypt', 'Morocco',
  'United States', 'United Kingdom', 'Other',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const { user, checkAuthStatus } = useAuth();
  const searchParams = useSearchParams();

  // Resolve plan from URL query string, default to starter
  const rawPlan = (searchParams.get('plan') ?? 'starter').toLowerCase() as Plan;
  const plan: Plan = ['starter', 'professional', 'enterprise'].includes(rawPlan)
    ? rawPlan
    : 'starter';

  // Plans
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('');

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

  const selectedPlan = plans.find(p => p.code === selectedPlanCode) ?? null;

  // Form state
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const fillDummy = () => {
    const n = Math.floor(Math.random() * 90) + 1; // 1–90
    setCompanyName(`Airproof Test ${String(n).padStart(2, '0')}`);
    setEmail(`isaac@airprooftest${String(n).padStart(2, '0')}.com`);
    setUsername('isaac');
    setPassword('Password123');
    setPhone('+25471234567');
    setCountry('Kenya');
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          country,
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
          plan_name: data.plan_name ?? plan,
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
  const planMeta = PLAN_META[plan];

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Create your PayHub account</CardTitle>
          </div>
          <CardDescription>Get your payroll running in minutes.</CardDescription>

          {/* Plan badge */}
          {/* Plan selector */}
          {plans.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-2">
              {plans.map(p => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(p.code)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${selectedPlanCode === p.code
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary'
                    }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {p.name}
                  {p.base_price === 0
                    ? ' — Free Trial'
                    : ` — KES ${p.base_price.toLocaleString()}/mo`}
                </button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Company Name */}
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

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email">Work Email</Label>
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

            {/* Username */}
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

            {/* Password */}
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

            {/* Phone */}
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

            {/* Country */}
            <div className="space-y-1">
              <Label htmlFor="country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country" aria-invalid={!!errors.country}>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
            </div>

            {process.env.NODE_ENV === 'development' && (
              <Button type="button" variant="outline" className="w-full text-muted-foreground" onClick={fillDummy}>
                Fill dummy data
              </Button>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? 'Creating account…'
                : selectedPlanCode.startsWith('starter')
                  ? 'Start Free Trial'
                  : 'Continue to Payment — M-Pesa'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <a href="/login" className="text-primary underline underline-offset-2">Sign in</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}