import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { getGreeting, getToday, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget, getActivityLevel, calculateFitnessScore, GOALS_LABELS } from '@/lib/fitnessUtils';
import { Flame, Droplets, Footprints, Moon, Dumbbell, Bot, Camera, Scale, Utensils, Trophy, TrendingUp, Zap, ChevronRight, Crown, Activity, Heart, Building2, LogIn, LogOut } from 'lucide-react';
import AIDailyTip from '@/components/se7enfit/AIDailyTip';
import DailyHabits from '@/components/se7enfit/DailyHabits';

export default function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState({ calories: 0, protein: 0, water: 0, steps: 0, sleep: 0, workoutDone: false });
  const [gymStatus, setGymStatus] = useState({ gym: null, todayLog: null });
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    // Redirect gym owners to their dashboard
    const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
    if (owners.length > 0) {
      navigate(owners[0].onboarding_complete ? '/gym-owner/dashboard' : '/gym-owner/onboarding', { replace: true });
      return;
    }
    const [profiles, subs] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }),
    ]);
    if (!profiles.length) { navigate('/onboarding'); return; }
    const p = profiles[0];
    setProfile(p);
    setSubscription(subs[0] || null);

    // Load gym check-in status
    if (p.primary_gym_id) {
      try {
        const [gymOwners, attLogs] = await Promise.all([
          base44.entities.GymOwner.list(),
          base44.entities.GymAttendanceLog.filter({ user_id: user.id, gym_id: p.primary_gym_id, date: today }),
        ]);
        const gymOwner = gymOwners.find(o => o.id === p.primary_gym_id);
        setGymStatus({ gym: gymOwner || null, todayLog: attLogs[0] || null });
      } catch {}
    }

    const [nutritionLogs, waterLogs, stepLogs, sleepLogs, workoutLogs] = await Promise.all([
      base44.entities.NutritionLog.filter({ user_id: user.id, date: today }),
      base44.entities.WaterLog.filter({ user_id: user.id, date: today }),
      base44.entities.StepLog.filter({ user_id: user.id, date: today }),
      base44.entities.SleepLog.filter({ user_id: user.id, date: today }),
      base44.entities.WorkoutLog.filter({ user_id: user.id, date: today }),
    ]);

    setTodayData({
      calories: nutritionLogs.reduce((s, n) => s + (n.calories || 0), 0),
      protein: nutritionLogs.reduce((s, n) => s + (n.protein_g || 0), 0),
      water: waterLogs.reduce((s, w) => s + (w.amount_ml || 0), 0),
      steps: stepLogs.reduce((s, st) => s + (st.steps || 0), 0),
      sleep: sleepLogs[0]?.hours || 0,
      workoutDone: workoutLogs.some(w => w.completed),
    });
    setLoading(false);
  };

  if (loading) return <LoadingScreen />;
  if (!profile) return null;

  const bmr = calculateBMR(profile.weight_kg, profile.height_cm, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, getActivityLevel(profile.workout_days_per_week));
  const calorieTarget = calculateCalorieTarget(tdee, profile.goal);
  const proteinTarget = calculateProteinTarget(profile.weight_kg, profile.goal);
  const waterGoal = profile.daily_water_goal_ml || 2500;
  const stepGoal = profile.daily_step_goal || 8000;

  const fitnessScore = calculateFitnessScore({
    workoutDone: todayData.workoutDone,
    stepsPercent: (todayData.steps / stepGoal) * 100,
    waterPercent: (todayData.water / waterGoal) * 100,
    caloriesOnTrack: todayData.calories > 0 && todayData.calories <= calorieTarget * 1.1,
    sleepHours: todayData.sleep,
    proteinOnTrack: todayData.protein >= proteinTarget * 0.8,
  });

  const scoreLabel = fitnessScore >= 80 ? 'Excellent 🔥' : fitnessScore >= 50 ? 'Good Progress 💪' : 'Let\'s Go! 🚀';
  const scoreColor = fitnessScore >= 80 ? 'text-green-400' : fitnessScore >= 50 ? 'text-yellow-400' : 'text-muted-foreground';
  const isPremium = subscription && subscription.plan !== 'free';

  const rings = [
    { label: 'Calories', percent: Math.min((todayData.calories / calorieTarget) * 100, 100), color: 'hsl(var(--accent))', route: '/nutrition' },
    { label: 'Water', percent: Math.min((todayData.water / waterGoal) * 100, 100), color: '#3b82f6', route: '/tracking/water' },
    { label: 'Steps', percent: Math.min((todayData.steps / stepGoal) * 100, 100), color: '#a855f7', route: '/tracking/steps' },
  ];

  return (
    <>
      <TopBar />
      <div className="px-4 pt-3 pb-6 space-y-5">

        {/* Header Greeting */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{getGreeting()} 👋</p>
            <h1 className="text-2xl font-heading font-bold mt-0.5 leading-tight">{profile.full_name || 'Champ'}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs bg-accent/15 text-accent px-2.5 py-0.5 rounded-full font-medium">{GOALS_LABELS[profile.goal] || 'Fitness'}</span>
              {isPremium && (
                <span className="text-xs bg-yellow-500/15 text-yellow-400 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Crown size={9} /> Premium
                </span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex flex-col items-center justify-center">
              <Flame size={16} className="text-accent" />
              <p className="text-xs font-bold font-heading text-accent">{profile.streak_days || 0}</p>
              <p className="text-[8px] text-muted-foreground">STREAK</p>
            </div>
          </div>
        </div>

        {/* Fitness Score Hero */}
        <div className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />
          <div className="flex items-center gap-5">
            <ProgressRing percent={fitnessScore} size={88} strokeWidth={7}>
              <div className="text-center">
                <p className="text-2xl font-bold font-heading leading-none">{fitnessScore}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Score</p>
              </div>
            </ProgressRing>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-accent uppercase tracking-widest font-extrabold mb-1">Today's Fitness</p>
              <p className="font-heading font-bold text-xl text-white">{scoreLabel}</p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {todayData.workoutDone && <Badge label="Workout ✓" />}
                {todayData.steps >= stepGoal && <Badge label="Steps ✓" />}
                {todayData.water >= waterGoal && <Badge label="Hydrated ✓" />}
                {todayData.sleep >= 7 && <Badge label="Sleep ✓" />}
              </div>
            </div>
          </div>

          {/* Activity rings row */}
          <div className="flex gap-3 mt-4 pt-4 border-t border-border/50">
            {rings.map(r => (
              <button key={r.label} onClick={() => navigate(r.route)} className="flex-1 flex flex-col items-center gap-2 active:scale-95 transition-all">
                <ProgressRing percent={r.percent} size={44} strokeWidth={4} color={r.color}>
                  <span className="text-[11px] font-bold">{Math.round(r.percent)}%</span>
                  </ProgressRing>
                   <span className="text-xs font-bold text-white">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <MetricCard
            icon={<Flame size={20} />} label="Calories"
            value={`${todayData.calories}`} sub={`/ ${calorieTarget} kcal`}
            percent={(todayData.calories / calorieTarget) * 100}
            onClick={() => navigate('/nutrition')}
            color="text-orange-400" barColor="bg-orange-400"
          />
          <MetricCard
            icon={<Zap size={20} />} label="Protein"
            value={`${todayData.protein}g`} sub={`/ ${proteinTarget}g`}
            percent={(todayData.protein / proteinTarget) * 100}
            onClick={() => navigate('/nutrition')}
            color="text-green-400" barColor="bg-green-400"
          />
          <MetricCard
            icon={<Droplets size={20} />} label="Water"
            value={`${Math.round(todayData.water / 250)}`} sub={`/ ${Math.round(waterGoal / 250)} glasses`}
            percent={(todayData.water / waterGoal) * 100}
            onClick={() => navigate('/tracking/water')}
            color="text-blue-400" barColor="bg-blue-400"
          />
          <MetricCard
            icon={<Footprints size={20} />} label="Steps"
            value={todayData.steps.toLocaleString()} sub={`/ ${stepGoal.toLocaleString()}`}
            percent={(todayData.steps / stepGoal) * 100}
            onClick={() => navigate('/tracking/steps')}
            color="text-purple-400" barColor="bg-purple-400"
          />
          <MetricCard
            icon={<Moon size={20} />} label="Sleep"
            value={`${todayData.sleep}h`} sub={`/ ${profile.sleep_goal_hours || 7}h goal`}
            percent={(todayData.sleep / (profile.sleep_goal_hours || 7)) * 100}
            onClick={() => navigate('/tracking/sleep')}
            color="text-indigo-400" barColor="bg-indigo-400"
          />
          <MetricCard
            icon={<Dumbbell size={20} />} label="Workout"
            value={todayData.workoutDone ? 'Done!' : 'Pending'}
            sub={todayData.workoutDone ? 'Great job 💪' : 'Tap to start'}
            percent={todayData.workoutDone ? 100 : 0}
            onClick={() => navigate('/workout')}
            color="text-accent" barColor="bg-accent"
          />
        </div>

        {/* Gym Check-in Card */}
        {gymStatus.gym && (
          <button onClick={() => navigate('/my-gym')}
            className={`w-full rounded-2xl p-4 flex items-center gap-3 border transition-all active:scale-[0.98] ${
              gymStatus.todayLog?.status === 'checked_in'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-card border-border hover:border-accent/30'
            }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              gymStatus.todayLog?.status === 'checked_in' ? 'bg-emerald-500/20' : 'bg-accent/10'
            }`}>
              {gymStatus.todayLog?.status === 'checked_in'
                ? <LogOut size={18} className="text-emerald-400" />
                : <LogIn size={18} className="text-accent" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">{gymStatus.gym.gym_name || 'My Gym'}</p>
              <p className="text-xs text-muted-foreground">
                {gymStatus.todayLog?.status === 'checked_in'
                  ? `Checked in at ${gymStatus.todayLog.check_in_time} — tap to check out`
                  : gymStatus.todayLog?.status === 'checked_out'
                  ? `✓ Session done — ${gymStatus.todayLog.duration_minutes || 0} min`
                  : 'Tap to check in to your gym'}
              </p>
            </div>
            <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
          </button>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="font-heading font-semibold text-sm mb-3 px-0.5">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: Dumbbell, label: 'Log Workout', route: '/workout/log', color: 'text-accent bg-accent/10' },
              { icon: Utensils, label: 'Log Meal', route: '/nutrition/log', color: 'text-orange-400 bg-orange-400/10' },
              { icon: Droplets, label: 'Add Water', route: '/tracking', color: 'text-blue-400 bg-blue-400/10' },
              { icon: Camera, label: 'Food Scan 🤖', route: '/food-scan', color: 'text-green-400 bg-green-400/10' },
              { icon: Building2, label: 'My Gym', route: '/my-gym', color: 'text-amber-400 bg-amber-400/10' },
              { icon: Scale, label: 'Progress', route: '/progress', color: 'text-purple-400 bg-purple-400/10' },
            ].map(({ icon: Icon, label, route, color }) => (
              <button key={route} onClick={() => navigate(route)}
                className="bg-card border border-border rounded-2xl py-3 px-2 flex flex-col items-center gap-2 hover:border-accent/30 active:scale-95 transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
                  <Icon size={22} />
                </div>
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Daily Habits */}
        <DailyHabits />

        {/* AI Daily Tip (Gemini-powered) */}
        <AIDailyTip profile={profile} />

        {/* AI Recommendation */}
        <Link to="/ai-trainer" className="block">
          <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-3xl px-5 py-5 hover:border-accent/40 transition-all active:scale-[0.98]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Bot size={19} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-heading font-semibold text-sm">AI Recommendation</p>
                  <span className="text-[9px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {profile.goal === 'weight_loss'
                    ? 'Maintain your calorie deficit today. High-protein meals + 30 min cardio = faster results! 🔥'
                    : profile.goal === 'muscle_gain'
                    ? 'Hit your protein target today — aim for 2g/kg bodyweight. Don\'t skip compound lifts! 💪'
                    : 'Consistency is your superpower. Every workout compounds your transformation! 🚀'}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </div>
        </Link>

        {/* Progress & Streak */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={14} className="text-yellow-400" />
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Streak</span>
            </div>
            <p className="text-2xl font-bold font-heading">{profile.streak_days || 0}</p>
            <p className="text-xs text-muted-foreground">days in a row</p>
          </div>
          <Link to="/progress">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 active:scale-[0.97] transition-all h-full">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-accent" />
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Weight</span>
              </div>
              <p className="text-2xl font-bold font-heading">{profile.weight_kg}<span className="text-sm font-normal text-muted-foreground"> kg</span></p>
              <p className="text-[11px] text-accent font-medium">Target: {profile.target_weight_kg} kg</p>
            </div>
          </Link>
        </div>

        {/* Premium upsell if free */}
        {!isPremium && (
          <Link to="/subscription" className="block">
            <div className="bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-yellow-500/5 border border-yellow-500/30 rounded-3xl px-5 py-5 hover:border-yellow-500/50 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <Crown size={19} className="text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="font-heading font-bold text-sm">Unlock Premium AI Trainer</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Personalized plans, advanced analytics & more</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </div>
          </Link>
        )}

        {/* Bottom links */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Community', icon: '👥', route: '/community' },
            { label: 'Rewards 🪙', icon: '🪙', route: '/rewards' },
            { label: 'Premium', icon: '⭐', route: '/subscription' },
          ].map(item => (
            <Link key={item.route} to={item.route}>
              <div className="bg-card border border-border rounded-2xl p-3.5 text-center hover:border-accent/30 active:scale-[0.97] transition-all">
                <span className="text-xl">{item.icon}</span>
                <p className="text-[10px] font-medium mt-1.5">{item.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function MetricCard({ icon, label, value, sub, percent, onClick, color, barColor }) {
  const pct = Math.min(Math.max(percent || 0, 0), 100);
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-2xl py-3 px-2 flex flex-col items-center gap-2 hover:border-accent/30 active:scale-[0.97] transition-all w-full"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`} style={{ background: 'color-mix(in srgb, currentColor 15%, transparent)' }}>
        <span className={color}>{icon}</span>
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

function Badge({ label }) {
  return (
    <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-medium">{label}</span>
  );
}