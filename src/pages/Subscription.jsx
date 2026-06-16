import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Crown, Check, Zap, Star, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PLANS = [
  {
    key: 'free',
    label: 'Free',
    price: 0,
    icon: Zap,
    color: 'border-border',
    features: ['Basic workout tracking', 'Manual nutrition logging', 'Water & step tracking', 'Community access'],
  },
  {
    key: 'ai_trainer',
    label: 'AI Trainer',
    price: 299,
    icon: Sparkles,
    color: 'border-accent',
    popular: true,
    features: ['Everything in Free', 'Unlimited AI Trainer chat', 'AI nutrition estimation', 'Personalized workout plans', 'Progress analytics'],
  },
  {
    key: 'premium_pro',
    label: 'Premium Pro',
    price: 699,
    icon: Crown,
    color: 'border-yellow-500',
    features: ['Everything in AI Trainer', 'Advanced body analytics', 'Transformation tracking', 'Priority support', 'Custom meal plans', 'Gym network access'],
  },
  {
    key: 'premium_elite',
    label: 'Elite',
    price: 1499,
    icon: Star,
    color: 'border-purple-500',
    features: ['Everything in Pro', 'Personal trainer matching', 'Video consultations', 'Dedicated coach', 'DNA-based nutrition', 'VIP community access'],
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
    if (subs.length) setCurrent(subs[0]);
    setLoading(false);
  };

  const handleSubscribe = async (plan) => {
    if (plan.key === 'free') return;
    toast({ title: `${plan.label} Plan`, description: 'Payment integration coming soon! Contact us to upgrade.' });
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const activePlan = current?.plan || 'free';

  return (
    <>
      <TopBar title="Subscription" showBack backTo="/profile" />
      <div className="px-4 py-4 space-y-4 pb-24">
        <div className="text-center py-2">
          <Crown size={28} className="text-yellow-500 mx-auto mb-2" />
          <h2 className="font-heading font-bold text-xl">Unlock Your Full Potential</h2>
          <p className="text-xs text-muted-foreground mt-1">Choose a plan that fits your fitness goals</p>
        </div>

        {current && (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Current Plan</p>
            <p className="font-heading font-bold text-accent capitalize">{current.plan.replace(/_/g, ' ')}</p>
            {current.end_date && <p className="text-xs text-muted-foreground mt-1">Expires: {current.end_date}</p>}
          </div>
        )}

        <div className="space-y-3">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const isActive = activePlan === plan.key;
            return (
              <div key={plan.key} className={`bg-card border-2 rounded-2xl p-5 relative ${isActive ? 'border-accent' : plan.color} ${plan.popular ? 'shadow-lg shadow-accent/10' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
                )}
                {isActive && (
                  <div className="absolute -top-3 right-4 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full">ACTIVE</div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Icon size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-heading font-bold">{plan.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.price === 0 ? 'Always Free' : `₹${plan.price}/month`}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check size={12} className="text-accent flex-shrink-0" />
                      <span className="text-xs">{f}</span>
                    </div>
                  ))}
                </div>
                {!isActive && plan.key !== 'free' && (
                  <Button onClick={() => handleSubscribe(plan)} className="w-full h-10 rounded-xl bg-accent text-accent-foreground">
                    Get {plan.label}
                  </Button>
                )}
                {isActive && (
                  <div className="text-center text-xs text-accent font-medium py-1">✓ Current Plan</div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-center text-muted-foreground">All prices in INR. Cancel anytime. 7-day money back guarantee.</p>
      </div>
    </>
  );
}