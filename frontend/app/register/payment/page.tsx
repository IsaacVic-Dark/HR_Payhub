'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Smartphone, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS  = 3_000;  //  3 seconds between polls
const TIMEOUT_MS        = 5 * 60 * 1_000; // 5-minute hard timeout

type PaymentState = 'waiting' | 'completed' | 'failed' | 'timeout';

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentWaitingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const checkoutRequestId = searchParams.get('checkout_request_id') ?? '';
  const phone             = searchParams.get('phone')               ?? '';
  const amount            = searchParams.get('amount')              ?? '';
  const planName          = searchParams.get('plan_name')           ?? '';
  const organizationId    = searchParams.get('organization_id')     ?? '';
  const subscriptionId    = searchParams.get('subscription_id')     ?? '';

  const [state,       setState]       = useState<PaymentState>('waiting');
  const [retrying,    setRetrying]    = useState(false);
  const [elapsed,     setElapsed]     = useState(0);   // seconds, for display

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // ── Cleanup helper ──────────────────────────────────────────────────────────
  const clearTimers = () => {
    if (intervalRef.current)  clearInterval(intervalRef.current);
    if (timeoutRef.current)   clearTimeout(timeoutRef.current);
  };

  // ── Poll /subscription/payment-status ──────────────────────────────────────
  const startPolling = (crid: string) => {
    clearTimers();
    startTimeRef.current = Date.now();

    // Hard 5-minute timeout
    timeoutRef.current = setTimeout(() => {
      clearTimers();
      setState('timeout');
    }, TIMEOUT_MS);

    // Elapsed-seconds counter for UI
    const ticker = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1_000);

    intervalRef.current = setInterval(async () => {
      try {
        const res  = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription/payment-status?checkout_request_id=${encodeURIComponent(crid)}`,
          { credentials: 'include' }
        );
        const data = await res.json();

        if (!data.success) return; // transient — keep polling

        if (data.status === 'completed') {
          clearTimers();
          clearInterval(ticker);

          // Store JWT in cookie — the backend sets httpOnly cookie, but the
          // token is also returned in the body so we can pass it to AuthContext.
          // We store it in a short-lived cookie for the middleware to pick up.
          if (data.token) {
            // Set a readable (non-httpOnly) flag cookie so middleware.js can
            // read setup_completed / subscription_status from the JWT payload.
            // The httpOnly access_token cookie was already set by mpesaCallback
            // via the pending_tokens mechanism → the backend issues it as a
            // regular Set-Cookie on the next authenticated request.
            // Here we just redirect — the JWT in the cookie is already there.
            document.cookie = `access_token=${data.token}; path=/; SameSite=Lax`;
          }

          setState('completed');
          toast.success('Payment confirmed! Setting up your account…');

          // Small delay so the user sees the success state before redirect
          setTimeout(() => router.push('/dashboard'), 1_500);
          return;
        }

        if (data.status === 'failed') {
          clearTimers();
          clearInterval(ticker);
          setState('failed');
          return;
        }

        // status is 'initiated' or 'pending' — keep waiting
      } catch {
        // Network hiccup — keep polling silently
      }
    }, POLL_INTERVAL_MS);

    // Return cleanup for ticker too
    return () => { clearInterval(ticker); };
  };

  // ── Start polling on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!checkoutRequestId) {
      setState('failed');
      return;
    }

    const tickerCleanup = startPolling(checkoutRequestId);
    return () => {
      clearTimers();
      tickerCleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutRequestId]);

  // ── Retry: re-trigger STK push ──────────────────────────────────────────────
  const handleRetry = async () => {
    setRetrying(true);
    setState('waiting');
    setElapsed(0);

    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/subscription/initiate-payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: parseInt(organizationId, 10),
          subscription_id: parseInt(subscriptionId, 10),
          phone,
          amount: parseFloat(amount),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.checkout_request_id) {
        toast.error(data.message ?? 'Could not resend payment prompt.');
        setState('failed');
        return;
      }

      // Update URL so a page refresh works correctly
      const params = new URLSearchParams(searchParams.toString());
      params.set('checkout_request_id', data.checkout_request_id);
      router.replace(`/register/payment?${params.toString()}`);

      startPolling(data.checkout_request_id);
      toast.info('Payment prompt resent — check your phone.');
    } catch {
      toast.error('Network error. Please try again.');
      setState('failed');
    } finally {
      setRetrying(false);
    }
  };

  // ── Format elapsed time as m:ss ────────────────────────────────────────────
  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader className="space-y-3 pb-2">

          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {state === 'waiting'   && <Smartphone className="h-8 w-8 text-primary animate-pulse" />}
            {state === 'completed' && <CheckCircle2 className="h-8 w-8 text-emerald-500" />}
            {(state === 'failed' || state === 'timeout') && <XCircle className="h-8 w-8 text-destructive" />}
          </div>

          <CardTitle className="text-xl">
            {state === 'waiting'   && 'Waiting for M-Pesa Payment'}
            {state === 'completed' && 'Payment Confirmed!'}
            {state === 'failed'    && 'Payment Failed'}
            {state === 'timeout'   && 'Payment Timed Out'}
          </CardTitle>

          <CardDescription>
            {state === 'waiting' && (
              <>Check your phone — enter your <strong>M-Pesa PIN</strong> to complete payment.</>
            )}
            {state === 'completed' && 'Your subscription is active. Redirecting to your dashboard…'}
            {state === 'failed'    && 'The payment was declined or cancelled. Please try again.'}
            {state === 'timeout'   && 'We didn\'t receive a payment confirmation within 5 minutes. Please contact support if you were charged.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-2">

          {/* Payment details */}
          {(state === 'waiting' || state === 'failed') && (
            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-left space-y-1.5">
              {phone  && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{phone}</span></div>}
              {amount && <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">KES {parseFloat(amount).toLocaleString()}</span></div>}
              {planName && <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium capitalize">{planName}</span></div>}
            </div>
          )}

          {/* Waiting — spinner + elapsed timer */}
          {state === 'waiting' && (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Waiting for confirmation… {formatElapsed(elapsed)}
              </p>
              <p className="text-xs text-muted-foreground">
                Times out in {formatElapsed(Math.max(0, 300 - elapsed))}
              </p>
            </div>
          )}

          {/* Retry button */}
          {(state === 'failed' || state === 'timeout') && (
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={handleRetry}
                disabled={retrying}
              >
                {retrying
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  : <><RefreshCw className="mr-2 h-4 w-4" />Try Again</>}
              </Button>
              <p className="text-xs text-muted-foreground">
                Need help?{' '}
                <a href="mailto:support@payhub.co.ke" className="text-primary underline underline-offset-2">
                  Contact support
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}