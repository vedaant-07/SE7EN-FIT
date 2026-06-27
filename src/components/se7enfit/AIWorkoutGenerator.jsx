import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Lock, Crown, Dumbbell, ChevronDown, ChevronUp, Zap, Building2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AIWorkoutGenerator({ profile, equipment, gymName, subscription }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [locked, setLocked] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('geminiService', {
        action: 'generateWorkout',
        profile,
        equipment: equipment || [],
        gymName: gymName || null,
      });
      const data = result.data;
      if (data?.locked) { setLocked(true); setLoading(false); return; }
      if (data?.error) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); setLoading(false); return; }

      setPlan(data);

      await base44.entities.WorkoutPlan.create({
        user_id: (await base44.auth.me()).id,
        name: data.planName || 'AI Generated Workout',
        goal: data.goal || profile?.goal,
        days_per_week: (data.weeklySchedule || []).length,
        level: profile?.fitness_level || 'beginner',
        is_ai_generated: true,
        is_active: true,
        description: data.notes || '',
      });
      toast({ title: '💪 Workout plan generated & saved!' });
    } catch (e) {
      toast({ title: 'Error', description: 'AI is temporarily unavailable. Try again.', variant: 'destructive' });
    }
    setLoading(false);
  };

  if (locked) return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-center">
      <Lock size={24} className="text-yellow-400 mx-auto mb-2" />
      <p className="font-semibold text-sm mb-1">Workout Generator Locked</p>
      <p className="text-xs text-muted-foreground mb-3">Upgrade to generate AI gym-based workout plans.</p>
      <a href="/subscription" className="inline-flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-4 py-2 rounded-xl"><Crown size={12} /> Upgrade</a>
    </div>
  );

  if (!plan) return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border flex items-center justify-center"><Dumbbell size={16} className="text-white" /></div>
        <div className="flex-1">
          <p className="font-heading font-semibold text-sm">AI Gym Workout Generator</p>
          <p className="text-xs text-muted-foreground">
            {gymName && equipment?.length > 0
              ? `Using ${equipment.length} machines from ${gymName}`
              : gymName
              ? `Connected to ${gymName}`
              : 'Bodyweight & home workout'}
          </p>
        </div>
      </div>

      {equipment?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {equipment.slice(0, 5).map((e, i) => (
            <span key={i} className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full border border-border">{e.equipment_name}</span>
          ))}
          {equipment.length > 5 && <span className="text-[10px] text-muted-foreground px-2 py-0.5">+{equipment.length - 5} more</span>}
        </div>
      )}

      {!gymName && (
        <div className="bg-muted/40 border border-border rounded-xl p-3 mb-3 flex items-start gap-2">
          <Building2 size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">Connect your gym with referral code in <a href="/my-gym" className="text-white underline">My Gym</a> to unlock machine-based workout plans.</p>
        </div>
      )}

      <Button onClick={generate} disabled={loading} className="w-full h-10 rounded-xl bg-white text-black hover:bg-white/90 text-sm font-bold">
        {loading
          ? <><Loader2 size={14} className="mr-2 animate-spin" />Generating with Gemini...</>
          : <><Zap size={14} className="mr-2" />Generate AI Workout Plan</>}
      </Button>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="bg-muted/35 p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles size={13} className="text-white" />
              <p className="font-heading font-bold text-sm">{plan.planName}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {plan.connectedGymName || 'Home workout'} • {(plan.weeklySchedule || []).length} days/week
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPlan(null)} className="text-xs text-muted-foreground">Redo</Button>
        </div>
        {plan.safetyNote && (
          <p className="text-[10px] text-yellow-400/80 mt-2">⚠️ {plan.safetyNote}</p>
        )}
      </div>

      <div className="divide-y divide-border/50">
        {(plan.weeklySchedule || []).map((day, i) => (
          <div key={i} className="p-4">
            <button onClick={() => setExpandedDay(expandedDay === i ? null : i)} className="w-full flex items-center justify-between">
              <div className="text-left">
                <p className="font-medium text-sm">{day.day} — {day.focus}</p>
                <p className="text-xs text-muted-foreground">{(day.exercises || []).length} exercises • ~{day.estimatedDurationMinutes} min</p>
              </div>
              {expandedDay === i ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
            </button>

            {expandedDay === i && (
              <div className="mt-3 space-y-3">
                {(day.exercises || []).map((ex, j) => (
                  <div key={j} className="bg-muted/30 rounded-xl p-3 border border-border/50">
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <p className="font-heading font-semibold text-sm">{ex.exerciseName}</p>
                        <p className="text-[10px] text-muted-foreground">{ex.targetMuscle} • {ex.equipmentUsed}</p>
                      </div>
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">{ex.difficulty}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap mb-2">
                      <span className="text-xs font-medium">{ex.sets} sets × {ex.reps}</span>
                      <span className="text-xs text-muted-foreground">Rest: {ex.restSeconds}s</span>
                    </div>
                    {ex.instructions?.length > 0 && (
                      <div className="space-y-1">
                        {ex.instructions.map((step, k) => (
                          <p key={k} className="text-[11px] text-muted-foreground">→ {step}</p>
                        ))}
                      </div>
                    )}
                    {ex.formTips?.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">💡 {ex.formTips[0]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
