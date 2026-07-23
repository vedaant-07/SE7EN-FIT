import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  ChevronRight,
  Crown,
  Flame,
  Gift,
  Lock,
  Medal,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  WalletCards,
  Zap,
} from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { engagementClient } from '@/api/engagementClient';

const REWARD_PREVIEW = [
  { id: 'premium-week', label: 'Premium extension', cost: 1000, emoji: '👑', description: 'Seven-day premium extension', status: 'preview' },
  { id: 'gym-coupon', label: 'Partner gym coupon', cost: 700, emoji: '🎫', description: 'Gym-managed discount reward', status: 'preview' },
  { id: 'trainer-call', label: 'Trainer consultation', cost: 1200, emoji: '🎯', description: 'Short expert consultation', status: 'preview' },
];

function Badge({ emoji, title, description, earned }) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${earned ? 'border-accent/30 bg-accent/[0.07]' : 'border-border bg-card opacity-65'}`}>
      <div className={`text-3xl ${earned ? '' : 'grayscale opacity-60'}`}>{emoji}</div>
      <p className="mt-2 text-[11px] font-black leading-tight">{title}</p>
      <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-2 flex justify-center">
        {earned ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[8px] font-black uppercase text-accent">Earned</span> : <Lock size={10} className="text-muted-foreground" />}
      </div>
    </div>
  );
}

export default function Rewards() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState('wallet');

  const loadData = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setOverview(await engagementClient.getOverview());
    } catch (loadError) {
      console.error('[Rewards] load failed:', loadError);
      setError(loadError.message || 'Rewards could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const wallet = overview?.wallet || { coins_balance: 0, total_earned: 0 };
  const stats = overview?.stats || {};
  const transactions = overview?.transactions || [];
  const badges = useMemo(() => [
    { emoji: '🚀', title: 'First Move', description: 'Join your first challenge', earned: Number(stats.joined || 0) >= 1 },
    { emoji: '🔥', title: 'Streak Builder', description: 'Reach a 7-day verified streak', earned: Number(stats.streak || 0) >= 7 },
    { emoji: '🏆', title: 'Challenge Finisher', description: 'Complete one challenge', earned: Number(stats.completed || 0) >= 1 },
    { emoji: '🥇', title: 'Three Wins', description: 'Complete three challenges', earned: Number(stats.completed || 0) >= 3 },
    { emoji: '💰', title: 'Coin Collector', description: 'Earn 1,000 lifetime coins', earned: Number(wallet.total_earned || 0) >= 1000 },
    { emoji: '⚡', title: 'SE7EN Elite', description: 'Earn 5,000 lifetime coins', earned: Number(wallet.total_earned || 0) >= 5000 },
  ], [stats, wallet]);

  if (loading) return <LoadingScreen />;

  if (error && !overview) {
    return (
      <>
        <TopBar title="Rewards" showBack backTo="/challenges" />
        <main className="mx-auto max-w-lg px-4 py-10 text-center">
          <Gift size={34} className="mx-auto text-muted-foreground" />
          <h2 className="mt-3 font-heading text-lg font-black">Rewards are temporarily unavailable</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <Button onClick={() => loadData()} className="mt-5 h-11 rounded-xl"><RefreshCw size={15} className="mr-2" /> Try again</Button>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Rewards" showBack backTo="/challenges" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="relative overflow-hidden rounded-[30px] border border-yellow-400/25 bg-gradient-to-br from-yellow-400/[0.16] via-card to-card p-5">
          <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-yellow-400/[0.07]" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-yellow-400/25 bg-yellow-400/15 text-3xl">🪙</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-yellow-300"><Sparkles size={13} /><span className="text-[9px] font-black uppercase tracking-[0.16em]">Verified reward wallet</span></div>
              <p className="mt-1 font-heading text-4xl font-black text-yellow-300">{Number(wallet.coins_balance || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Spendable coins • {Number(wallet.total_earned || 0).toLocaleString()} earned lifetime</p>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-background/60 p-3 text-center"><Target size={14} className="mx-auto text-accent" /><p className="mt-1 font-heading text-base font-black">{stats.active || 0}</p><p className="text-[8px] uppercase tracking-wide text-muted-foreground">Active</p></div>
            <div className="rounded-2xl bg-background/60 p-3 text-center"><Trophy size={14} className="mx-auto text-yellow-300" /><p className="mt-1 font-heading text-base font-black">{stats.completed || 0}</p><p className="text-[8px] uppercase tracking-wide text-muted-foreground">Completed</p></div>
            <div className="rounded-2xl bg-background/60 p-3 text-center"><Flame size={14} className="mx-auto text-orange-300" /><p className="mt-1 font-heading text-base font-black">{stats.streak || 0}d</p><p className="text-[8px] uppercase tracking-wide text-muted-foreground">Streak</p></div>
          </div>

          {!overview?.premium && (
            <button type="button" onClick={() => navigate('/subscription')} className="relative mt-4 flex w-full items-center gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.07] px-3 py-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/15 text-yellow-300"><Crown size={17} /></div>
              <div className="min-w-0 flex-1"><p className="text-xs font-black text-yellow-200">Premium challenge multiplier</p><p className="mt-0.5 text-[10px] text-muted-foreground">Premium transparently awards 2× coins when a challenge is completed.</p></div>
              <ChevronRight size={16} className="text-yellow-300" />
            </button>
          )}
        </section>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1.5">
          {[
            { key: 'wallet', label: 'Activity', icon: WalletCards },
            { key: 'badges', label: 'Badges', icon: Award },
            { key: 'store', label: 'Store', icon: Gift },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold ${tab === key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === 'wallet' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div><h2 className="font-heading text-base font-black">Reward activity</h2><p className="text-[10px] text-muted-foreground">Server-verified coin changes</p></div>
              <button type="button" onClick={() => loadData({ background: true })} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /></button>
            </div>

            {transactions.length ? transactions.map((transaction) => {
              const earning = transaction.type === 'earn';
              return (
                <div key={transaction.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${earning ? 'bg-accent/10 text-accent' : 'bg-purple-400/10 text-purple-300'}`}>
                    {earning ? <Zap size={17} /> : <Gift size={17} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{transaction.reason || 'Reward activity'}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{transaction.date || 'Recent activity'}</p>
                  </div>
                  <p className={`font-heading text-base font-black ${earning ? 'text-accent' : 'text-purple-300'}`}>{earning ? '+' : '-'}{Math.abs(Number(transaction.coins || 0))}</p>
                </div>
              );
            }) : (
              <div className="rounded-[24px] border border-border bg-card p-8 text-center">
                <span className="text-4xl">🪙</span>
                <h3 className="mt-3 font-heading text-sm font-black">Your wallet is ready</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Join a challenge and complete verified daily targets to earn your first coins.</p>
                <Button onClick={() => navigate('/challenges')} className="mt-4 h-10 rounded-xl">Find a challenge</Button>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck size={15} className="shrink-0 text-accent" /> Coins are awarded by the server after completion checks; tapping buttons alone cannot generate rewards.
            </div>
          </section>
        )}

        {tab === 'badges' && (
          <section>
            <div className="mb-3 flex items-center justify-between px-1"><div><h2 className="font-heading text-base font-black">Achievement badges</h2><p className="text-[10px] text-muted-foreground">Built from your real challenge history</p></div><Medal size={18} className="text-yellow-300" /></div>
            <div className="grid grid-cols-3 gap-2.5">
              {badges.map((badge) => <Badge key={badge.title} {...badge} />)}
            </div>
            <button type="button" onClick={() => navigate('/leaderboard')} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-bold">
              See your leaderboard rank <ChevronRight size={16} />
            </button>
          </section>
        )}

        {tab === 'store' && (
          <section className="space-y-3">
            <div className="rounded-[24px] border border-purple-400/20 bg-purple-400/[0.07] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-400/15 text-purple-300"><Gift size={20} /></div>
                <div><h2 className="font-heading text-base font-black">Reward store preview</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">These reward types are planned. Redemption stays disabled until fulfilment, terms and support are fully operational.</p></div>
              </div>
            </div>

            {REWARD_PREVIEW.map((reward) => {
              const affordable = Number(wallet.coins_balance || 0) >= reward.cost;
              return (
                <div key={reward.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/10 text-2xl">{reward.emoji}</div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-black">{reward.label}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{reward.description}</p><p className="mt-1 text-xs font-bold text-yellow-300">{reward.cost} coins</p></div>
                  <span className={`rounded-xl px-2.5 py-1.5 text-[9px] font-black ${affordable ? 'bg-yellow-400/15 text-yellow-300' : 'bg-muted text-muted-foreground'}`}>Coming soon</span>
                </div>
              );
            })}

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><Star size={16} className="text-yellow-300" /><p className="text-sm font-black">Keep your coins safe</p></div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Your balance remains available while reward fulfilment is prepared. No coins are deducted from preview items.</p>
            </div>
          </section>
        )}

        <button type="button" onClick={() => navigate('/challenges')} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-black text-accent-foreground">
          Earn coins in Challenges <ChevronRight size={16} />
        </button>
      </main>
    </>
  );
}
