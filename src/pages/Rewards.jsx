import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Crown, Star, Zap, Trophy, Gift, Share2, ChevronRight, Lock, Flame, Droplets, Footprints, Dumbbell, Camera, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EARN_RULES = [
  { action: 'Complete Workout', coins: 50, icon: Dumbbell, color: 'text-accent' },
  { action: 'Hit Step Goal', coins: 30, icon: Footprints, color: 'text-blue-400' },
  { action: 'Hit Water Goal', coins: 20, icon: Droplets, color: 'text-cyan-400' },
  { action: 'Hit Protein Goal', coins: 40, icon: Zap, color: 'text-yellow-400' },
  { action: '7-Day Streak', coins: 200, icon: Flame, color: 'text-orange-400' },
  { action: 'Complete Challenge', coins: 500, icon: Trophy, color: 'text-purple-400' },
  { action: 'Upload Progress Photo', coins: 30, icon: Camera, color: 'text-pink-400' },
  { action: 'Refer a Friend', coins: 300, icon: Users, color: 'text-green-400' },
  { action: 'Transformation Milestone', coins: 1000, icon: Star, color: 'text-yellow-400' },
];

const BADGES = [
  { id: 'first_workout', label: 'First Rep', emoji: '💪', desc: 'Complete first workout', earned: true },
  { id: 'week_streak', label: '7-Day Warrior', emoji: '🔥', desc: '7-day streak', earned: true },
  { id: 'hydration', label: 'Hydration Hero', emoji: '💧', desc: 'Hit water goal 7 times', earned: false },
  { id: 'challenge', label: 'Challenge Master', emoji: '🏆', desc: 'Complete a challenge', earned: false },
  { id: 'transformation', label: 'Transformer', emoji: '⚡', desc: 'Submit transformation photos', earned: false },
  { id: 'referral', label: 'Ambassador', emoji: '🤝', desc: 'Refer 3 friends', earned: false },
];

const REWARDS_STORE = [
  { id: 'r1', label: 'Gym Discount Coupon', cost: 500, type: 'coupon', emoji: '🎫', available: true },
  { id: 'r2', label: 'Premium Extension (7 days)', cost: 1000, type: 'premium', emoji: '👑', available: true },
  { id: 'r3', label: 'Trainer Consultation', cost: 800, type: 'consultation', emoji: '🎯', available: false },
  { id: 'r4', label: 'SE7EN FIT Merchandise', cost: 2000, type: 'merch', emoji: '👕', available: false },
  { id: 'r5', label: 'Partner Gym Pass', cost: 1500, type: 'gym', emoji: '🏋️', available: false },
];

export default function Rewards() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [activeTab, setActiveTab] = useState('wallet');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [wallets, txns, subs] = await Promise.all([
      base44.entities.RewardWallet.filter({ user_id: user.id }),
      base44.entities.RewardTransaction.filter({ user_id: user.id }, '-created_date', 20),
      base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }),
    ]);
    setWallet(wallets[0] || { coins_balance: 0, total_earned: 0, badges: [] });
    setTransactions(txns);
    setSubscription(subs[0] || null);
    setLoading(false);
  };

  const isPremium = subscription && ['premium_monthly', 'premium_quarterly', 'premium_annual'].includes(subscription.plan);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Rewards" showBack />
      <div className="px-4 py-4 pb-24 space-y-4 max-w-lg mx-auto">

        {/* Coin wallet hero */}
        <div className="bg-gradient-to-br from-yellow-400/20 via-yellow-400/10 to-transparent border border-yellow-400/30 rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
              <span className="text-3xl">🪙</span>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">SE7EN FIT Coins</p>
              <p className="font-heading font-black text-4xl text-yellow-400">{wallet?.coins_balance || 0}</p>
              <p className="text-xs text-muted-foreground">Total earned: {wallet?.total_earned || 0} coins</p>
            </div>
          </div>
          {!isPremium && (
            <button onClick={() => navigate('/subscription')}
              className="mt-3 flex items-center gap-2 text-xs text-yellow-400 font-medium">
              <Crown size={12} /> Upgrade to earn 2x coins <ChevronRight size={12} />
            </button>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex gap-2">
          {['wallet', 'earn', 'badges', 'store'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 h-9 rounded-xl text-[11px] font-semibold capitalize transition-all ${activeTab === tab ? 'bg-white text-black hover:bg-white/90' : 'bg-muted text-muted-foreground'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* WALLET TAB */}
        {activeTab === 'wallet' && (
          <div className="space-y-3">
            <p className="font-heading font-semibold text-sm">Recent Activity</p>
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">🪙</span>
                <p className="font-heading font-semibold mt-2">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Complete workouts & goals to earn coins</p>
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tx.type === 'earn' ? 'bg-accent/10' : 'bg-destructive/10'}`}>
                    {tx.type === 'earn' ? <Zap size={14} className="text-accent" /> : <Gift size={14} className="text-destructive" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{tx.reason || tx.source}</p>
                    <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                  </div>
                  <span className={`font-bold text-sm ${tx.type === 'earn' ? 'text-accent' : 'text-destructive'}`}>
                    {tx.type === 'earn' ? '+' : '-'}{tx.coins}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* EARN TAB */}
        {activeTab === 'earn' && (
          <div className="space-y-2">
            <p className="font-heading font-semibold text-sm">How to Earn Coins</p>
            {EARN_RULES.map((rule, i) => {
              const Icon = rule.icon;
              return (
                <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className={rule.color} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{rule.action}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-400 font-bold text-sm">+{rule.coins}</span>
                    <span className="text-[10px] text-muted-foreground">coins</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BADGES TAB */}
        {activeTab === 'badges' && (
          <div className="space-y-3">
            <p className="font-heading font-semibold text-sm">Achievement Badges</p>
            <div className="grid grid-cols-3 gap-2.5">
              {BADGES.map(badge => (
                <div key={badge.id} className={`bg-card border rounded-2xl p-3 text-center transition-all ${badge.earned ? 'border-accent/30 shadow-sm shadow-accent/10' : 'border-border opacity-60'}`}>
                  <div className={`text-3xl mb-1.5 ${badge.earned ? '' : 'grayscale opacity-50'}`}>{badge.emoji}</div>
                  <p className="text-[11px] font-semibold leading-tight">{badge.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{badge.desc}</p>
                  {!badge.earned && <div className="mt-1.5 flex items-center justify-center"><Lock size={10} className="text-muted-foreground" /></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STORE TAB */}
        {activeTab === 'store' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-heading font-semibold text-sm">Rewards Store</p>
              <p className="text-xs text-yellow-400 font-medium">Balance: {wallet?.coins_balance || 0} 🪙</p>
            </div>
            {REWARDS_STORE.map(reward => {
              const canAfford = (wallet?.coins_balance || 0) >= reward.cost;
              return (
                <div key={reward.id} className={`bg-card border border-border rounded-2xl p-4 ${!reward.available ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center text-2xl">
                      {reward.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-sm">{reward.label}</p>
                      <p className="flex items-center gap-1 text-xs text-yellow-400 font-medium mt-0.5">
                        🪙 {reward.cost} coins
                      </p>
                    </div>
                    <button
                      disabled={!reward.available || !canAfford}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        !reward.available ? 'bg-muted text-muted-foreground' :
                        canAfford ? 'bg-yellow-400 text-black hover:bg-yellow-400/90' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {!reward.available ? 'Coming Soon' : canAfford ? 'Redeem' : 'Need more'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
