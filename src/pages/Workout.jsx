import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import EmptyState from '@/components/se7enfit/EmptyState';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Dumbbell, Plus, Calendar, Library, ChevronRight, Flame, Clock, Zap, CheckCircle2, Circle } from 'lucide-react';
import { getToday, GOALS_LABELS } from '@/lib/fitnessUtils';
import AIWorkoutGenerator from '@/components/se7enfit/AIWorkoutGenerator';

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
  const [plans, setPlans] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [gymEquipment, setGymEquipment] = useState([]);
  const [gymOwner, setGymOwner] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [p, logs, profiles, subs] = await Promise.all([
      base44.entities.WorkoutPlan.filter({ user_id: user.id }),
      base44.entities.WorkoutLog.filter({ user_id: user.id, date: getToday() }),
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.Subscription.filter({ user_id: user.id, status: 'active' }),
    ]);
    setPlans(p);
    setTodayLogs(logs);
    setSubscription(subs[0] || null);
    const prof = profiles[0] || null;
    setProfile(prof);
    if (prof?.primary_gym_id) {
      const [eq, gymData] = await Promise.all([
        base44.entities.GymEquipment.filter({ gym_id: prof.primary_gym_id }),
        base44.entities.GymOwner.filter({ user_id: prof.primary_gym_id }),
      ]).catch(() => [[], []]);
      setGymEquipment(eq.filter(e => e.available));
      setGymOwner(gymData[0] || null);
    }
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
            <Button onClick={() => navigate('/workout/log')} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 h-10 px-4 gap-1.5 shrink-0">
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

        {/* My Plans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-sm">My Workout Plans</h3>
            <Link to="/ai-trainer" className="text-xs text-accent font-medium flex items-center gap-1">
              <Zap size={11} /> AI Generate
            </Link>
          </div>

          {plans.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="No workout plans yet"
              description="Ask the AI Trainer to create a personalized workout plan based on your goals."
              actionLabel="Create with AI"
              onAction={() => navigate('/ai-trainer')}
              compact
            />
          ) : (
            <div className="space-y-2.5">
              {plans.map(plan => (
                <div key={plan.id} className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Dumbbell size={18} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-sm truncate">{plan.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.days_per_week} days/week • {plan.level}
                        {plan.is_ai_generated && <span className="ml-1 text-accent">• AI</span>}
                      </p>
                    </div>
                    {plan.is_active && (
                      <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">Active</span>
                    )}
                    <ChevronRight size={15} className="text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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