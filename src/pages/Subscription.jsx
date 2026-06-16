import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Crown, Check, Zap, Star, Sparkles, ChevronRight, Shield } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PLANS = [
  {
    key: 'free',
    label: 'Free',
    price: 0,
    icon: Zap,
    iconColor: 'text-muted-foreground',
    borderColor: 'border-border',
    features: ['Basic workout tracking', 'Manual nutrition logging', 'Water, step & sleep tracking', 'Community access (view)', '3 AI trainer messages/day'],
  },
  {
    key: 'ai_trainer',
    label: 'AI Trainer',
    price: 299,
    icon: Sparkles,
    iconColor: 'text-accent',
    borderColor: 'border-accent',
    popular: true,
    features: ['Everything in Free', 'Unlimited AI Trainer chat', 'AI nutrition estimation', 'Personalized workout plans', 'Progress analytics & charts', 'Community posting'],
  },
  {
    key: 'premium_pro',
    label: 'Premium Pro',
    price: 699,
    icon: Crown,
    iconColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/50',
    features: ['Everything in AI Trainer', 'Advanced body analytics', 'Transformation score tracking', 'Gym network access', 'Custom meal planning', 'Priority support'],
  },
  {
    key: 'premium_elite',
    label: 'Elite',
    price: 1499,
    icon: Star,
    iconColor: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    features: ['Everything in Pro', 'Personal trainer matching', 'Video consultations', 'Dedicated fitness coach', 'DNA-based nutrition (coming)', 'VIP community badge'],
  },
];

export default function Subscription() {
  const { toast } = useToast();
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const subs = await base44.entities.Subscription.filter({ user_id: user.id, status: 'active' });
    setCurrent(subs[0] || null);
    setLoading(false);
  };

  const handleSubscribe = (plan) => {
    if (plan.key === 'free') return;
    toast({
      title: `${plan.label} — ₹${plan.price}/month`,
      description: 'Payment gateway coming soon! Contact support to activate your plan.',
    });
  };

  if (loading) return <LoadingScreen />;

  const activePlan = current?.plan || 'free';

  return (
    <>
      <TopBar title="Plans" showBack />
      <div className="px-4 py-4 space-y-4 pb-6">

        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/15 flex items-center justify-center mx-auto mb-3">
            <Crown size={26} className="text-yellow-400" />
          </div>
          <h2 className="font-heading font-bold text-xl">Unlock Your Potential</h2>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            Choose the plan that matches your fitness ambitions
          </p>
        </div>

        {current && current.plan !== 'free' && (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
              <Check size={16} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Active Subscription</p>
              <p className="font-heading font-bold text-accent capitalize">{current.plan.replace(/_/g, ' ')}</p>
            </div>
            {current.end_date && <p className="text-[10px] text-muted-foreground">Until {current.end_date}</p>}
          </div>
        )}

        <div className="space-y-3">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const isActive = activePlan === plan.key;
            return (
              <div key={plan.key}
                className={`bg-card border-2 rounded-3xl p-5 relative overflow-hidden transition-all ${
                  isActive ? 'border-accent shadow-lg shadow-accent/10' : plan.borderColor
                } ${plan.popular && !isActive ? 'shadow-md shadow-accent/5' : ''}`}>

                {plan.popular && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[9px] font-bold px-4 py-1 rounded-b-xl uppercase tracking-widest">
                    Most Popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4 mt-1">
                  <div className={`w-10 h-10 rounded-xl ${isActive ? 'bg-accent/20' : 'bg-muted'} flex items-center justify-center`}>
                    <Icon size={19} className={isActive ? 'text-accent' : plan.iconColor} />
                  </div>
                  <div className="flex-1">
                    <p className="font-heading font-bold text-base">{plan.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.price === 0 ? 'Always free' : `₹${plan.price} / month`}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-[10px] bg-accent text-accent-foreground px-2.5 py-1 rounded-full font-semibold">Active</span>
                  )}
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

                {!isActive && plan.key !== 'free' && (
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    className={`w-full h-11 rounded-xl font-semibold text-sm ${
                      plan.popular ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-foreground text-background hover:bg-foreground/90'
                    }`}
                  >
                    Get {plan.label} — ₹{plan.price}/mo
                    <ChevronRight size={15} />
                  </Button>
                )}
                {isActive && plan.key !== 'free' && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-accent font-medium">
                    <Shield size={12} /> Your current plan
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center space-y-1">
          <p className="text-[11px] text-muted-foreground">All plans include 7-day money-back guarantee</p>
          <p className="text-[11px] text-muted-foreground">Prices in INR • Cancel anytime</p>
        </div>
      </div>
    </>
  );
}