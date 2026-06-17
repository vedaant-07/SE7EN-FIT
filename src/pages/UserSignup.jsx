import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dumbbell, Mail, Lock, Loader2, ChevronLeft, Hash, Building2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import GoogleIcon from '@/components/GoogleIcon';

export default function UserSignup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [gymCode, setGymCode] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gymInfo, setGymInfo] = useState(null);
  const [gymCodeError, setGymCodeError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const validateGymCode = async (code) => {
    if (!code.trim()) { setGymInfo(null); setGymCodeError(''); return; }
    const owners = await base44.entities.GymOwner.list();
    const matched = owners.find(o => o.referral_code?.toUpperCase() === code.trim().toUpperCase());
    if (matched) {
      setGymInfo(matched);
      setGymCodeError('');
    } else {
      setGymInfo(null);
      setGymCodeError('Invalid gym referral code. Please check with your gym owner.');
    }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode: otp });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      // If gym code provided and valid, link gym after verification
      if (gymInfo) {
        try {
          const user = await base44.auth.me();
          const today = new Date().toISOString().split('T')[0];
          await Promise.all([
            base44.entities.UserGymMembership.create({
              user_id: user.id,
              gym_id: gymInfo.id,
              owner_id: gymInfo.user_id,
              referral_code_used: gymCode.trim().toUpperCase(),
              status: 'pending',
              joined_at: today,
            }),
            base44.entities.GymLead.create({
              gym_id: gymInfo.id,
              owner_id: gymInfo.user_id,
              name: user.full_name || email.split('@')[0],
              email: email,
              source: 'app',
              status: 'new',
              referral_code_used: gymCode.trim().toUpperCase(),
              user_id: user.id,
            }),
          ]);
          // Store gym code to pick up during onboarding
          localStorage.setItem('pending_gym_id', gymInfo.id);
          localStorage.setItem('pending_gym_code', gymCode.trim().toUpperCase());
        } catch {}
      }
      window.location.href = '/onboarding';
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider('google', '/user-dashboard');
  };

  if (showOtp) {
    return (
      <div className="min-h-screen bg-background flex flex-col px-6">
        <div className="flex items-center gap-3 pt-14 mb-8">
          <button onClick={() => setShowOtp(false)} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center"><ChevronLeft size={18} /></button>
          <div className="font-display font-bold text-xl">SE<span className="text-accent">7</span>ENFIT</div>
        </div>
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4"><Mail size={26} className="text-accent" /></div>
            <h1 className="font-heading font-bold text-2xl">Verify Email</h1>
            <p className="text-muted-foreground text-sm mt-1">Code sent to {email}</p>
          </div>
          {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
          <div className="flex justify-center mb-6">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus autoComplete="one-time-code">
              <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
            </InputOTP>
          </div>
          <Button className="w-full h-12 rounded-xl font-semibold bg-accent text-accent-foreground" onClick={handleVerify} disabled={loading || otp.length < 6}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : 'Verify & Continue'}
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Didn't get code?{' '}
            <button onClick={() => base44.auth.resendOtp(email)} className="text-accent font-medium">Resend</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 pt-14 mb-8">
        <button onClick={() => navigate('/welcome')} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center active:scale-95 transition-all">
          <ChevronLeft size={18} />
        </button>
        <div className="font-display font-bold text-xl">SE<span className="text-accent">7</span>ENFIT</div>
      </div>

      <div className="flex-1 max-w-sm w-full mx-auto pb-10">
        <div className="mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
            <Dumbbell size={26} className="text-accent" />
          </div>
          <h1 className="font-heading font-bold text-2xl">Create Account</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Start your fitness journey today</p>
        </div>

        <Button variant="outline" className="w-full h-12 text-sm font-medium mb-6 rounded-xl" onClick={handleGoogle}>
          <GoogleIcon className="w-5 h-5 mr-2" />
          Continue with Google
        </Button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground">or</span>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" autoComplete="email" autoFocus placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12 rounded-xl" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" autoComplete="new-password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12 rounded-xl" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" autoComplete="new-password" placeholder="••••••••"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10 h-12 rounded-xl" required />
            </div>
          </div>
          {/* Optional Gym Referral Code */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Building2 size={13} className="text-accent" />
              Gym Referral Code <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="e.g. SE7EN-GYM-001"
                value={gymCode}
                onChange={(e) => { setGymCode(e.target.value.toUpperCase()); }}
                onBlur={() => validateGymCode(gymCode)}
                className="pl-10 h-12 rounded-xl font-mono tracking-wider"
              />
            </div>
            {gymInfo && (
              <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl p-3">
                <Building2 size={14} className="text-accent flex-shrink-0" />
                <p className="text-xs text-accent font-semibold">✓ {gymInfo.gym_name} — {gymInfo.city}</p>
              </div>
            )}
            {gymCodeError && <p className="text-xs text-destructive">{gymCodeError}</p>}
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <button onClick={() => navigate('/login/user')} className="text-accent font-medium hover:underline">Log in</button>
        </p>
      </div>
    </div>
  );
}