import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { getToday, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget, getActivityLevel, calculateFitnessScore } from '@/lib/fitnessUtils';
import { Flame, Droplets, Footprints, Moon, Dumbbell, Camera, Scale, Utensils, Trophy, TrendingUp, Zap, ChevronRight, Crown, Building2, LogIn, LogOut, Users, Megaphone } from 'lucide-react';

const emptyToday = { calories: 0, protein: 0, water: 0, steps: 0, sleep: 0, workoutDone: false };
const safeArray = (value) => Array.isArray(value) ? value : [];
const iconTileClass = 'bg-[#77AC6F]/10 border border-[#77AC6F]/20 text-white';
const fourPerViewStyle = { flex: '0 0 calc((100% - 18px) / 4)' };

const defaultAds = [
  {
    id: 'admin-default-offer',
    source_type: 'admin',
    source_name: 'SE7EN FIT',
    title: 'Premium fitness offers',
    description: 'Admin offers, app promotions, and featured partner deals will appear here.',
    offer_text: 'Featured Offer',
    media_type: 'image',
    cta_label: 'Explore',
  },
  {
    id: 'gym-default-offer',
    source_type: 'gym_owner',
    source_name: 'Partner Gyms',
    title: 'Gym owner ads',
    description: 'Gym owners can promote plans, trials, and seasonal discounts to their referred users.',
    offer_text: 'Gym Promotion',
    media_type: 'image',
    cta_label: 'View Offer',
  },
];

const isVideoAd = (ad) => {
  const type = String(ad?.media_type || ad?.type || '').toLowerCase();
  const url = String(ad?.media_url || ad?.video_url || '').toLowerCase();
  return type === 'video' || /\.(mp4|webm|mov)(\?|$)/.test(url);
};

const isAdActive = (ad) => {
  const status = String(ad?.status || 'active').toLowerCase();
  if (!['active', 'published', 'approved', 'live'].includes(status)) return false;

  const now = Date.now();
  const start = ad.start_date ? Date.parse(ad.start_date) : null;
  const end = ad.end_date ? Date.parse(ad.end_date) : null;
  if (start && start > now) return false;
  if (end && end < now) return false;

  return true;
};

const shouldShowAdToUser = (ad, profile) => {
  const sourceType = String(ad.source_type || ad.created_by_role || ad.owner_type || '').toLowerCase();
  const scope = String(ad.target_scope || ad.audience || '').toLowerCase();

  if (sourceType === 'admin' || scope === 'all' || scope === 'everyone' || ad.show_to_all) return true;

  const userGymId = profile?.primary_gym_id || profile?.referred_gym_id || profile?.gym_id;
  const targetGymId = ad.target_gym_id || ad.gym_id || ad.owner_gym_id;
  return !!userGymId && !!targetGymId && String(userGymId) === String(targetGymId);
};

export default function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState(emptyToday);
  const [gymStatus, setGymStatus] = useState({ gym: null, todayLog: null });
  const [ads, setAds] = useState([]);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);

    try {
      const user = await base44.auth.me();

      const owners = safeArray(await base44.entities.GymOwner.filter({ user_id: user.id }).catch(() => []));
      if (owners.length > 0) {
        setLoading(false);
        navigate(owners[0].onboarding_complete ? '/gym-owner/dashboard' : '/gym-owner/onboarding', { replace: true });
        return;
      }

      const [profilesRaw, subsRaw] = await Promise.all([
        base44.entities.UserProfile.filter({ user_id: user.id }).catch(() => []),
        base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }).catch(() => []),
      ]);

      const profiles = safeArray(profilesRaw);
      const subs = safeArray(subsRaw);

      if (!profiles.length) {
        setLoading(false);
        navigate('/onboarding', { replace: true });
        return;
      }

      const p = profiles[0];
      setProfile(p);
      setSubscription(subs[0] || null);

      if (p.primary_gym_id) {
        try {
          const [gymOwnersRaw, attLogsRaw] = await Promise.all([
            base44.entities.GymOwner.list().catch(() => []),
            base44.entities.GymAttendanceLog.filter({ user_id: user.id, gym_id: p.primary_gym_id, date: today }).catch(() => []),
          ]);
          const gymOwners = safeArray(gymOwnersRaw);
          const attLogs = safeArray(attLogsRaw);
          const gymOwner = gymOwners.find(o => o.id === p.primary_gym_id);
          setGymStatus({ gym: gymOwner || null, todayLog: attLogs[0] || null });
        } catch {
          setGymStatus({ gym: null, todayLog: null });
        }
      }

      const [nutritionRaw, waterRaw, stepsRaw, sleepRaw, workoutRaw, adsRaw] = await Promise.all([
        base44.entities.NutritionLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.WaterLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.StepLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.SleepLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.WorkoutLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.Advertisement.list('-created_date', 30).catch(() => []),
      ]);

      const nutritionLogs = safeArray(nutritionRaw);
      const waterLogs = safeArray(waterRaw);
      const stepLogs = safeArray(stepsRaw);
      const sleepLogs = safeArray(sleepRaw);
      const workoutLogs = safeArray(workoutRaw);
      const visibleAds = safeArray(adsRaw).filter(ad => isAdActive(ad) && shouldShowAdToUser(ad, p));

      setTodayData({
        calories: nutritionLogs.reduce((s, n) => s + Number(n.calories || 0), 0),
        protein: nutritionLogs.reduce((s, n) => s + Number(n.protein_g || 0), 0),
        water: waterLogs.reduce((s, w) => s + Number(w.amount_ml || 0), 0),
        steps: stepLogs.reduce((s, st) => s + Number(st.steps || 0), 0),
        sleep: Number(sleepLogs[0]?.hours || 0),
        workoutDone: workoutLogs.some(w => w.completed),
      });
      setAds(visibleAds.length ? visibleAds : defaultAds);
    } catch (error) {
      console.error('[Home] Dashboard load failed:', error);
      setProfile(null);
      setTodayData(emptyToday);
      navigate('/welcome', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!profile) return null;

  const bmr = calculateBMR(profile.weight_kg || 70, profile.height_cm || 170, profile.age || 25, profile.gender || 'male');
  const tdee = calculateTDEE(bmr, getActivityLevel(profile.workout_days_per_week || 4));
  const calorieTarget = calculateCalorieTarget(tdee, profile.goal);
  const proteinTarget = calculateProteinTarget(profile.weight_kg || 70, profile.goal);
  const waterGoal = profile.daily_water_goal_ml || 2500;
  const stepGoal = profile.daily_step_goal || 8000;
  const isPremium = subscription && subscription.plan !== 'free';

  const fitnessScore = calculateFitnessScore({
    workoutDone: todayData.workoutDone,
    stepsPercent: (todayData.steps / stepGoal) * 100,
    waterPercent: (todayData.water / waterGoal) * 100,
    caloriesOnTrack: todayData.calories > 0 && todayData.calories <= calorieTarget * 1.1,
    sleepHours: todayData.sleep,
    proteinOnTrack: todayData.protein >= proteinTarget * 0.8,
  });
  const scoreLabel = fitnessScore >= 80 ? 'Excellent' : fitnessScore >= 50 ? 'Good Progress' : 'Let\'s Go';

  return (
    <>
      <TopBar />
      <div className="px-4 pt-3 pb-6 space-y-5">
        <AdBanners ads={ads} />

        <div>
          <h3 className="font-heading font-semibold text-sm mb-3 px-0.5">Daily Fitness</h3>
          <DailyScoreCard score={fitnessScore} label={scoreLabel} onClick={() => navigate('/tracking')} />
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <MetricCard icon={<Flame size={20} />} label="Calories" value={`${todayData.calories}`} sub={`/ ${calorieTarget} kcal`} percent={(todayData.calories / calorieTarget) * 100} onClick={() => navigate('/nutrition')} barColor="bg-accent" />
          <MetricCard icon={<Zap size={20} />} label="Protein" value={`${todayData.protein}g`} sub={`/ ${proteinTarget}g`} percent={(todayData.protein / proteinTarget) * 100} onClick={() => navigate('/nutrition')} barColor="bg-accent" />
          <MetricCard icon={<Droplets size={20} />} label="Water" value={`${Math.round(todayData.water / 250)}`} sub={`/ ${Math.round(waterGoal / 250)} glasses`} percent={(todayData.water / waterGoal) * 100} onClick={() => navigate('/tracking/water')} barColor="bg-accent" />
          <MetricCard icon={<Footprints size={20} />} label="Steps" value={todayData.steps.toLocaleString()} sub={`/ ${stepGoal.toLocaleString()}`} percent={(todayData.steps / stepGoal) * 100} onClick={() => navigate('/tracking/steps')} barColor="bg-accent" />
          <MetricCard icon={<Moon size={20} />} label="Sleep" value={`${todayData.sleep}h`} sub={`/ ${profile.sleep_goal_hours || 7}h goal`} percent={(todayData.sleep / (profile.sleep_goal_hours || 7)) * 100} onClick={() => navigate('/tracking/sleep')} barColor="bg-accent" />
          <MetricCard icon={<Dumbbell size={20} />} label="Workout" value={todayData.workoutDone ? 'Done' : 'Pending'} sub={todayData.workoutDone ? 'Great job' : 'Tap to start'} percent={todayData.workoutDone ? 100 : 0} onClick={() => navigate('/workout')} barColor="bg-accent" />
        </div>

        {gymStatus.gym && (
          <button onClick={() => navigate('/my-gym')}
            className={`w-full rounded-2xl p-4 flex items-center gap-3 border transition-all active:scale-[0.98] ${
              gymStatus.todayLog?.status === 'checked_in' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card border-border hover:border-accent/30'
            }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconTileClass}`}>
              {gymStatus.todayLog?.status === 'checked_in' ? <LogOut size={18} className="text-white" /> : <LogIn size={18} className="text-white" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">{gymStatus.gym.gym_name || 'My Gym'}</p>
              <p className="text-xs text-muted-foreground">
                {gymStatus.todayLog?.status === 'checked_in'
                  ? `Checked in at ${gymStatus.todayLog.check_in_time} — tap to check out`
                  : gymStatus.todayLog?.status === 'checked_out'
                  ? `Session done — ${gymStatus.todayLog.duration_minutes || 0} min`
                  : 'Tap to check in to your gym'}
              </p>
            </div>
            <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
          </button>
        )}

        <div>
          <h3 className="font-heading font-semibold text-sm mb-3 px-0.5">Quick Actions</h3>
          <div className="-mx-1 overflow-x-auto no-scrollbar pb-1">
            <div className="flex gap-1.5 px-1 snap-x snap-mandatory">
              {[
                { icon: Dumbbell, label: 'Log Workout', route: '/workout/log', tileClass: 'bg-[#0F2A1A] border-[#153822]', iconClass: 'text-[#22C55E]' },
                { icon: Utensils, label: 'Log Meal', route: '/nutrition/log', tileClass: 'bg-[#2B1E13] border-[#3A2919]', iconClass: 'text-[#FB923C]' },
                { icon: Droplets, label: 'Add Water', route: '/tracking', tileClass: 'bg-[#111D2B] border-[#1A2B45]', iconClass: 'text-[#60A5FA]' },
                { icon: Camera, label: 'Food Scan', route: '/food-scan', tileClass: 'bg-[#0F2A1A] border-[#153822]', iconClass: 'text-[#4ADE80]' },
                { icon: Building2, label: 'My Gym', route: '/my-gym', tileClass: 'bg-[#2A220F] border-[#3B3014]', iconClass: 'text-[#FBBF24]' },
                { icon: Scale, label: 'Progress', route: '/progress', tileClass: 'bg-[#22182C] border-[#332140]', iconClass: 'text-[#C084FC]' },
              ].map(({ icon: Icon, label, route, tileClass, iconClass }) => (
                <button
                  key={route}
                  onClick={() => navigate(route)}
                  style={fourPerViewStyle}
                  className="snap-start flex flex-col items-center gap-1.5 rounded-2xl py-2 hover:bg-card/60 active:scale-95 transition-all"
                >
                  <div className={`w-[60px] h-[60px] rounded-2xl flex items-center justify-center border ${tileClass}`}>
                    <Icon size={28} className={iconClass} />
                  </div>
                  <span className="text-[10px] font-semibold text-center leading-tight whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-white" /><span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Streak</span></div>
            <p className="text-2xl font-bold font-heading">{profile.streak_days || 0}</p>
            <p className="text-xs text-muted-foreground">days in a row</p>
          </div>
          <Link to="/progress">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 active:scale-[0.97] transition-all h-full">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} className="text-white" /><span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Weight</span></div>
              <p className="text-2xl font-bold font-heading">{profile.weight_kg}<span className="text-sm font-normal text-muted-foreground"> kg</span></p>
              <p className="text-[11px] text-accent font-medium">Target: {profile.target_weight_kg} kg</p>
            </div>
          </Link>
        </div>

        {!isPremium && (
          <Link to="/subscription" className="block">
            <div className="bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-yellow-500/5 border border-yellow-500/30 rounded-3xl px-5 py-5 hover:border-yellow-500/50 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#2A220F] border border-[#3B3014]"><Crown size={19} className="text-[#FBBF24]" /></div>
                <div className="flex-1"><p className="font-heading font-bold text-sm">Unlock Premium AI Trainer</p><p className="text-xs text-muted-foreground mt-0.5">Personalized plans, advanced analytics & more</p></div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Community', icon: Users, route: '/community' },
            { label: 'Rewards', icon: Trophy, route: '/rewards' },
            { label: 'Premium', icon: Crown, route: '/subscription' },
          ].map(({ label, icon: Icon, route }) => (
            <Link key={route} to={route}>
              <div className="bg-card border border-border rounded-2xl p-3.5 text-center hover:border-accent/30 active:scale-[0.97] transition-all">
                <div className="w-9 h-9 mx-auto rounded-xl flex items-center justify-center bg-[#2A220F] border border-[#3B3014]"><Icon size={18} className="text-[#FBBF24]" /></div>
                <p className="text-[10px] font-medium mt-1.5">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
}

function AdBanners({ ads }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h3 className="font-heading font-semibold text-sm">Offers & Advertisements</h3>
        <span className="text-[10px] text-muted-foreground">Sponsored</span>
      </div>
      <div className="overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
        <div className="flex gap-3">
          {safeArray(ads).map(ad => <AdCard key={ad.id || ad.title} ad={ad} />)}
        </div>
      </div>
    </div>
  );
}

function AdCard({ ad }) {
  const mediaUrl = ad.media_url || ad.image_url || ad.video_url || '';
  const clickable = !!ad.cta_url;
  const handleClick = () => {
    if (!clickable) return;
    window.open(ad.cta_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="snap-start flex-shrink-0 w-full overflow-hidden rounded-3xl border border-border bg-card text-left active:scale-[0.99] transition-all"
    >
      <div className="relative min-h-[148px] bg-gradient-to-br from-accent/25 via-emerald-500/10 to-yellow-500/10">
        {mediaUrl && isVideoAd(ad) && (
          <video src={mediaUrl} className="absolute inset-0 h-full w-full object-cover" muted loop playsInline autoPlay />
        )}
        {mediaUrl && !isVideoAd(ad) && (
          <img src={mediaUrl} alt={ad.title || 'Advertisement'} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
        <div className="relative z-10 flex min-h-[148px] flex-col justify-between p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex max-w-[68%] items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
              <Megaphone size={11} className="shrink-0" /> <span className="truncate">{ad.offer_text || ad.source_name || 'Offer'}</span>
            </span>
            <span className="shrink-0 rounded-full bg-black/35 px-2 py-1 text-[9px] font-semibold uppercase text-white/80">
              {String(ad.source_type || 'admin').replace('_', ' ')}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-heading text-[22px] font-black leading-tight text-white line-clamp-2">{ad.title || 'Special offer'}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/75">{ad.description || ad.subtitle || 'Tap to view this offer.'}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-black">
              {ad.cta_label || 'View Offer'} <ChevronRight size={13} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function DailyScoreCard({ score, label, onClick }) {
  const pct = Math.min(Math.max(score || 0, 0), 100);
  return (
    <button onClick={onClick} className="w-full bg-card border border-border rounded-3xl px-5 py-4 hover:border-white/20 active:scale-[0.98] transition-all">
      <div className="flex items-center gap-3 text-left">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-muted/50 border border-border">
          <Trophy size={18} className="text-[#FBBF24]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading font-bold text-sm">Daily Score</p>
            <span className="text-xs bg-muted text-foreground border border-border px-2.5 py-1 rounded-full font-black">{pct}/100</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{label} • Tap to view today’s tracking</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-white/40 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
      </div>
    </button>
  );
}

function MetricCard({ icon, label, value, sub, percent, onClick, barColor }) {
  const pct = Math.min(Math.max(percent || 0, 0), 100);
  return (
    <button onClick={onClick} className="bg-card border border-border rounded-2xl py-3 px-2 flex flex-col items-center gap-2 hover:border-accent/30 active:scale-[0.97] transition-all w-full">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconTileClass}`}>
        <span className="text-white">{icon}</span>
      </div>
      <div className="text-center w-full px-1">
        <p className="text-sm font-bold font-heading leading-none">{value}</p>
        <p className="text-[10px] font-semibold text-foreground/80 mt-0.5">{label}</p>
        <p className="text-[9px] text-muted-foreground opacity-70">{sub}</p>
      </div>
      <div className="w-full px-2 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}
