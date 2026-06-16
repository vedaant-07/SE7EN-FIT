import React from 'react';
import { Link } from 'react-router-dom';
import { Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PremiumGate({ feature = 'This feature', subscription }) {
  const FREE_PLANS = ['free'];
  const isPremium = subscription && !FREE_PLANS.includes(subscription.plan);

  if (isPremium) return null;

  return (
    <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/30 rounded-2xl p-5 text-center">
      <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
        <Crown size={22} className="text-yellow-500" />
      </div>
      <h3 className="font-heading font-bold text-sm">{feature} is Premium</h3>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
        Upgrade to unlock this feature and get the most out of SE7ENFIT.
      </p>
      <Link to="/subscription">
        <Button className="mt-4 rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 h-10 text-xs font-semibold px-5">
          <Crown size={12} className="mr-1.5" /> Upgrade Now
        </Button>
      </Link>
    </div>
  );
}