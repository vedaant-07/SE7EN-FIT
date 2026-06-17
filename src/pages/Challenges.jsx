import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Trophy, Flame, Zap, Droplets, Dumbbell, Footprints, Moon, Heart, Star, Users, Clock, Crown, Lock, ChevronRight, Check } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const CHALLENGES_DATA = [
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

export default function Challenges() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [joiningId, setJoiningId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const [subs, parts] = await Promise.all([
      base44.entities.Subscription.filter({ user_id: u.id, status: 'active' }),
      base44.entities.ChallengeParticipant.filter({ user_id: u.id }),
    ]);
    setSubscription(subs[0] || null);
    setParticipants(parts);
    setLoading(false);
  };

  const isPremium = subscription && ['premium_monthly', 'premium_quarterly', 'premium_annual'].includes(subscription.plan);
  const joinedIds = participants.map(p => p.challenge_id);

  const handleJoin = async (challenge) => {
    if (challenge.premium && !isPremium) {
      navigate('/subscription');
      return;
    }
    if (joinedIds.includes(challenge.id)) return;
    setJoiningId(challenge.id);
    try {
      await base44.entities.ChallengeParticipant.create({
        challenge_id: challenge.id,
        user_id: user.id,
        joined_date: getToday(),
        target: challenge.target,
        current_progress: 0,
      });
      setParticipants(prev => [...prev, { challenge_id: challenge.id, current_progress: 0, target: challenge.target }]);
      toast({ title: `🎉 Joined ${challenge.title}!`, description: `Earn ${challenge.coins} coins on completion.` });
    } catch (e) {
      toast({ title: 'Failed to join', variant: 'destructive' });
    }
    setJoiningId(null);
  };

  const getProgress = (challenge) => {
    const p = participants.find(pp => pp.challenge_id === challenge.id);
    if (!p) return 0;
    return Math.min(100, ((p.current_progress || 0) / (p.target || challenge.target)) * 100);
  };

  const filtered = activeTab === 'joined'
    ? CHALLENGES_DATA.filter(c => joinedIds.includes(c.id))
    : CHALLENGES_DATA;

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
              {tab === 'all' ? 'All Challenges' : 'My Challenges'}
            </button>
          ))}
        </div>

        {/* Challenges list */}
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
              const locked = challenge.premium && !isPremium;

              return (
                <div key={challenge.id}
                  className={`bg-card border rounded-3xl p-4 relative overflow-hidden transition-all ${locked ? 'border-border opacity-90' : joined ? 'border-accent/40' : 'border-border'}`}>

                  {locked && (
                    <div className="absolute top-3 right-3">
                      <div className="w-7 h-7 rounded-full bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
                        <Crown size={13} className="text-yellow-400" />
                      </div>
                    </div>
                  )}

                  {joined && !locked && (
                    <div className="absolute top-3 right-3">
                      <span className="text-[9px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-bold">JOINED</span>
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
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${challenge.difficulty === 'Easy' ? 'bg-accent/10 text-accent border-accent/20' : challenge.difficulty === 'Medium' ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' : challenge.difficulty === 'Hard' ? 'bg-orange-400/10 text-orange-400 border-orange-400/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
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
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => handleJoin(challenge)}
                    disabled={joiningId === challenge.id}
                    className={`w-full h-10 rounded-xl text-xs font-semibold transition-all ${
                      locked ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/20' :
                      joined ? 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20' :
                      'bg-accent text-accent-foreground hover:bg-accent/90'
                    }`}
                    variant={locked || joined ? 'outline' : 'default'}
                  >
                    {locked ? <><Crown size={12} className="mr-1" /> Unlock Premium</> :
                     joined ? <><Check size={12} className="mr-1" /> In Progress — Log Today</> :
                     joiningId === challenge.id ? 'Joining...' :
                     <>Join Challenge <ChevronRight size={13} /></>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}