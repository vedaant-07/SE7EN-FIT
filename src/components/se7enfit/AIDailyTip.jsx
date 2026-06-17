import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';

const CATEGORY_COLORS = {
  workout: 'text-blue-400 bg-blue-400/10',
  nutrition: 'text-green-400 bg-green-400/10',
  steps: 'text-orange-400 bg-orange-400/10',
  water: 'text-cyan-400 bg-cyan-400/10',
  sleep: 'text-purple-400 bg-purple-400/10',
  motivation: 'text-yellow-400 bg-yellow-400/10',
};

export default function AIDailyTip({ profile }) {
  const [tip, setTip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (profile && !loaded) loadTip();
  }, [profile]);

  const loadTip = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Check for cached tip from today first
      const user = await base44.auth.me();
      const today = new Date().toISOString().slice(0, 10);
      const cached = await base44.entities.AIRecommendation.filter({ user_id: user.id, type: 'daily_tip', date: today });
      if (cached.length > 0) {
        try { setTip(JSON.parse(cached[0].content)); setLoaded(true); setLoading(false); return; } catch {}
      }

      const result = await base44.functions.invoke('geminiService', {
        action: 'getDailyTip',
        profile,
        recentActivity: {},
      });
      if (result.data && !result.data.error && !result.data.locked) {
        setTip(result.data);
      }
      setLoaded(true);
    } catch {}
    setLoading(false);
  };

  if (!tip && !loading) return null;

  if (loading) return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <Loader2 size={16} className="text-accent animate-spin" />
      <p className="text-sm text-muted-foreground">Getting your AI tip...</p>
    </div>
  );

  if (!tip) return null;

  const colorClass = CATEGORY_COLORS[tip.category] || CATEGORY_COLORS.motivation;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
            <Sparkles size={14} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-heading font-semibold text-sm">{tip.tipTitle}</p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize ${colorClass}`}>{tip.category}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{tip.tip}</p>
            {tip.action && (
              <p className="text-xs text-accent font-medium mt-2">→ {tip.action}</p>
            )}
          </div>
        </div>
        <button onClick={loadTip} disabled={loading} className="p-1.5 hover:bg-muted rounded-lg transition-colors flex-shrink-0">
          <RefreshCw size={13} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}