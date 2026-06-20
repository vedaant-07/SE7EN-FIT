import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getToday } from '@/lib/fitnessUtils';
import { CheckCircle2, Circle } from 'lucide-react';

const HABITS = [
  { key: 'water', emoji: '💧', label: 'Water', sub: '8 glasses' },
  { key: 'sleep', emoji: '😴', label: 'Sleep', sub: '7+ hours' },
  { key: 'meditation', emoji: '🧘', label: 'Meditate', sub: '10 min' },
  { key: 'no_junk', emoji: '🥗', label: 'Eat Clean', sub: 'No junk' },
  { key: 'morning_walk', emoji: '🚶', label: 'Walk', sub: '30 min' },
  { key: 'vitamins', emoji: '💊', label: 'Vitamins', sub: 'Taken' },
];

export default function DailyHabits() {
  const [habits, setHabits] = useState([]);
  const [logId, setLogId] = useState(null);
  const [saving, setSaving] = useState(null);
  const today = getToday();

  useEffect(() => { loadHabits(); }, []);

  const loadHabits = async () => {
    const user = await base44.auth.me();
    const logs = await base44.entities.HabitLog.filter({ user_id: user.id, date: today });
    if (logs.length > 0) {
      const log = logs[0];
      setLogId(log.id);
      setHabits(log.habits_completed || []);
    }
  };

  const toggle = async (key) => {
    setSaving(key);
    const user = await base44.auth.me();
    const isChecked = habits.includes(key);
    const updated = isChecked ? habits.filter(h => h !== key) : [...habits, key];
    setHabits(updated);

    if (logId) {
      await base44.entities.HabitLog.update(logId, { habits_completed: updated });
    } else {
      const created = await base44.entities.HabitLog.create({
        user_id: user.id,
        date: today,
        habits_completed: updated,
      });
      setLogId(created.id);
    }
    setSaving(null);
  };

  const doneCount = habits.length;
  const total = HABITS.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-sm">Daily Habits</h3>
        <span className="text-xs font-bold text-accent">{doneCount}/{total}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {HABITS.map(habit => {
          const done = habits.includes(habit.key);
          const isSaving = saving === habit.key;
          return (
            <button
              key={habit.key}
              onClick={() => toggle(habit.key)}
              disabled={isSaving}
              className={`relative rounded-2xl p-3 flex flex-col items-center gap-1.5 border transition-all active:scale-95 ${
                done
                  ? 'bg-accent/10 border-accent/40'
                  : 'bg-card border-border hover:border-accent/20'
              }`}
            >
              <span className="text-xl">{habit.emoji}</span>
              <span className={`text-[10px] font-semibold leading-tight text-center ${done ? 'text-accent' : 'text-foreground'}`}>
                {habit.label}
              </span>
              <span className="text-[9px] text-muted-foreground">{habit.sub}</span>
              <div className="absolute top-2 right-2">
                {done
                  ? <CheckCircle2 size={13} className="text-accent" />
                  : <Circle size={13} className="text-muted-foreground/40" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}