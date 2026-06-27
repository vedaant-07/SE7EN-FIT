import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { getToday } from '@/lib/fitnessUtils';
import { Footprints, Flame, Droplets, Moon, Scale, Ruler, Dumbbell, Heart, CheckSquare, Smile, RefreshCw } from 'lucide-react';
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
  { key: 'steps',       label: 'Steps',       icon: Footprints,  color: '#a855f7',                  component: StepsTab },
  { key: 'calories',    label: 'Calories',     icon: Flame,       color: 'hsl(var(--accent))',       component: CaloriesTab },
  { key: 'water',       label: 'Water',        icon: Droplets,    color: '#3b82f6',                  component: WaterTab },
  { key: 'sleep',       label: 'Sleep',        icon: Moon,        color: 'hsl(260,60%,55%)',         component: SleepTab },
  { key: 'weight',      label: 'Weight',       icon: Scale,       color: '#22c55e',                  component: WeightTab },
  { key: 'measurements',label: 'Measures',     icon: Ruler,       color: '#ec4899',                  component: MeasurementsTab },
  { key: 'workout',     label: 'Workout',      icon: Dumbbell,    color: 'hsl(var(--accent))',       component: WorkoutPerfTab },
  { key: 'cardio',      label: 'Cardio',       icon: Heart,       color: '#ef4444',                  component: CardioTab },
  { key: 'habits',      label: 'Habits',       icon: CheckSquare, color: '#eab308',                  component: HabitsTab },
  { key: 'mood',        label: 'Mood',         icon: Smile,       color: '#14b8a6',                  component: MoodTab },
];

const safeArray = (value) => Array.isArray(value) ? value : [];
const tabBarStyle = { gridAutoColumns: '20%' };
const tabButtonStyle = { width: 'calc(100% - 6px)' };

export default function Tracking() {
  const [activeTab, setActiveTab] = useState('steps');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todaySummary, setTodaySummary] = useState({});
  const tabBarRef = useRef(null);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const user = await base44.auth.me();
      const [profilesRaw, waterRaw, stepsRaw, sleepRaw, weightRaw, workoutRaw] = await Promise.all([
        base44.entities.UserProfile.filter({ user_id: user.id }).catch(() => []),
        base44.entities.WaterLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.StepLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.SleepLog.filter({ user_id: user.id, date: today }).catch(() => []),
        base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 1).catch(() => []),
        base44.entities.WorkoutLog.filter({ user_id: user.id, date: today }).catch(() => []),
      ]);

      const profiles = safeArray(profilesRaw);
      const water = safeArray(waterRaw);
      const steps = safeArray(stepsRaw);
      const sleep = safeArray(sleepRaw);
      const weight = safeArray(weightRaw);
      const workout = safeArray(workoutRaw);

      if (profiles.length) setProfile(profiles[0]);
      setTodaySummary({
        steps: steps.reduce((s, l) => s + Number(l.steps || 0), 0),
        water: water.reduce((s, l) => s + Number(l.amount_ml || 0), 0),
        sleep: Number(sleep[0]?.hours || 0),
        weight: weight[0]?.weight_kg || null,
        workout: workout.some(w => w.completed),
      });
    } catch (err) {
      console.error('[Tracking] Failed to load tracking data:', err);
      setError(err.message || 'Unable to load tracking data. Please try again.');
      setTodaySummary({});
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    const tabEl = document.getElementById(`tab-${key}`);
    if (tabEl && tabBarRef.current) tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  if (loading) return <LoadingScreen />;

  const ActiveComponent = TABS.find(t => t.key === activeTab)?.component;

  const hasSummary = (key) => {
    if (key === 'steps') return todaySummary.steps > 0;
    if (key === 'water') return todaySummary.water > 0;
    if (key === 'sleep') return todaySummary.sleep > 0;
    if (key === 'weight') return !!todaySummary.weight;
    if (key === 'workout') return todaySummary.workout;
    return false;
  };

  return (
    <>
      <TopBar title="Tracking" showBack />

      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div ref={tabBarRef} style={tabBarStyle} className="grid grid-flow-col px-0 py-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            const hasData = hasSummary(tab.key);
            return (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                onClick={() => handleTabChange(tab.key)}
                style={tabButtonStyle}
                className={`snap-start justify-self-center min-w-0 flex flex-col items-center gap-1 px-0 py-1.5 rounded-2xl transition-all active:scale-95 ${
                  active ? 'bg-accent/15 border border-accent/30' : 'hover:bg-muted/60 border border-transparent'
                }`}
              >
                <div className="relative w-11 h-9 rounded-xl flex items-center justify-center">
                  <Icon size={22} style={{ color: active ? tab.color : undefined }} className={active ? '' : 'text-muted-foreground'} />
                  {hasData && !active && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />}
                </div>
                <span className={`max-w-full overflow-hidden text-ellipsis text-[10px] font-semibold whitespace-nowrap leading-tight ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{error}</p>
          <Button onClick={loadData} variant="outline" size="sm" className="mt-3 h-9 rounded-lg">
            <RefreshCw size={14} className="mr-2" /> Retry
          </Button>
        </div>
      )}

      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <span className="text-[11px] text-muted-foreground font-medium">Today:</span>
          <div className="flex gap-1.5 flex-wrap">
            {todaySummary.steps > 0 && <span className="text-[10px] bg-purple-400/15 text-purple-400 px-1.5 py-0.5 rounded-full">🚶 {todaySummary.steps.toLocaleString()}</span>}
            {todaySummary.water > 0 && <span className="text-[10px] bg-blue-400/15 text-blue-400 px-1.5 py-0.5 rounded-full">💧 {todaySummary.water}ml</span>}
            {todaySummary.sleep > 0 && <span className="text-[10px] bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded-full">😴 {todaySummary.sleep}h</span>}
            {todaySummary.workout && <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">💪 Done</span>}
            {!todaySummary.steps && !todaySummary.water && !todaySummary.sleep && !todaySummary.workout && (
              <span className="text-[11px] text-muted-foreground">Start logging to see your stats →</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 pb-28">
        {ActiveComponent && <ActiveComponent profile={profile} />}
      </div>

      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </>
  );
}
