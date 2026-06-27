import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Crown, Check, ChevronRight, Shield, AlertCircle } from 'lucide-react';
import { PLAN_CONFIG, PLANS, isActivePlan, getDaysRemaining } from '@/lib/subscriptionUtils';
import { useNavigate } from 'react-router-dom';

export default function Subscription() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    const subs = await base44.entities.Subscription.filter({ user_id: u.id, status: 'active' });
    setCurrent(subs[0] || null);
    setLoading(false);
  };

  const openCheckout = (plan) => {
    if (plan.key === PLANS.FREE_TRIAL || plan.key === PLANS.FREE) return;
    navigate(`/subscription/checkout/${plan.key}`);
  };

  if (loading) return <LoadingScreen />;

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
                    🔥 Best Choice
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
                    className={`w-full h-11 rounded-xl font-semibold text-sm transition-all ${
                      isPopular ? 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20' :
                      'bg-foreground text-background hover:bg-foreground/90'
                    }`}
                  >
                    {isPopular ? '⚡ ' : ''}Get {plan.label} — ₹{plan.price}/{plan.duration} <ChevronRight size={14} />
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
