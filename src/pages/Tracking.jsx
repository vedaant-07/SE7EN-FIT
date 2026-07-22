import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import UnifiedLiveTracker from '@/components/se7enfit/tracking/UnifiedLiveTracker';
import { getToday } from '@/lib/fitnessUtils';
import { Footprints, Flame, Droplets, Moon, Scale, Ruler, Dumbbell, Heart, CheckSquare, Smile, RefreshCw, Activity, Sparkles } from 'lucide-react';
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
  { key: 'steps', label: 'Steps', icon: Footprints, color: '#a855f7', component: StepsTab },
  { key: 'cardio', label: 'Cardio', icon: Heart, color: '#ef4444', component: CardioTab },
  { key: 'workout', label: 'Workout', icon: Dumbbell, color: 'hsl(var(--accent))', component: WorkoutPerfTab },
  { key: 'sleep', label: 'Sleep', icon: Moon, color: '#818cf8', component: SleepTab },
  { key: 'weight', label: 'Weight', icon: Scale, color: '#22c55e', component: WeightTab },
  { key: 'water', label: 'Water', icon: Droplets, color: '#3b82f6', component: WaterTab },
  { key: 'calories', label: 'Calories', icon: Flame, color: '#f59e0b', component: CaloriesTab },
  { key: 'measurements', label: 'Body', icon: Ruler, color: '#ec4899', component: MeasurementsTab },
  { key: 'habits', label: 'Habits', icon: CheckSquare, color: '#eab308', component: HabitsTab },
  { key: 'mood', label: 'Mood', icon: Smile, color: '#14b8a6', component: MoodTab },
];

const VALID_TABS = new Set(TABS.map((tab) => tab.key));
const safeArray = (value) => Array.isArray(value) ? value : [];

export default function Tracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMetric = searchParams.get('metric');
  const [activeTab, setActiveTab] = useState(VALID_TABS.has(requestedMetric) ? requestedMetric : 'steps');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todaySummary, setTodaySummary] = useState({});
  const [refreshToken, setRefreshToken] = useState(0);
  const tabBarRef = useRef(null);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (VALID_TABS.has(requestedMetric) && requestedMetric !== activeTab) setActiveTab(requestedMetric);
  }, [requestedMetric]);

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

  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearchParams({ metric: key }, { replace: true });
    window.requestAnimationFrame(() => {
      document.getElementById(`tab-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  };

  const handleLiveSaved = () => {
    setRefreshToken((value) => value + 1);
    loadData({ background: true });
  };

  if (loading) return <LoadingScreen />;

  const activeDefinition = TABS.find((tab) => tab.key === activeTab) || TABS[0];
  const ActiveComponent = activeDefinition.component;
  const stepGoal = Number(profile?.daily_step_goal || 8000);
  const stepPercent = Math.min(100, Math.round((Number(todaySummary.steps || 0) / stepGoal) * 100));

  const hasSummary = (key) => {
    if (key === 'steps') return todaySummary.steps > 0;
    if (key === 'water') return todaySummary.water > 0;
    if (key === 'sleep') return todaySummary.sleep > 0;
    if (key === 'weight') return Boolean(todaySummary.weight);
    if (key === 'workout') return todaySummary.workout;
    if (key === 'cardio') return todaySummary.cardio > 0;
    return false;
  };

  return (
    <>
      <TopBar title="Health" />

      <main className="px-4 pb-4 pt-4">
        <section className="mb-4 overflow-hidden rounded-[28px] border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><Sparkles size={15} className="text-accent" /><p className="text-xs font-bold text-foreground">Today at a glance</p></div>
              <p className="mt-1 text-[11px] text-muted-foreground">Your latest movement and recovery signals</p>
            </div>
            <div className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[10px] font-black text-accent">{stepPercent}% steps</div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { value: Number(todaySummary.steps || 0).toLocaleString(), label: 'Steps' },
              { value: `${Number(todaySummary.cardio || 0)}m`, label: 'Cardio' },
              { value: todaySummary.workout ? 'Done' : '—', label: 'Workout' },
              { value: todaySummary.sleep ? `${todaySummary.sleep}h` : '—', label: 'Sleep' },
            ].map((item) => (
              <div key={item.label} className="min-w-0 rounded-2xl bg-background/65 px-1.5 py-3 text-center">
                <p className="truncate font-heading text-sm font-black">{item.value}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <UnifiedLiveTracker profile={profile} onSaved={handleLiveSaved} />

        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button onClick={() => loadData()} variant="outline" size="sm" className="mt-3 h-9 rounded-xl"><RefreshCw size={14} className="mr-2" /> Try again</Button>
          </div>
        )}
      </main>

      <div className="sticky top-14 z-30 border-y border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 pt-3"><div><p className="text-xs font-bold">Explore your metrics</p><p className="text-[10px] text-muted-foreground">Log, review, and improve</p></div><Activity size={16} className="text-accent" /></div>
        <div ref={tabBarRef} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto px-2 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} id={`tab-${tab.key}`} type="button" onClick={() => handleTabChange(tab.key)} aria-selected={active}
                className={`relative flex w-[20%] min-w-[20%] snap-start flex-col items-center gap-1 rounded-2xl px-0 py-2 transition-all active:scale-95 ${active ? 'bg-card text-foreground' : 'text-muted-foreground'}`}>
                <div className="relative flex h-8 w-10 items-center justify-center rounded-xl">
                  <Icon size={20} style={{ color: active ? tab.color : undefined }} />
                  {hasSummary(tab.key) && !active && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />}
                </div>
                <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-4 pb-28">
        <ActiveComponent profile={profile} refreshToken={refreshToken} />
      </div>

      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
}
