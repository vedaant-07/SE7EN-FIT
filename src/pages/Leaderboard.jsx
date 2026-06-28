import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Trophy, Medal, Crown, Users, Building2, ChevronRight } from 'lucide-react';

const safeArray = (value) => Array.isArray(value) ? value : [];

const DEFAULT_PRIZES = [
  { rank: 1, title: 'Gold Rank Prize', reward: 'Premium gym reward', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/25' },
  { rank: 2, title: 'Silver Rank Prize', reward: 'Runner-up reward', color: 'text-zinc-300', bg: 'bg-zinc-300/10 border-zinc-300/20' },
  { rank: 3, title: 'Bronze Rank Prize', reward: 'Third rank reward', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
];

function initials(name = '') {
  const parts = String(name || 'User').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'U').toUpperCase();
}

function rankStyle(rank) {
  if (rank === 1) return 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400';
  if (rank === 2) return 'bg-zinc-300/15 border-zinc-300/25 text-zinc-300';
  if (rank === 3) return 'bg-orange-400/15 border-orange-400/25 text-orange-400';
  return 'bg-muted border-border text-muted-foreground';
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [gym, setGym] = useState(null);
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [prizes, setPrizes] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const userProfiles = safeArray(await base44.entities.UserProfile.filter({ user_id: user.id }).catch(() => []));
      const p = userProfiles[0] || null;
      setProfile(p);

      if (!p?.primary_gym_id) {
        setLoading(false);
        return;
      }

      const [ownersRaw, membershipsRaw, allProfilesRaw, walletsRaw, prizeRaw] = await Promise.all([
        base44.entities.GymOwner.list().catch(() => []),
        base44.entities.UserGymMembership.filter({ gym_id: p.primary_gym_id }).catch(() => []),
        base44.entities.UserProfile.list('-created_date', 300).catch(() => []),
        base44.entities.RewardWallet.list('-total_earned', 300).catch(() => []),
        base44.entities.LeaderboardPrize.filter({ gym_id: p.primary_gym_id }).catch(() => []),
      ]);

      const activeMembers = safeArray(membershipsRaw).filter(m => (m.status || 'active') !== 'rejected');
      const memberIds = new Set(activeMembers.map(m => String(m.user_id)));
      let profileRows = safeArray(allProfilesRaw).filter(row => memberIds.has(String(row.user_id)));
      let walletRows = safeArray(walletsRaw).filter(row => memberIds.has(String(row.user_id)));

      if (profileRows.length < activeMembers.length) {
        const missingIds = activeMembers
          .map(m => m.user_id)
          .filter(id => id && !profileRows.some(row => String(row.user_id) === String(id)));
        const fetchedProfiles = await Promise.all(missingIds.map(id =>
          base44.entities.UserProfile.filter({ user_id: id }).catch(() => [])
        ));
        profileRows = [...profileRows, ...fetchedProfiles.flatMap(safeArray)];
      }

      if (walletRows.length < activeMembers.length) {
        const missingIds = activeMembers
          .map(m => m.user_id)
          .filter(id => id && !walletRows.some(row => String(row.user_id) === String(id)));
        const fetchedWallets = await Promise.all(missingIds.map(id =>
          base44.entities.RewardWallet.filter({ user_id: id }).catch(() => [])
        ));
        walletRows = [...walletRows, ...fetchedWallets.flatMap(safeArray)];
      }

      const owners = safeArray(ownersRaw);
      setGym(owners.find(o => String(o.id) === String(p.primary_gym_id)) || null);
      setMembers(activeMembers);
      setProfiles(profileRows);
      setWallets(walletRows);
      setPrizes(safeArray(prizeRaw).filter(pr => (pr.status || 'active') === 'active'));
    } catch (error) {
      console.error('[Leaderboard] load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const rankings = useMemo(() => {
    const memberIds = new Set(members.map(m => String(m.user_id)));
    const rows = profiles
      .filter(p => memberIds.has(String(p.user_id)))
      .map(p => {
        const wallet = wallets.find(w => String(w.user_id) === String(p.user_id));
        const membership = members.find(m => String(m.user_id) === String(p.user_id));
        const score = Number(wallet?.total_earned || wallet?.coins_balance || p.fitness_score || 0) + Number(p.streak_days || 0) * 10 + Number(membership?.total_visits || 0) * 5;
        return {
          user_id: p.user_id,
          name: p.full_name || p.name || p.email || 'SE7EN FIT Member',
          score,
          coins: Number(wallet?.coins_balance || 0),
          streak: Number(p.streak_days || 0),
          visits: Number(membership?.total_visits || 0),
        };
      })
      .sort((a, b) => b.score - a.score);

    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [members, profiles, wallets]);

  const prizeList = (prizes.length ? prizes : DEFAULT_PRIZES)
    .slice(0, 3)
    .map((prize, index) => ({
      rank: Number(prize.rank || index + 1),
      title: prize.title || prize.prize_title || DEFAULT_PRIZES[index]?.title,
      reward: prize.reward || prize.description || prize.prize_description || DEFAULT_PRIZES[index]?.reward,
      color: DEFAULT_PRIZES[index]?.color || 'text-yellow-400',
      bg: DEFAULT_PRIZES[index]?.bg || 'bg-card border-border',
    }));

  if (loading) return <LoadingScreen />;

  if (!profile?.primary_gym_id) {
    return (
      <>
        <TopBar title="Leaderboard" showBack backTo="/" />
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-card border border-border rounded-3xl p-6 text-center">
            <Building2 size={34} className="text-muted-foreground mx-auto mb-3" />
            <h2 className="font-heading font-bold text-lg">Connect your gym first</h2>
            <p className="text-sm text-muted-foreground mt-2">Leaderboard is available for users connected with a gym.</p>
            <button onClick={() => navigate('/my-gym')} className="mt-5 w-full h-11 rounded-xl bg-white text-black font-bold">
              Go to My Gym
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Leaderboard" showBack backTo="/" />
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 rounded-full bg-yellow-400/5 -translate-y-8 translate-x-8" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center">
              <Trophy size={26} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">My Gym Leaderboard</p>
              <h2 className="font-heading font-black text-xl">{gym?.gym_name || 'Your Gym'}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Top members by coins, streak and gym visits</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h3 className="font-heading font-semibold text-sm">Top 3 Prizes</h3>
            <span className="text-[10px] text-muted-foreground">Gym/admin managed</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {prizeList.map(prize => (
              <div key={prize.rank} className={`rounded-2xl border p-3 text-center ${prize.bg}`}>
                <Crown size={18} className={`${prize.color} mx-auto mb-1.5`} />
                <p className="text-[10px] text-muted-foreground">Rank {prize.rank}</p>
                <p className="text-xs font-bold leading-tight mt-0.5">{prize.title}</p>
                <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">{prize.reward}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="font-heading font-semibold text-sm">All Gym Members</h3>
            <span className="text-xs text-muted-foreground">{rankings.length} members</span>
          </div>

          {rankings.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-6 text-center">
              <Users size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="font-heading font-semibold text-sm">No leaderboard data yet</p>
              <p className="text-xs text-muted-foreground mt-1">Members will appear here after joining your gym and earning points.</p>
            </div>
          ) : rankings.map(row => (
            <div key={row.user_id} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm ${rankStyle(row.rank)}`}>
                {row.rank <= 3 ? <Medal size={18} /> : row.rank}
              </div>
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-black text-sm">
                {initials(row.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{row.name}</p>
                <p className="text-[10px] text-muted-foreground">{row.streak} day streak • {row.visits} visits • {row.coins} coins</p>
              </div>
              <div className="text-right">
                <p className="font-heading font-black text-base">{row.score}</p>
                <p className="text-[10px] text-muted-foreground">score</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/my-gym')} className="w-full h-11 rounded-xl bg-card border border-border flex items-center justify-center gap-2 text-sm font-semibold">
          Open My Gym <ChevronRight size={15} />
        </button>
      </div>
    </>
  );
}
