import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Check } from 'lucide-react';
import { getToday, MUSCLE_GROUPS } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

export default function WorkoutLog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Pre-populate from workout day passed via navigation state
  const passedDay = location.state?.workoutDay;
  const defaultExercises = passedDay?.exercises?.map(ex => ({
    name: ex.name || '',
    muscle_group: (ex.muscles?.[0] || 'chest').toLowerCase().replace(/\s+/g, '_'),
    sets: typeof ex.sets === 'number' ? ex.sets : 3,
    reps: typeof ex.reps === 'number' ? ex.reps : 10,
    weight: '',
    rest_sec: ex.rest_seconds || 60,
  })) || [{ name: '', muscle_group: 'chest', sets: 3, reps: 10, weight: '', rest_sec: 60 }];

  const [workout, setWorkout] = useState({
    day_name: passedDay ? `${passedDay.day} — ${passedDay.split}` : '',
    workout_type: 'strength',
    duration_minutes: passedDay?.estimated_duration || '',
    calories_burned: passedDay?.estimated_calories || '',
    difficulty_rating: 3,
    notes: '',
  });
  const [exercises, setExercises] = useState(defaultExercises);

  const addExercise = () => setExercises(prev => [...prev, { name: '', muscle_group: 'chest', sets: 3, reps: 10, weight: '', rest_sec: 60 }]);
  const removeExercise = (idx) => setExercises(prev => prev.filter((_, i) => i !== idx));
  const updateExercise = (idx, field, value) => setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const handleSave = async () => {
    setSaving(true);
    const user = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
    const profile = profiles[0];
    await base44.entities.WorkoutLog.create({
      user_id: user.id,
      gym_id: profile?.primary_gym_id || undefined,
      date: getToday(),
      day_name: workout.day_name,
      workout_type: workout.workout_type,
      exercises: exercises.filter(e => e.name),
      duration_minutes: Number(workout.duration_minutes) || 0,
      calories_burned: Number(workout.calories_burned) || 0,
      difficulty_rating: workout.difficulty_rating,
      notes: workout.notes,
      completed: true,
    });
    if (profile) {
      await base44.entities.UserProfile.update(profile.id, {
        total_workouts: (profile.total_workouts || 0) + 1,
      });
    }
    toast({ title: '💪 Workout complete!', description: 'Amazing work! Your progress is updated.' });
    navigate('/workout');
  };

  return (
    <>
      <TopBar title="Log Workout" showBack backTo="/workout" />
      <div className="px-4 py-4 space-y-5 pb-24">
        <div className="space-y-4">
          <div>
            <Label className="text-sm mb-2 block">Workout Name</Label>
            <Input placeholder="e.g., Push Day, Chest & Triceps" value={workout.day_name} onChange={e => setWorkout(p => ({ ...p, day_name: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-2 block">Duration (min)</Label>
              <Input type="number" placeholder="45" value={workout.duration_minutes} onChange={e => setWorkout(p => ({ ...p, duration_minutes: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Calories Burned</Label>
              <Input type="number" placeholder="300" value={workout.calories_burned} onChange={e => setWorkout(p => ({ ...p, calories_burned: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
            </div>
          </div>
          <div>
            <Label className="text-sm mb-2 block">Difficulty: {workout.difficulty_rating}/5</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setWorkout(p => ({ ...p, difficulty_rating: n }))}
                  className={`w-10 h-10 rounded-xl border text-sm font-bold transition-all ${n <= workout.difficulty_rating ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'}`}
                >{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Exercises */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-sm">Exercises</h3>
            <Button variant="ghost" size="sm" onClick={addExercise} className="text-accent text-xs"><Plus size={14} className="mr-1" /> Add</Button>
          </div>
          <div className="space-y-4">
            {exercises.map((ex, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Exercise {idx + 1}</span>
                  {exercises.length > 1 && (
                    <button onClick={() => removeExercise(idx)} className="text-destructive"><Trash2 size={14} /></button>
                  )}
                </div>
                <Input placeholder="Exercise name" value={ex.name} onChange={e => updateExercise(idx, 'name', e.target.value)} className="h-10 rounded-xl bg-background border-border text-sm" />
                <Select value={ex.muscle_group} onValueChange={v => updateExercise(idx, 'muscle_group', v)}>
                  <SelectTrigger className="h-10 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map(mg => (
                      <SelectItem key={mg} value={mg}>{mg.charAt(0).toUpperCase() + mg.slice(1).replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Sets</Label>
                    <Input type="number" value={ex.sets} onChange={e => updateExercise(idx, 'sets', Number(e.target.value))} className="h-9 rounded-lg bg-background border-border text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Reps</Label>
                    <Input type="number" value={ex.reps} onChange={e => updateExercise(idx, 'reps', Number(e.target.value))} className="h-9 rounded-lg bg-background border-border text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Weight (kg)</Label>
                    <Input type="number" placeholder="0" value={ex.weight} onChange={e => updateExercise(idx, 'weight', e.target.value)} className="h-9 rounded-lg bg-background border-border text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm mb-2 block">Notes (optional)</Label>
          <Input placeholder="How did it feel?" value={workout.notes} onChange={e => setWorkout(p => ({ ...p, notes: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
          <Check size={16} className="mr-2" /> {saving ? 'Saving...' : 'Complete Workout'}
        </Button>
      </div>
    </>
  );
}