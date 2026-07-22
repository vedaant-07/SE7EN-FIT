import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44, normalizeRole } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Camera,
  ChevronRight,
  Crown,
  Dumbbell,
  Footprints,
  HeartPulse,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  Users,
  Zap,
} from 'lucide-react';
import {
  calculateBMR,
  calculateCalorieTarget,
  calculateFitnessScore,
  calculateProteinTarget,
  calculateTDEE,
  getActivityLevel,
  getGreeting,
  getLocalDateKey,
  getToday,
} from '@/lib/fitnessUtils';

const safeArray = (value) => Array.isArray(value) ? value : [];
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function shiftDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

function makeDailyRows(start, count, collections) {
  return Array.from({ length: count }, (_, index) => {
    const date = shiftDateKey(start, index);
    const byDay = (rows) => safeArray(rows).filter((row) => row.date === date);
    const steps = byDay(collections.steps);
    const water = byDay(collections.water);
    const sleep = byDay(collections.sleep);
    const workouts = byDay(collections.workouts).filter((row) => row.completed !== false);
    const cardio = byDay(collections.cardio);
    const nutrition = byDay(collections.nutrition);
    return {
      date,
      steps: steps.reduce((sum, row) => sum + number(row.steps), 0),
      water_ml: water.reduce((sum, row) => sum + number(row.amount_ml), 0),
      sleep_hours: sleep.reduce((max, row) => Math.max(max, number(row.hours)), 0),
      workout_count: workouts.length,
      cardio_minutes: cardio.reduce((sum, row) => sum + number(row.duration_minutes), 0),
      active_calories: [...workouts, ...cardio].reduce((sum, row) => sum + number(row.calories_burned), 0),
      nutrition_calories: nutrition.reduce((sum, row) => sum + number(row.calories), 0),
      protein_g: nutrition.reduce((sum, row) => sum + number(row.protein_g), 0),
    };
  });
}

async function loadLegacyDashboard(user, date) {
  const rangeStart = shiftDateKey(date, -13);
  const [profiles, subscriptions, steps, water, sleep, workouts, cardio, nutrition, weights] = await Promise.all([
    base44.entities.UserProfile.filter({ user_id: user.id }),
    base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }),
    base44.entities.StepLog.filter({ user_id: user.id }, '-date', 100),
    base44.entities.WaterLog.filter({ user_id: user.id }, '-date', 100),
    base44.entities.SleepLog.filter({ user_id: user.id }, '-date', 30),
    base44.entities.WorkoutLog.filter({ user_id: user.id }, '-date', 60),
    base44.entities.CardioLog.filter({ user_id: user.id }, '-date', 60),
    base44.entities.NutritionLog.filter({ user_id: user.id }, '-date', 120),
    base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 10),
  ]);
  const inRange = (rows) => safeArray(rows).filter((row) => row.date >= rangeStart && row.date <= date);
  const daily = makeDailyRows(rangeStart, 14, {
    steps: inRange(steps), water: inRange(water), sleep: inRange(sleep), workouts: inRange(workouts), cardio: inRange(cardio), nutrition: inRange(nutrition),
  });
  const week = daily.slice(-7);
  const previousWeek = daily.slice(0, 7);
  const average = (rows, key) => Math.round(rows.reduce((sum, row) => sum + number(row[key]), 0) / Math.max(1, rows.length));
  const currentAverageSteps = average(week, 'steps');
  const previousAverageSteps = average(previousWeek, 'steps');
  const sleepDays = week.filter((row) => row.sleep_hours > 0);
  return {
    date,
    profile: profiles[0] || null,
    subscription: subscriptions[0] || null,
    membership: null,
    attendance: null,
    today: week[6],
    week,
    previous_week: previousWeek,
    performance: {
      average_steps: currentAverageSteps,
      step_change_percent: previousAverageSteps ? Math.round(((currentAverageSteps - previousAverageSteps) / previousAverageSteps) * 100) : null,
      workouts: week.reduce((sum, row) => sum + row.workout_count, 0),
      cardio_minutes: week.reduce((sum, row) => sum + row.cardio_minutes, 0),
      active_days: week.filter((row) => row.steps > 0 || row.workout_count > 0 || row.cardio_minutes > 0).length,
      average_sleep_hours: sleepDays.length ? Number((sleepDays.reduce((sum, row) => sum + row.sleep_hours, 0) / sleepDays.length).toFixed(1)) : 0,
    },
    weight: weights[0] || null,
  };
}

const isVideoAd = (ad) => {
  const type = String(ad?.media_type || ad?.type || '').toLowerCase();
  const url = String(ad?.media_url || ad?.video_url || '').toLowerCase();
  return type === 'video' || /\.(mp4|webm|mov)(\?|$)/.test(url);
};

const isAdActive = (ad) => {
  const status = String(ad?.status || 'active').toLowerCase();
  if (!['active', 'published', 'approved', 'live'].includes(status)) return false;
  const now = Date.now();
  const start = ad.start_at || ad.start_date;
  const end = ad.end_at || ad.end_date;
  return (!start || Date.parse(start) <= now) && (!end || Date.parse(end) >= now);
};

const shouldShowAdToUser = (ad, membership) => {
  const scope = String(ad.target_scope || ad.audience || 'all').toLowerCase();
  if (scope === 'all' || scope === 'everyone' || ad.show_to_all) return true;
  const targetGymId = ad.gym_id || ad.target_gym_id || ad.owner_gym_id;
  return Boolean(membership?.gym_id && targetGymId && String(membership.gym_id) === String(targetGymId));
};

export default function Home() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const today = getToday();

  const loadData = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      if (normalizeRole(user.role) === 'gym_owner') {
        navigate('/gym-owner/dashboard', { replace: true });
        return;
      }

      let performance;
      try {
        performance = await base44.dashboard.getPerformance(today);
      } catch (requestError) {
        if (requestError?.status !== 404) throw requestError;
        performance = await loadLegacyDashboard(user, today);
      }

      if (!performance?.profile) {
        navigate('/onboarding', { replace: true });
        return;
      }

      setDashboard(performance);
      const rawAds = await base44.entities.Advertisement.list('-created_date', 20).catch(() => []);
      setAds(safeArray(rawAds).filter((ad) => isAdActive(ad) && shouldShowAdToUser(ad, performance.membership)));
    } catch (requestError) {
      console.error('[Home] Dashboard load failed:', requestError);
      if (requestError?.status === 401) navigate('/welcome', { replace: true });
      else setError('Your dashboard could not refresh. Your saved data is safe—check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <LoadingScreen />;
  if (!dashboard && error) return <DashboardError message={error} onRetry={() => loadData()} />;
  if (!dashboard) return null;

  const profile = dashboard.profile || {};
  const current = dashboard.today || {};
  const week = safeArray(dashboard.week);
  const performance = dashboard.performance || {};
  const membership = dashboard.membership;
  const attendance = dashboard.attendance;
  const subscription = dashboard.subscription;
  const firstName = String(profile.full_name || profile.name || 'Athlete').trim().split(/\s+/)[0];
  const stepGoal = number(profile.daily_step_goal, 8000);
  const waterGoal = number(profile.daily_water_goal_ml, 2500);
  const workoutGoal = Math.max(1, number(profile.workout_days_per_week, 4));
  const currentWeight = number(dashboard.weight?.weight_kg ?? profile.weight_kg, 0);
  const targetWeight = number(profile.target_weight_kg, 0);
  const bmr = calculateBMR(number(profile.weight_kg, 70), number(profile.height_cm, 170), number(profile.age, 25), profile.gender || 'male');
  const tdee = calculateTDEE(bmr, getActivityLevel(workoutGoal));
  const calorieTarget = calculateCalorieTarget(tdee, profile.goal);
  const proteinTarget = calculateProteinTarget(number(profile.weight_kg, 70), profile.goal);
  const score = calculateFitnessScore({
    workoutDone: number(current.workout_count) > 0,
    stepsPercent: (number(current.steps) / stepGoal) * 100,
    waterPercent: (number(current.water_ml) / waterGoal) * 100,
    caloriesOnTrack: number(current.nutrition_calories) > 0 && number(current.nutrition_calories) <= calorieTarget * 1.1,
    sleepHours: number(current.sleep_hours),
    proteinOnTrack: number(current.protein_g) >= proteinTarget * 0.8,
  });
  const isPremium = Boolean(subscription && String(subscription.plan || subscription.plan_code || 'free') !== 'free');
  const nextAction = getNextAction({ current, stepGoal, currentWeight });
  const remainingWeight = currentWeight && targetWeight ? Math.abs(currentWeight - targetWeight) : null;
  const maxWeekSteps = Math.max(stepGoal, ...week.map((day) => number(day.steps)));

  return (
    <>
      <TopBar />
      <main className="space-y-5 px-4 pb-8 pt-4">
        <header className="flex items-start justify-between gap-4 px-0.5">
          <div><p className="text-xs font-semibold text-accent">{getGreeting()}</p><h1 className="mt-0.5 font-heading text-2xl font-black tracking-tight">Ready, {firstName}?</h1><p className="mt-1 text-xs text-muted-foreground">{new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
          <button type="button" onClick={() => loadData({ background: true })} disabled={refreshing} aria-label="Refresh dashboard" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-all active:scale-95 disabled:opacity-60"><RefreshCw size={16} className={refreshing ? 'animate-spin text-accent' : ''} /></button>
        </header>

        {error && <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-200">{error}</div>}

        <PerformanceHero score={score} current={current} performance={performance} nextAction={nextAction} onAction={() => navigate(nextAction.route)} />

        <section>
          <SectionHeading title="Progress & performance" subtitle="What is moving you toward your goal" action="Full progress" onAction={() => navigate('/progress')} />
          <div className="grid grid-cols-2 gap-2.5">
            <PerformanceTile icon={Footprints} label="Steps" value={`${Math.min(100, Math.round(number(current.steps) / stepGoal * 100))}%`} detail={`${number(current.steps).toLocaleString()} of ${stepGoal.toLocaleString()}`} color="purple" onClick={() => navigate('/tracking?metric=steps')} />
            <PerformanceTile icon={Dumbbell} label="Weekly training" value={`${number(performance.workouts)}/${workoutGoal}`} detail={`${number(performance.cardio_minutes)} cardio min`} color="green" onClick={() => navigate('/tracking?metric=workout')} />
            <PerformanceTile icon={Moon} label="Recovery" value={number(current.sleep_hours) ? `${number(current.sleep_hours)}h` : 'Log sleep'} detail={`7-day avg ${number(performance.average_sleep_hours).toFixed(1)}h`} color="blue" onClick={() => navigate('/tracking?metric=sleep')} />
            <PerformanceTile icon={Target} label="Body goal" value={remainingWeight !== null ? `${remainingWeight.toFixed(1)} kg` : 'Set target'} detail={remainingWeight !== null ? `remaining to ${targetWeight} kg` : 'Add weight & target'} color="orange" onClick={() => navigate('/progress')} />
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-heading text-sm font-bold">This week</p><p className="mt-0.5 text-[11px] text-muted-foreground">Consistency beats a perfect day</p></div>{performance.step_change_percent !== null && performance.step_change_percent !== undefined && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${number(performance.step_change_percent) >= 0 ? 'bg-accent/10 text-accent' : 'bg-orange-400/10 text-orange-300'}`}>{number(performance.step_change_percent) >= 0 ? '+' : ''}{number(performance.step_change_percent)}% steps</span>}</div>
          <div className="mt-5 flex h-28 items-end gap-2" aria-label="Seven day steps chart">
            {week.map((day, index) => {
              const height = Math.max(6, Math.round(number(day.steps) / maxWeekSteps * 100));
              const isToday = index === week.length - 1;
              return <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="relative flex h-full w-full items-end justify-center rounded-xl bg-background/60 px-1"><div className={`w-full rounded-lg transition-all duration-700 ${isToday ? 'bg-accent' : 'bg-white/15'}`} style={{ height: `${height}%` }} /></div><span className={`text-[9px] font-semibold ${isToday ? 'text-accent' : 'text-muted-foreground'}`}>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'narrow' })}</span></div>;
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-2xl bg-background/55 py-3 text-center">
            <WeeklyStat value={number(performance.active_days)} label="Active days" />
            <WeeklyStat value={number(performance.average_steps).toLocaleString()} label="Avg steps" />
            <WeeklyStat value={`${number(performance.cardio_minutes)}m`} label="Cardio" />
          </div>
        </section>

        <section>
          <SectionHeading title="Quick log" subtitle="The actions you use most" />
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Dumbbell, label: 'Workout', route: '/workout/log', tone: 'bg-accent/10 text-accent' },
              { icon: Utensils, label: 'Meal', route: '/nutrition/log', tone: 'bg-orange-400/10 text-orange-300' },
              { icon: Activity, label: 'Activity', route: '/tracking', tone: 'bg-purple-400/10 text-purple-300' },
              { icon: Camera, label: 'Food scan', route: '/food-scan', tone: 'bg-blue-400/10 text-blue-300' },
            ].map(({ icon: Icon, label, route, tone }) => (
              <button key={label} type="button" onClick={() => navigate(route)} className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card px-1 py-3.5 text-center transition-all active:scale-[0.97]">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span><span className="max-w-full truncate text-[10px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {membership && <GymStatusCard membership={membership} attendance={attendance} onClick={() => navigate('/my-gym')} />}

        {ads.length > 0 && <AdBanners ads={ads} />}

        {!isPremium && (
          <Link to="/subscription" className="block rounded-[28px] border border-yellow-500/25 bg-gradient-to-br from-yellow-500/12 via-card to-card p-5 transition-all active:scale-[0.99]">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300"><Crown size={20} /></span><div className="min-w-0 flex-1"><p className="font-heading text-sm font-bold">Unlock your complete plan</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Advanced analytics, personalized AI coaching, and deeper reports.</p></div><ChevronRight size={16} className="shrink-0 text-muted-foreground" /></div>
          </Link>
        )}

        <section>
          <SectionHeading title="Explore SE7EN FIT" subtitle="Community, rewards, gym, and competition" />
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Community', detail: 'Share and learn', icon: Users, route: '/community' },
              { label: 'Challenges', detail: 'Build consistency', icon: Zap, route: '/challenges' },
              { label: 'Leaderboard', detail: 'See your rank', icon: Trophy, route: '/leaderboard' },
              { label: 'My Gym', detail: membership?.gyms?.name || membership?.gym?.name || 'Connect your gym', icon: Building2, route: '/my-gym' },
            ].map(({ label, detail, icon: Icon, route }) => (
              <button key={label} type="button" onClick={() => navigate(route)} className="rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.98]"><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground"><Icon size={17} /></span><p className="font-heading text-sm font-bold">{label}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p></button>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function getNextAction({ current, stepGoal, currentWeight }) {
  if (!number(current.workout_count)) return { eyebrow: 'Best next action', title: 'Complete today’s workout', detail: 'A focused session will have the biggest impact on your score.', route: '/workout', icon: Dumbbell };
  if (number(current.steps) < stepGoal * 0.65) return { eyebrow: 'Keep momentum', title: 'Start a short walk', detail: `${Math.max(0, stepGoal - number(current.steps)).toLocaleString()} steps remain today.`, route: '/tracking', icon: Footprints };
  if (number(current.sleep_hours) < 7) return { eyebrow: 'Recovery check', title: 'Log last night’s sleep', detail: 'Recovery data helps make your training guidance more useful.', route: '/tracking?metric=sleep', icon: Moon };
  if (!currentWeight) return { eyebrow: 'Complete your baseline', title: 'Log your current weight', detail: 'A baseline makes body-goal progress measurable.', route: '/progress', icon: Scale };
  return { eyebrow: 'Strong day', title: 'Review your weekly progress', detail: 'See what improved and choose your next focus.', route: '/progress', icon: BarChart3 };
}

function PerformanceHero({ score, current, performance, nextAction, onAction }) {
  const Icon = nextAction.icon;
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Strong' : score >= 35 ? 'Building' : 'Start here';
  return (
    <section className="overflow-hidden rounded-[30px] border border-accent/20 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_42%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--background)))] p-5">
      <div className="flex items-center gap-4">
        <ProgressRing percent={score} size={104} strokeWidth={8} color="hsl(var(--accent))"><div className="text-center"><p className="font-heading text-2xl font-black leading-none">{score}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Score</p></div></ProgressRing>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent"><Sparkles size={12} /> Today’s performance</div><h2 className="mt-1 font-heading text-2xl font-black">{scoreLabel}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">A balanced view of movement, training, recovery, and consistency.</p></div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <HeroStat value={number(performance.active_days)} label="Active days" />
        <HeroStat value={number(current.steps).toLocaleString()} label="Steps today" />
        <HeroStat value={`${number(performance.cardio_minutes)}m`} label="Cardio week" />
      </div>
      <button type="button" onClick={onAction} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 text-left transition-all hover:bg-white/[0.09] active:scale-[0.99]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-[9px] font-bold uppercase tracking-[0.13em] text-accent">{nextAction.eyebrow}</span><span className="mt-0.5 line-clamp-2 block text-sm font-bold leading-tight">{nextAction.title}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{nextAction.detail}</span></span><ArrowRight size={16} className="shrink-0 text-muted-foreground" /></button>
    </section>
  );
}

function HeroStat({ value, label }) {
  return <div className="rounded-2xl bg-background/55 px-2 py-3 text-center"><p className="font-heading text-sm font-black">{value}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p></div>;
}

function SectionHeading({ title, subtitle, action, onAction }) {
  return <div className="mb-3 flex items-end justify-between gap-3 px-0.5"><div><h2 className="font-heading text-sm font-bold">{title}</h2>{subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}</div>{action && <button type="button" onClick={onAction} className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-accent">{action}<ArrowUpRight size={12} /></button>}</div>;
}

function PerformanceTile({ icon: Icon, label, value, detail, color, onClick }) {
  const tones = { green: 'bg-accent/10 text-accent', purple: 'bg-purple-400/10 text-purple-300', blue: 'bg-blue-400/10 text-blue-300', orange: 'bg-orange-400/10 text-orange-300' };
  return <button type="button" onClick={onClick} className="min-h-[138px] rounded-[24px] border border-border bg-card p-4 text-left transition-all hover:border-white/20 active:scale-[0.98]"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[color]}`}><Icon size={17} /></span><p className="mt-3 text-[10px] font-semibold text-muted-foreground">{label}</p><p className="mt-0.5 font-heading text-xl font-black">{value}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p></button>;
}

function WeeklyStat({ value, label }) {
  return <div className="px-1"><p className="font-heading text-sm font-black">{value}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p></div>;
}

function GymStatusCard({ membership, attendance, onClick }) {
  const gym = membership.gyms || membership.gym || {};
  const checkedIn = attendance?.status === 'checked_in';
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-[24px] border p-4 text-left transition-all active:scale-[0.99] ${checkedIn ? 'border-accent/30 bg-accent/10' : 'border-border bg-card'}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${checkedIn ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground'}`}>{checkedIn ? <LogOut size={19} /> : <LogIn size={19} />}</span><span className="min-w-0 flex-1"><span className="block truncate font-heading text-sm font-bold">{gym.name || gym.gym_name || 'My Gym'}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{checkedIn ? 'You are checked in — tap when your session is done' : attendance?.status === 'checked_out' ? `Session complete · ${attendance.duration_minutes || 0} min` : 'Membership active · tap to check in'}</span></span><ChevronRight size={16} className="shrink-0 text-muted-foreground" /></button>;
}

function AdBanners({ ads }) {
  return <section><SectionHeading title="Offers for you" subtitle="Relevant SE7EN FIT and gym partner promotions" /><div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">{ads.map((ad) => <AdCard key={ad.id || ad.ad_id || ad.title} ad={ad} />)}</div></section>;
}

function AdCard({ ad }) {
  const mediaUrl = ad.media_url || ad.image_url || ad.video_url || '';
  const handleClick = () => { if (ad.cta_url) window.open(ad.cta_url, '_blank', 'noopener,noreferrer'); };
  return (
    <button type="button" onClick={handleClick} className="relative min-h-[176px] w-[88%] shrink-0 snap-start overflow-hidden rounded-[26px] border border-border bg-card text-left transition-all active:scale-[0.99]">
      {mediaUrl && isVideoAd(ad) && <video src={mediaUrl} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: ad.media_crop || 'center' }} muted loop playsInline autoPlay preload="metadata" />}
      {mediaUrl && !isVideoAd(ad) && <img src={mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: ad.media_crop || 'center' }} loading="lazy" decoding="async" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
      <div className="relative z-10 flex min-h-[176px] flex-col justify-between p-4"><span className="w-fit rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">{ad.offer_text || ad.source_name || 'Featured'}</span><div><p className="line-clamp-2 font-heading text-xl font-black leading-tight text-white">{ad.title}</p>{ad.description && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/75">{ad.description}</p>}<span className="mt-3 inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-black">{ad.cta_label || 'View offer'}<ChevronRight size={12} /></span></div></div>
    </button>
  );
}

function DashboardError({ message, onRetry }) {
  return <><TopBar /><div className="flex min-h-[70vh] items-center justify-center px-5"><div className="w-full max-w-sm rounded-[28px] border border-border bg-card p-6 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-400/10 text-orange-300"><HeartPulse size={22} /></span><h1 className="mt-4 font-heading text-lg font-bold">Dashboard unavailable</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p><button type="button" onClick={onRetry} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-bold text-accent-foreground"><RefreshCw size={15} /> Try again</button></div></div></>;
}
