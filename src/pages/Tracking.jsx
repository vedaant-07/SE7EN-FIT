import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { getToday } from '@/lib/fitnessUtils';
import {
  Activity,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  LocateFixed,
  Moon,
  Play,
  RefreshCw,
  Ruler,
  Scale,
  Smile,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import StepsTab from '@/components/se7enfit/tracking/tabs/StepsTab';
import CaloriesTab from '@/components/se7enfit/tracking/tabs/CaloriesTab';
import WaterTab from '@/components/se7enfit/tracking/tabs/WaterTab';
import SleepTab from '@/components/se7enfit/tracking/tabs/SleepTab';
import WeightTab from '@/components/se7enfit/tracking/tabs/WeightTab';
import MeasurementsTab from '@/components/se7enfit/tracking/tabs/MeasurementsTab';
import WorkoutPerfTab from '@/components/se7enfit/tracking/tabs/WorkoutPerfTab';
import CardioTab from '@/components/se7enfit/tracking/tabs/CardioTab';
import HabitsTab from '@/components/se7enfit/tracking/tabs/HabitsTab';
import MoodTab from '@/components/se7enfit/tracking/tabs/MoodTab';

const TABS = [
  { key: 'steps', label: 'Steps', description: 'Movement and daily goal', icon: Footprints, color: '#a855f7', component: StepsTab },
  { key: 'workout', label: 'Workout', description: 'Training and consistency', icon: Dumbbell, color: 'hsl(var(--accent))', component: WorkoutPerfTab },
  { key: 'cardio', label: 'Cardio', description: 'Distance and active minutes', icon: Heart, color: '#ef4444', component: CardioTab },
  { key: 'sleep', label: 'Sleep', description: 'Rest and recovery', icon: Moon, color: '#818cf8', component: SleepTab },
  { key: 'weight', label: 'Weight', description: 'Body-weight trend', icon: Scale, color: '#22c55e', component: WeightTab },
  { key: 'water', label: 'Water', description: 'Daily hydration', icon: Droplets, color: '#3b82f6', component: WaterTab },
  { key: 'calories', label: 'Calories', description: 'Meals and energy intake', icon: Flame, color: '#f59e0b', component: CaloriesTab },
  { key: 'measurements', label: 'Body', description: 'Measurements and change', icon: Ruler, color: '#ec4899', component: MeasurementsTab },
  { key: 'habits', label: 'Habits', description: 'Daily routines', icon: CheckSquare, color: '#eab308', component: HabitsTab },
  { key: 'mood', label: 'Mood', description: 'Wellbeing check-in', icon: Smile, color: '#14b8a6', component: MoodTab },
];

const PRIMARY_KEYS = ['steps', 'workout', 'cardio', 'sleep'];
const SECONDARY_KEYS = ['weight', 'water', 'calories', 'measurements', 'habits', 'mood'];
const VALID_TABS = new Set(TABS.map((tab) => tab.key));
const safeArray = (value) => Array.isArray(value) ? value : [];

function MetricCard({ tab, active, summary, completed, compact = false, onClick }) {
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex w-full items-center gap-3 rounded-2xl border text-left transition-all duration-200 active:scale-[0.985] ${
        compact ? 'min-h-[74px] p-3' : 'min-h-[104px] p-4'
      } ${active ? 'border-accent/45 bg-accent/[0.08] shadow-[0_12px_30px_rgba(0,0,0,0.12)]' : 'border-border bg-card hover:border-border/90 hover:bg-card/80'}`}
    >
      <span
        className={`${compact ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl'} flex shrink-0 items-center justify-center`}
        style={{ backgroundColor: `${tab.color}18`, color: tab.color }}
      >
        <Icon size={compact ? 18 : 21} strokeWidth={2.1} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`${compact ? 'text-sm' : 'text-[15px]'} font-heading font-bold text-foreground`}>{tab.label}</span>
          {completed && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Data logged today" />}
        </span>
        <span className={`${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs'} block truncate font-medium text-muted-foreground`}>{summary || tab.description}</span>
      </span>

      <ChevronRight size={17} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${active ? 'text-accent' : 'text-muted-foreground'}`} />
    </button>
  );
}

export default function Tracking() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMetric = searchParams.get('metric');
  const [activeTab, setActiveTab] = useState(VALID_TABS.has(requestedMetric) ? requestedMetric : 'steps');
  const [showMore, setShowMore] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todaySummary, setTodaySummary] = useState({});
  const [refreshToken, setRefreshToken] = useState(0);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (VALID_TABS.has(requestedMetric) && requestedMetric !== activeTab) setActiveTab(requestedMetric);
  }, [requestedMetric, activeTab]);

  const loadData = async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      const [profilesRaw, snapshot] = await Promise.all([
        base44.entities.UserProfile.filter({ user_id: user.id }),
        base44.tracking.getToday(today),
      ]);
      const profiles = safeArray(profilesRaw);
      if (profiles.length) setProfile(profiles[0]);
      const steps = safeArray(snapshot?.steps);
      const water = safeArray(snapshot?.water);
      const sleep = safeArray(snapshot?.sleep);
      const weight = safeArray(snapshot?.weight);
      const workouts = safeArray(snapshot?.workout);
      const cardio = safeArray(snapshot?.cardio);
      setTodaySummary({
        steps: steps.reduce((sum, row) => sum + Number(row.steps || 0), 0),
        water: water.reduce((sum, row) => sum + Number(row.amount_ml || 0), 0),
        sleep: sleep.reduce((max, row) => Math.max(max, Number(row.hours || 0)), 0),
        weight: weight[0]?.weight_kg || null,
        workout: workouts.some((row) => row.completed !== false),
        cardio: cardio.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0),
      });
    } catch (err) {
      console.error('[Tracking] Failed to load tracking data:', err);
      setError('Your latest health data could not be loaded. Check your connection and try again.');
    } finally {
      if (!background) setLoading(false);
    }
  };

  const handleMetricOpen = (key) => {
    setActiveTab(key);
    setSearchParams({ metric: key }, { replace: true });
    window.requestAnimationFrame(() => {
      document.getElementById('metric-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (loading) return <LoadingScreen />;

  const activeDefinition = TABS.find((tab) => tab.key === activeTab) || TABS[0];
  const ActiveComponent = activeDefinition.component;
  const stepGoal = Number(profile?.daily_step_goal || 8000);
  const primaryTabs = PRIMARY_KEYS.map((key) => TABS.find((tab) => tab.key === key)).filter(Boolean);
  const secondaryTabs = SECONDARY_KEYS.map((key) => TABS.find((tab) => tab.key === key)).filter(Boolean);

  const hasSummary = (key) => {
    if (key === 'steps') return todaySummary.steps > 0;
    if (key === 'water') return todaySummary.water > 0;
    if (key === 'sleep') return todaySummary.sleep > 0;
    if (key === 'weight') return Boolean(todaySummary.weight);
    if (key === 'workout') return todaySummary.workout;
    if (key === 'cardio') return todaySummary.cardio > 0;
    return false;
  };

  const metricSummary = (key) => {
    if (key === 'steps') return `${Number(todaySummary.steps || 0).toLocaleString()} / ${stepGoal.toLocaleString()} steps`;
    if (key === 'cardio') return todaySummary.cardio ? `${todaySummary.cardio} active min today` : 'No cardio logged today';
    if (key === 'workout') return todaySummary.workout ? 'Training completed today' : 'No workout logged today';
    if (key === 'sleep') return todaySummary.sleep ? `${todaySummary.sleep} hours last logged` : 'Add your sleep';
    if (key === 'weight') return todaySummary.weight ? `${todaySummary.weight} kg last logged` : 'Add your weight';
    if (key === 'water') return todaySummary.water ? `${todaySummary.water.toLocaleString()} ml today` : 'Add water intake';
    return TABS.find((tab) => tab.key === key)?.description || 'Open metric';
  };

  return (
    <>
      <TopBar title="Tracking" />

      <main className="space-y-4 px-4 pb-28 pt-4">
        <section className="rounded-[28px] border border-border bg-card p-4 shadow-[0_16px_45px_rgba(0,0,0,0.12)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-accent">
                <Sparkles size={16} />
                <p className="text-xs font-bold uppercase tracking-[0.12em]">Health hub</p>
              </div>
              <h2 className="mt-1 font-heading text-xl font-black text-foreground">Explore metrics</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Your most useful health signals, organised by priority.</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Activity size={19} /></span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {primaryTabs.map((tab) => (
              <MetricCard
                key={tab.key}
                tab={tab}
                active={activeTab === tab.key}
                completed={hasSummary(tab.key)}
                summary={metricSummary(tab.key)}
                onClick={() => handleMetricOpen(tab.key)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            aria-expanded={showMore}
            className="mt-3 flex h-11 w-full items-center justify-between rounded-2xl border border-border bg-background/55 px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-background"
          >
            <span>More metrics</span>
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {secondaryTabs.length} options
              {showMore ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showMore && (
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {secondaryTabs.map((tab) => (
                <MetricCard
                  key={tab.key}
                  tab={tab}
                  compact
                  active={activeTab === tab.key}
                  completed={hasSummary(tab.key)}
                  summary={metricSummary(tab.key)}
                  onClick={() => handleMetricOpen(tab.key)}
                />
              ))}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => navigate('/tracking/live')}
          className="group flex w-full items-center gap-3 rounded-[24px] border border-accent/25 bg-gradient-to-r from-accent/[0.14] via-accent/[0.08] to-card p-4 text-left shadow-[0_14px_40px_rgba(0,0,0,0.12)] transition-all active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-[0_10px_28px_rgba(34,197,94,0.2)]">
            <LocateFixed size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-[15px] font-black text-foreground">Start live tracking</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">Walk, run, cycle or train with one focused recorder.</span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform group-hover:translate-x-0.5">
            <Play size={15} fill="currentColor" />
          </span>
        </button>

        {error && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button onClick={() => loadData()} variant="outline" size="sm" className="mt-3 h-9 rounded-xl"><RefreshCw size={14} className="mr-2" /> Try again</Button>
          </div>
        )}

        <section id="metric-detail" className="scroll-mt-20">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${activeDefinition.color}18`, color: activeDefinition.color }}>
                <activeDefinition.icon size={17} />
              </span>
              <div className="min-w-0">
                <h2 className="font-heading text-base font-black text-foreground">{activeDefinition.label}</h2>
                <p className="truncate text-xs text-muted-foreground">{activeDefinition.description}</p>
              </div>
            </div>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Today</span>
          </div>

          <ActiveComponent profile={profile} refreshToken={refreshToken} onSaved={() => setRefreshToken((value) => value + 1)} />
        </section>
      </main>
    </>
  );
}
