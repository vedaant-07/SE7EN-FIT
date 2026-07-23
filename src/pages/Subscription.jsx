import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { billingClient } from '@/api/billingClient';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Crown,
  Gift,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { PLAN_CONFIG, PLANS, getDaysRemaining, isActivePlan } from '@/lib/subscriptionUtils';
import { useToast } from '@/components/ui/use-toast';

const PENDING_PAYMENT_KEY = 'se7enfit_pending_payment_verification';

const AVAILABLE_OFFERS = [
  {
    code: 'WELCOME20',
    title: 'Welcome Offer',
    description: 'Save 20% on your first paid SE7EN FIT plan.',
    tag: '20% OFF',
    type: 'percent',
    value: 20,
  },
  {
    code: 'SE7EN50',
    title: 'SE7EN FIT Starter',
    description: 'Flat ₹50 off your first Basic or Premium monthly plan.',
    tag: '₹50 OFF',
    type: 'flat',
    value: 50,
    appliesTo: [PLANS.BASIC, PLANS.PREMIUM_MONTHLY],
  },
  {
    code: 'YEARLY25',
    title: 'Annual Transformation',
    description: 'Save 25% when you choose the annual plan.',
    tag: '25% OFF',
    type: 'percent',
    value: 25,
    appliesTo: [PLANS.PREMIUM_ANNUAL],
  },
];

function isOfferEligible(offer, plan) {
  if (!offer || !plan) return false;
  return !offer.appliesTo || offer.appliesTo.includes(plan.key);
}

function getOfferDiscount(offer, plan) {
  if (!isOfferEligible(offer, plan)) return 0;
  if (offer.type === 'percent') return Math.min(plan.price - 1, Math.round((plan.price * offer.value) / 100));
  if (offer.type === 'flat') return Math.min(plan.price - 1, offer.value);
  return 0;
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[data-se7enfit-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.se7enfitRazorpay = 'true';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function readPendingPayment() {
  try {
    const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePendingPayment(payload) {
  localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payload));
}

function clearPendingPayment() {
  localStorage.removeItem(PENDING_PAYMENT_KEY);
}

export default function Subscription() {
  const { toast } = useToast();
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [user, setUser] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);

  const loadData = async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setPageError('');
    try {
      const [account, subscription] = await Promise.all([
        base44.auth.me(),
        billingClient.getCurrentSubscription(),
      ]);
      setUser(account);
      setCurrent(subscription || null);
    } catch (error) {
      console.error('[Subscription] load failed:', error);
      setPageError(error.message || 'Subscription details could not be loaded.');
    } finally {
      if (!background) setLoading(false);
    }
  };

  const verifyAndActivate = async (payload, { silent = false } = {}) => {
    if (!payload || processing) return false;
    setProcessing(true);
    setPendingVerification(payload);
    savePendingPayment(payload);

    try {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const result = await billingClient.verifyPayment(payload);
        if (!result?.pending && result?.subscription) {
          clearPendingPayment();
          setPendingVerification(null);
          setCurrent(result.subscription);
          setCheckoutPlan(null);
          if (!silent) {
            toast({
              title: 'Plan activated securely',
              description: `${String(result.subscription.plan || 'Paid plan').replace(/_/g, ' ')} is now active.`,
            });
          }
          return true;
        }
        if (attempt < 3) await wait(1800);
      }

      if (!silent) {
        toast({
          title: 'Payment received — activation pending',
          description: 'Razorpay is still confirming capture. Use Retry activation in a moment.',
        });
      }
      return false;
    } catch (error) {
      console.error('[Subscription] verification failed:', error);
      const permanentFailure = error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status);
      if (permanentFailure) {
        clearPendingPayment();
        setPendingVerification(null);
      }
      if (!silent) {
        toast({
          title: permanentFailure ? 'Payment could not be verified' : 'Activation needs another attempt',
          description: error.message || 'Please try again or contact support with your payment ID.',
          variant: permanentFailure ? 'destructive' : 'default',
        });
      }
      return false;
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initialise = async () => {
      await loadData();
      if (cancelled) return;
      const pending = readPendingPayment();
      if (pending) {
        setPendingVerification(pending);
        await verifyAndActivate(pending, { silent: true });
      }
    };
    initialise();
    return () => { cancelled = true; };
  }, []);

  const openCheckout = (plan) => {
    if (plan.key === PLANS.FREE_TRIAL || plan.key === PLANS.FREE) return;
    setCoupon('');
    setSelectedOffer(null);
    setCheckoutPlan(plan);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyCoupon = () => {
    const value = coupon.trim().toUpperCase();
    if (!value) {
      toast({ title: 'Enter a coupon code', variant: 'destructive' });
      return;
    }
    const offer = AVAILABLE_OFFERS.find((item) => item.code === value);
    if (!offer || !isOfferEligible(offer, checkoutPlan)) {
      toast({ title: 'Offer is not valid for this plan', variant: 'destructive' });
      return;
    }
    setSelectedOffer(offer);
    toast({ title: 'Offer selected', description: 'Eligibility and final amount will be verified securely before checkout.' });
  };

  const selectOffer = (offer) => {
    setSelectedOffer(offer);
    setCoupon(offer.code);
  };

  const clearOffer = () => {
    setSelectedOffer(null);
    setCoupon('');
  };

  const continueToPayment = async () => {
    if (!checkoutPlan || processing) return;
    setProcessing(true);

    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Secure checkout could not be loaded. Check your connection and try again.');

      const order = await billingClient.createOrder(checkoutPlan.key, selectedOffer?.code);
      if (!order?.order_id || !order?.key_id) throw new Error('The secure payment order was not created.');

      const options = {
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: 'SE7EN FIT',
        description: `${order.plan_label} Plan`,
        image: '/favicon.ico',
        prefill: {
          name: order.prefill?.name || user?.full_name || user?.name || '',
          email: order.prefill?.email || user?.email || '',
          contact: order.prefill?.contact || user?.phone || user?.mobile || '',
        },
        notes: {
          plan_code: order.plan_code,
          offer_code: order.offer_code || '',
        },
        theme: { color: '#22c55e' },
        handler: async (response) => {
          const payload = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };
          savePendingPayment(payload);
          setPendingVerification(payload);
          await verifyAndActivate(payload);
        },
        modal: {
          ondismiss: () => setProcessing(false),
          confirm_close: true,
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.on('payment.failed', (failure) => {
        console.error('[Subscription] Razorpay payment failed:', failure?.error);
        toast({
          title: 'Payment was not completed',
          description: failure?.error?.description || 'No plan was activated. You can safely try again.',
          variant: 'destructive',
        });
        setProcessing(false);
      });
      checkout.open();
      setProcessing(false);
    } catch (error) {
      console.error('[Subscription] checkout failed:', error);
      toast({
        title: 'Checkout unavailable',
        description: error.message || 'Please try again shortly.',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (checkoutPlan) {
    const eligibleOffers = AVAILABLE_OFFERS.filter((offer) => isOfferEligible(offer, checkoutPlan));
    const discountAmount = getOfferDiscount(selectedOffer, checkoutPlan);
    const estimatedPayable = Math.max(1, checkoutPlan.price - discountAmount);

    return (
      <>
        <TopBar title="Secure checkout" showBack backTo="/subscription" rightElement={null} />
        <main className="mx-auto max-w-lg space-y-4 px-4 pb-32 pt-4">
          <button type="button" onClick={() => setCheckoutPlan(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground">Back to plans</button>

          <section className="rounded-[28px] border border-accent/35 bg-gradient-to-b from-accent/10 to-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Selected plan</p>
                <h1 className="mt-1 font-heading text-2xl font-black">{checkoutPlan.label}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{checkoutPlan.tagline}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent"><WalletCards size={22} /></div>
            </div>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-black">₹{checkoutPlan.price.toLocaleString('en-IN')}</span>
              <span className="text-sm text-muted-foreground">/{checkoutPlan.duration}</span>
            </div>
            <div className="mt-4 space-y-2">
              {checkoutPlan.features.slice(0, 5).map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15"><Check size={9} className="text-accent" /></span>
                  <span className="text-xs text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </section>

          {pendingVerification && (
            <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <div className="flex items-start gap-3">
                <Loader2 size={18} className="mt-0.5 shrink-0 text-amber-300" />
                <div className="flex-1">
                  <p className="text-sm font-bold">Payment activation pending</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your payment confirmation is saved on this device. Retrying will not charge you again.</p>
                  <Button type="button" onClick={() => verifyAndActivate(pendingVerification)} disabled={processing} variant="outline" className="mt-3 h-9 rounded-xl">
                    <RefreshCw size={14} className={`mr-2 ${processing ? 'animate-spin' : ''}`} /> Retry activation
                  </Button>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 font-heading text-sm font-semibold"><Gift size={15} className="text-accent" /> Offer code</p>
            {selectedOffer && (
              <div className="flex items-center justify-between rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
                <span>{selectedOffer.code} selected</span>
                <button type="button" onClick={clearOffer} className="text-muted-foreground">Remove</button>
              </div>
            )}
            <div className="flex gap-2">
              <Input value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="COUPON CODE" className="h-12 flex-1 rounded-xl bg-muted/40 font-mono uppercase" />
              <button type="button" onClick={applyCoupon} className="h-12 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground">Apply</button>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-heading text-sm font-semibold"><Gift size={15} className="text-accent" /> Available offers</p><span className="text-[10px] text-muted-foreground">Server verified</span></div>
            <div className="space-y-2">
              {eligibleOffers.map((offer) => {
                const active = selectedOffer?.code === offer.code;
                return (
                  <button key={offer.code} type="button" onClick={() => selectOffer(offer)} className={`w-full rounded-2xl border p-3 text-left transition-all active:scale-[0.99] ${active ? 'border-accent bg-accent/10' : 'border-border bg-background/60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-sm font-bold">{offer.title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{offer.description}</p><p className="mt-2 font-mono text-[10px] text-muted-foreground">{offer.code}</p></div>
                      <span className="shrink-0 rounded-full bg-accent/15 px-2 py-1 text-[10px] font-bold text-accent">{offer.tag}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
            <p className="flex items-center gap-1.5 font-heading text-xs font-semibold"><ShieldCheck size={13} className="text-accent" /> Server-verified checkout</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">SE7EN FIT creates the Razorpay order on the backend. Access activates only after the server verifies the checkout signature, order amount and captured payment status.</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Lock size={12} /> Payment details are handled by Razorpay.</p>
          </section>

          <section className="rounded-3xl border border-accent/30 bg-card p-4 shadow-lg shadow-accent/5">
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Plan price</span><span>₹{checkoutPlan.price.toLocaleString('en-IN')}</span></div>
              {discountAmount > 0 && <div className="flex items-center justify-between text-xs text-accent"><span>Estimated offer</span><span>-₹{discountAmount.toLocaleString('en-IN')}</span></div>}
              <p className="text-[10px] text-muted-foreground">The backend confirms final eligibility and amount before Razorpay opens.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><p className="text-[11px] text-muted-foreground">Estimated payable</p><p className="font-heading text-2xl font-black">₹{estimatedPayable.toLocaleString('en-IN')}</p></div>
              <Button type="button" onClick={continueToPayment} disabled={processing || Boolean(pendingVerification)} className="h-12 rounded-2xl bg-accent px-6 font-bold text-accent-foreground hover:bg-accent/90">
                {processing ? <><Loader2 size={15} className="mr-2 animate-spin" /> Verifying</> : <>Pay securely <ChevronRight size={15} /></>}
              </Button>
            </div>
          </section>
        </main>
      </>
    );
  }

  const activePlan = current?.plan || PLANS.FREE;
  const isActive = isActivePlan(current);
  const daysLeft = current?.end_date ? getDaysRemaining(current.end_date) : null;

  return (
    <>
      <TopBar title="Subscription" showBack />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="py-2 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/20 to-accent/10"><Crown size={28} className="text-yellow-400" /></div>
          <h1 className="font-heading text-2xl font-black">Choose your SE7EN FIT plan</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Upgrade for deeper coaching, premium challenges, rewards and transformation tools.</p>
        </section>

        {pageError && (
          <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-start gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0 text-destructive" /><div className="flex-1"><p className="text-sm font-semibold">Subscription details unavailable</p><p className="mt-1 text-xs text-muted-foreground">{pageError}</p><Button type="button" onClick={() => loadData()} variant="outline" className="mt-3 h-9 rounded-xl"><RefreshCw size={14} className="mr-2" /> Try again</Button></div></div>
          </section>
        )}

        {pendingVerification && (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <div className="flex items-start gap-3"><Loader2 size={18} className={`mt-0.5 shrink-0 text-amber-300 ${processing ? 'animate-spin' : ''}`} /><div className="flex-1"><p className="text-sm font-bold">Payment found — activation pending</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Retrying verifies the same payment and never creates a second charge.</p><Button type="button" onClick={() => verifyAndActivate(pendingVerification)} disabled={processing} variant="outline" className="mt-3 h-9 rounded-xl"><RefreshCw size={14} className="mr-2" /> Retry activation</Button></div></div>
          </section>
        )}

        {current && isActive && (
          <section className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20"><Check size={18} className="text-accent" /></span>
            <div className="flex-1"><p className="text-xs text-muted-foreground">Active plan</p><p className="font-heading font-bold capitalize text-accent">{String(current.plan).replace(/_/g, ' ')}</p>{daysLeft !== null && <p className="text-[10px] text-muted-foreground">{daysLeft} days remaining</p>}</div>
            {current.end_date && <p className="text-right text-[10px] text-muted-foreground">Until<br />{current.end_date}</p>}
          </section>
        )}

        {current && !isActive && (
          <section className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"><AlertCircle size={18} className="shrink-0 text-destructive" /><div><p className="text-sm font-semibold text-destructive">Plan expired</p><p className="text-xs text-muted-foreground">Choose a plan to restore paid access.</p></div></section>
        )}

        <section className="space-y-3">
          {PLAN_CONFIG.map((plan) => {
            const isCurrentPlan = activePlan === plan.key && isActive;
            return (
              <article key={plan.key} className={`relative overflow-hidden rounded-3xl border-2 bg-card p-5 transition-all ${isCurrentPlan ? 'border-accent shadow-lg shadow-accent/10' : plan.popular ? 'border-accent/50' : plan.border}`}>
                {plan.popular && !isCurrentPlan && <div className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b-xl bg-accent px-5 py-1 text-[9px] font-bold uppercase tracking-widest text-accent-foreground">Popular</div>}
                {plan.savings && <div className="absolute right-4 top-4 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-[9px] font-bold text-green-400">{plan.savings}</div>}
                <div className="mb-1 mt-1 flex items-end gap-2"><h2 className="font-heading text-xl font-black">{plan.label}</h2>{isCurrentPlan && <span className="mb-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">ACTIVE</span>}</div>
                <div className="mb-4 flex items-baseline gap-1"><span className="font-heading text-3xl font-black">{plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString('en-IN')}`}</span>{plan.price > 0 && <span className="text-sm text-muted-foreground">/{plan.duration}</span>}</div>
                <div className="mb-4 space-y-2">
                  {plan.features.map((feature) => <div key={feature} className="flex items-center gap-2.5"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15"><Check size={9} className="text-accent" /></span><span className="text-xs text-muted-foreground">{feature}</span></div>)}
                </div>
                {!isCurrentPlan && plan.price > 0 && <Button type="button" onClick={() => openCheckout(plan)} disabled={Boolean(pendingVerification)} className="h-11 w-full rounded-xl bg-foreground text-sm font-semibold text-background hover:bg-foreground/90">Choose {plan.label} <ChevronRight size={14} /></Button>}
                {isCurrentPlan && <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-accent"><Shield size={12} /> Your current plan</div>}
              </article>
            );
          })}
        </section>

        <section className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
          <p className="flex items-center gap-1.5 font-heading text-xs font-semibold"><Shield size={12} className="text-muted-foreground" /> Subscription policy</p>
          {[
            'Final price and offer eligibility are confirmed by the backend before checkout.',
            'Access activates only after Razorpay signature and captured-payment verification.',
            'Paid access remains active until the displayed billing-period end date.',
            'For a paid-but-not-activated payment, use Retry activation or contact support with the payment ID.',
          ].map((policy) => <p key={policy} className="text-[11px] leading-relaxed text-muted-foreground">• {policy}</p>)}
        </section>

        <p className="text-center text-[10px] text-muted-foreground">Prices in INR • Secure order and signature verification • Payments handled by Razorpay</p>
      </main>
    </>
  );
}
