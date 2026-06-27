import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Check, ChevronRight, Shield, AlertCircle, Gift, WalletCards, Lock } from 'lucide-react';
import { PLAN_CONFIG, PLANS, isActivePlan, getDaysRemaining } from '@/lib/subscriptionUtils';
import { useToast } from '@/components/ui/use-toast';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

const AVAILABLE_OFFERS = [
  {
    code: 'WELCOME20',
    title: 'Welcome Offer',
    description: 'Save 20% on any paid subscription plan.',
    tag: '20% OFF',
    type: 'percent',
    value: 20,
  },
  {
    code: 'SE7EN50',
    title: 'SE7EN FIT Starter',
    description: 'Flat ₹50 off on Basic or Premium monthly plan.',
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
  if (!offer.appliesTo) return true;
  return offer.appliesTo.includes(plan.key) || offer.appliesTo.includes(plan.billing);
}

function getOfferDiscount(offer, plan) {
  if (!isOfferEligible(offer, plan)) return 0;
  if (offer.type === 'percent') return Math.min(plan.price, Math.round((plan.price * offer.value) / 100));
  if (offer.type === 'flat') return Math.min(plan.price, offer.value);
  return 0;
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function getSubscriptionDates(plan) {
  const today = new Date();
  const endDate = new Date(today);
  if (plan.billing === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
  else if (plan.billing === 'quarterly') endDate.setMonth(endDate.getMonth() + 3);
  else if (plan.billing === 'annual') endDate.setFullYear(endDate.getFullYear() + 1);
  return { today, endDate };
}

export default function Subscription() {
  const { toast } = useToast();
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [user, setUser] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    const subs = await base44.entities.Subscription.filter({ user_id: u.id, status: 'active' });
    setUser(u);
    setCurrent(subs[0] || null);
    setLoading(false);
  };

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

    const offer = AVAILABLE_OFFERS.find(item => item.code === value);
    if (!offer || !isOfferEligible(offer, checkoutPlan)) {
      toast({ title: 'Invalid offer for this plan', description: 'Choose one of the available offers below.', variant: 'destructive' });
      return;
    }

    setSelectedOffer(offer);
    toast({ title: 'Offer applied', description: `${offer.code} saved ₹${getOfferDiscount(offer, checkoutPlan)}` });
  };

  const selectOffer = (offer) => {
    setSelectedOffer(offer);
    setCoupon(offer.code);
    toast({ title: 'Offer applied', description: `${offer.code} saved ₹${getOfferDiscount(offer, checkoutPlan)}` });
  };

  const clearOffer = () => {
    setSelectedOffer(null);
    setCoupon('');
  };

  const completeSubscription = async (response, plan, payableAmount, discountAmount) => {
    const { today, endDate } = getSubscriptionDates(plan);

    await base44.entities.Payment.create({
      user_id: user.id,
      plan: plan.key,
      amount: payableAmount,
      original_amount: plan.price,
      discount_amount: discountAmount,
      currency: 'INR',
      status: 'success',
      razorpay_payment_id: response.razorpay_payment_id,
      applied_offer_code: selectedOffer?.code || undefined,
      paid_at: new Date().toISOString(),
    });

    if (current) {
      await base44.entities.Subscription.update(current.id, { status: 'expired' });
    }

    const nextSub = await base44.entities.Subscription.create({
      user_id: user.id,
      plan: plan.key,
      status: 'active',
      start_date: today.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      payment_id: response.razorpay_payment_id,
      original_amount: plan.price,
      paid_amount: payableAmount,
      discount_amount: discountAmount,
      applied_offer_code: selectedOffer?.code || undefined,
    });

    setCurrent(nextSub);
    setCheckoutPlan(null);
    toast({ title: `${plan.label} Activated`, description: `Active until ${endDate.toDateString()}` });
  };

  const continueToPayment = async () => {
    if (!checkoutPlan || processing) return;

    if (!RAZORPAY_KEY_ID) {
      toast({
        title: 'Razorpay key missing',
        description: 'Add VITE_RAZORPAY_KEY_ID in Render frontend environment and redeploy.',
        variant: 'destructive',
      });
      return;
    }

    const discountAmount = getOfferDiscount(selectedOffer, checkoutPlan);
    const payableAmount = Math.max(1, checkoutPlan.price - discountAmount);

    setProcessing(true);
    const loaded = await loadRazorpay();
    if (!loaded) {
      toast({ title: 'Payment gateway failed to load', description: 'Check your internet connection.', variant: 'destructive' });
      setProcessing(false);
      return;
    }

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: payableAmount * 100,
      currency: 'INR',
      name: 'SE7EN FIT',
      description: `${checkoutPlan.label} Plan`,
      image: '/favicon.ico',
      prefill: {
        name: user?.full_name || user?.name || '',
        email: user?.email || '',
        contact: user?.phone || user?.mobile || '',
      },
      notes: {
        plan: checkoutPlan.key,
        offer: selectedOffer?.code || '',
        original_amount: String(checkoutPlan.price),
        discount_amount: String(discountAmount),
      },
      theme: { color: '#22c55e' },
      handler: async (response) => {
        try {
          await completeSubscription(response, checkoutPlan, payableAmount, discountAmount);
        } catch (error) {
          toast({ title: 'Payment done, activation failed', description: error.message || 'Please contact support.', variant: 'destructive' });
        } finally {
          setProcessing(false);
        }
      },
      modal: {
        ondismiss: () => setProcessing(false),
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', () => {
      toast({ title: 'Payment failed', description: 'Please try again.', variant: 'destructive' });
      setProcessing(false);
    });
    rzp.open();
  };

  if (loading) return <LoadingScreen />;

  if (checkoutPlan) {
    const eligibleOffers = AVAILABLE_OFFERS.filter(offer => isOfferEligible(offer, checkoutPlan));
    const discountAmount = getOfferDiscount(selectedOffer, checkoutPlan);
    const payableAmount = Math.max(1, checkoutPlan.price - discountAmount);

    return (
      <>
        <TopBar title="Checkout" showBack backTo="/subscription" rightElement={null} />
        <div className="max-w-lg mx-auto px-4 py-4 pb-32 space-y-4">
          <button onClick={() => setCheckoutPlan(null)} className="text-xs text-muted-foreground hover:text-foreground">Back to plans</button>

          <div className="rounded-3xl border border-accent/35 bg-gradient-to-b from-accent/10 to-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Selected plan</p>
                <h2 className="font-heading text-2xl font-black mt-1">{checkoutPlan.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">{checkoutPlan.tagline}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
                <WalletCards size={22} />
              </div>
            </div>

            <div className="flex items-baseline gap-1 mt-5">
              <span className="font-heading text-4xl font-black">₹{checkoutPlan.price}</span>
              <span className="text-sm text-muted-foreground">/{checkoutPlan.duration}</span>
            </div>

            <div className="mt-4 space-y-2">
              {checkoutPlan.features.slice(0, 5).map((feature, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                    <Check size={9} className="text-accent" />
                  </div>
                  <span className="text-xs text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="font-heading font-semibold text-sm flex items-center gap-2">
              <Gift size={15} className="text-accent" /> Have a code?
            </p>

            {selectedOffer && (
              <div className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent font-semibold flex items-center justify-between">
                <span>{selectedOffer.code} applied • You save ₹{discountAmount}</span>
                <button onClick={clearOffer} className="text-muted-foreground hover:text-foreground">Remove</button>
              </div>
            )}

            <div className="flex gap-2">
              <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="COUPON CODE" className="flex-1 h-12 rounded-xl bg-muted/40 uppercase font-mono" />
              <button onClick={applyCoupon} className="px-4 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold">Apply</button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-heading font-semibold text-sm flex items-center gap-2">
                <Gift size={15} className="text-accent" /> Available offers
              </p>
              <span className="text-[10px] text-muted-foreground">Tap to apply</span>
            </div>

            <div className="space-y-2">
              {eligibleOffers.map(offer => {
                const active = selectedOffer?.code === offer.code;
                const savings = getOfferDiscount(offer, checkoutPlan);
                return (
                  <button
                    key={offer.code}
                    onClick={() => selectOffer(offer)}
                    className={`w-full text-left rounded-2xl border p-3 transition-all active:scale-[0.99] ${
                      active ? 'border-accent bg-accent/10' : 'border-border bg-background/60 hover:border-accent/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{offer.title}</span>
                          {active && <span className="text-[9px] font-bold text-accent">APPLIED</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{offer.description}</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-2">Code: {offer.code}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="inline-flex rounded-full bg-accent/15 px-2 py-1 text-[10px] font-bold text-accent">{offer.tag}</span>
                        <p className="text-[10px] text-muted-foreground mt-1">Save ₹{savings}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2">
            <p className="font-heading font-semibold text-xs flex items-center gap-1.5"><Shield size={12} className="text-muted-foreground" /> Secure checkout</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Payment opens through Razorpay test checkout. Your plan activates after successful payment.</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1.5"><Lock size={12} /> Prices in INR • GST included.</p>
          </div>

          <div className="rounded-3xl border border-accent/30 bg-card p-4 shadow-lg shadow-accent/5">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Plan price</span>
                <span>₹{checkoutPlan.price}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-accent">
                  <span>Offer discount</span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[11px] text-muted-foreground">Total payable</p>
                <p className="font-heading text-2xl font-black">₹{payableAmount}</p>
              </div>
              <Button onClick={continueToPayment} disabled={processing} className="h-12 rounded-2xl bg-accent px-6 text-accent-foreground font-bold hover:bg-accent/90">
                {processing ? 'Processing...' : <>Pay Now <ChevronRight size={15} /></>}
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const activePlan = current?.plan || PLANS.FREE;
  const isActive = isActivePlan(current);
  const daysLeft = current?.end_date ? getDaysRemaining(current.end_date) : null;

  return (
    <>
      <TopBar title="Subscription" showBack />
      <div className="px-4 py-4 space-y-4 pb-10 max-w-lg mx-auto">
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-yellow-400/20 to-accent/10 border border-yellow-400/30 flex items-center justify-center mx-auto mb-3">
            <Crown size={28} className="text-yellow-400" />
          </div>
          <h2 className="font-heading font-bold text-2xl">Unlock SE7ENFIT</h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Premium AI fitness coaching, food scanner,<br />animated guides & unlimited everything
          </p>
        </div>

        {current && isActive && (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center"><Check size={18} className="text-accent" /></div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Active Plan</p>
              <p className="font-heading font-bold text-accent capitalize">{current.plan.replace(/_/g, ' ')}</p>
              {daysLeft !== null && <p className="text-[10px] text-muted-foreground">{daysLeft} days remaining</p>}
            </div>
            {current.end_date && <p className="text-[10px] text-muted-foreground text-right">Until<br />{current.end_date}</p>}
          </div>
        )}

        {current && !isActive && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-destructive flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm text-destructive">Plan Expired</p>
              <p className="text-xs text-muted-foreground">Renew now to restore full access</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {PLAN_CONFIG.map(plan => {
            const isCurrentPlan = activePlan === plan.key;
            const isPopular = plan.popular;

            return (
              <div key={plan.key}
                className={`bg-card border-2 rounded-3xl p-5 relative overflow-hidden transition-all ${
                  isCurrentPlan ? 'border-accent shadow-lg shadow-accent/10' :
                  isPopular ? 'border-accent/50' : plan.border
                }`}>

                {isPopular && !isCurrentPlan && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[9px] font-bold px-5 py-1 rounded-b-xl uppercase tracking-widest">
                    Best Choice
                  </div>
                )}

                {plan.savings && (
                  <div className="absolute top-4 right-4 bg-green-500/10 border border-green-500/30 text-green-400 text-[9px] font-bold px-2 py-1 rounded-full">
                    {plan.savings}
                  </div>
                )}

                <div className="flex items-end gap-2 mb-1 mt-1">
                  <p className="font-heading font-black text-xl">{plan.label}</p>
                  {isCurrentPlan && <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-bold mb-0.5">ACTIVE</span>}
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-heading font-black text-3xl">{plan.price === 0 ? 'Free' : `₹${plan.price}`}</span>
                  {plan.price > 0 && <span className="text-sm text-muted-foreground">/{plan.duration}</span>}
                </div>

                <div className="space-y-2 mb-4">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <Check size={9} className="text-accent" />
                      </div>
                      <span className="text-xs text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>

                {!isCurrentPlan && plan.key !== PLANS.FREE && plan.key !== PLANS.FREE_TRIAL && (
                  <Button
                    onClick={() => openCheckout(plan)}
                    className="w-full h-11 rounded-xl font-semibold text-sm transition-all bg-foreground text-background hover:bg-foreground/90 shadow-none"
                  >
                    Get {plan.label} — ₹{plan.price}/{plan.duration} <ChevronRight size={14} />
                  </Button>
                )}

                {isCurrentPlan && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-accent font-medium">
                    <Shield size={12} /> Your current plan
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-muted/40 border border-border rounded-2xl p-4 space-y-2">
          <p className="font-heading font-semibold text-xs flex items-center gap-1.5"><Shield size={12} className="text-muted-foreground" /> Subscription Policy</p>
          {[
            'All subscription payments are non-refundable once purchased.',
            'Paid access remains active until the end of the selected billing period.',
            'You can cancel future renewal anytime — access continues until expiry.',
            'Health guidance is for informational purposes only. Consult a doctor before intense exercise.',
          ].map((p, i) => (
            <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">• {p}</p>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground">Prices in INR • Payments secured by Razorpay • GST included</p>
      </div>
    </>
  );
}
