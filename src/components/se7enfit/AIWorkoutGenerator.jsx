import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, ChevronUp, Crown, Dumbbell, Loader2, Lock, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { memberProductClient } from '@/api/memberProductClient';

function normalizePlan(value) {
  if (!value) return null;
  const data = value.plan_data || value;
  return {
    ...value,
    ...data,
    id: value.id || value.plan_id,
    planName: data.planName || value.title || 'Personalized workout plan',
    weeklySchedule: Array.isArray(data.weeklySchedule) ? data.weeklySchedule : [],
  };
}

function sessionKey(planId, dayIndex, date) {
  return `workout:${planId}:${dayIndex}:${date}:${Date.now()}`;
}

export default function AIWorkoutGenerator({
  profile,
  equipment = [],
  gymName,
  initialPlan = null,
  initialSessions = [],
  onPlanChange,
}) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(() => normalizePlan(initialPlan));
  const [sessions, setSessions] = useState(initialSessions);
  const [loading, setLoading] = useState(false);
  const [completingDay, setCompletingDay] = useState(null);
  const [expandedDay, setExpandedDay] = useState(0);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => { setPlan(normalizePlan(initialPlan)); }, [initialPlan]);
  useEffect(() => { setSessions(Array.isArray(initialSessions) ? initialSessions : []); }, [initialSessions]);

  const completedDays = useMemo(() => new Set(
    sessions.filter((row) => row.status === 'completed').map((row) => `${row.schedule_day_index}:${row.session_date}`),
  ), [sessions]);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await memberProductClient.generateWorkoutPlan();
      const next = normalizePlan(result.plan);
      setPlan(next);
      setSessions(result.sessions || []);
      setRemaining(result.usage?.remaining ?? null);
      setExpandedDay(0);
      onPlanChange?.(next, result.sessions || []);
      toast({ title: 'Personalized plan activated', description: 'Your previous active plan was archived safely.' });
    } catch (requestError) {
      if (requestError.code === 'feature_locked') setLocked(true);
      if (requestError.code === 'quota_exceeded') setLimitReached(true);
      setError(requestError.message || 'Could not generate a workout plan.');
    } finally {
      setLoading(false);
    }
  };

  const completeDay = async (day, dayIndex) => {
    if (!plan?.id || completingDay !== null) return;
    const date = new Date().toLocaleDateString('en-CA');
    if (completedDays.has(`${dayIndex}:${date}`)) {
      toast({ title: 'Already completed today' });
      return;
    }
    setCompletingDay(dayIndex);
    setError('');
    try {
      const result = await memberProductClient.completeWorkoutDay(plan.id, {
        schedule_day_index: dayIndex,
        date,
        duration_minutes: Number(day.estimatedDurationMinutes || 30),
        calories_burned: Math.round(Number(day.estimatedDurationMinutes || 30) * 5),
        exercises: day.exercises || [],
        external_id: sessionKey(plan.id, dayIndex, date),
      });
      setSessions((current) => {
        const filtered = current.filter((row) => !(row.schedule_day_index === dayIndex && row.session_date === date));
        return [result.session, ...filtered];
      });
      toast({ title: 'Workout completed', description: 'Your progress and activity summary were updated.' });
    } catch (requestError) {
      setError(requestError.message || 'Could not complete this workout.');
    } finally {
      setCompletingDay(null);
    }
  };

  if (locked || limitReached) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-center">
        <Lock size={24} className="text-yellow-400 mx-auto mb-2" />
        <p className="font-semibold text-sm">{locked ? 'AI workout plans are not included in this plan' : 'Workout plan generation limit reached'}</p>
        <p className="text-xs text-muted-foreground mt-1 mb-3">Upgrade to generate more personalized plans.</p>
        <a href="/subscription" className="inline-flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-4 py-2 rounded-xl"><Crown size={12} /> View plans</a>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border flex items-center justify-center"><Dumbbell size={16} /></div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-semibold text-sm">Personalized AI workout plan</p>
            <p className="text-xs text-muted-foreground truncate">
              {gymName && equipment.length > 0 ? `${equipment.length} available machines at ${gymName}` : gymName ? `Connected to ${gymName}` : 'Safe home and bodyweight alternatives included'}
            </p>
          </div>
        </div>
        {!gymName && (
          <div className="bg-muted/40 border border-border rounded-xl p-3 mb-3 flex items-start gap-2">
            <Building2 size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">Connect a gym in My Gym to personalize the plan around available equipment.</p>
          </div>
        )}
        {profile?.medical_notes && <p className="text-[10px] text-amber-300 mb-3">Your saved injury or medical notes will be considered by the server.</p>}
        {error && <p className="text-xs text-red-300 mb-3">{error}</p>}
        <Button onClick={() => void generate()} disabled={loading} className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-bold">
          {loading ? <><Loader2 size={14} className="mr-2 animate-spin" />Building your plan…</> : <><Zap size={14} className="mr-2" />Generate personalized plan</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="bg-muted/35 p-4 border-b border-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Sparkles size={13} className="text-accent" /><p className="font-heading font-bold text-sm truncate">{plan.planName}</p></div>
            <p className="text-xs text-muted-foreground mt-1">{plan.weeklySchedule.length} days/week • 4-week active plan</p>
            {remaining !== null && <p className="text-[10px] text-accent mt-1">{remaining} plan generations remaining</p>}
          </div>
          <button onClick={() => void generate()} disabled={loading} className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Replace plan
          </button>
        </div>
        {plan.safetyNote && <p className="text-[10px] text-yellow-300/90 mt-2">⚠️ {plan.safetyNote}</p>}
        {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      </div>

      <div className="divide-y divide-border/50">
        {plan.weeklySchedule.map((day, dayIndex) => {
          const date = new Date().toLocaleDateString('en-CA');
          const completedToday = completedDays.has(`${dayIndex}:${date}`);
          const expanded = expandedDay === dayIndex;
          return (
            <div key={`${day.day}-${dayIndex}`} className="p-4">
              <button onClick={() => setExpandedDay(expanded ? null : dayIndex)} className="w-full flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{day.day} — {day.focus}</p>
                    {completedToday && <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent"><Check size={9} /> Done</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{day.exercises?.length || 0} exercises • about {day.estimatedDurationMinutes} min</p>
                </div>
                {expanded ? <ChevronUp size={15} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={15} className="shrink-0 text-muted-foreground" />}
              </button>

              {expanded && (
                <div className="mt-3 space-y-3">
                  {(day.exercises || []).map((exercise, exerciseIndex) => (
                    <div key={`${exercise.exerciseName}-${exerciseIndex}`} className="bg-muted/30 rounded-xl p-3 border border-border/50">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-heading font-semibold text-sm">{exercise.exerciseName}</p><p className="text-[10px] text-muted-foreground">{exercise.targetMuscle} • {exercise.equipmentUsed}</p></div>
                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded-full capitalize">{exercise.difficulty}</span>
                      </div>
                      <p className="text-xs font-medium mt-2">{exercise.sets} sets × {exercise.reps} • Rest {exercise.restSeconds}s</p>
                      <div className="mt-2 space-y-1">{(exercise.instructions || []).map((step, index) => <p key={index} className="text-[11px] text-muted-foreground">{index + 1}. {step}</p>)}</div>
                      {exercise.formTips?.[0] && <p className="text-[10px] text-accent mt-2">Form tip: {exercise.formTips[0]}</p>}
                    </div>
                  ))}
                  <Button onClick={() => void completeDay(day, dayIndex)} disabled={completedToday || completingDay !== null}
                    className={`w-full h-11 rounded-xl ${completedToday ? 'bg-accent/15 text-accent' : 'bg-white text-black hover:bg-white/90'}`}>
                    {completingDay === dayIndex ? <><Loader2 size={14} className="mr-2 animate-spin" />Saving completion…</> : completedToday ? <><Check size={14} className="mr-2" />Completed today</> : <><Check size={14} className="mr-2" />Mark workout complete</>}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
