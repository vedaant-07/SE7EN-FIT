import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Mail } from 'lucide-react';
import AuthExperienceShell from '@/components/auth/AuthExperienceShell';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Keep the response private and identical whether the account exists or not.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthExperienceShell
      onBack={() => navigate('/login/user')}
      icon={Mail}
      title="Reset your password"
      subtitle="Enter your email and we will send a secure reset link."
      roleLabel="Account recovery"
      compact={sent}
      footer={<Link to="/login/user" className="font-semibold text-accent hover:underline">Back to login</Link>}
    >
      {sent ? (
        <div className="py-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-accent/25 bg-accent/10 text-accent"><Check size={28} /></div>
          <h2 className="mt-4 font-heading text-xl font-black">Check your inbox</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">If an account exists for <span className="font-semibold text-foreground">{email}</span>, a reset link will arrive shortly.</p>
          <Button type="button" onClick={() => { setSent(false); setEmail(''); }} variant="outline" className="mt-5 h-11 rounded-2xl">Use another email</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-email">Email address</Label>
            <div className="relative"><Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="recovery-email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-2xl pl-10" required /></div>
          </div>
          <Button type="submit" className="h-12 w-full rounded-2xl bg-accent font-black text-accent-foreground" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending reset link…</> : 'Send reset link'}</Button>
        </form>
      )}
    </AuthExperienceShell>
  );
}
