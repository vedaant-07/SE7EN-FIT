import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Gift,
  Lock,
  Medal,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { engagementClient } from '@/api/engagementClient';

const FILTERS = [
  { key: 'discover', label: 'Discover' },
  { key: 'mine', label: 'My challenges' },
  { key: 'completed', label: 'Completed' },
];

function difficultyClasses(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'easy') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (key === 'medium') return 'border-amber-400/25 bg-amber-400/10 text-amber-300';
  if (key === 'hard') return 'border-orange-400/25 bg-orange-400/10 text-orange-300';
  return 'border-rose-400/25 bg-rose-400/10 text-rose-300';
}

function scopeLabel(challenge) {
  if (challenge.scope === 'gym') return 'Gym challenge';
  if (challenge.scope === 'city') return 'City challenge';
  return 'SE7EN FIT challenge';
}

function ChallengeCard({ challenge, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(challenge)}
      className={`relative w-full overflow-hidden rounded-[24px] border p-4 text-left transition-all active:scale-[0.99] ${
        challenge.joined ? 'border-accent/35 bg-gradient-to-br from-accent/[0.08] to-card' : 'border-border bg-card'
      }`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/[0.04]" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/70 text-2xl shadow-inner">
          {challenge.emoji || '🏆'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${difficultyClasses(challenge.difficulty)}`}>
              {challenge.difficulty || 'Medium'}
            </span>
            <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
              {scopeLabel(challenge)}
            </span>
            {challenge.premium && (
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold text-yellow-300">
                <Crown size={9} /> Premium
              </span>
            )}
          </div>
          <h3 className="font-heading text-[15px] font-black leading-tight text-foreground">{challenge.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{challenge.description}</p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-muted-foreground" />
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock3 size={11} /> {challenge.days} verified days</span>
        <span className="inline-flex items-center gap-1"><Users size={11} /> {Number(challenge.participants || 0).toLocaleString()} joined</span>
        <span className="inline-flex items-center gap-1 font-bold text-yellow-300"><Gift size={11} /> {challenge.coins} coins</span>
      </div>

      {challenge.joined && (
        <div className="relative mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold">
            <span className={challenge.completed ? 'text-emerald-300' : 'text-foreground'}>
              {challenge.completed ? 'Completed' : `${challenge.progress} of ${challenge.target} days`}
            </span>
            <span className="text-muted-foreground">{challenge.progress_percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background/80">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${challenge.progress_percent}%` }} />
          </div>
        </div>
      )}

      {challenge.locked && (
        <div className="relative mt-3 flex items-center gap-2 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.07] px-3 py-2 text-[10px] text-yellow-200">
          <Lock size={12} /> Premium unlocks this challenge and doubles challenge-completion coins.
        </div>
      )}
    </button>
  );
}

export default function Challenges() {
  const navigate = useNavigate();
  const { challengeId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [filter, setFilter] = useState('discover');
  const [joiningId, setJoiningId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);

  const loadData = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await engagementClient.getOverview();
      setOverview(data || null);
    } catch (loadError) {
      console.error('[Challenges] load failed:', loadError);
      setError(loadError.message || 'Challenges could not be loaded. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const challenges = overview?.challenges || [];
  const selected = challenges.find((item) => String(item.id) === String(challengeId));
  const filtered = useMemo(() => {
    if (filter === 'mine') return challenges.filter((item) => item.joined && !item.completed);
    if (filter === 'completed') return challenges.filter((item) => item.completed);
    return challenges;
  }, [challenges, filter]);

  const openChallenge = (challenge) => navigate(`/challenges/${challenge.id}`);

  const joinChallenge = async (challenge) => {
    if (challenge.locked) {
      navigate('/subscription');
      return;
    }
    setJoiningId(challenge.id);
    try {
      await engagementClient.joinChallenge(challenge.id);
      toast({ title: 'Challenge joined', description: `${challenge.title} is now in your daily plan.` });
      await loadData({ background: true });
    } catch (joinError) {
      if (joinError.status === 402) {
        navigate('/subscription');
      } else {
        toast({ title: 'Could not join challenge', description: joinError.message, variant: 'destructive' });
      }
    } finally {
      setJoiningId(null);
    }
  };

  const checkIn = async (challenge) => {
    setCheckingId(challenge.id);
    try {
      const result = await engagementClient.checkInChallenge(challenge.id);
      if (result?.already_logged) {
        toast({ title: 'Already checked in today', description: 'Come back after your next verified day.' });
      } else if (result?.completed) {
        toast({ title: 'Challenge completed 🏆', description: `You earned ${result.reward_coins || challenge.coins} coins.` });
      } else {
        toast({ title: 'Verified check-in added', description: `${result.progress} of ${result.target} days complete.` });
      }
      await loadData({ background: true });
    } catch (checkError) {
      toast({
        title: checkError.status === 422 ? 'Complete today’s target first' : 'Check-in failed',
        description: checkError.message,
        variant: checkError.status === 422 ? 'default' : 'destructive',
      });
    } finally {
      setCheckingId(null);
    }
  };

  const shareChallenge = async (challenge) => {
    const text = challenge.completed
      ? `I completed ${challenge.title} on SE7EN FIT — ${challenge.progress}/${challenge.target} verified days.`
      : `I am taking on ${challenge.title} in SE7EN FIT — ${challenge.progress}/${challenge.target} days complete.`;
    try {
      if (navigator.share) await navigator.share({ title: 'SE7EN FIT Challenge', text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Progress copied', description: 'Share it anywhere you like.' });
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') toast({ title: 'Could not share progress', variant: 'destructive' });
    }
  };

  if (loading) return <LoadingScreen />;

  if (error && !overview) {
    return (
      <>
        <TopBar title="Challenges" showBack backTo="/" />
        <main className="mx-auto max-w-lg px-4 py-10 text-center">
          <Trophy size={36} className="mx-auto text-muted-foreground" />
          <h2 className="mt-3 font-heading text-lg font-black">Challenges are temporarily unavailable</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <Button onClick={() => loadData()} className="mt-5 h-11 rounded-xl bg-accent text-accent-foreground">
            <RefreshCw size={15} className="mr-2" /> Try again
          </Button>
        </main>
      </>
    );
  }

  if (challengeId) {
    if (!selected) {
      return (
        <>
          <TopBar title="Challenge" showBack backTo="/challenges" />
          <main className="mx-auto max-w-lg px-4 py-10 text-center">
            <Trophy size={36} className="mx-auto text-muted-foreground" />
            <h2 className="mt-3 font-heading text-lg font-black">Challenge not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">It may have ended or may not be available for your gym or city.</p>
            <Button onClick={() => navigate('/challenges')} className="mt-5 h-11 rounded-xl">Browse challenges</Button>
          </main>
        </>
      );
    }

    const loggedToday = selected.last_checkin === overview?.date;
    return (
      <>
        <TopBar title="Challenge" showBack backTo="/challenges" />
        <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
          <button type="button" onClick={() => navigate('/challenges')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ArrowLeft size={14} /> All challenges
          </button>

          <section className="relative overflow-hidden rounded-[30px] border border-border bg-gradient-to-br from-card via-card to-accent/[0.08] p-5">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/[0.06]" />
            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-border bg-background/70 text-3xl">
                  {selected.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${difficultyClasses(selected.difficulty)}`}>{selected.difficulty}</span>
                    {selected.premium && <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2 py-0.5 text-[9px] font-bold text-yellow-300">Premium</span>}
                  </div>
                  <h1 className="mt-2 font-heading text-2xl font-black leading-tight">{selected.title}</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-background/65 p-3 text-center">
                  <Target size={15} className="mx-auto text-accent" />
                  <p className="mt-1 font-heading text-base font-black">{selected.target}</p>
                  <p className="text-[9px] text-muted-foreground">Verified days</p>
                </div>
                <div className="rounded-2xl bg-background/65 p-3 text-center">
                  <Gift size={15} className="mx-auto text-yellow-300" />
                  <p className="mt-1 font-heading text-base font-black">{selected.coins}</p>
                  <p className="text-[9px] text-muted-foreground">Base coins</p>
                </div>
                <div className="rounded-2xl bg-background/65 p-3 text-center">
                  <Users size={15} className="mx-auto text-blue-300" />
                  <p className="mt-1 font-heading text-base font-black">{Number(selected.participants || 0).toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">Members</p>
                </div>
              </div>
            </div>
          </section>

          {selected.joined && (
            <section className="rounded-[24px] border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Your progress</p>
                  <p className="mt-1 font-heading text-2xl font-black">{selected.progress} <span className="text-sm font-semibold text-muted-foreground">/ {selected.target} days</span></p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${selected.completed ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-accent/30 bg-accent/10 text-accent'}`}>
                  {selected.completed ? <Check size={22} /> : <span className="font-heading text-sm font-black">{selected.progress_percent}%</span>}
                </div>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${selected.progress_percent}%` }} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck size={13} className="text-accent" /> Check-ins only count after SE7EN FIT verifies today’s logged activity.
              </div>
            </section>
          )}

          {selected.locked ? (
            <section className="rounded-[24px] border border-yellow-400/25 bg-gradient-to-br from-yellow-400/10 to-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/15 text-yellow-300"><Crown size={20} /></div>
                <div>
                  <h2 className="font-heading text-base font-black">Premium challenge</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Premium includes this challenge and a clearly disclosed 2× coin multiplier on completed challenges.</p>
                </div>
              </div>
              <Button onClick={() => navigate('/subscription')} className="mt-4 h-11 w-full rounded-xl bg-yellow-400 font-black text-black hover:bg-yellow-300">View subscription plans</Button>
            </section>
          ) : !selected.joined ? (
            <Button onClick={() => joinChallenge(selected)} disabled={joiningId === selected.id} className="h-12 w-full rounded-2xl bg-accent text-sm font-black text-accent-foreground">
              {joiningId === selected.id ? 'Joining…' : <>Join challenge <ChevronRight size={16} className="ml-1" /></>}
            </Button>
          ) : selected.completed ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-sm font-black text-emerald-300"><Check size={16} /> Completed</div>
              <button type="button" onClick={() => shareChallenge(selected)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-bold"><Share2 size={16} /> Share</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <Button onClick={() => checkIn(selected)} disabled={checkingId === selected.id || loggedToday} className="h-12 w-full rounded-2xl bg-accent text-sm font-black text-accent-foreground disabled:opacity-60">
                {checkingId === selected.id ? 'Verifying today…' : loggedToday ? <><Check size={16} className="mr-2" /> Checked in today</> : <><Zap size={16} className="mr-2" /> Verify today’s progress</>}
              </Button>
              <button type="button" onClick={() => navigate(selected.action_path || '/tracking')} className="h-11 w-full rounded-2xl border border-border bg-card text-sm font-bold text-foreground">
                Open today’s activity <ChevronRight size={15} className="ml-1 inline" />
              </button>
            </div>
          )}
        </main>
      </>
    );
  }

  const stats = overview?.stats || {};
  const spotlight = overview?.spotlight || [];
  const activeChallenge = challenges.find((item) => item.joined && !item.completed && item.last_checkin !== overview?.date);

  return (
    <>
      <TopBar title="Challenges" showBack backTo="/" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="relative overflow-hidden rounded-[30px] border border-border bg-gradient-to-br from-accent/[0.16] via-card to-card p-5">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/[0.08]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-accent"><Sparkles size={15} /><span className="text-[10px] font-black uppercase tracking-[0.16em]">Verified progress</span></div>
              <h1 className="mt-2 font-heading text-2xl font-black">Turn daily effort into wins</h1>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Complete real activity targets, earn coins, move up gym, city and whole-app leaderboards.</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-accent text-accent-foreground shadow-[0_14px_35px_rgba(34,197,94,0.2)]"><Trophy size={25} /></div>
          </div>

          <div className="relative mt-5 grid grid-cols-4 gap-2">
            {[
              { label: 'Active', value: stats.active || 0, icon: Target },
              { label: 'Done', value: stats.completed || 0, icon: Medal },
              { label: 'Streak', value: `${stats.streak || 0}d`, icon: Flame },
              { label: 'Coins', value: overview?.wallet?.coins_balance || 0, icon: Gift },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl bg-background/60 px-1.5 py-3 text-center backdrop-blur">
                <Icon size={13} className="mx-auto text-accent" />
                <p className="mt-1 font-heading text-sm font-black">{value}</p>
                <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {activeChallenge && (
          <button type="button" onClick={() => openChallenge(activeChallenge)} className="flex w-full items-center gap-3 rounded-[24px] border border-accent/30 bg-accent/[0.08] p-4 text-left active:scale-[0.99]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-2xl">{activeChallenge.emoji}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-accent">Today’s next win</p>
              <p className="mt-0.5 truncate font-heading text-sm font-black">{activeChallenge.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Verify today to reach {activeChallenge.progress + 1}/{activeChallenge.target} days.</p>
            </div>
            <ChevronRight size={18} className="text-accent" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => navigate('/leaderboard')} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-300"><Medal size={18} /></div>
            <div><p className="text-sm font-black">Leaderboards</p><p className="text-[10px] text-muted-foreground">Gym • City • App</p></div>
          </button>
          <button type="button" onClick={() => navigate('/rewards')} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/10 text-purple-300"><Gift size={18} /></div>
            <div><p className="text-sm font-black">Rewards</p><p className="text-[10px] text-muted-foreground">Wallet and badges</p></div>
          </button>
        </div>

        {spotlight.length > 0 && (
          <section className="rounded-[24px] border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="font-heading text-sm font-black">Whole-app spotlight</h2><p className="text-[10px] text-muted-foreground">Top members by verified reward score</p></div>
              <button type="button" onClick={() => navigate('/leaderboard')} className="text-[11px] font-bold text-accent">View all</button>
            </div>
            <div className="space-y-2">
              {spotlight.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 rounded-2xl bg-background/60 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400/10 text-xs font-black text-yellow-300">#{member.rank}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{member.name}</p><p className="text-[9px] text-muted-foreground">{member.completed_challenges} completed challenges</p></div>
                  <p className="font-heading text-sm font-black">{member.score}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2 rounded-2xl border border-border bg-card p-1.5">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`flex-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-colors ${filter === item.key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-1">
          <div><h2 className="font-heading text-base font-black">{FILTERS.find((item) => item.key === filter)?.label}</h2><p className="text-[10px] text-muted-foreground">{filtered.length} available</p></div>
          <button type="button" onClick={() => loadData({ background: true })} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {filtered.length ? (
          <div className="space-y-3">
            {filtered.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} onOpen={openChallenge} />)}
          </div>
        ) : (
          <div className="rounded-[24px] border border-border bg-card p-8 text-center">
            <Trophy size={30} className="mx-auto text-muted-foreground" />
            <h3 className="mt-3 font-heading text-sm font-black">Nothing here yet</h3>
            <p className="mt-1 text-xs text-muted-foreground">Choose Discover to find a challenge that fits your current routine.</p>
            <Button onClick={() => setFilter('discover')} className="mt-4 h-10 rounded-xl">Browse challenges</Button>
          </div>
        )}
      </main>
    </>
  );
}
