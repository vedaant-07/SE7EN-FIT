import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Trophy, Flame, Zap, Droplets, Dumbbell, Footprints, Star, Users, Clock, Crown, ChevronRight, Check, Plus, Bot, RefreshCw } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const BUILTIN_CHALLENGES = [
  {
    id: 'c1', title: '7-Day Beginner', emoji: '🌟', type: 'steps', icon: Footprints,
    difficulty: 'Easy', days: 7, coins: 200, participants: 1284, color: 'text-accent', bg: 'bg-accent/10',
    description: 'Complete 7 consecutive days of at least 5,000 steps. Perfect for beginners!',
    target: 7, unit: 'days', premium: false,
  },
  {
    id: 'c2', title: '10K Steps Challenge', emoji: '👟', type: 'steps', icon: Footprints,
    difficulty: 'Medium', days: 14, coins: 350, participants: 892, color: 'text-blue-400', bg: 'bg-blue-400/10',
    description: 'Hit 10,000 steps every day for 14 days. Become a walking champion!',
    target: 14, unit: 'days', premium: false,
  },
  {
    id: 'c3', title: '21-Day Consistency', emoji: '🔥', type: 'consistency', icon: Flame,
    difficulty: 'Hard', days: 21, coins: 500, participants: 647, color: 'text-orange-400', bg: 'bg-orange-400/10',
    description: 'Log any workout for 21 consecutive days. Build an unbreakable habit!',
    target: 21, unit: 'days', premium: true,
  },
  {
    id: 'c4', title: '30-Day Fat Loss', emoji: '💪', type: 'workout', icon: Dumbbell,
    difficulty: 'Hard', days: 30, coins: 750, participants: 423, color: 'text-red-400', bg: 'bg-red-400/10',
    description: 'Follow a structured fat loss program for 30 days. Transform your body!',
    target: 30, unit: 'days', premium: true,
  },
  {
    id: 'c5', title: 'Water Challenge', emoji: '💧', type: 'water', icon: Droplets,
    difficulty: 'Easy', days: 7, coins: 150, participants: 2341, color: 'text-cyan-400', bg: 'bg-cyan-400/10',
    description: 'Drink 2.5L of water every day for 7 days. Stay hydrated!',
    target: 7, unit: 'days', premium: false,
  },
  {
    id: 'c6', title: '30-Day Muscle Gain', emoji: '🏋️', type: 'workout', icon: Dumbbell,
    difficulty: 'Hard', days: 30, coins: 800, participants: 318, color: 'text-purple-400', bg: 'bg-purple-400/10',
    description: 'Progressive overload for 30 days. Gain size and strength!',
    target: 30, unit: 'days', premium: true,
  },
  {
    id: 'c7', title: 'Protein Target Challenge', emoji: '🥩', type: 'protein', icon: Zap,
    difficulty: 'Medium', days: 14, coins: 300, participants: 567, color: 'text-yellow-400', bg: 'bg-yellow-400/10',
    description: 'Hit your daily protein goal for 14 consecutive days.',
    target: 14, unit: 'days', premium: false,
  },
  {
    id: 'c8', title: 'Transformation Challenge', emoji: '⚡', type: 'transformation', icon: Star,
    difficulty: 'Expert', days: 90, coins: 2000, participants: 156, color: 'text-yellow-400', bg: 'bg-yellow-500/10',
    description: 'A full 90-day body transformation challenge with AI guidance. The ultimate test!',
    target: 90, unit: 'days', premium: true,
  },
];

function difficultyStyle(d) {
  if (d === 'Easy') return 'bg-accent/10 text-accent border-accent/20';
  if (d === 'Medium') return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
  if (d === 'Hard') return 'bg-orange-400/10 text-orange-400 border-orange-400/20';
  return 'bg-red-400/10 text-red-400 border-red-400/20';
}

export default function Challenges() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [gymChallenges, setGymChallenges] = useState([]);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [joiningId, setJoiningId] = useState(null);
  const [loggingId, setLoggingId] = useState(null);
  const [aiRecs, setAiRecs] = useState(null);
  const [loadingAiRecs, setLoadingAiRecs] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const [subs, parts, profiles] = await Promise.all([
      base44.entities.Subscription.filter({ user_id: u.id, status: 'active' }),
      base44.entities.ChallengeParticipant.filter({ user_id: u.id }),
      base44.entities.UserProfile.filter({ user_id: u.id }),
    ]);
    setSubscription(subs[0] || null);
    setParticipants(parts);
    const p = profiles[0] || null;
    setProfile(p);

    // Load gym challenges if user is linked to a gym
    if (p?.primary_gym_id) {
      try {
        const gc = await base44.entities.Challenge.filter({ gym_id: p.primary_gym_id });
        setGymChallenges(gc.filter(c => c.is_active));
      } catch {}
    }
    setLoading(false);
  };

  const isPremium = subscription && ['premium_monthly', 'premium_quarterly', 'premium_annual'].includes(subscription.plan);

  // Build merged challenge list: gym challenges first (as real DB entries), then builtins
  const gymChallengesMapped = gymChallenges.map(gc => ({
    id: gc.id,
    title: gc.name,
    emoji: '🏋️',
    type: gc.type,
    icon: Trophy,
    difficulty: 'Gym',
    days: gc.duration_days || 30,
    coins: gc.reward_coins || 100,
    participants: gc.participants_count || 0,
    color: 'text-accent',
    bg: 'bg-accent/10',
    description: gc.rules || gc.description || `A challenge from your gym. ${gc.duration_days || 30} days.`,
    target: gc.duration_days || 30,
    unit: 'days',
    premium: false,
    isGymChallenge: true,
  }));

  const allChallenges = [...gymChallengesMapped, ...BUILTIN_CHALLENGES];
  const joinedIds = participants.map(p => p.challenge_id);

  const filtered = activeTab === 'joined'
    ? allChallenges.filter(c => joinedIds.includes(c.id))
    : allChallenges;

  const handleJoin = async (challenge) => {
    if (challenge.premium && !isPremium) {
      navigate('/subscription');
      return;
    }
    if (joinedIds.includes(challenge.id)) return;
    setJoiningId(challenge.id);
    try {
      const rec = await base44.entities.ChallengeParticipant.create({
        challenge_id: challenge.id,
        user_id: user.id,
        joined_date: getToday(),
        target: challenge.target,
        current_progress: 0,
      });
      setParticipants(prev => [...prev, rec]);
      toast({ title: `🎉 Joined ${challenge.title}!`, description: `Earn ${challenge.coins} coins on completion.` });
    } catch {
      toast({ title: 'Failed to join', variant: 'destructive' });
    }
    setJoiningId(null);
  };

  const handleLogProgress = async (challenge) => {
    const participant = participants.find(p => p.challenge_id === challenge.id);
    if (!participant || participant.completed) return;
    setLoggingId(challenge.id);
    try {
      const newProgress = (participant.current_progress || 0) + 1;
      const completed = newProgress >= (participant.target || challenge.target);
      await base44.entities.ChallengeParticipant.update(participant.id, {
        current_progress: newProgress,
        completed,
        completed_date: completed ? getToday() : undefined,
        last_checkin: getToday(),
        coins_earned: completed ? challenge.coins : participant.coins_earned || 0,
      });
      setParticipants(prev => prev.map(p =>
        p.id === participant.id ? { ...p, current_progress: newProgress, completed, last_checkin: getToday() } : p
      ));

      if (completed) {
        // Award coins
        const wallets = await base44.entities.RewardWallet.filter({ user_id: user.id });
        if (wallets[0]) {
          await base44.entities.RewardWallet.update(wallets[0].id, {
            coins_balance: (wallets[0].coins_balance || 0) + challenge.coins,
            total_earned: (wallets[0].total_earned || 0) + challenge.coins,
          });
        } else {
          await base44.entities.RewardWallet.create({
            user_id: user.id, coins_balance: challenge.coins, total_earned: challenge.coins, badges: [],
          });
        }
        await base44.entities.RewardTransaction.create({
          user_id: user.id, type: 'earn', coins: challenge.coins,
          reason: `Completed: ${challenge.title}`, source: 'challenge', date: getToday(),
        });
        toast({ title: `🏆 Challenge Complete!`, description: `+${challenge.coins} coins awarded!` });
      } else {
        toast({ title: `✅ Progress logged!`, description: `Day ${newProgress} of ${participant.target || challenge.target}` });
      }
    } catch {
      toast({ title: 'Failed to log progress', variant: 'destructive' });
    }
    setLoggingId(null);
  };

  const handleAiRecommend = async () => {
    setLoadingAiRecs(true);
    try {
      const stats = {
        joined: participants.length,
        completed: participants.filter(p => p.completed).length,
        coinsEarned: participants.reduce((s, p) => s + (p.coins_earned || 0), 0),
      };
      const res = await base44.functions.invoke('geminiService', { action: 'recommendChallenges', profile, stats });
      if (res.data?.locked) { navigate('/subscription'); return; }
      if (res.data?.error) throw new Error(res.data.error);
      setAiRecs(res.data?.recommendedChallenges || []);
    } catch (e) {
      toast({ title: 'AI unavailable', description: e.message, variant: 'destructive' });
    }
    setLoadingAiRecs(false);
  };

  const getParticipant = (challengeId) => participants.find(p => p.challenge_id === challengeId);
  const getProgress = (challenge) => {
    const p = getParticipant(challenge.id);
    if (!p) return 0;
    return Math.min(100, ((p.current_progress || 0) / (p.target || challenge.target)) * 100);
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Challenges" showBack />
      <div className="px-4 py-4 pb-24 space-y-4 max-w-lg mx-auto">

        {/* Header stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card border border-border rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-accent">{joinedIds.length}</p>
            <p className="text-[10px] text-muted-foreground">Joined</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-yellow-400">{participants.filter(p => p.completed).length}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-purple-400">{participants.reduce((s, p) => s + (p.coins_earned || 0), 0)}</p>
            <p className="text-[10px] text-muted-foreground">Coins Earned</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {['all', 'joined'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-all ${activeTab === tab ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
              {tab === 'all' ? `All Challenges (${allChallenges.length})` : `My Challenges (${joinedIds.length})`}
            </button>
          ))}
        </div>

        {/* AI Recommendations */}
        {activeTab === 'all' && (
          <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-accent" />
                <p className="text-sm font-semibold">AI Challenge Picks</p>
              </div>
              <button onClick={handleAiRecommend} disabled={loadingAiRecs}
                className="text-xs text-accent font-medium flex items-center gap-1 disabled:opacity-50">
                {loadingAiRecs ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                {aiRecs ? 'Refresh' : 'Get Picks'}
              </button>
            </div>
            {!aiRecs && !loadingAiRecs && (
              <p className="text-xs text-muted-foreground">Tap "Get Picks" for personalized challenge recommendations based on your goal.</p>
            )}
            {loadingAiRecs && <p className="text-xs text-muted-foreground">Analyzing your profile…</p>}
            {aiRecs && (
              <div className="space-y-2 mt-2">
                {aiRecs.map((rec, i) => (
                  <div key={i} className="bg-card/60 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{rec.challengeName}</p>
                      <span className="text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full whitespace-nowrap">{rec.difficulty}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{rec.reason}</p>
                    <p className="text-[11px] text-accent mt-0.5">🎯 {rec.expectedBenefit}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gym challenges banner */}
        {gymChallengesMapped.length > 0 && activeTab === 'all' && (
          <div className="bg-accent/8 border border-accent/20 rounded-xl px-3 py-2 flex items-center gap-2">
            <Trophy size={13} className="text-accent flex-shrink-0" />
            <p className="text-xs text-accent font-medium">{gymChallengesMapped.length} challenge{gymChallengesMapped.length > 1 ? 's' : ''} from your gym</p>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <Trophy size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-heading font-semibold">No challenges joined yet</p>
            <p className="text-xs text-muted-foreground mt-1">Browse challenges and join to start earning!</p>
            <Button onClick={() => setActiveTab('all')} className="mt-4 h-10 rounded-xl bg-accent text-accent-foreground text-sm">Browse Challenges</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(challenge => {
              const Icon = challenge.icon;
              const joined = joinedIds.includes(challenge.id);
              const progress = getProgress(challenge);
              const participant = getParticipant(challenge.id);
              const locked = challenge.premium && !isPremium;
              const alreadyLoggedToday = participant?.last_checkin === getToday();
              const isCompleted = participant?.completed;

              return (
                <div key={challenge.id}
                  className={`bg-card border rounded-3xl p-4 relative overflow-hidden transition-all ${
                    locked ? 'border-border opacity-90' :
                    challenge.isGymChallenge ? 'border-accent/30' :
                    joined ? 'border-accent/30' : 'border-border'
                  }`}>

                  {challenge.isGymChallenge && (
                    <div className="absolute top-3 right-3">
                      <span className="text-[9px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-bold">GYM</span>
                    </div>
                  )}
                  {locked && !challenge.isGymChallenge && (
                    <div className="absolute top-3 right-3">
                      <div className="w-7 h-7 rounded-full bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
                        <Crown size={13} className="text-yellow-400" />
                      </div>
                    </div>
                  )}
                  {joined && !locked && !challenge.isGymChallenge && (
                    <div className="absolute top-3 right-3">
                      <span className="text-[9px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-bold">
                        {isCompleted ? '✓ DONE' : 'JOINED'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-2xl ${challenge.bg} flex items-center justify-center flex-shrink-0 text-xl`}>
                      {challenge.emoji}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <p className="font-heading font-bold text-sm">{challenge.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{challenge.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${difficultyStyle(challenge.difficulty)}`}>
                      {challenge.difficulty}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock size={10} /> {challenge.days} days
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users size={10} /> {challenge.participants.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-yellow-400 font-semibold">
                      🪙 {challenge.coins} coins
                    </span>
                  </div>

                  {joined && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Progress — Day {participant?.current_progress || 0} of {participant?.target || challenge.target}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  {joined && !isCompleted && !locked ? (
                    <Button
                      onClick={() => handleLogProgress(challenge)}
                      disabled={loggingId === challenge.id || alreadyLoggedToday}
                      className="w-full h-10 rounded-xl text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {loggingId === challenge.id ? 'Logging...' :
                       alreadyLoggedToday ? <><Check size={12} className="mr-1" /> Logged Today ✓</> :
                       <><Plus size={12} className="mr-1" /> Log Today's Progress</>}
                    </Button>
                  ) : joined && isCompleted ? (
                    <div className="w-full h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-semibold text-emerald-400">
                      <Check size={13} className="mr-1.5" /> Challenge Completed! 🏆
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleJoin(challenge)}
                      disabled={joiningId === challenge.id}
                      className={`w-full h-10 rounded-xl text-xs font-semibold transition-all ${
                        locked ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/20' :
                        'bg-accent text-accent-foreground hover:bg-accent/90'
                      }`}
                      variant={locked ? 'outline' : 'default'}
                    >
                      {locked ? <><Crown size={12} className="mr-1" /> Unlock Premium</> :
                       joiningId === challenge.id ? 'Joining...' :
                       <>Join Challenge <ChevronRight size={13} /></>}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}