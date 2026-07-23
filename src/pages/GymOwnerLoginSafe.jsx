import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Mail, Lock, Loader2 } from 'lucide-react';
import AnimatedOtpVerification from '@/components/auth/AnimatedOtpVerification';
import AuthExperienceShell from '@/components/auth/AuthExperienceShell';
import { verifyOtpWithPurpose, resendOtpWithPurpose } from '@/lib/otp';

function friendlyError(error, fallback) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message && message !== '{}' && message !== '[object Object]' ? message : fallback;
}

export default function GymOwnerLoginSafe() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => { localStorage.setItem('se7enfit_active_role', 'gym_owner'); }, []);

  useEffect(() => {
    if (!needsCode || resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [needsCode, resendCooldown]);

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
    navigate(!owner || !owner.onboarding_complete ? '/gym-owner/onboarding' : '/gym-owner/dashboard', { replace: true });
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setError(''); setNotice(''); setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password, 'gym_owner');
      if (result?.requires_otp) {
        setNeedsCode(true);
        setCode('');
        setResendCooldown(60);
        setNotice(result.message || 'Verification code sent to your email.');
        return;
      }
      await goAfterLogin();
    } catch (err) {
      setError(friendlyError(err, 'Login failed. Please check your details.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async (otpCode) => {
    setError(''); setNotice('');
    return verifyOtpWithPurpose({ email, otpCode, purpose: 'login' });
  };

  const resend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true); setError(''); setNotice('');
    try {
      await resendOtpWithPurpose(email, 'login');
      setResendCooldown(60);
      setNotice('New verification code sent.');
    } catch (err) {
      setError(friendlyError(err, 'Could not resend the code.'));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (needsCode) {
      setNeedsCode(false);
      setCode('');
      setError('');
      return;
    }
    navigate('/welcome');
  };

  return (
    <AuthExperienceShell
      onBack={goBack}
      icon={Building2}
      title={needsCode ? undefined : 'Welcome back'}
      subtitle={needsCode ? undefined : 'Use the same SE7EN FIT experience with gym-management tools unlocked after sign-in.'}
      roleLabel="Gym owner"
      compact={needsCode}
      footer={!needsCode ? <>New gym owner? <Link to="/gym-owner/register" className="font-semibold text-accent hover:underline">Register your gym</Link></> : null}
    >
      {error && <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {needsCode ? (
        <AnimatedOtpVerification
          value={code}
          onChange={setCode}
          onVerify={verifyLoginCode}
          onVerified={goAfterLogin}
          onError={(err) => setError(friendlyError(err, 'Verification failed. Please try again.'))}
          onResend={resend}
          resendDisabled={resendCooldown > 0 || loading}
          resendLabel={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
          destination={email}
          notice={notice}
          title="Verify your login"
          successDescription="Your gym owner login is verified."
        />
      ) : (
        <form onSubmit={submitLogin} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="owner-email">Email</Label><div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="owner-email" type="email" autoComplete="email" autoFocus placeholder="gym@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="owner-password">Password</Label><Link to="/forgot-password" className="text-xs font-semibold text-accent hover:underline">Forgot?</Link></div><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="owner-password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div></div>
          <Button type="submit" className="h-12 w-full rounded-2xl bg-accent font-black text-accent-foreground hover:bg-accent/90" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending secure code…</> : 'Continue with Email OTP'}</Button>
        </form>
      )}
    </AuthExperienceShell>
  );
}
