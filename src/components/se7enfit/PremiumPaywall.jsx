import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HIGHLIGHTS = [
  { plan: '₹299/mo', label: 'Basic', features: ['20 AI messages/day', 'Limited food scans', 'Basic challenges'] },
  { plan: '₹499/mo', label: 'Premium', features: ['Unlimited everything', 'All animated guides', 'All challenges + rewards'], highlight: true },
];

export default function PremiumPaywall({ feature = 'This Feature', description, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mx-0">
      <div className="flex flex-col items-center mb-4">
        <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mb-3">
          <Crown size={22} className="text-yellow-400" />
        </div>
        <h2 className="font-heading font-bold text-base text-center">Unlock {feature}</h2>
        {description && <p className="text-xs text-muted-foreground text-center mt-1 leading-relaxed">{description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {HIGHLIGHTS.map(h => (
          <div key={h.plan} className={`rounded-xl p-3 border transition-all ${h.highlight ? 'border-accent bg-accent/5' : 'border-border bg-muted/40'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`font-heading font-bold text-sm ${h.highlight ? 'text-accent' : ''}`}>{h.label}</span>
            </div>
            <p className={`font-black text-base ${h.highlight ? 'text-accent' : 'text-foreground'}`}>{h.plan}</p>
            <div className="mt-1.5 space-y-1">
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
        className="w-full h-11 rounded-xl bg-accent text-accent-foreground font-bold">
        <Zap size={15} /> Upgrade Now — From ₹299/mo <ChevronRight size={13} />
      </Button>
    </div>
  );
}