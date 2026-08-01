import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Flame, Library, Plus, RefreshCw, Clock } from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import AIWorkoutGenerator from '@/components/se7enfit/AIWorkoutGenerator';
import { Button } from '@/components/ui/button';
import { memberProductClient } from '@/api/memberProductClient';

const PLAN_TEMPLATES = [
  { key: 'push_pull_legs', label: 'Push Pull Legs', emoji: '💪', desc: 'Balanced strength split' },
  { key: 'full_body', label: 'Full Body', emoji: '🏋️', desc: 'All major muscle groups' },
  { key: 'upper_lower', label: 'Upper / Lower', emoji: '⬆️', desc: 'Four-day structure' },
  { key: 'weight_loss', label: 'Fat Loss', emoji: '🏃', desc: 'Strength and cardio' },
  { key: 'home_workout', label: 'Home Workout', emoji: '🏠', desc: 'Minimal equipment' },
  { key: 'mobility', label: 'Mobility', emoji: '🧘', desc: 'Low-impact movement' },
];

export default function Workout() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [plan, setPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewResult, planResult] = await Promise.all([
        memberProductClient.getOverview(new Date().toLocaleDateString('en-CA')),
        memberProductClient.getWorkoutPlan(),
      ]);
      setOverview(overviewResult);
      setPlan(planResult.plan || null);
      setSessions(planResult.sessions || []);
    } catch (requestError) {
      setError(requestError.message || 'Could not load your workout workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  if (loading && !overview) return <LoadingScreen />;

  const activity = overview?.activity || {};
  const goal = overview?.profile?.goal?.replace(/_/g, ' ') || 'General fitness';

  return (
    <>
      <TopBar title="Workout" showBack />
      <div className="px-4 py-4 space-y-5 pb-24">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-red-200">Workout data unavailable</p><p className="text-xs text-red-100/70 mt-1">{error}</p></div>
            <button onClick={() => void loadData()} className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-red-400/30 px-3 py-2 text-xs text-red-100"><RefreshCw size={13} /> Retry</button>
          </div>
        )}

        <div className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -translate-y-6 translate-x-6 pointer-events-none" />
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Today’s verified activity</p>
              <p className="font-heading font-bold text-lg mt-0.5">
                {activity.workout_count > 0 ? <span className="text-accent">{activity.workout_count} workout{activity.workout_count > 1 ? 's' : ''} completed</span> : 'No workout completed yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">Goal: {goal}</p>
            </div>
            <Button onClick={() => navigate('/workout/log')} className="rounded-xl bg-white text-black hover:bg-white/90 h-10 px-4 gap-1.5 shrink-0"><Plus size={15} /> Manual log</Button>
          </div>
          <div className="flex gap-5 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5"><Clock size={14} className="text-blue-400" /><span className="text-xs font-medium">{Math.round(activity.workout_minutes || 0)} min</span></div>
            <div className="flex items-center gap-1.5"><Flame size={14} className="text-orange-400" /><span className="text-xs font-medium">{Math.round(activity.cardio_minutes || 0)} cardio min</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Link to="/exercises" className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 active:scale-[0.98] transition-all">
            <Library size={20} className="text-accent mb-2" /><p className="font-heading font-semibold text-sm">Exercise library</p><p className="text-xs text-muted-foreground mt-0.5">Form and movement guides</p>
          </Link>
          <Link to="/tracking" className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 active:scale-[0.98] transition-all">
            <Calendar size={20} className="text-accent mb-2" /><p className="font-heading font-semibold text-sm">Activity tracking</p><p className="text-xs text-muted-foreground mt-0.5">Steps, cardio and recovery</p>
          </Link>
        </div>

        <AIWorkoutGenerator
          profile={overview?.profile}
          gymName={overview?.gym?.name || null}
          initialPlan={plan}
          initialSessions={sessions}
          onPlanChange={(nextPlan, nextSessions) => { setPlan(nextPlan); setSessions(nextSessions); }}
        />

        <div>
          <div className="flex items-end justify-between mb-3"><div><h3 className="font-heading font-semibold text-sm">Workout ideas</h3><p className="text-[10px] text-muted-foreground mt-0.5">Ask the AI Coach to adapt any style safely.</p></div></div>
          <div className="grid grid-cols-2 gap-2.5">
            {PLAN_TEMPLATES.map((template) => (
              <button key={template.key} onClick={() => navigate('/ai-trainer', { state: { prompt: `Create a ${template.label} workout for me.` } })}
                className="bg-card border border-border rounded-2xl p-4 text-left hover:border-accent/30 active:scale-[0.98] transition-all">
                <span className="text-2xl mb-2 block">{template.emoji}</span><p className="font-heading font-semibold text-xs">{template.label}</p><p className="text-[10px] text-muted-foreground mt-0.5">{template.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
