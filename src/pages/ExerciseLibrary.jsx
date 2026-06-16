import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Input } from '@/components/ui/input';
import { Search, Dumbbell, Filter } from 'lucide-react';
import { MUSCLE_GROUPS } from '@/lib/fitnessUtils';

const DEFAULT_EXERCISES = [
  { name: 'Bench Press', muscle_group: 'chest', equipment: 'barbell', level: 'beginner', instructions: 'Lie on bench, grip bar shoulder-width, lower to chest, press up.', target_muscles: 'Chest, Triceps, Shoulders' },
  { name: 'Squat', muscle_group: 'legs', equipment: 'barbell', level: 'beginner', instructions: 'Bar on upper back, feet shoulder-width, sit back and down, push up.', target_muscles: 'Quads, Glutes, Hamstrings' },
  { name: 'Deadlift', muscle_group: 'back', equipment: 'barbell', level: 'intermediate', instructions: 'Grip bar, hinge at hips, keep back flat, pull up.', target_muscles: 'Back, Glutes, Hamstrings' },
  { name: 'Overhead Press', muscle_group: 'shoulders', equipment: 'barbell', level: 'beginner', instructions: 'Bar at shoulders, press overhead, lock out arms.', target_muscles: 'Shoulders, Triceps' },
  { name: 'Pull-ups', muscle_group: 'back', equipment: 'bodyweight', level: 'intermediate', instructions: 'Hang from bar, pull chin above bar, lower slowly.', target_muscles: 'Lats, Biceps, Core' },
  { name: 'Push-ups', muscle_group: 'chest', equipment: 'bodyweight', level: 'beginner', instructions: 'Plank position, lower chest to floor, push up.', target_muscles: 'Chest, Triceps, Shoulders' },
  { name: 'Dumbbell Curl', muscle_group: 'biceps', equipment: 'dumbbell', level: 'beginner', instructions: 'Stand tall, curl dumbbells up, squeeze at top.', target_muscles: 'Biceps' },
  { name: 'Tricep Dips', muscle_group: 'triceps', equipment: 'bodyweight', level: 'beginner', instructions: 'Grip parallel bars, lower body, push up.', target_muscles: 'Triceps, Chest' },
  { name: 'Leg Press', muscle_group: 'legs', equipment: 'machine', level: 'beginner', instructions: 'Feet shoulder-width on platform, push away, control back.', target_muscles: 'Quads, Glutes' },
  { name: 'Lat Pulldown', muscle_group: 'back', equipment: 'cable', level: 'beginner', instructions: 'Grip wide, pull bar to upper chest, squeeze lats.', target_muscles: 'Lats, Biceps' },
  { name: 'Plank', muscle_group: 'abs', equipment: 'bodyweight', level: 'beginner', instructions: 'Forearm plank, keep body straight, hold position.', target_muscles: 'Core, Abs' },
  { name: 'Lunges', muscle_group: 'legs', equipment: 'bodyweight', level: 'beginner', instructions: 'Step forward, lower back knee, push back up.', target_muscles: 'Quads, Glutes' },
  { name: 'Cable Fly', muscle_group: 'chest', equipment: 'cable', level: 'intermediate', instructions: 'Set cables high, pull handles together in front.', target_muscles: 'Chest' },
  { name: 'Lateral Raise', muscle_group: 'shoulders', equipment: 'dumbbell', level: 'beginner', instructions: 'Stand tall, raise dumbbells to sides at shoulder height.', target_muscles: 'Side Delts' },
  { name: 'Calf Raise', muscle_group: 'calves', equipment: 'machine', level: 'beginner', instructions: 'Stand on edge, push up onto toes, lower slowly.', target_muscles: 'Calves' },
  { name: 'Hip Thrust', muscle_group: 'glutes', equipment: 'barbell', level: 'intermediate', instructions: 'Upper back on bench, bar on hips, thrust up, squeeze glutes.', target_muscles: 'Glutes, Hamstrings' },
];

export default function ExerciseLibrary() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const filtered = DEFAULT_EXERCISES.filter(ex => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || ex.muscle_group === filter;
    return matchSearch && matchFilter;
  });

  return (
    <>
      <TopBar title="Exercise Library" showBack backTo="/workout" />
      <div className="px-4 py-4 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-9 rounded-xl bg-card border-border" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${filter === 'all' ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'}`}>All</button>
          {MUSCLE_GROUPS.map(mg => (
            <button key={mg} onClick={() => setFilter(mg)} className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all capitalize ${filter === mg ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'}`}>
              {mg.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((ex, i) => (
            <button key={i} onClick={() => setExpanded(expanded === i ? null : i)} className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-semibold text-sm">{ex.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{ex.muscle_group} • {ex.equipment} • {ex.level}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Dumbbell size={14} className="text-accent" />
                </div>
              </div>
              {expanded === i && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs"><span className="text-muted-foreground">Target:</span> {ex.target_muscles}</p>
                  <p className="text-xs"><span className="text-muted-foreground">How to:</span> {ex.instructions}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}