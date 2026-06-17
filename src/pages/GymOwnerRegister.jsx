import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Mail, Lock, Loader2, ChevronLeft, User, Phone } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function GymOwnerRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=account, 2=otp
  const [form, setForm] = useState({ ownerName: '', email: '', mobile: '', password: '', confirm: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email: form.email, password: form.password });
      setStep(2);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: form.email, otpCode: otp });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      // Create gym owner profile stub
      const user = await base44.auth.me();
      await base44.entities.GymOwner.create({
        user_id: user.id,
        owner_name: form.ownerName,
        email: form.email,
        mobile: form.mobile,
        gym_name: '',
        onboarding_complete: false,
      });
      window.location.href = '/gym-owner/onboarding';
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  if (step === 2) {
    return (
      <div className="min-h-screen bg-background flex flex-col px-6">
        <div className="flex items-center gap-3 pt-14 mb-8">
          <button onClick={() => setStep(1)} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center"><ChevronLeft size={18} /></button>
          <div className="font-display font-bold text-xl">SE<span className="text-accent">7</span>ENFIT</div>
        </div>
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4"><Mail size={26} className="text-accent" /></div>
            <h1 className="font-heading font-bold text-2xl">Verify Email</h1>
            <p className="text-muted-foreground text-sm mt-1">Code sent to {form.email}</p>
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
            <button onClick={() => base44.auth.resendOtp(form.email)} className="text-accent font-medium">Resend</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 overflow-y-auto">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center gap-3 pt-14 mb-8">
        <button onClick={() => navigate('/welcome')} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center active:scale-95"><ChevronLeft size={18} /></button>
        <div className="font-display font-bold text-xl">SE<span className="text-accent">7</span>ENFIT</div>
      </div>
      <div className="max-w-sm w-full mx-auto pb-10">
        <div className="mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4"><Building2 size={26} className="text-accent" /></div>
          <h1 className="font-heading font-bold text-2xl">Register Your Gym</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Create your gym owner account</p>
        </div>
        {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label>Owner Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Your full name" value={form.ownerName} onChange={set('ownerName')} className="pl-10 h-12 rounded-xl" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mobile Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="+91 9876543210" value={form.mobile} onChange={set('mobile')} className="pl-10 h-12 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" placeholder="gym@example.com" value={form.email} onChange={set('email')} className="pl-10 h-12 rounded-xl" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} className="pl-10 h-12 rounded-xl" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} className="pl-10 h-12 rounded-xl" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : 'Create Gym Account'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link to="/gym-owner/login" className="text-accent font-medium hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}