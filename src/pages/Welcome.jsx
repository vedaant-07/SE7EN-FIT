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
          const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
          if (owners.length > 0) {
            navigate(owners[0].onboarding_complete ? '/gym-owner/dashboard' : '/gym-owner/onboarding', { replace: true });
          } else {
            const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
            navigate(profiles.length > 0 ? '/user-dashboard' : '/onboarding', { replace: true });
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
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-accent/10">
            <Zap size={36} className="text-accent" />
          </div>
          <h1 className="font-display font-black text-4xl tracking-tight">
            SE<span className="text-accent">7</span>ENFIT
          </h1>
          <p className="text-muted-foreground text-sm mt-2 font-medium">India's #1 AI Fitness App</p>
        </div>

        {/* Tagline */}
        <div className="text-center mb-8">
          <h2 className="font-heading font-bold text-2xl leading-tight">
            Transform Your <span className="text-accent">Body & Mind</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            AI-powered workouts, nutrition tracking,<br />challenges & rewards — all in one app.
          </p>
        </div>

        {/* TWO BIG CTA BUTTONS */}
        <div className="space-y-4 mb-6">
          {/* User */}
          <button
            onClick={() => navigate('/login/user')}
            className="w-full h-16 bg-accent text-accent-foreground rounded-2xl font-heading font-bold text-lg flex items-center px-5 gap-4 shadow-lg shadow-accent/25 active:scale-[0.98] transition-all hover:bg-accent/90"
          >
            <div className="w-10 h-10 rounded-xl bg-accent-foreground/10 flex items-center justify-center flex-shrink-0">
              <Dumbbell size={22} />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold">Continue as User</div>
              <div className="text-xs font-normal opacity-75">Track fitness, nutrition & more</div>
            </div>
            <ChevronRight size={20} />
          </button>

          {/* Gym Owner */}
          <button
            onClick={() => navigate('/login/gym-owner')}
            className="w-full h-16 bg-card border-2 border-accent/40 rounded-2xl font-heading font-bold text-lg flex items-center px-5 gap-4 active:scale-[0.98] transition-all hover:border-accent hover:bg-accent/5"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-accent" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold">Continue as Gym Owner</div>
              <div className="text-xs font-normal text-muted-foreground">Manage members, leads & earnings</div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Legal */}
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