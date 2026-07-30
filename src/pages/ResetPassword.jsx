import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import AuthExperienceShell from '@/components/auth/AuthExperienceShell';
import { confirmPasswordReset } from '@/lib/authSessionSecurity';

function passwordError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password is too long';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Use an uppercase letter, a lowercase letter and a number';
  }
  return '';
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const validationError = passwordError(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset({ resetToken, newPassword });
      navigate('/login/user', { replace: true });
    } catch (requestError) {
      const message = typeof requestError?.message === 'string' ? requestError.message : '';
      setError(message && message !== '{}' ? message : 'Failed to reset password. Request a new link and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthExperienceShell
        onBack={() => navigate('/forgot-password')}
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is incomplete, expired or invalid."
        roleLabel="Account recovery"
        compact
        footer={<Link to="/forgot-password" className="font-semibold text-accent hover:underline">Request a new link</Link>}
      >
        <p className="py-4 text-center text-sm leading-relaxed text-muted-foreground">Return to password recovery and request a fresh secure link.</p>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell
      onBack={() => navigate('/login/user')}
      icon={Lock}
      title="Create a new password"
      subtitle="Use 8–128 characters with an uppercase letter, a lowercase letter and a number."
      roleLabel="Secure reset"
      footer={<Link to="/login/user" className="font-semibold text-accent hover:underline">Back to login</Link>}
    >
      {error && <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="new-password">New password</Label><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="new-password" type="password" autoComplete="new-password" autoFocus placeholder="8+ characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-12 rounded-2xl pl-10" minLength={8} maxLength={128} required /></div></div>
        <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><div className="relative"><Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="confirm-password" type="password" autoComplete="new-password" placeholder="Repeat password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 rounded-2xl pl-10" minLength={8} maxLength={128} required /></div></div>
        <Button type="submit" className="h-12 w-full rounded-2xl bg-accent font-black text-accent-foreground" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting password…</> : 'Save new password'}</Button>
      </form>
    </AuthExperienceShell>
  );
}
