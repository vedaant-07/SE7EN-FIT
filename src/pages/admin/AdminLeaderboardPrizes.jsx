import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { engagementClient } from '@/api/engagementClient';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Award, Gift, Globe2, Plus, RefreshCw, ShieldCheck, Trophy } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const safeArray = (value) => Array.isArray(value) ? value : [];

function previousMonthKey() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function AdminLeaderboardPrizes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [form, setForm] = useState({ gym_id: '', rank: '1', title: '', description: '', coins: '0' });
  const [awardScope, setAwardScope] = useState({ gym_id: '', period_key: previousMonthKey() });
  const [saving, setSaving] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      if (!['admin', 'super_admin'].includes(user.role)) {
        window.location.href = '/';
        return;
      }
      const [gymRows, prizeRows] = await Promise.all([
        engagementClient.getAdminGyms(),
        base44.entities.LeaderboardPrize.list('-created_date', 300),
      ]);
      setGyms(safeArray(gymRows));
      setPrizes(safeArray(prizeRows));
    } catch (loadError) {
      console.error('[AdminLeaderboardPrizes] load failed:', loadError);
      setError(loadError.message || 'Leaderboard prizes could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const createPrize = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      await base44.entities.LeaderboardPrize.create({
        gym_id: form.gym_id || null,
        scope: form.gym_id ? 'gym' : 'global',
        rank: Number(form.rank),
        title: form.title.trim(),
        description: form.description.trim(),
        coins: Math.max(0, Math.min(100000, Number(form.coins || 0))),
        active: true,
        metadata: { cadence: 'monthly' },
      });
      setForm((previous) => ({ ...previous, rank: '1', title: '', description: '', coins: '0' }));
      toast({ title: 'Monthly leaderboard prize published' });
      await loadData({ background: true });
    } catch (saveError) {
      toast({ title: 'Could not save prize', description: saveError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (prize) => {
    try {
      await base44.entities.LeaderboardPrize.update(prize.id, { active: prize.active === false });
      await loadData({ background: true });
    } catch (updateError) {
      toast({ title: 'Could not update prize', description: updateError.message, variant: 'destructive' });
    }
  };

  const awardFinishedLeaderboard = async () => {
    if (awarding) return;
    setAwarding(true);
    try {
      const result = await engagementClient.awardLeaderboard({
        scope: awardScope.gym_id ? 'gym' : 'global',
        gym_id: awardScope.gym_id || null,
        period_key: awardScope.period_key,
      });
      toast({
        title: 'Leaderboard settlement completed',
        description: `${safeArray(result?.awarded).length} prize award${safeArray(result?.awarded).length === 1 ? '' : 's'} issued without duplicates.`,
      });
    } catch (awardError) {
      toast({ title: 'Could not award leaderboard', description: awardError.message, variant: 'destructive' });
    } finally {
      setAwarding(false);
    }
  };

  const gymName = (gymId) => {
    if (!gymId) return 'Whole app';
    const gym = gyms.find((item) => String(item.gym_id || item.id) === String(gymId));
    return gym?.name || gym?.gym_name || gym?.email || 'Gym';
  };

  const activePrizeCount = useMemo(() => prizes.filter((prize) => prize.active !== false).length, [prizes]);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Leaderboard Prizes" showBack backTo="/admin" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="rounded-[28px] border border-border bg-card p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/25 bg-yellow-400/10 text-yellow-300"><Trophy size={23} /></div>
            <div>
              <h1 className="font-heading text-lg font-black">Publish monthly prizes</h1>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Prizes are awarded only after a monthly cycle closes and its verified ranking snapshot is locked.</p>
            </div>
          </div>

          <form onSubmit={createPrize} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Leaderboard</Label>
              <select value={form.gym_id} onChange={(event) => setForm((previous) => ({ ...previous, gym_id: event.target.value }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                <option value="">Whole app leaderboard</option>
                {gyms.map((gym) => {
                  const id = gym.gym_id || gym.id;
                  return <option key={id} value={id}>{gym.name || gym.gym_name || gym.email || id}</option>;
                })}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Rank</Label>
                <select value={form.rank} onChange={(event) => setForm((previous) => ({ ...previous, rank: event.target.value }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                  <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1.5"><Label>Prize title</Label><Input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value.slice(0, 160) }))} placeholder="Monthly Champion" className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5"><Label>Reward details</Label><Input value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value.slice(0, 500) }))} placeholder="One free gym month, merchandise, voucher..." className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Bonus coins</Label><Input type="number" min="0" max="100000" value={form.coins} onChange={(event) => setForm((previous) => ({ ...previous, coins: event.target.value }))} placeholder="0" className="h-11 rounded-xl" /></div>

            <Button type="submit" disabled={saving || !form.title.trim() || !form.description.trim()} className="h-11 w-full rounded-xl bg-accent font-black text-accent-foreground">
              <Plus size={15} className="mr-1.5" /> {saving ? 'Publishing…' : 'Publish monthly prize'}
            </Button>
          </form>
        </section>

        <section className="rounded-[28px] border border-accent/25 bg-accent/[0.06] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Award size={20} /></div>
            <div><h2 className="font-heading text-base font-black">Settle a finished month</h2><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">The operation is atomic and idempotent. Running it again cannot duplicate a prize or coins.</p></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5"><Label>Leaderboard</Label><select value={awardScope.gym_id} onChange={(event) => setAwardScope((current) => ({ ...current, gym_id: event.target.value }))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs"><option value="">Whole app</option>{gyms.map((gym) => { const id = gym.gym_id || gym.id; return <option key={id} value={id}>{gym.name || gym.gym_name || gym.email || id}</option>; })}</select></div>
            <div className="space-y-1.5"><Label>Month</Label><Input type="month" value={awardScope.period_key} onChange={(event) => setAwardScope((current) => ({ ...current, period_key: event.target.value }))} className="h-11 rounded-xl" /></div>
          </div>
          <Button onClick={awardFinishedLeaderboard} disabled={awarding || !awardScope.period_key} className="mt-4 h-11 w-full rounded-xl bg-accent font-black text-accent-foreground"><ShieldCheck size={15} className="mr-2" /> {awarding ? 'Verifying and awarding…' : 'Verify rankings and issue prizes'}</Button>
        </section>

        {error && (
          <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button onClick={() => loadData()} variant="outline" size="sm" className="mt-3 h-9 rounded-xl"><RefreshCw size={14} className="mr-2" /> Try again</Button>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          <div><h2 className="font-heading text-base font-black">Published prizes</h2><p className="text-[10px] text-muted-foreground">{activePrizeCount} active • {prizes.length} total</p></div>
          <button type="button" onClick={() => loadData({ background: true })} disabled={refreshing} aria-label="Refresh prizes" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>

        <div className="space-y-2.5">
          {prizes.length === 0 ? (
            <div className="rounded-[24px] border border-border bg-card p-8 text-center"><Gift size={28} className="mx-auto text-muted-foreground" /><h3 className="mt-3 text-sm font-black">No prizes published</h3><p className="mt-1 text-xs text-muted-foreground">Add a top-three prize to make verified leaderboard goals meaningful.</p></div>
          ) : prizes.map((prize) => {
            const active = prize.active !== false;
            return (
              <div key={prize.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10 font-heading text-sm font-black text-yellow-300">#{prize.rank || 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><p className="truncate text-sm font-black">{prize.title}</p>{!prize.gym_id && <Globe2 size={12} className="shrink-0 text-accent" />}</div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{prize.description || prize.reward}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground">{gymName(prize.gym_id)} • monthly{Number(prize.coins || 0) ? ` • +${prize.coins} coins` : ''}</p>
                </div>
                <button type="button" onClick={() => toggleStatus(prize)} className={`rounded-xl px-2.5 py-1.5 text-[9px] font-black ${active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{active ? 'Active' : 'Inactive'}</button>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
