import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { base44 } from '@/api/base44Client';
import { Dumbbell, Building2, Zap, ChevronRight, Loader2 } from 'lucide-react';

const ACTIVE_ROLE_KEY = 'se7enfit_active_role';

const isCapacitorNativeShell = () => {
  if (Capacitor.isNativePlatform()) return true;
  if (import.meta.env.MODE === 'capacitor') return true;
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' && !window.location.port;
};

const selectedRole = () => String(localStorage.getItem(ACTIVE_ROLE_KEY) || '').trim();
const chooseRole = (role) => localStorage.setItem(ACTIVE_ROLE_KEY, role);

const routeForRole = async (user) => {
  const activeRole = selectedRole() || user?.active_role || user?.role;

  if (activeRole === 'gym_owner') {
    try {
      const owner = await base44.gymOwner.getMine();
      return owner?.onboarding_complete ? '/gym-owner/dashboard' : '/gym-owner/onboarding';
    } catch {
      return '/gym-owner/onboarding';
    }
  }

  if (activeRole === 'super_admin' || activeRole === 'nagarsevak') return '/admin';

  return '/';
};

export default function Welcome() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(() => !isCapacitorNativeShell());

  useEffect(() => {
    if (isCapacitorNativeShell()) {
      setChecking(false);
      return;
    }

    let active = true;

    base44.auth.isAuthenticated().then(async (authed) => {
      if (!active) return;

      if (authed) {
        try {
          const user = await base44.auth.me();
          const route = await routeForRole(user);
          if (!active) return;
          navigate(route, { replace: true });
        } catch {
          if (active) setChecking(false);
        }
      } else {
        setChecking(false);
      }
    }).catch(() => {
      if (active) setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="font-display font-bold text-2xl mb-4">SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span></div>
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
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-accent/10">
            <Zap size={36} className="text-accent" />
          </div>
          <h1 className="font-display font-black text-4xl tracking-tight">
            SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2 font-medium">India's #1 AI Fitness App</p>
        </div>

        <div className="text-center mb-8">
          <h2 className="font-heading font-bold text-2xl leading-tight">
            Transform Your <span className="text-accent">Body & Mind</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            AI-powered workouts, nutrition tracking,<br />challenges & rewards — all in one app.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <button
            onClick={() => { chooseRole('user'); navigate('/login/user'); }}
            className="w-full h-16 bg-white text-black rounded-2xl font-heading font-bold text-lg flex items-center px-5 gap-4 shadow-lg shadow-white/10 active:scale-[0.98] transition-all hover:bg-white/90"
          >
            <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center flex-shrink-0">
              <Dumbbell size={22} />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold">Continue as User</div>
              <div className="text-xs font-normal opacity-70">Track fitness, nutrition & more</div>
            </div>
            <ChevronRight size={20} />
          </button>

          <button
            onClick={() => { chooseRole('gym_owner'); navigate('/login/gym-owner'); }}
            className="w-full min-h-[64px] bg-card border-2 border-accent/40 rounded-2xl font-heading font-bold flex items-center px-5 gap-4 active:scale-[0.98] transition-all hover:border-accent hover:bg-accent/5"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-accent" />
            </div>
            <div className="flex-1 text-left py-3">
              <div className="font-bold text-base leading-tight">Continue as Gym Owner</div>
              <div className="text-xs font-normal text-muted-foreground mt-0.5">Manage members, leads & earnings</div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
          </button>
        </div>

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
