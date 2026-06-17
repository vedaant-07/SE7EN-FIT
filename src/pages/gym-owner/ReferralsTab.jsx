import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Share2, Copy, Check, RefreshCw, Users, TrendingUp, Download } from 'lucide-react';
import ConfirmModal from '@/components/gym-owner/ConfirmModal';

export default function ReferralsTab({ owner, setOwner, memberships, showToast, onNavigateToEarnings }) {
  const [copied, setCopied] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const totalReferral = memberships.filter(m => m.referral_code_used).length;
  const activeViaRef = memberships.filter(m => m.referral_code_used && m.status === 'active').length;
  const pendingViaRef = memberships.filter(m => m.referral_code_used && m.status === 'pending').length;
  const estRevenue = activeViaRef * (owner.monthly_fee || 999);

  const copyCode = () => {
    if (!owner.referral_code) return;
    navigator.clipboard.writeText(owner.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Referral code copied!', 'success');
  };

  const shareCode = () => {
    if (navigator.share) {
      navigator.share({ title: `Join ${owner.gym_name}`, text: `Use my referral code: ${owner.referral_code} to join ${owner.gym_name} on SE7ENFIT!` });
    } else {
      copyCode();
      showToast('Link copied — share it!', 'info');
    }
  };

  const regenerateCode = async () => {
    setRegenerating(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const newCode = (owner.gym_name?.slice(0, 3).toUpperCase() || 'GYM') +
      Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await base44.entities.GymOwner.update(owner.id, { referral_code: newCode });
    setOwner(prev => ({ ...prev, referral_code: newCode }));
    setRegenConfirm(false);
    showToast(`New code generated: ${newCode}`, 'success');
    setRegenerating(false);
  };

  return (
    <div className="space-y-4">
      <p className="font-heading font-bold text-lg">Referrals</p>

      {/* Code Card */}
      <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-2xl p-5">
        <p className="text-xs text-muted-foreground mb-1">🔑 Your Gym Referral Code</p>
        <p className="text-[11px] text-muted-foreground mb-3">Share this code with potential members so they can link your gym during signup</p>
        {owner.referral_code ? (
          <>
            <div className="flex items-center justify-between bg-background/60 border border-accent/30 rounded-xl px-4 py-3 mb-3">
              <span className="font-mono font-black text-2xl tracking-widest text-accent">{owner.referral_code}</span>
              <button onClick={copyCode}
                className="flex items-center gap-1.5 text-xs text-accent font-semibold bg-accent/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all min-w-[68px]">
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={shareCode}
                className="flex-1 h-9 rounded-xl bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                <Share2 size={12} /> Share Code
              </button>
              <button onClick={() => setRegenConfirm(true)}
                className="h-9 px-3 rounded-xl border border-border text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted transition-all">
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-amber-400">⚠️ Complete your gym profile to generate a referral code</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total via Referral', value: totalReferral, color: 'text-blue-400', border: 'border-blue-400/20' },
          { label: 'Active Members', value: activeViaRef, color: 'text-emerald-400', border: 'border-emerald-400/20' },
          { label: 'Pending Approval', value: pendingViaRef, color: 'text-amber-400', border: 'border-amber-400/20' },
          { label: 'Est. Monthly Rev', value: `₹${estRevenue.toLocaleString()}`, color: 'text-purple-400', border: 'border-purple-400/20' },
        ].map(s => (
          <div key={s.label} className={`bg-card border ${s.border} rounded-2xl p-4`}>
            <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referred members */}
      {memberships.filter(m => m.referral_code_used).length > 0 && (
        <div className="space-y-2">
          <p className="font-semibold text-sm">Referred Members</p>
          {memberships.filter(m => m.referral_code_used).map(m => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-accent">{(m.user_id || 'U')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Member #{m.user_id?.slice(-6)}</p>
                <p className="text-xs text-muted-foreground">Code used: {m.referral_code_used} • Joined {m.joined_at || 'Recently'}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${m.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onNavigateToEarnings}
          className="flex-1 h-10 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold flex items-center justify-center gap-1.5">
          <TrendingUp size={14} /> View Earnings
        </button>
        <button onClick={() => showToast('Referral report export — coming soon!', 'info')}
          className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 hover:bg-muted transition-all">
          <Download size={14} /> Export
        </button>
      </div>

      <ConfirmModal
        open={regenConfirm}
        title="Regenerate Referral Code"
        message="Your old code will stop working. Existing members already linked won't be affected, but new signups must use the new code."
        confirmLabel="Regenerate"
        confirmClass="bg-accent text-accent-foreground"
        onConfirm={regenerateCode}
        onCancel={() => setRegenConfirm(false)}
      />
    </div>
  );
}