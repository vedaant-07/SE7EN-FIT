import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Building2,
  ChevronRight,
  Crown,
  Flag,
  Gift,
  Globe2,
  MapPin,
  Medal,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { engagementClient } from '@/api/engagementClient';

const SCOPES = [
  { key: 'gym', label: 'Gym', icon: Building2 },
  { key: 'city', label: 'City', icon: MapPin },
  { key: 'global', label: 'Whole app', icon: Globe2 },
];

function rankClasses(rank) {
  if (rank === 1) return 'border-yellow-400/30 bg-yellow-400/12 text-yellow-300';
  if (rank === 2) return 'border-zinc-300/25 bg-zinc-300/10 text-zinc-200';
  if (rank === 3) return 'border-orange-400/25 bg-orange-400/10 text-orange-300';
  return 'border-border bg-background/60 text-muted-foreground';
}

function initials(name = '') {
  if (name === 'You') return 'YOU';
  const parts = String(name || 'Member').trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || 'M'}${parts[1]?.[0] || ''}`.toUpperCase();
}

function PrizeCard({ prize }) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${rankClasses(prize.rank)}`}>
      <Crown size={18} className="mx-auto" />
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide opacity-75">Rank {prize.rank}</p>
      <p className="mt-1 line-clamp-1 text-xs font-black text-foreground">{prize.title}</p>
      <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-muted-foreground">{prize.reward || 'Recognition award'}</p>
      {Number(prize.coins || 0) > 0 && <p className="mt-1 text-[10px] font-bold text-yellow-300">+{prize.coins} coins</p>}
    </div>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [scope, setScope] = useState('global');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dataByScope, setDataByScope] = useState({});

  const loadScope = async (nextScope, { background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await engagementClient.getLeaderboard(nextScope);
      setDataByScope((previous) => ({ ...previous, [nextScope]: result }));
    } catch (loadError) {
      console.error('[Leaderboard] load failed:', loadError);
      setError(loadError.message || 'Leaderboard could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!dataByScope[scope]) loadScope(scope);
  }, [scope, dataByScope]);

  const data = dataByScope[scope] || null;
  const entries = useMemo(() => (data?.entries || []).filter((entry) => Number(entry.rank || 0) > 0), [data]);
  const currentUser = entries.find((entry) => entry.is_current_user);
  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);
  const prizes = data?.prizes || [];
  const awardHistory = data?.award_history || [];

  if (loading && !data) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Leaderboard" showBack backTo="/challenges" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="relative overflow-hidden rounded-[30px] border border-border bg-gradient-to-br from-yellow-400/[0.14] via-card to-card p-5">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-yellow-400/[0.06]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-yellow-300"><Sparkles size={14} /><span className="text-[10px] font-black uppercase tracking-[0.16em]">Verified monthly competition</span></div>
              <h1 className="mt-2 font-heading text-2xl font-black">Rise through every league</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Rankings use server-issued rewards from completed challenges, settled gym battles and official prizes.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-yellow-400 text-black shadow-[0_14px_35px_rgba(250,204,21,0.18)]"><Trophy size={26} /></div>
          </div>
          <div className="relative mt-4 flex items-center gap-2 rounded-2xl bg-background/60 px-3 py-2.5 text-[11px] text-muted-foreground">
            <ShieldCheck size={14} className="shrink-0 text-accent" /> Manual scores, duplicate rewards and activity under review do not count.
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1.5">
          {SCOPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-bold transition-all ${scope === key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {error && !data ? (
          <section className="rounded-[24px] border border-destructive/25 bg-destructive/10 p-6 text-center">
            <Trophy size={30} className="mx-auto text-muted-foreground" />
            <h2 className="mt-3 font-heading text-base font-black">Leaderboard unavailable</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{error}</p>
            <Button onClick={() => loadScope(scope)} className="mt-4 h-10 rounded-xl"><RefreshCw size={14} className="mr-2" /> Try again</Button>
          </section>
        ) : data?.unavailable_reason ? (
          <section className="rounded-[24px] border border-border bg-card p-6 text-center">
            {scope === 'gym' ? <Building2 size={32} className="mx-auto text-muted-foreground" /> : <MapPin size={32} className="mx-auto text-muted-foreground" />}
            <h2 className="mt-3 font-heading text-base font-black">Unlock the {scope} leaderboard</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.unavailable_reason}</p>
            <Button onClick={() => navigate('/my-gym')} className="mt-5 h-11 rounded-xl bg-accent text-accent-foreground">Open My Gym</Button>
          </section>
        ) : (
          <>
            <section className="rounded-[24px] border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-accent">{data?.period_label || data?.period_key || 'Current month'}</p>
                  <h2 className="mt-1 font-heading text-lg font-black">{data?.scope_label || 'Leaderboard'}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{entries.length} verified ranked members shown</p>
                </div>
                <button type="button" onClick={() => loadScope(scope, { background: true })} disabled={refreshing} aria-label="Refresh leaderboard" className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              {data?.user_integrity_status === 'review' ? (
                <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-3 text-xs leading-relaxed text-amber-200">
                  Your competitive score is under fairness review and is temporarily unranked.
                </div>
              ) : data?.user_rank ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.08] p-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-sm font-black text-accent-foreground">#{data.user_rank}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-muted-foreground">Your verified rank</p>
                    <p className="mt-0.5 font-heading text-base font-black">{currentUser?.score || 0} points</p>
                  </div>
                  <ChevronRight size={17} className="text-accent" />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-background/60 p-3 text-xs text-muted-foreground">Earn a verified challenge or battle reward to enter this month’s rankings.</div>
              )}
            </section>

            {prizes.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between px-1">
                  <div><h2 className="font-heading text-sm font-black">Official prizes</h2><p className="text-[10px] text-muted-foreground">Awarded after the leaderboard period is locked</p></div>
                  <Gift size={17} className="text-yellow-300" />
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {prizes.slice(0, 3).map((prize) => <PrizeCard key={prize.id || `${prize.rank}-${prize.title}`} prize={prize} />)}
                </div>
              </section>
            )}

            {topThree.length > 0 && (
              <section className="rounded-[24px] border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between"><h2 className="font-heading text-sm font-black">Podium</h2><Medal size={17} className="text-yellow-300" /></div>
                <div className="grid grid-cols-3 items-end gap-2">
                  {[topThree[1], topThree[0], topThree[2]].filter(Boolean).map((member) => (
                    <div key={member.user_id} className={`rounded-2xl border p-3 text-center ${rankClasses(member.rank)} ${member.rank === 1 ? 'pb-5 pt-4' : ''}`}>
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-background/70 text-xs font-black">{initials(member.name)}</div>
                      <p className="mt-2 truncate text-[10px] font-black text-foreground">{member.name}</p>
                      <p className="mt-0.5 font-heading text-lg font-black">{member.score}</p>
                      <p className="text-[8px] text-muted-foreground">verified points</p>
                      <span className="mt-2 inline-flex rounded-full border border-current/20 px-2 py-0.5 text-[9px] font-black">#{member.rank}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1"><h2 className="font-heading text-sm font-black">Rankings</h2><span className="text-[10px] text-muted-foreground">Verified score</span></div>
              {entries.length === 0 ? (
                <div className="rounded-[24px] border border-border bg-card p-8 text-center">
                  <Users size={30} className="mx-auto text-muted-foreground" />
                  <h3 className="mt-3 font-heading text-sm font-black">No verified rankings yet</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Complete a trusted challenge or gym battle to claim the opening position.</p>
                  <Button onClick={() => navigate('/challenges')} className="mt-4 h-10 rounded-xl">Browse challenges</Button>
                </div>
              ) : remaining.map((member) => (
                <div key={member.user_id} className={`flex items-center gap-3 rounded-2xl border p-3 ${member.is_current_user ? 'border-accent/35 bg-accent/[0.07]' : 'border-border bg-card'}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${rankClasses(member.rank)}`}>#{member.rank}</div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-[10px] font-black"><UserRound size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{member.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{member.completed_challenges} completed challenges</p>
                  </div>
                  <div className="text-right"><p className="font-heading text-base font-black">{member.score}</p><p className="text-[9px] text-muted-foreground">points</p></div>
                </div>
              ))}
            </section>

            {awardHistory.length > 0 && (
              <section className="rounded-[24px] border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2"><Award size={17} className="text-yellow-300" /><h2 className="font-heading text-sm font-black">Your award history</h2></div>
                <div className="space-y-2">
                  {awardHistory.slice(0, 5).map((award) => (
                    <div key={award.id} className="flex items-center gap-3 rounded-2xl bg-background/60 p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-300"><Crown size={15} /></div>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{award.title}</p><p className="text-[9px] text-muted-foreground">Rank {award.rank} • {award.status}</p></div>
                      {Number(award.coins || 0) > 0 && <span className="text-xs font-black text-yellow-300">+{award.coins}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => navigate('/challenges')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 text-xs font-bold">
            Earn points <ChevronRight size={15} />
          </button>
          <button type="button" onClick={() => navigate('/fair-play?source_type=leaderboard')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 text-xs font-bold text-muted-foreground">
            <Flag size={14} /> Report concern
          </button>
        </div>
      </main>
    </>
  );
}
