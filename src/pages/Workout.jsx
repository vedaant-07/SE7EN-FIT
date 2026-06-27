import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Library, ChevronRight, Flame, Clock, Zap, Brain } from 'lucide-react';
import { getToday, GOALS_LABELS } from '@/lib/fitnessUtils';
import AIWorkoutGenerator from '@/components/se7enfit/AIWorkoutGenerator';
import { getNextWorkoutSuggestion } from '@/lib/workoutMemory';

const PLAN_TEMPLATES = [
  { key: 'push_pull_legs', label: 'Push Pull Legs', emoji: '💪', desc: '3-day split, intermediate' },
  { key: 'full_body', label: 'Full Body', emoji: '🏋️', desc: '3x/week, all levels' },
  { key: 'upper_lower', label: 'Upper / Lower', emoji: '⬆️', desc: '4-day split, intermediate' },
  { key: 'bro_split', label: 'Bro Split', emoji: '🔥', desc: '5-day split, advanced' },
  { key: 'weight_loss', label: 'Weight Loss', emoji: '🏃', desc: 'Cardio + strength combo' },
  { key: 'home_workout', label: 'Home Workout', emoji: '🏠', desc: 'No equipment needed' },
];

export default function Workout() {
  const navigate = useNavigate();
  const [todayLogs, setTodayLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [gymEquipment, setGymEquipment] = useState([]);
  const [gymOwner, setGymOwner] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nextWorkout, setNextWorkout] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [logs, profiles, subs] = await Promise.all([
      base44.entities.WorkoutLog.filter({ user_id: user.id, date: getToday() }),
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }),
    ]);
    setTodayLogs(logs);
    setSubscription(subs[0] || null);
    const prof = profiles[0] || null;
    setProfile(prof);
    if (prof?.primary_gym_id) {
      try {
        const [eq, gymData] = await Promise.all([
          base44.entities.GymEquipment.filter({ gym_id: prof.primary_gym_id }),
          base44.entities.GymOwner.filter({ id: prof.primary_gym_id }),
        ]);
        setGymEquipment(eq.filter(e => e.available));
        setGymOwner(gymData[0] || null);
      } catch { /* gym not found, continue */ }
    }
    try {
      const suggestion = await getNextWorkoutSuggestion(user.id);
      setNextWorkout(suggestion);
    } catch { /* non-critical */ }
    setLoading(false);
  };

  if (loading) return <LoadingScreen />;

  const todayCompleted = todayLogs.filter(l => l.completed).length;
  const totalCalories = todayLogs.reduce((s, l) => s + (l.calories_burned || 0), 0);
  const totalMins = todayLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const goalLabel = profile ? GOALS_LABELS[profile.goal] : null;

  return (
    <>
      <TopBar title="Workout" showBack />
      <div className="px-4 py-4 space-y-5 pb-6">

        {/* Next Recommended Workout */}
        {nextWorkout && (
          <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/25 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={15} className="text-accent" />
              <p className="text-xs font-semibold text-accent uppercase tracking-wide">Next Recommended Workout</p>
            </div>
            <p className="font-heading font-bold text-sm">{nextWorkout.label}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{nextWorkout.reason}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => navigate('/workout/log')}
                className="flex-1 bg-white text-black rounded-xl py-2 text-xs font-semibold active:scale-95 transition-all hover:bg-white/90">
                Start Recommended
              </button>
              <button onClick={() => navigate('/ai-trainer')}
                className="flex items-center gap-1 px-3 py-2 border border-border rounded-xl text-xs font-medium text-muted-foreground active:scale-95 transition-all hover:bg-muted/40">
                <Zap size={11} className="text-muted-foreground" /> Ask AI
              </button>
            </div>
          </div>
        )}

        {/* Today's Status */}
        <div className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -translate-y-6 translate-x-6 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Today's Workout</p>
              <p className="font-heading font-bold text-lg mt-0.5">
                {todayCompleted > 0
                  ? <span className="text-accent">{todayCompleted} session{todayCompleted > 1 ? 's' : ''} done ✓</span>
                  : 'No workout logged yet'}
              </p>
              {goalLabel && <p className="text-xs text-muted-foreground mt-0.5">Goal: {goalLabel}</p>}
            </div>
            <Button onClick={() => navigate('/workout/log')} className="rounded-xl bg-white text-black hover:bg-white/90 h-10 px-4 gap-1.5 shrink-0">
              <Plus size={15} /> Log
            </Button>
          </div>
          {(todayCompleted > 0 || totalCalories > 0) && (
            <div className="flex gap-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Flame size={14} className="text-orange-400" />
                <span className="text-xs font-medium">{totalCalories} kcal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-blue-400" />
                <span className="text-xs font-medium">{totalMins} min</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Nav */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link to="/exercises">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 active:scale-[0.97] transition-all">
              <Library size={20} className="text-accent mb-2" />
              <p className="font-heading font-semibold text-sm">Exercise Library</p>
              <p className="text-xs text-muted-foreground mt-0.5">Browse & search exercises</p>
            </div>
          </Link>
          <Link to="/tracking">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 active:scale-[0.97] transition-all">
              <Calendar size={20} className="text-accent mb-2" />
              <p className="font-heading font-semibold text-sm">All Tracking</p>
              <p className="text-xs text-muted-foreground mt-0.5">Steps, cardio, sleep & more</p>
            </div>
          </Link>
        </div>

        {/* AI Workout Generator */}
        <AIWorkoutGenerator
          profile={profile}
          equipment={gymEquipment}
          gymName={gymOwner?.gym_name || null}
          subscription={subscription}
        />

        {/* Explore Templates */}
        <div>
          <h3 className="font-heading font-semibold text-sm mb-3">Explore Plan Templates</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {PLAN_TEMPLATES.map(t => (
              <button
                key={t.key}
                onClick={() => navigate('/ai-trainer')}
                className="bg-card border border-border rounded-2xl p-4 text-left hover:border-accent/30 active:scale-[0.97] transition-all"
              >
                <span className="text-2xl mb-2 block">{t.emoji}</span>
                <p className="font-heading font-semibold text-xs">{t.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
