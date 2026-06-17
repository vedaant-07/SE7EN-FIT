import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Building2, Zap, ChevronRight } from 'lucide-react';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background glow */}
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
          <button
            onClick={() => navigate('/login')}
            className="w-full h-14 bg-accent text-accent-foreground rounded-2xl font-heading font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-accent/25 active:scale-[0.98] transition-all hover:bg-accent/90"
          >
            <Dumbbell size={20} />
            Continue as User
            <ChevronRight size={18} />
          </button>

          <button
            onClick={() => navigate('/gym-owner/login')}
            className="w-full h-14 bg-card border-2 border-border rounded-2xl font-heading font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:border-accent/40"
          >
            <Building2 size={20} className="text-accent" />
            Continue as Gym Owner
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Legal note */}
        <p className="text-center text-[10px] text-muted-foreground mt-8 leading-relaxed px-4">
          By continuing, you agree to our{' '}
          <button onClick={() => navigate('/terms')} className="underline">Terms</button>
          {' '}and{' '}
          <button onClick={() => navigate('/privacy')} className="underline">Privacy Policy</button>.
          {' '}Health guidance is for informational purposes only.
        </p>
      </div>
    </div>
  );
}