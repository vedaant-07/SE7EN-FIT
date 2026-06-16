import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Dumbbell, Plus, Calendar, Library, Trophy, Clock, ChevronRight, Flame } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';

const WORKOUT_TYPES = [
  { key: 'push_pull_legs', label: 'Push Pull Legs', emoji: '💪' },
  { key: 'full_body', label: 'Full Body', emoji: '🏋️' },
  { key: 'upper_lower', label: 'Upper Lower', emoji: '⬆️' },
  { key: 'bro_split', label: 'Bro Split', emoji: '🔥' },
  { key: 'weight_loss', label: 'Weight Loss', emoji: '🏃' },
  { key: 'muscle_gain', label: 'Muscle Gain', emoji: '💪' },
  { key: 'beginner', label: 'Beginner Plan', emoji: '🌟' },
  { key: 'home_workout', label: 'Home Workout', emoji: '🏠' },
  { key: 'cardio', label: 'Cardio Plan', emoji: '❤️' },
  { key: 'transformation', label: 'Transformation', emoji: '🔄' },
];

export default function Workout() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [p, logs] = await Promise.all([
      base44.entities.WorkoutPlan.filter({ user_id: user.id }),
      base44.entities.WorkoutLog.filter({ user_id: user.id, date: getToday() }),
    ]);
    setPlans(p);
    setTodayLogs(logs);
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayCompleted = todayLogs.filter(l => l.completed).length;

  return (
    <>
      <TopBar title="Workout" showBack />
      <div className="px-4 py-4 space-y-5">
        {/* Today's Status */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Today's Workout</p>
              <p className="font-heading font-bold text-lg mt-1">
                {todayCompleted > 0 ? `${todayCompleted} session${todayCompleted > 1 ? 's' : ''} done ✓` : 'No workout yet'}
              </p>
            </div>
            <Button onClick={() => navigate('/workout/log')} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 h-10">
              <Plus size={16} className="mr-1" /> Log Workout
            </Button>
          </div>
        </div>

        {/* Quick Nav */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/workout/exercises" className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all">
            <Library size={20} className="text-accent mb-2" />
            <p className="font-heading font-semibold text-sm">Exercise Library</p>
            <p className="text-xs text-muted-foreground mt-1">Browse exercises</p>
          </Link>
          <Link to="/workout/history" className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all">
            <Calendar size={20} className="text-accent mb-2" />
            <p className="font-heading font-semibold text-sm">History</p>
            <p className="text-xs text-muted-foreground mt-1">Past workouts</p>
          </Link>
        </div>

        {/* My Plans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-sm">My Workout Plans</h3>
            <Link to="/ai-trainer" className="text-xs text-accent">+ AI Generate</Link>
          </div>
          {plans.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Dumbbell size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No workout plans yet</p>
              <Button onClick={() => navigate('/ai-trainer')} variant="outline" className="mt-3 rounded-xl border-accent/30 text-accent text-xs">
                Ask AI to create a plan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map(plan => (
                <div key={plan.id} className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-heading font-semibold text-sm">{plan.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.days_per_week} days/week • {plan.level}
                        {plan.is_ai_generated && ' • AI Generated'}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workout Types */}
        <div>
          <h3 className="font-heading font-semibold text-sm mb-3">Explore Plans</h3>
          <div className="grid grid-cols-2 gap-3">
            {WORKOUT_TYPES.map(type => (
              <button
                key={type.key}
                onClick={() => navigate('/ai-trainer')}
                className="bg-card border border-border rounded-2xl p-4 text-left hover:border-accent/30 transition-all active:scale-[0.98]"
              >
                <span className="text-xl mb-2 block">{type.emoji}</span>
                <p className="font-heading font-medium text-xs">{type.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}