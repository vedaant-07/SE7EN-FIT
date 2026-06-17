import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Lock, Check, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HIGHLIGHTS = [
  { plan: '₹299/mo', label: 'Basic', features: ['20 AI messages/day', 'Limited food scans', 'Basic challenges'] },
  { plan: '₹499/mo', label: 'Premium', features: ['Unlimited everything', 'All animated guides', 'All challenges + rewards'], highlight: true },
];

export default function PremiumPaywall({ feature = 'This Feature', description, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-card rounded-t-3xl p-6 pb-10 border-t border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        {/* Lock icon */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-yellow-400/20 to-yellow-400/5 border border-yellow-400/30 flex items-center justify-center mb-3">
            <Crown size={28} className="text-yellow-400" />
          </div>
          <h2 className="font-heading font-bold text-xl text-center">Unlock {feature}</h2>
          {description && <p className="text-sm text-muted-foreground text-center mt-1.5 leading-relaxed">{description}</p>}
        </div>

        {/* Plan comparison */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {HIGHLIGHTS.map(h => (
            <div key={h.plan} className={`rounded-2xl p-3 border-2 transition-all ${h.highlight ? 'border-accent bg-accent/5' : 'border-border bg-muted/40'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-heading font-bold text-sm ${h.highlight ? 'text-accent' : ''}`}>{h.label}</span>
                {h.highlight && <span className="text-[9px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-bold">ALL FEATURES</span>}
              </div>
              <p className={`font-black text-lg ${h.highlight ? 'text-accent' : 'text-foreground'}`}>{h.plan}</p>
              <div className="mt-2 space-y-1">
                {h.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Check size={10} className="text-accent flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => { navigate('/subscription'); onClose?.(); }}
          className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-bold shadow-lg shadow-accent/20">
          <Zap size={16} /> Upgrade Now — From ₹299/mo <ChevronRight size={14} />
        </Button>

        <p className="text-center text-[10px] text-muted-foreground mt-3">
          All plans include 7-day free trial • Non-refundable once purchased
        </p>
      </div>
    </div>
  );
}