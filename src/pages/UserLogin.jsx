import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dumbbell, Mail, Lock, Loader2 } from 'lucide-react';
import AnimatedOtpVerification from '@/components/auth/AnimatedOtpVerification';
import AuthExperienceShell from '@/components/auth/AuthExperienceShell';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { cacheRouteUser, getPostAuthRoute } from '@/lib/routing';
import { verifyOtpWithPurpose, resendOtpWithPurpose } from '@/lib/otp';

function getErrorMessage(error, fallback = 'Something went wrong') {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  const bodyError = typeof error?.body?.error === 'string' ? error.body.error.trim() : '';
  const bodyMessage = typeof error?.body?.message === 'string' ? error.body.message.trim() : '';
  if (message && message !== '{}' && message !== '[object Object]') return message;
  if (bodyError && bodyError !== '{}') return bodyError;
  if (bodyMessage && bodyMessage !== '{}') return bodyMessage;
  return fallback;
}

export default function UserLogin() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => { localStorage.setItem('se7enfit_active_role', 'user'); }, []);

  useEffect(() => {
    if (!showOtp || resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [showOtp, resendCooldown]);

  const routeByDatabaseRole = useCallback(async (candidateUser) => {
    const fresh = await checkUserAuth().catch(() => null);
    const resolved = cacheRouteUser(fresh || candidateUser || base44.auth.getCachedUser?.() || {});
    navigate(getPostAuthRoute(resolved), { replace: true });
  }, [checkUserAuth, navigate]);

  const beginOtp = (result) => {
    setShowOtp(true);
    setOtpCode('');
    setResendCooldown(60);
    setSuccess(result.message || 'Login verification code sent to your email.');
  };

  const handleGoogleSuccess = useCallback(async (user) => {
    setError(''); setSuccess(''); setLoading(true);
    try { await routeByDatabaseRole(user); }
    catch (err) { setError(getErrorMessage(err, 'Google login failed')); }
    finally { setLoading(false); }
  }, [routeByDatabaseRole]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password, 'user');
      if (result?.requires_otp) { beginOtp(result); return; }
      await routeByDatabaseRole(result);
    } catch (err) {
      const message = getErrorMessage(err, 'Invalid email or password');
      if (err?.status === 403 && /gym owner/i.test(message)) {
        try {
          const ownerResult = await base44.auth.loginViaEmailPassword(email, password, 'gym_owner');
          if (ownerResult?.requires_otp) { beginOtp(ownerResult); return; }
          await routeByDatabaseRole(ownerResult);
          return;
        } catch (ownerErr) {
          setError(getErrorMessage(ownerErr, message));
          return;
        }
      }
      setError(message);
    } finally { setLoading(false); }
  };

  const verifyLoginCode = async (code) => {
    setError(''); setSuccess('');
    return verifyOtpWithPurpose({ email, otpCode: code, purpose: 'login' });
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(''); setSuccess(''); setLoading(true);
    try {
      await resendOtpWithPurpose(email, 'login');
      setResendCooldown(60);
      setSuccess('New verification code sent.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend code'));
    } finally { setLoading(false); }
  };

  const goBack = () => {
    if (showOtp) {
      setShowOtp(false);
      setOtpCode('');
      setError('');
      return;
    }
    navigate('/welcome');
  };

  return (
    <AuthExperienceShell
      onBack={goBack}
      icon={Dumbbell}
      title={showOtp ? undefined : 'Welcome back'}
      subtitle={showOtp ? undefined : 'Sign in once, verify securely, and continue your fitness plan.'}
      roleLabel="Member"
      compact={showOtp}
      footer={!showOtp ? <>New to SE7EN FIT? <Link to="/signup/user" className="font-semibold text-accent hover:underline">Create account</Link></> : null}
    >
      {error && <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {showOtp ? (
        <AnimatedOtpVerification
          value={otpCode}
          onChange={setOtpCode}
          onVerify={verifyLoginCode}
          onVerified={(result) => routeByDatabaseRole(result.user || result)}
          onError={(err) => setError(getErrorMessage(err, 'Invalid verification code'))}
          onResend={handleResend}
          resendDisabled={resendCooldown > 0 || loading}
          resendLabel={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
          destination={email}
          notice={success}
          title="Verify your login"
          successDescription="Your SE7EN FIT login is verified."
        />
      ) : (
        <>
          {googleClientId && (
            <>
              <GoogleSignInButton role="user" disabled={loading} onSuccess={handleGoogleSuccess} onError={(err) => setError(getErrorMessage(err, 'Google login failed'))} />
              <div className="relative my-5"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest"><span className="bg-card px-3 text-muted-foreground">or continue with email</span></div></div>
            </>
          )}

          {success && <div className="mb-4 rounded-2xl border border-accent/20 bg-accent/10 p-3 text-sm text-accent">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="member-email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label htmlFor="member-password">Password</Label><Link to="/forgot-password" className="text-xs font-semibold text-accent hover:underline">Forgot?</Link></div>
              <div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="member-password" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div>
            </div>
            <Button type="submit" className="h-12 w-full rounded-2xl bg-accent font-black text-accent-foreground hover:bg-accent/90" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending secure code…</> : 'Continue with Email OTP'}
            </Button>
          </form>
        </>
      )}
    </AuthExperienceShell>
  );
}
