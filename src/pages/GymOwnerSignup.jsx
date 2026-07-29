import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Mail, Lock, Loader2, User, Phone } from 'lucide-react';
import AnimatedOtpVerification from '@/components/auth/AnimatedOtpVerification';
import AuthExperienceShell from '@/components/auth/AuthExperienceShell';
import { verifyOtpWithPurpose, resendOtpWithPurpose } from '@/lib/otp';

function friendlyError(error, fallback) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message && message !== '{}' && message !== '[object Object]' ? message : fallback;
}

export default function GymOwnerSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ownerName: '', email: '', mobile: '', password: '', confirm: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => { localStorage.setItem('se7enfit_active_role', 'gym_owner'); }, []);

  useEffect(() => {
    if (step !== 2 || resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, resendCooldown]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleRegister = async (event) => {
    event.preventDefault();
    setError(''); setNotice('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const result = await base44.auth.register({
        email: form.email,
        password: form.password,
        name: form.ownerName,
        owner_name: form.ownerName,
        phone: form.mobile,
        mobile: form.mobile,
        role: 'gym_owner',
      });
      if (result?.requires_otp) {
        setStep(2);
        setOtp('');
        setResendCooldown(60);
        setNotice(result.message || 'Verification code sent to your email.');
        return;
      }
      navigate('/gym-owner/onboarding', { replace: true });
    } catch (err) {
      setError(friendlyError(err, 'Registration failed. Please check your details.'));
    } finally {
      setLoading(false);
    }
  };

  const verifySignupCode = async (code) => {
    setError(''); setNotice('');
    return verifyOtpWithPurpose({ email: form.email, otpCode: code, purpose: 'register' });
  };

  const resend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true); setError(''); setNotice('');
    try {
      await resendOtpWithPurpose(form.email, 'register');
      setResendCooldown(60);
      setNotice('New verification code sent.');
    } catch (err) {
      setError(friendlyError(err, 'Could not resend the code.'));
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 2) {
      setStep(1);
      setOtp('');
      setError('');
      return;
    }
    navigate('/welcome');
  };

  return (
    <AuthExperienceShell
      onBack={goBack}
      icon={Building2}
      title={step === 2 ? undefined : 'Register your gym'}
      subtitle={step === 2 ? undefined : 'The same SE7EN FIT design, with member management, gym challenges and business tools.'}
      roleLabel="Gym owner"
      compact={step === 2}
      footer={step === 1 ? <>Already registered? <Link to="/login/gym-owner" className="font-semibold text-accent hover:underline">Log in</Link></> : null}
    >
      {error && <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {step === 2 ? (
        <AnimatedOtpVerification
          value={otp}
          onChange={setOtp}
          onVerify={verifySignupCode}
          onVerified={() => navigate('/gym-owner/onboarding', { replace: true })}
          onError={(err) => setError(friendlyError(err, 'Invalid verification code'))}
          onResend={resend}
          resendDisabled={resendCooldown > 0 || loading}
          resendLabel={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
          destination={form.email}
          notice={notice}
          title="Verify your account"
          successDescription="Your gym owner account is verified."
        />
      ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="owner-name">Owner name</Label><div className="relative"><User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="owner-name" placeholder="Your full name" value={form.ownerName} onChange={set('ownerName')} className="h-12 rounded-2xl pl-10" required /></div></div>
          <div className="space-y-2"><Label htmlFor="owner-mobile">Mobile number</Label><div className="relative"><Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="owner-mobile" type="tel" autoComplete="tel" placeholder="Mobile number" value={form.mobile} onChange={set('mobile')} className="h-12 rounded-2xl pl-10" /></div></div>
          <div className="space-y-2"><Label htmlFor="owner-signup-email">Email</Label><div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="owner-signup-email" type="email" autoComplete="email" placeholder="gym@example.com" value={form.email} onChange={set('email')} className="h-12 rounded-2xl pl-10" required /></div></div>
          <div className="space-y-2"><Label htmlFor="owner-signup-password">Password</Label><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="owner-signup-password" type="password" autoComplete="new-password" placeholder="Minimum 6 characters" value={form.password} onChange={set('password')} className="h-12 rounded-2xl pl-10" required /></div></div>
          <div className="space-y-2"><Label htmlFor="owner-confirm-password">Confirm password</Label><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="owner-confirm-password" type="password" autoComplete="new-password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} className="h-12 rounded-2xl pl-10" required /></div></div>
          <Button type="submit" className="h-12 w-full rounded-2xl bg-accent font-black text-accent-foreground hover:bg-accent/90" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : 'Create Gym Owner Account'}</Button>
        </form>
      )}
    </AuthExperienceShell>
  );
}
