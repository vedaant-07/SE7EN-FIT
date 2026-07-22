import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Mail, Lock, Loader2, ChevronLeft } from 'lucide-react';
import AnimatedOtpVerification from '@/components/auth/AnimatedOtpVerification';

export default function GymOwnerLoginSafe() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const goAfterLogin = async () => {
    let owner = null;
    try {
      owner = await base44.gymOwner.getMine();
    } catch {
      try {
        const user = await base44.auth.me();
        const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
        owner = owners?.[0] || null;
      } catch {
        owner = null;
      }
    }

    if (!owner || !owner.onboarding_complete) {
      navigate('/gym-owner/onboarding', { replace: true });
      return;
    }

    navigate('/gym-owner/dashboard', { replace: true });
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password, 'gym_owner');
      if (result?.requires_otp) {
        setNeedsCode(true);
        return;
      }
      await goAfterLogin();
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async (otpCode) => {
    setError('');
    return base44.auth.verifyOtp({ email, otpCode });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 pt-14 mb-8">
        <button onClick={() => needsCode ? setNeedsCode(false) : navigate('/welcome')} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center active:scale-95 transition-all">
          <ChevronLeft size={18} />
        </button>
        <div className="font-display font-bold text-xl">SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span></div>
      </div>

      <div className="flex-1 max-w-sm w-full mx-auto">
        {!needsCode && (
          <div className="mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
              <Building2 size={26} className="text-accent" />
            </div>
            <h1 className="font-heading font-bold text-2xl">Gym Owner Login</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Sign in to access your gym dashboard</p>
          </div>
        )}

        {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}

        {needsCode ? (
          <AnimatedOtpVerification
            value={code}
            onChange={setCode}
            onVerify={verifyLoginCode}
            onVerified={goAfterLogin}
            onError={(err) => setError(err?.message || 'Verification failed. Please try again.')}
            onResend={() => base44.auth.resendOtp(email)}
            resendDisabled={loading}
            destination={email}
            successDescription="Your gym owner login is verified."
          />
        ) : (
          <form onSubmit={submitLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" placeholder="gym@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12 rounded-xl" required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 rounded-xl" required />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-semibold bg-white text-black hover:bg-white/90" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : 'Continue with Email OTP'}
            </Button>
          </form>
        )}

        {!needsCode && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            New gym owner? <Link to="/gym-owner/register" className="text-accent font-medium hover:underline">Register your gym</Link>
          </p>
        )}
      </div>
    </div>
  );
}
