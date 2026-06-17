import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dumbbell, Building2, Zap, ChevronRight, Loader2 } from 'lucide-react';

export default function Welcome() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed) {
        try {
          const user = await base44.auth.me();
          // Check if gym owner
          const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
          if (owners.length > 0) {
            navigate(owners[0].onboarding_complete ? '/gym-owner/dashboard' : '/gym-owner/onboarding', { replace: true });
          } else {
            // Check user profile
            const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
            navigate(profiles.length > 0 ? '/' : '/onboarding', { replace: true });
          }
        } catch {
          setChecking(false);
        }
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="font-display font-bold text-2xl mb-4">SE<span className="text-accent">7</span>ENFIT</div>
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-3xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-accent/10">
            <Zap size={36} className="text-accent" />
          </div>
          <h1 className="font-display font-black text-4xl tracking-tight">
            SE<span className="text-accent">7</span>ENFIT
          </h1>
          <p className="text-muted-foreground text-sm mt-2 font-medium">India's #1 AI Fitness App</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] text-accent font-semibold uppercase tracking-widest">Gen-Z Fitness</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          </div>
        </div>

        {/* Tagline */}
        <div className="text-center mb-10">
          <h2 className="font-heading font-bold text-2xl leading-tight">
            Transform Your
            <br />
            <span className="text-accent">Body & Mind</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            AI-powered workouts, nutrition tracking,<br />challenges & rewards — all in one app.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {['AI Trainer', 'Food Scan', 'Challenges', 'Rewards', 'Live Tracking'].map(f => (
            <span key={f} className="text-[10px] bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium border border-border">
              {f}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          {/* User Button */}
          <button
            onClick={() => navigate('/login')}
            className="w-full h-14 bg-accent text-accent-foreground rounded-2xl font-heading font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-accent/25 active:scale-[0.98] transition-all hover:bg-accent/90"
          >
            <Dumbbell size={20} />
            Continue as User
            <ChevronRight size={18} />
          </button>

          {/* Gym Owner Button */}
          <button
            onClick={() => navigate('/gym-owner/login')}
            className="w-full h-14 bg-card border-2 border-border rounded-2xl font-heading font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:border-accent/50 hover:bg-accent/5"
          >
            <Building2 size={20} className="text-accent" />
            Continue as Gym Owner
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Divider with label */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Choose your path</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Role explainers */}
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          <div className="bg-muted/40 border border-border rounded-2xl p-3 text-center">
            <Dumbbell size={16} className="text-accent mx-auto mb-1.5" />
            <p className="text-[11px] font-semibold">User</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Track workouts, nutrition & health</p>
          </div>
          <div className="bg-muted/40 border border-border rounded-2xl p-3 text-center">
            <Building2 size={16} className="text-accent mx-auto mb-1.5" />
            <p className="text-[11px] font-semibold">Gym Owner</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Manage members, leads & earnings</p>
          </div>
        </div>

        {/* Legal note */}
        <p className="text-center text-[10px] text-muted-foreground leading-relaxed px-4">
          By continuing, you agree to our{' '}
          <button onClick={() => navigate('/terms')} className="underline">Terms</button>
          {' '}and{' '}
          <button onClick={() => navigate('/privacy')} className="underline">Privacy Policy</button>.
        </p>
      </div>
    </div>
  );
}