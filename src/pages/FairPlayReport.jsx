import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Flag, ShieldCheck } from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { engagementClient } from '@/api/engagementClient';

const SOURCE_TYPES = [
  { value: 'leaderboard', label: 'Leaderboard result' },
  { value: 'gym_battle', label: 'Gym battle' },
  { value: 'challenge', label: 'Challenge progress' },
  { value: 'profile', label: 'Member profile' },
];

const REASONS = [
  { value: 'impossible_activity', label: 'Impossible or unrealistic activity' },
  { value: 'fake_result', label: 'Fake or manipulated result' },
  { value: 'duplicate_account', label: 'Duplicate account abuse' },
  { value: 'harassment', label: 'Harassment or intimidation' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other fair-play concern' },
];

export default function FairPlayReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(location.search);
  const [form, setForm] = useState({
    source_type: SOURCE_TYPES.some((item) => item.value === params.get('source_type')) ? params.get('source_type') : 'leaderboard',
    source_id: params.get('source_id') || '',
    reported_user_id: params.get('user_id') || '',
    reason_code: 'impossible_activity',
    details: '',
  });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (sending || !form.reason_code) return;
    setSending(true);
    try {
      await engagementClient.submitReport({
        source_type: form.source_type,
        source_id: form.source_id.trim() || null,
        reported_user_id: form.reported_user_id.trim() || null,
        reason_code: form.reason_code,
        details: form.details.trim() || null,
      });
      setSubmitted(true);
      toast({ title: 'Fair-play report submitted', description: 'The SE7EN FIT review team can now investigate it.' });
    } catch (error) {
      toast({
        title: 'Report could not be submitted',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <>
        <TopBar title="Fair Play" showBack backTo="/leaderboard" />
        <main className="mx-auto max-w-lg px-4 py-10">
          <section className="rounded-[28px] border border-emerald-400/25 bg-emerald-400/[0.08] p-7 text-center">
            <CheckCircle2 size={42} className="mx-auto text-emerald-300" />
            <h1 className="mt-4 font-heading text-xl font-black">Report received</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your report is stored securely for administrative review. Reports do not automatically remove a member or result.
            </p>
            <Button onClick={() => navigate('/leaderboard')} className="mt-6 h-11 rounded-xl bg-accent text-accent-foreground">
              Return to leaderboard
            </Button>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Fair Play Report" showBack backTo="/leaderboard" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-card to-accent/[0.07] p-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/[0.06]" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">Competition integrity</p>
              <h1 className="mt-1 font-heading text-xl font-black">Report suspicious activity</h1>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Report only genuine concerns. SE7EN FIT reviews activity evidence, duplicate protection and reward history before taking action.
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={submit} className="space-y-4 rounded-[26px] border border-border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="fair-play-source">What are you reporting?</Label>
            <select
              id="fair-play-source"
              value={form.source_type}
              onChange={(event) => setForm((current) => ({ ...current, source_type: event.target.value }))}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {SOURCE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fair-play-reason">Reason</Label>
            <select
              id="fair-play-reason"
              value={form.reason_code}
              onChange={(event) => setForm((current) => ({ ...current, reason_code: event.target.value }))}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fair-play-user">Member ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="fair-play-user"
              value={form.reported_user_id}
              onChange={(event) => setForm((current) => ({ ...current, reported_user_id: event.target.value }))}
              placeholder="Paste the member ID shown by support"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fair-play-source-id">Result or battle ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="fair-play-source-id"
              value={form.source_id}
              onChange={(event) => setForm((current) => ({ ...current, source_id: event.target.value }))}
              placeholder="Challenge, battle or leaderboard reference"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fair-play-details">What happened?</Label>
            <textarea
              id="fair-play-details"
              value={form.details}
              onChange={(event) => setForm((current) => ({ ...current, details: event.target.value.slice(0, 1200) }))}
              placeholder="Describe what looked incorrect and when you noticed it."
              rows={5}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-right text-[10px] text-muted-foreground">{form.details.length}/1200</p>
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-[10px] leading-relaxed text-muted-foreground">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
            Deliberately false or abusive reports may be dismissed and can lead to account review.
          </div>

          <Button type="submit" disabled={sending} className="h-12 w-full rounded-xl bg-accent font-black text-accent-foreground">
            <Flag size={16} className="mr-2" /> {sending ? 'Submitting securely…' : 'Submit fair-play report'}
          </Button>
        </form>
      </main>
    </>
  );
}
