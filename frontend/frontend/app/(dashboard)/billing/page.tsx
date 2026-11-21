'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { IconCheck, IconCrown, IconRocket, IconBuildingSkyscraper, IconRefresh, IconCreditCard, IconCalendar, IconUsers } from '@tabler/icons-react';
import { billingAPI,BillingData, SubscriptionPlan, OrganizationSubscription } from '@/services/api/billing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const planIcons: Record<string, React.ReactNode> = {
  Starter: <IconRocket size={20} />,
  Professional: <IconCrown size={20} />,
  Enterprise: <IconBuildingSkyscraper size={20} />,
};

const statusColors: Record<string, string> = {
  active: 'status-active',
  trialing: 'status-trialing',
  pending_payment: 'status-pending',
  past_due: 'status-danger',
  suspended: 'status-danger',
  cancelled: 'status-neutral',
  expired: 'status-neutral',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(plan: SubscriptionPlan) {
  if (plan.base_price === 0) return 'Free';
  const cycle = plan.billing_cycle === 'annual' ? '/yr' : '/mo';
  return `$${plan.base_price.toFixed(0)}${cycle}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        setLoading(true);
        const result = await billingAPI.getCurrentSubscription();
        if (result.success && result.data) {
          setBilling(result.data);
          if (result.data.current_plan?.billing_cycle) {
            setBillingCycle(result.data.current_plan.billing_cycle);
          }
        } else {
          throw new Error(result.error ?? 'Unknown error');
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load billing');
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
  }, []);

  const filteredPlans = billing?.all_plans.filter(p => p.billing_cycle === billingCycle) ?? [];
  const currentPlan = billing?.current_plan;
  const currentSub = billing?.current_subscription;

  return (
    <>
      <style>{`
        .billing-page { max-width: 880px; margin: 0 auto; padding: 2rem 1.5rem; }
        .page-header { margin-bottom: 2rem; }
        .page-title { font-size: 22px; font-weight: 500; margin: 0 0 4px; color: var(--color-text-primary); }
        .page-subtitle { font-size: 14px; color: var(--color-text-secondary); margin: 0; }

        /* current plan card */
        .current-card {
          background: var(--color-background-primary);
          border: 0.5px solid var(--color-border-tertiary);
          border-radius: var(--border-radius-lg);
          padding: 1.25rem 1.5rem;
          margin-bottom: 2rem;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 1rem;
          align-items: start;
        }
        .current-label { font-size: 11px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-secondary); margin: 0 0 6px; }
        .current-plan-name { font-size: 20px; font-weight: 500; color: var(--color-text-primary); margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
        .current-meta { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-secondary); }
        .meta-item svg { opacity: .65; }

        /* status badge */
        .status-badge {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 500;
          padding: 3px 10px; border-radius: var(--border-radius-md);
        }
        .status-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .8; }
        .status-active { background: #EAF3DE; color: #3B6D11; }
        .status-trialing { background: #E6F1FB; color: #185FA5; }
        .status-pending { background: #FAEEDA; color: #854F0B; }
        .status-danger { background: #FCEBEB; color: #A32D2D; }
        .status-neutral { background: var(--color-background-secondary); color: var(--color-text-secondary); }

        /* toggle */
        .cycle-toggle { display: flex; align-items: center; gap: 0; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); overflow: hidden; width: fit-content; margin: 0 auto 2rem; }
        .cycle-btn { padding: 6px 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: transparent; color: var(--color-text-secondary); transition: background .15s, color .15s; }
        .cycle-btn.active { background: var(--color-background-secondary); color: var(--color-text-primary); }
        .save-badge { font-size: 11px; font-weight: 500; background: #EAF3DE; color: #3B6D11; padding: 2px 7px; border-radius: var(--border-radius-md); margin-left: 4px; }

        /* plan cards grid */
        .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .plan-card {
          background: var(--color-background-primary);
          border: 0.5px solid var(--color-border-tertiary);
          border-radius: var(--border-radius-lg);
          padding: 1.5rem;
          display: flex; flex-direction: column;
          transition: border-color .15s;
        }
        .plan-card:hover { border-color: var(--color-border-secondary); }
        .plan-card.is-current { border: 2px solid #185FA5; }
        .plan-card.is-current .plan-badge { display: inline-flex; }

        .plan-badge {
          display: none;
          font-size: 11px; font-weight: 500;
          background: #E6F1FB; color: #185FA5;
          padding: 3px 10px; border-radius: var(--border-radius-md);
          margin-bottom: 12px; width: fit-content;
        }
        .plan-icon { margin-bottom: 10px; color: var(--color-text-secondary); }
        .plan-name { font-size: 17px; font-weight: 500; color: var(--color-text-primary); margin: 0 0 4px; }
        .plan-price { font-size: 26px; font-weight: 500; color: var(--color-text-primary); margin: 0 0 4px; }
        .plan-price-sub { font-size: 12px; color: var(--color-text-secondary); margin: 0 0 1rem; }
        .plan-divider { border: none; border-top: 0.5px solid var(--color-border-tertiary); margin: 1rem 0; }
        .plan-features { list-style: none; padding: 0; margin: 0 0 1.5rem; flex: 1; }
        .plan-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px; }
        .plan-features li svg { flex-shrink: 0; margin-top: 1px; color: #185FA5; }
        .plan-cta {
          width: 100%; padding: 9px; font-size: 13px; font-weight: 500;
          border-radius: var(--border-radius-md); border: 0.5px solid var(--color-border-secondary);
          background: transparent; cursor: pointer; color: var(--color-text-primary);
          transition: background .15s;
        }
        .plan-cta:hover { background: var(--color-background-secondary); }
        .plan-cta.primary { background: #185FA5; color: #fff; border-color: #185FA5; }
        .plan-cta.primary:hover { background: #0C447C; }
        .plan-cta.current-cta { opacity: .5; cursor: default; }
        .plan-cta.current-cta:hover { background: transparent; }

        /* skeleton */
        .skeleton { background: var(--color-background-secondary); border-radius: var(--border-radius-md); animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .skeleton-card { height: 320px; border-radius: var(--border-radius-lg); }

        /* error */
        .error-box { padding: 1rem 1.25rem; border-radius: var(--border-radius-md); background: #FCEBEB; color: #A32D2D; font-size: 14px; display: flex; align-items: center; gap: 8px; }
      `}</style>

      <div className="billing-page">
        <div className="page-header">
          <h1 className="page-title">Billing &amp; Subscription</h1>
          <p className="page-subtitle">Manage your plan and review usage</p>
        </div>

        {/* Error state */}
        {error && (
          <div className="error-box">
            <IconRefresh size={16} />
            {error} — please refresh the page or contact support.
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <>
            <div className="skeleton skeleton-card" style={{ marginBottom: '2rem' }} />
            <div className="plans-grid">
              {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" />)}
            </div>
          </>
        )}

        {/* Content */}
        {!loading && !error && billing && (
          <>
            {/* Current plan summary */}
            {currentSub && currentPlan ? (
              <div className="current-card">
                <div>
                  <p className="current-label">Current plan</p>
                  <h2 className="current-plan-name">
                    {planIcons[currentPlan.name]}
                    {currentPlan.name}
                    <span className={`status-badge ${statusColors[currentSub.status] ?? 'status-neutral'}`}>
                      {currentSub.status.replace('_', ' ')}
                    </span>
                  </h2>
                  <div className="current-meta">
                    <span className="meta-item">
                      <IconCreditCard size={14} />
                      {formatPrice(currentPlan)}
                      {currentPlan.price_per_employee ? ` + $${currentPlan.price_per_employee}/employee` : ''}
                    </span>
                    {currentSub.current_period_ends_at && (
                      <span className="meta-item">
                        <IconCalendar size={14} />
                        Renews {formatDate(currentSub.current_period_ends_at)}
                      </span>
                    )}
                    {currentSub.trial_ends_at && currentSub.status === 'trialing' && (
                      <span className="meta-item">
                        <IconCalendar size={14} />
                        Trial ends {formatDate(currentSub.trial_ends_at)}
                      </span>
                    )}
                    {currentPlan.max_employees && (
                      <span className="meta-item">
                        <IconUsers size={14} />
                        Up to {currentPlan.max_employees} employees
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="current-card">
                <div>
                  <p className="current-label">No active subscription</p>
                  <h2 className="current-plan-name" style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
                    Choose a plan below to get started
                  </h2>
                </div>
              </div>
            )}

            {/* Billing cycle toggle */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="cycle-toggle">
                <button
                  className={`cycle-btn${billingCycle === 'monthly' ? ' active' : ''}`}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={`cycle-btn${billingCycle === 'annual' ? ' active' : ''}`}
                  onClick={() => setBillingCycle('annual')}
                >
                  Annual
                  <span className="save-badge">save 15%</span>
                </button>
              </div>
            </div>

            {/* Plans grid */}
            <div className="plans-grid">
              {filteredPlans.map(plan => {
                const isCurrent = currentPlan?.id === plan.id;
                const isProfessional = plan.name === 'Professional';
                return (
                  <div key={plan.id} className={`plan-card${isCurrent ? ' is-current' : ''}`}>
                    <div className="plan-badge">Current plan</div>
                    <div className="plan-icon" aria-hidden="true">{planIcons[plan.name]}</div>
                    <p className="plan-name">{plan.name}</p>
                    <p className="plan-price">{formatPrice(plan)}</p>
                    <p className="plan-price-sub">
                      {plan.price_per_employee
                        ? `+ $${plan.price_per_employee}/employee/mo`
                        : plan.max_employees
                        ? `up to ${plan.max_employees} employees`
                        : 'unlimited employees'}
                    </p>
                    {plan.trial_days && !isCurrent && (
                      <p style={{ fontSize: '12px', color: '#185FA5', margin: '-4px 0 8px', fontWeight: 500 }}>
                        {plan.trial_days}-day free trial
                      </p>
                    )}
                    <hr className="plan-divider" />
                    <ul className="plan-features">
                      {plan.features.map((f, i) => (
                        <li key={i}>
                          <IconCheck size={14} strokeWidth={2.5} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <button className="plan-cta current-cta" disabled>Current plan</button>
                    ) : plan.name === 'Enterprise' ? (
                      <button className="plan-cta">Contact sales</button>
                    ) : (
                      <button className={`plan-cta${isProfessional ? ' primary' : ''}`}>
                        {currentPlan && plan.base_price > currentPlan.base_price ? 'Upgrade' : 'Switch plan'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}