import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Mail, Lock, Loader2, ChevronLeft, User, Phone } from 'lucide-react';
import AnimatedOtpVerification from '@/components/auth/AnimatedOtpVerification';
import { verifyOtpWithPurpose, resendOtpWithPurpose } from '@/lib/otp';

export default function GymOwnerSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
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
      const result = await base44.auth.register({
        email: form.email,
        password: form.password,
        name: form.ownerName,
        owner_name: form.ownerName,
        phone: form.mobile,
        mobile: form.mobile,
        role: 'gym_owner',
      });
      if (result?.requires_otp) { setStep(2); return; }
      navigate('/gym-owner/dashboard', { replace: true });
    } catch (err) { setError(err.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const verifySignupCode = async (code) => {
    setError('');
    return verifyOtpWithPurpose({ email: form.email, otpCode: code, purpose: 'register' });
  };

  if (step === 2) {
    return (
      <div className="min-h-screen bg-background flex flex-col px-6">
        <div className="flex items-center gap-3 pt-14 mb-8">
          <button onClick={() => setStep(1)} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center"><ChevronLeft size={18} /></button>
          <div className="font-display font-bold text-xl">SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span></div>
        </div>
        <div className="max-w-sm w-full mx-auto">
          {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
          <AnimatedOtpVerification
            value={otp}
            onChange={setOtp}
            onVerify={verifySignupCode}
            onVerified={() => navigate('/gym-owner/dashboard', { replace: true })}
            onError={(err) => setError(err?.message || 'Invalid verification code')}
            onResend={() => resendOtpWithPurpose(form.email, 'register')}
            resendDisabled={loading}
            destination={form.email}
            successDescription="Your gym owner account is verified."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center gap-3 pt-14 mb-8">
        <button onClick={() => navigate('/welcome')} className="w-9 h-9 rounded-xl border border-border flex items-center justify-center active:scale-95"><ChevronLeft size={18} /></button>
        <div className="font-display font-bold text-xl">SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span></div>
      </div>
      <div className="max-w-sm w-full mx-auto pb-10">
        <div className="mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4"><Building2 size={26} className="text-accent" /></div>
          <h1 className="font-heading font-bold text-2xl">Register Your Gym</h1>
          <p className="text-muted-foreground text-sm mt-1.5">Create your gym owner account</p>
        </div>
        {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2"><Label>Owner Name</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Your full name" value={form.ownerName} onChange={set('ownerName')} className="pl-10 h-12 rounded-xl" required /></div></div>
          <div className="space-y-2"><Label>Mobile Number</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Mobile number" value={form.mobile} onChange={set('mobile')} className="pl-10 h-12 rounded-xl" /></div></div>
          <div className="space-y-2"><Label>Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input type="email" placeholder="gym@example.com" value={form.email} onChange={set('email')} className="pl-10 h-12 rounded-xl" required /></div></div>
          <div className="space-y-2"><Label>Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input type="password" placeholder="Password" value={form.password} onChange={set('password')} className="pl-10 h-12 rounded-xl" required /></div></div>
          <div className="space-y-2"><Label>Confirm Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input type="password" placeholder="Password" value={form.confirm} onChange={set('confirm')} className="pl-10 h-12 rounded-xl" required /></div></div>
          <Button type="submit" className="w-full h-12 rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : 'Create Gym Account'}</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">Already have an account? <button onClick={() => navigate('/login/gym-owner')} className="text-accent font-medium hover:underline">Login</button></p>
      </div>
    </div>
  );
}
