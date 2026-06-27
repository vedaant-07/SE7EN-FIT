import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronRight, Gift, Lock, Shield, WalletCards } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { PLAN_CONFIG, PLANS } from '@/lib/subscriptionUtils';

export default function SubscriptionCheckout() {
  const { planKey } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coupon, setCoupon] = useState('');
  const [referral, setReferral] = useState('');
  const [appliedCode, setAppliedCode] = useState(null);

  const plan = useMemo(() => PLAN_CONFIG.find(p => p.key === planKey), [planKey]);

  const applyCode = (type) => {
    const value = type === 'coupon' ? coupon.trim().toUpperCase() : referral.trim().toUpperCase();
    if (!value) {
      toast({ title: `Enter a ${type} code`, variant: 'destructive' });
      return;
    }
    setAppliedCode({ type, value });
    toast({ title: `${type === 'coupon' ? 'Coupon' : 'Referral'} code applied`, description: value });
  };

  const continueToPayment = () => {
    toast({
      title: 'Razorpay setup required',
      description: 'Add VITE_RAZORPAY_KEY_ID in Render frontend env, then I will connect this button to checkout.',
      variant: 'destructive',
    });
  };

  if (!plan || plan.key === PLANS.FREE || plan.key === PLANS.FREE_TRIAL) {
    return (
      <>
        <TopBar title="Checkout" showBack backTo="/subscription" />
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="font-heading font-bold">Plan not available</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a paid subscription plan to continue.</p>
            <Button onClick={() => navigate('/subscription')} className="mt-4 h-11 rounded-xl bg-accent text-accent-foreground">Back to plans</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Checkout" showBack backTo="/subscription" />
      <div className="max-w-lg mx-auto px-4 py-4 pb-28 space-y-4">
        <div className="rounded-3xl border border-accent/35 bg-gradient-to-b from-accent/10 to-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Selected plan</p>
              <h2 className="font-heading text-2xl font-black mt-1">{plan.label}</h2>
              <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
              <WalletCards size={22} />
            </div>
          </div>

          <div className="flex items-baseline gap-1 mt-5">
            <span className="font-heading text-4xl font-black">₹{plan.price}</span>
            <span className="text-sm text-muted-foreground">/{plan.duration}</span>
          </div>

          <div className="mt-4 space-y-2">
            {plan.features.slice(0, 5).map((feature, index) => (
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

          {appliedCode && (
            <div className="rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-accent font-semibold flex items-center justify-between">
              <span>{appliedCode.type === 'coupon' ? 'Coupon' : 'Referral'} applied: {appliedCode.value}</span>
              <button onClick={() => setAppliedCode(null)} className="text-muted-foreground hover:text-foreground">Remove</button>
            </div>
          )}

          <div className="flex gap-2">
            <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="COUPON CODE" className="flex-1 h-12 rounded-xl bg-muted/40 uppercase font-mono" />
            <button onClick={() => applyCode('coupon')} className="px-4 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold">Apply</button>
          </div>

          <div className="flex gap-2">
            <Input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())}
              placeholder="REFERRAL CODE" className="flex-1 h-12 rounded-xl bg-muted/40 uppercase font-mono" />
            <button onClick={() => applyCode('referral')} className="px-4 h-12 rounded-xl bg-muted border border-border text-sm font-medium">Apply</button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2">
          <p className="font-heading font-semibold text-xs flex items-center gap-1.5"><Shield size={12} className="text-muted-foreground" /> Secure checkout</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Your payment will open through Razorpay after the test key is configured.</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1.5"><Lock size={12} /> Prices in INR • GST included.</p>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-2xl px-4 py-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground">Total</p>
              <p className="font-heading text-xl font-black">₹{plan.price}</p>
            </div>
            <Button onClick={continueToPayment} className="h-12 rounded-2xl bg-accent px-6 text-accent-foreground font-bold hover:bg-accent/90">
              Continue <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
