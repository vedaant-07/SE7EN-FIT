import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dumbbell, Mail, Lock, Loader2, Hash, Building2 } from 'lucide-react';
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

export default function UserSignup() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [gymCode, setGymCode] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [gymInfo, setGymInfo] = useState(null);
  const [gymCodeError, setGymCodeError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => { localStorage.setItem('se7enfit_active_role', 'user'); }, []);

  useEffect(() => {
    if (!showOtp || resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [showOtp, resendCooldown]);

  const routeByDatabaseRole = async (candidateUser) => {
    const fresh = await checkUserAuth().catch(() => null);
    const resolved = cacheRouteUser(fresh || candidateUser || base44.auth.getCachedUser?.() || {});
    navigate(getPostAuthRoute(resolved), { replace: true });
  };

  const handleGoogleSuccess = async (user) => {
    setError(''); setLoading(true);
    try { await routeByDatabaseRole(user); }
    catch (err) { setError(getErrorMessage(err, 'Google signup failed')); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setSuccess('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const result = await base44.auth.register({ email, password, role: 'user', referral_code: gymCode.trim() || undefined });
      if (gymCode.trim()) localStorage.setItem('pending_gym_code', gymCode.trim().toUpperCase());
      if (result?.requires_otp) {
        setShowOtp(true);
        setOtp('');
        setResendCooldown(60);
        setSuccess(result.message || 'Verification code sent to your email.');
        return;
      }
      await routeByDatabaseRole(result.user || result);
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please check your details and try again.'));
    } finally { setLoading(false); }
  };

  const validateGymCode = async (code) => {
    if (!code.trim()) { setGymInfo(null); setGymCodeError(''); return; }
    try {
      const owners = await base44.entities.GymOwner.list();
      const matched = owners.find((owner) => owner.referral_code?.toUpperCase() === code.trim().toUpperCase());
      if (matched) { setGymInfo(matched); setGymCodeError(''); }
      else { setGymInfo(null); setGymCodeError('Referral code will be checked after signup.'); }
    } catch {
      setGymInfo(null);
      setGymCodeError('Referral code will be checked after signup.');
    }
  };

  const verifySignupCode = async (code) => {
    setError(''); setSuccess('');
    return verifyOtpWithPurpose({ email, otpCode: code, purpose: 'register' });
  };

  const finishVerifiedSignup = async (result) => {
    if (gymCode.trim()) localStorage.setItem('pending_gym_code', gymCode.trim().toUpperCase());
    await routeByDatabaseRole(result.user || result);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(''); setSuccess(''); setLoading(true);
    try {
      await resendOtpWithPurpose(email, 'register');
      setResendCooldown(60);
      setSuccess('New verification code sent.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend code'));
    } finally { setLoading(false); }
  };

  const goBack = () => {
    if (showOtp) {
      setShowOtp(false);
      setOtp('');
      setError('');
      return;
    }
    navigate('/welcome');
  };

  return (
    <AuthExperienceShell
      onBack={goBack}
      icon={Dumbbell}
      title={showOtp ? undefined : 'Create your account'}
      subtitle={showOtp ? undefined : 'One profile for AI coaching, personalized workouts, food tracking, challenges and gym progress.'}
      roleLabel="Member"
      compact={showOtp}
      footer={!showOtp ? <>Already registered? <Link to="/login/user" className="font-semibold text-accent hover:underline">Log in</Link></> : null}
    >
      {error && <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {showOtp ? (
        <AnimatedOtpVerification
          value={otp}
          onChange={setOtp}
          onVerify={verifySignupCode}
          onVerified={finishVerifiedSignup}
          onError={(err) => setError(getErrorMessage(err, 'Invalid verification code'))}
          onResend={handleResend}
          resendDisabled={resendCooldown > 0 || loading}
          resendLabel={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
          destination={email}
          notice={success}
          title="Verify your account"
          successDescription="Your SE7EN FIT member account is ready."
        />
      ) : (
        <>
          {googleClientId && (
            <>
              <GoogleSignInButton role="user" disabled={loading} onSuccess={handleGoogleSuccess} onError={(err) => setError(getErrorMessage(err, 'Google signup failed'))} />
              <div className="relative my-5"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest"><span className="bg-card px-3 text-muted-foreground">or create with email</span></div></div>
            </>
          )}

          {success && <div className="mb-4 rounded-2xl border border-accent/20 bg-accent/10 p-3 text-sm text-accent">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="signup-email">Email</Label><div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="signup-email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div></div>
            <div className="space-y-2"><Label htmlFor="signup-password">Password</Label><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="signup-password" type="password" autoComplete="new-password" placeholder="Minimum 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div></div>
            <div className="space-y-2"><Label htmlFor="signup-confirm">Confirm password</Label><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="signup-confirm" type="password" autoComplete="new-password" placeholder="Repeat password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div></div>
            <div className="space-y-2">
              <Label htmlFor="gym-code" className="flex items-center gap-1.5"><Building2 size={13} className="text-accent" />Gym referral code <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <div className="relative"><Hash className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="gym-code" placeholder="SE7EN-GYM-001" value={gymCode} onChange={(event) => setGymCode(event.target.value.toUpperCase())} onBlur={() => validateGymCode(gymCode)} className="h-12 rounded-2xl pl-10 font-mono tracking-wider" /></div>
              {gymInfo && <div className="flex items-center gap-2 rounded-2xl border border-accent/20 bg-accent/10 p-3"><Building2 size={14} className="shrink-0 text-accent" /><p className="text-xs font-semibold text-accent">{gymInfo.gym_name} · {gymInfo.city}</p></div>}
              {gymCodeError && <p className="text-xs text-muted-foreground">{gymCodeError}</p>}
            </div>
            <Button type="submit" className="h-12 w-full rounded-2xl bg-accent font-black text-accent-foreground hover:bg-accent/90" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : 'Create Member Account'}</Button>
          </form>
        </>
      )}
    </AuthExperienceShell>
  );
}
