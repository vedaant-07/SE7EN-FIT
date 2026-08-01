import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock3,
  Dumbbell,
  Flag,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { gymBattleClient } from '@/api/gymBattleClient';

const safeArray = (value) => Array.isArray(value) ? value : [];

function remaining(endAt) {
  if (!endAt) return 'Waiting to start';
  const milliseconds = new Date(endAt).getTime() - Date.now();
  if (milliseconds <= 0) return 'Final verification in progress';
  const hours = Math.ceil(milliseconds / 3_600_000);
  return hours < 24 ? `${hours}h left` : `${Math.ceil(hours / 24)}d left`;
}

function outcomeText(battle) {
  if (battle.under_review) return 'Activity review required before settlement';
  if (battle.status === 'cancelled') return 'Invitation declined or cancelled';
  if (battle.status === 'expired') return 'Expired without enough verified activity';
  if (battle.status !== 'completed') return remaining(battle.ends_at);
  const winner = safeArray(battle.members).find((member) => member.is_winner);
  if (winner) return `${winner.is_current_user ? 'You won' : `${winner.name} won`} with verified activity`;
  return 'Battle completed as a verified tie';
}

function BattleMember({ member, unit, target }) {
  return (
    <div className={`rounded-2xl border p-3 ${member.is_current_user ? 'border-accent/30 bg-accent/[0.07]' : 'border-border bg-background/55'}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-black">
          {member.is_winner ? <Trophy size={16} className="text-yellow-300" /> : <UserRound size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black">{member.is_current_user ? 'You' : member.name}</p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {member.invite_status === 'pending' ? 'Invite pending' : `${Number(member.progress || 0).toLocaleString()} ${unit}`}
          </p>
        </div>
        <p className="font-heading text-sm font-black">{Number(member.progress_percent || 0)}%</p>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-card">
        <div className={`h-full rounded-full transition-all duration-700 ${member.is_winner ? 'bg-yellow-300' : 'bg-accent'}`} style={{ width: `${Math.min(100, Number(member.progress_percent || 0))}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[8px] text-muted-foreground">
        <span>Target {Number(target || 0).toLocaleString()} {unit}</span>
        {Number(member.reward_coins || 0) > 0 && <span className="font-black text-yellow-300">+{member.reward_coins} coins</span>}
      </div>
    </div>
  );
}

function BattleCard({ battle, refreshing, onRefresh, onReport }) {
  const active = battle.status === 'active';
  const settled = ['completed', 'expired'].includes(battle.status);
  const totalReward = safeArray(battle.members).reduce((sum, member) => sum + Number(member.reward_coins || 0), 0);

  return (
    <section className={`overflow-hidden rounded-[26px] border bg-card ${battle.under_review ? 'border-amber-400/30' : 'border-border'}`}>
      <div className="relative p-4">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent/[0.05]" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/70 text-2xl">{battle.emoji || '⚔️'}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-accent/20 bg-accent/[0.08] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-accent">{battle.metric_label}</span>
              <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] font-bold text-muted-foreground">{battle.duration_days} days</span>
              {battle.under_review && <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">Under review</span>}
            </div>
            <h3 className="mt-2 font-heading text-base font-black">{battle.title}</h3>
            <p className="mt-1 text-[10px] text-muted-foreground">{outcomeText(battle)}</p>
          </div>
          {active && !battle.under_review && (
            <button type="button" onClick={() => onRefresh(battle)} disabled={refreshing} aria-label="Refresh verified progress" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2.5">
          {safeArray(battle.members).map((member) => <BattleMember key={member.user_id} member={member} unit={battle.unit} target={battle.target} />)}
        </div>

        {battle.under_review && (
          <div className="relative mt-3 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2.5 text-[10px] leading-relaxed text-amber-100">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" /> Rewards are paused while implausible or unsupported activity is reviewed.
          </div>
        )}

        {settled && !battle.under_review && (
          <div className={`relative mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-[10px] font-semibold ${totalReward > 0 ? 'border-yellow-400/20 bg-yellow-400/10 text-yellow-200' : 'border-border bg-background/60 text-muted-foreground'}`}>
            {totalReward > 0 ? <Trophy size={13} /> : <Clock3 size={13} />}
            {totalReward > 0 ? `${totalReward} total reward coins issued atomically.` : 'No reward was issued because minimum verified participation was not reached.'}
          </div>
        )}

        {!battle.is_creator && battle.status !== 'pending' && (
          <button type="button" onClick={() => onReport(battle)} className="relative mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <Flag size={12} /> Report this battle
          </button>
        )}
      </div>
    </section>
  );
}

export default function GymBattles() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ metric: 'steps', opponent_user_id: '', duration_days: 7, target_value: 50000, title: '' });

  const loadData = async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setError('');
    try {
      setOverview(await gymBattleClient.getOverview());
    } catch (loadError) {
      console.error('[GymBattles] load failed:', loadError);
      setError(loadError.message || 'Gym battles could not be loaded.');
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const templates = safeArray(overview?.templates);
  const members = safeArray(overview?.members);
  const selectedTemplate = useMemo(() => templates.find((template) => template.key === form.metric) || templates[0], [form.metric, templates]);

  const chooseTemplate = (metric) => {
    const template = templates.find((item) => item.key === metric);
    setForm((current) => ({ ...current, metric, title: template?.label || '', target_value: template?.target || 1, duration_days: template?.duration || 7 }));
  };

  const createBattle = async (event) => {
    event.preventDefault();
    if (!form.opponent_user_id || !form.metric || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await gymBattleClient.createBattle({
        ...form,
        duration_days: Number(form.duration_days),
        target_value: Number(form.target_value),
        title: form.title.trim() || selectedTemplate?.label,
      });
      setOverview(next);
      setShowCreate(false);
      setForm({ metric: 'steps', opponent_user_id: '', duration_days: 7, target_value: 50000, title: '' });
      toast({ title: 'Challenge sent ⚔️', description: 'The battle starts only after the member accepts.' });
    } catch (createError) {
      setError(createError.message || 'Could not create the gym battle.');
    } finally {
      setSaving(false);
    }
  };

  const respond = async (battle, response) => {
    setRefreshingId(battle.id);
    try {
      setOverview(await gymBattleClient.respond(battle.id, response));
      toast({
        title: response === 'accepted' ? 'Battle accepted 🔥' : 'Challenge declined',
        description: response === 'accepted' ? `${battle.duration_days}-day verified competition has started.` : 'The invitation was closed.',
      });
    } catch (responseError) {
      toast({ title: 'Could not update invitation', description: responseError.message, variant: 'destructive' });
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshBattle = async (battle) => {
    setRefreshingId(battle.id);
    try {
      setOverview(await gymBattleClient.refresh(battle.id));
    } catch (refreshError) {
      toast({ title: 'Progress refresh failed', description: refreshError.message, variant: 'destructive' });
    } finally {
      setRefreshingId(null);
    }
  };

  const reportBattle = (battle) => navigate(`/fair-play?source_type=gym_battle&source_id=${encodeURIComponent(battle.id)}`);

  if (loading) return <LoadingScreen />;

  if (error && !overview) {
    return (
      <>
        <TopBar title="Gym Battles" showBack backTo="/challenges" />
        <main className="mx-auto max-w-lg px-4 py-10 text-center">
          <Swords size={36} className="mx-auto text-muted-foreground" />
          <h2 className="mt-3 font-heading text-lg font-black">Battles are temporarily unavailable</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <Button onClick={() => loadData()} className="mt-5 h-11 rounded-xl"><RefreshCw size={15} className="mr-2" /> Try again</Button>
        </main>
      </>
    );
  }

  if (!overview?.connected) {
    return (
      <>
        <TopBar title="Gym Battles" showBack backTo="/challenges" />
        <main className="mx-auto max-w-lg space-y-4 px-4 pt-8">
          <section className="rounded-[30px] border border-border bg-card p-7 text-center">
            <Dumbbell size={38} className="mx-auto text-accent" />
            <h1 className="mt-4 font-heading text-xl font-black">Connect your gym first</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Gym battles only match verified active members from the same gym.</p>
            <Button onClick={() => navigate('/my-gym')} className="mt-5 h-11 rounded-xl bg-accent text-accent-foreground">Open My Gym <ArrowRight size={15} className="ml-2" /></Button>
          </section>
        </main>
      </>
    );
  }

  const active = safeArray(overview.active);
  const incoming = safeArray(overview.incoming);
  const sent = safeArray(overview.sent);
  const completed = safeArray(overview.completed);

  return (
    <>
      <TopBar title="Gym Battles" showBack backTo="/challenges" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="relative overflow-hidden rounded-[30px] border border-accent/25 bg-gradient-to-br from-accent/[0.14] via-card to-card p-5">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border border-accent/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-accent"><Sparkles size={14} /><span className="text-[10px] font-black uppercase tracking-[0.16em]">Verified member vs member</span></div>
              <h1 className="mt-2 font-heading text-2xl font-black">Challenge your gym crew</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Manual scores and self-created gym visits are excluded. No-show battles receive no reward.</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-accent text-accent-foreground"><Swords size={25} /></div>
          </div>
          <div className="relative mt-4 flex items-start gap-2 rounded-2xl bg-background/60 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" /> {overview.fairness || 'Only verified activity records count toward battle progress.'}
          </div>
          <Button onClick={() => setShowCreate((value) => !value)} className="relative mt-4 h-11 w-full rounded-2xl bg-accent font-black text-accent-foreground">
            {showCreate ? <><X size={16} className="mr-2" /> Close creator</> : <><Zap size={16} className="mr-2" /> Start a gym battle</>}
          </Button>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

        {showCreate && (
          <form onSubmit={createBattle} className="space-y-4 rounded-[26px] border border-border bg-card p-4">
            <div><p className="font-heading text-base font-black">Create battle</p><p className="mt-1 text-[10px] text-muted-foreground">Maximum five pending invitations per day and three battles with the same member per month.</p></div>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template) => (
                <button key={template.key} type="button" onClick={() => chooseTemplate(template.key)} className={`rounded-2xl border p-3 text-left transition-all ${form.metric === template.key ? 'border-accent/40 bg-accent/[0.09]' : 'border-border bg-background/55'}`}>
                  <span className="text-xl">{template.emoji}</span><p className="mt-1.5 text-xs font-black">{template.label}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{Number(template.target).toLocaleString()} {template.unit}</p>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="battle-opponent">Opponent</Label>
              <select id="battle-opponent" value={form.opponent_user_id} onChange={(event) => setForm((current) => ({ ...current, opponent_user_id: event.target.value }))} className="h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm">
                <option value="">Choose a gym member</option>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="battle-duration">Duration</Label><select id="battle-duration" value={form.duration_days} onChange={(event) => setForm((current) => ({ ...current, duration_days: Number(event.target.value) }))} className="h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm"><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option></select></div>
              <div className="space-y-2"><Label htmlFor="battle-target">Target</Label><Input id="battle-target" type="number" min="1" value={form.target_value} onChange={(event) => setForm((current) => ({ ...current, target_value: event.target.value }))} className="h-12 rounded-2xl" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="battle-title">Title</Label><Input id="battle-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value.slice(0, 80) }))} placeholder={selectedTemplate?.label || 'Battle title'} className="h-12 rounded-2xl" /></div>
            <Button type="submit" disabled={saving || !form.opponent_user_id} className="h-12 w-full rounded-2xl bg-accent font-black text-accent-foreground">{saving ? 'Sending…' : 'Send battle invitation'}</Button>
          </form>
        )}

        {incoming.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1"><h2 className="font-heading text-sm font-black">Invitations</h2><span className="text-[10px] text-muted-foreground">Your response starts or closes the battle</span></div>
            {incoming.map((battle) => (
              <div key={battle.id} className="rounded-[24px] border border-accent/25 bg-accent/[0.06] p-4">
                <div className="flex items-start gap-3"><span className="text-2xl">{battle.emoji}</span><div className="min-w-0 flex-1"><p className="font-heading text-sm font-black">{battle.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{battle.duration_days} days • Target {Number(battle.target).toLocaleString()} {battle.unit}</p></div></div>
                <div className="mt-4 grid grid-cols-2 gap-2"><Button onClick={() => respond(battle, 'declined')} disabled={refreshingId === battle.id} variant="outline" className="h-11 rounded-xl"><X size={14} className="mr-2" /> Decline</Button><Button onClick={() => respond(battle, 'accepted')} disabled={refreshingId === battle.id} className="h-11 rounded-xl bg-accent text-accent-foreground"><Check size={14} className="mr-2" /> Accept</Button></div>
              </div>
            ))}
          </section>
        )}

        {active.length > 0 && <section className="space-y-2.5"><div className="flex items-center justify-between px-1"><h2 className="font-heading text-sm font-black">Live battles</h2><span className="text-[10px] text-muted-foreground">Verified progress</span></div>{active.map((battle) => <BattleCard key={battle.id} battle={battle} refreshing={refreshingId === battle.id} onRefresh={refreshBattle} onReport={reportBattle} />)}</section>}
        {sent.length > 0 && <section className="space-y-2.5"><div className="flex items-center justify-between px-1"><h2 className="font-heading text-sm font-black">Sent invitations</h2><span className="text-[10px] text-muted-foreground">Waiting for response</span></div>{sent.map((battle) => <BattleCard key={battle.id} battle={battle} refreshing={false} onRefresh={refreshBattle} onReport={reportBattle} />)}</section>}
        {completed.length > 0 && <section className="space-y-2.5"><div className="flex items-center justify-between px-1"><h2 className="font-heading text-sm font-black">Battle history</h2><span className="text-[10px] text-muted-foreground">Settled outcomes</span></div>{completed.map((battle) => <BattleCard key={battle.id} battle={battle} refreshing={false} onRefresh={refreshBattle} onReport={reportBattle} />)}</section>}

        {!incoming.length && !active.length && !sent.length && !completed.length && (
          <section className="rounded-[24px] border border-border bg-card p-7 text-center">
            <Users size={32} className="mx-auto text-muted-foreground" />
            <h2 className="mt-3 font-heading text-base font-black">No gym battles yet</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Create a friendly competition with an active member of {overview.gym?.name}.</p>
            <Button onClick={() => setShowCreate(true)} className="mt-5 h-11 rounded-xl bg-accent text-accent-foreground"><Swords size={15} className="mr-2" /> Create first battle</Button>
          </section>
        )}
      </main>
    </>
  );
}
