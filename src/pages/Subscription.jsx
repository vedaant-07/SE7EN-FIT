import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Building2,
  Check,
  Clock3,
  Crown,
  LockKeyhole,
  ReceiptIndianRupee,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { billingClient } from '@/api/billingClient';

const FEATURE_LABELS = {
  ai_trainer_messages: 'AI trainer messages',
  food_scans: 'Food scans',
  animated_guides: 'Animated exercise guides',
  advanced_analytics: 'Advanced progress analytics',
  all_challenges: 'All challenges and gym battles',
  transformation_report: 'Transformation reports',
  reward_wallet: 'Reward wallet',
};

function formatMoneyMinor(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0) / 100);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function intervalLabel(plan) {
  if (plan.interval_unit === 'one_time') return plan.trial_days ? `${plan.trial_days} days` : 'included';
  const count = Number(plan.interval_count || 1);
  const unit = plan.interval_unit || 'month';
  return count === 1 ? unit : `${count} ${unit}s`;
}

function entitlementLabel(row) {
  const label = FEATURE_LABELS[row.feature_code] || row.feature_code.replace(/_/g, ' ');
  if (!row.enabled) return null;
  if (row.quota == null) return `${label}: unlimited`;
  return `${label}: ${row.quota}${row.quota_period ? ` / ${row.quota_period}` : ''}`;
}

function planTone(plan) {
  const tier = plan.metadata?.tier;
  if (tier === 'premium') return 'border-accent/45 bg-gradient-to-b from-accent/10 to-card';
  if (tier === 'basic') return 'border-blue-500/35 bg-gradient-to-b from-blue-500/10 to-card';
  return 'border-border bg-card';
}

export default function Subscription() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await billingClient.getMemberBilling();
      setData(response);
    } catch (requestError) {
      setError(requestError?.message || 'Could not load subscription information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const plans = data?.catalog || [];
  const activePlanCode = data?.subscription?.plan_code || data?.plan?.plan_code || 'free';
  const activePlan = useMemo(
    () => plans.find((plan) => plan.plan_code === activePlanCode) || data?.plan || null,
    [activePlanCode, data?.plan, plans],
  );
  const activeEntitlements = Object.entries(data?.entitlements || {})
    .filter(([, value]) => value?.enabled)
    .map(([featureCode, value]) => ({ feature_code: featureCode, ...value }));

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar
        title="Membership"
        showBack
        backTo="/profile"
        rightElement={(
          <button
            type="button"
            onClick={() => void load({ background: true })}
            disabled={refreshing}
            aria-label="Refresh membership"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      />

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-28">
        {error && (
          <section className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-destructive" size={19} />
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-base font-bold">Membership unavailable</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error}</p>
                <Button type="button" variant="outline" onClick={() => void load()} className="mt-4 h-10 rounded-xl">
                  Try again
                </Button>
              </div>
            </div>
          </section>
        )}

        {activePlan && (
          <section className="relative overflow-hidden rounded-[30px] border border-accent/25 bg-gradient-to-br from-accent/15 via-card to-card p-5">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/10" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">Current access</p>
                  <h1 className="mt-2 font-heading text-2xl font-black">{activePlan.name}</h1>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activePlan.description}</p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <Crown size={21} />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-border/70 bg-background/55 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-black capitalize">{data?.subscription?.status || 'Free access'}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/55 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Renews / ends</p>
                  <p className="mt-1 text-sm font-black">{formatDate(data?.subscription?.current_period_end)}</p>
                </div>
              </div>

              {activeEntitlements.length > 0 && (
                <div className="mt-4 space-y-2">
                  {activeEntitlements.slice(0, 7).map((row) => (
                    <div key={row.feature_code} className="flex items-center gap-2.5 text-xs text-foreground/75">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                        <Check size={11} />
                      </span>
                      <span>{entitlementLabel(row)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
              <LockKeyhole size={19} />
            </span>
            <div>
              <h2 className="font-heading text-base font-bold">Secure payment activation</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {data?.checkout?.message || 'Online payments are not enabled yet. Plans activate only after server-verified payment.'}
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck size={12} /> No frontend-only activation
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">Plan catalogue</p>
              <h2 className="mt-1 font-heading text-xl font-black">Choose your level</h2>
            </div>
            <Sparkles size={18} className="text-accent" />
          </div>

          {plans.map((plan) => {
            const active = plan.plan_code === activePlanCode;
            const features = (plan.entitlements || []).map(entitlementLabel).filter(Boolean);
            const paidPlan = Number(plan.price_minor || 0) > 0;
            return (
              <article key={plan.plan_code} className={`rounded-[26px] border p-5 ${planTone(plan)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-xl font-black">{plan.name}</h3>
                      {active && <span className="rounded-full bg-accent/15 px-2 py-1 text-[9px] font-black uppercase text-accent">Active</span>}
                      {plan.metadata?.popular && <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[9px] font-black uppercase text-blue-300">Popular</span>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-2xl font-black">{formatMoneyMinor(plan.price_minor, plan.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">/{intervalLabel(plan)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {features.slice(0, 7).map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-[11px] text-foreground/70">
                      <Check size={13} className="shrink-0 text-accent" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  disabled={active || paidPlan || !data?.checkout?.enabled}
                  className="mt-5 h-11 w-full rounded-2xl"
                  variant={active ? 'outline' : 'default'}
                >
                  {active
                    ? 'Current plan'
                    : paidPlan
                      ? 'Secure checkout coming after Razorpay setup'
                      : 'Included access'}
                </Button>
              </article>
            );
          })}

          {!plans.length && !error && (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center">
              <Crown size={24} className="mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-bold">No plans are published</p>
              <p className="mt-1 text-xs text-muted-foreground">Plan availability is controlled from the SE7EN FIT admin portal.</p>
            </div>
          )}
        </section>

        {data?.referral && (
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Building2 size={19} />
              </span>
              <div>
                <h2 className="font-heading text-base font-bold">Gym partner attribution</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Your gym referral is locked to protect the 20% partner commission model.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="rounded-full border border-border px-3 py-1.5">Code {data.referral.referral_code || 'Recorded'}</span>
                  <span className="rounded-full border border-border px-3 py-1.5">{data.referral.qualified_at ? 'Qualified' : 'Awaiting paid plan'}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">Billing history</p>
              <h2 className="mt-1 font-heading text-lg font-black">Verified payments</h2>
            </div>
            <ReceiptIndianRupee size={20} className="text-accent" />
          </div>

          <div className="mt-4 space-y-2.5">
            {(data?.payments || []).map((payment) => (
              <div key={payment.payment_id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/45 p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Clock3 size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: payment.currency || 'INR' }).format(Number(payment.amount || 0))}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {payment.provider || 'SE7EN FIT'} · {formatDate(payment.created_at)}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${
                  ['success', 'paid', 'captured', 'succeeded', 'completed'].includes(String(payment.status).toLowerCase())
                    ? 'bg-accent/10 text-accent'
                    : ['refunded', 'chargeback', 'reversed'].includes(String(payment.status).toLowerCase())
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-amber-500/10 text-amber-300'
                }`}>
                  {payment.status}
                </span>
              </div>
            ))}
            {!data?.payments?.length && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <p className="text-sm font-bold">No verified payments yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Payments will appear here only after server verification.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
