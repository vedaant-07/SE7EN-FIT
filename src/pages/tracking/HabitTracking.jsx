import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Plus, Check, X } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_HABITS = ['Morning Workout', 'Drink 2.5L Water', 'Sleep 7+ Hours', 'No Junk Food', 'Meditate 10min', 'Take Supplements', 'Evening Walk', 'Track Meals'];

export default function HabitTracking() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newHabit, setNewHabit] = useState('');
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const habitLogs = await base44.entities.HabitLog.filter({ user_id: user.id, date: today });
    setLogs(habitLogs);
    setLoading(false);
  };

  const toggleHabit = async (habit, existing) => {
    const user = await base44.auth.me();
    if (existing) {
      await base44.entities.HabitLog.update(existing.id, { completed: !existing.completed });
    } else {
      await base44.entities.HabitLog.create({ user_id: user.id, date: today, habit, completed: true });
    }
    loadData();
  };

  const addCustomHabit = async () => {
    if (!newHabit.trim()) return;
    const user = await base44.auth.me();
    await base44.entities.HabitLog.create({ user_id: user.id, date: today, habit: newHabit.trim(), completed: false });
    toast({ title: 'Habit added!' });
    setNewHabit('');
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  // Merge default habits with logged ones
  const loggedHabits = logs.map(l => l.habit);
  const allHabits = [...new Set([...loggedHabits, ...DEFAULT_HABITS])];
  const completed = logs.filter(l => l.completed).length;
  const total = allHabits.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <>
      <TopBar title="Habits" showBack backTo="/tracking" />
      <div className="px-4 py-4 space-y-5 pb-24">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Brain size={24} className="text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{completed}/{total}</p>
            <p className="text-xs text-muted-foreground">habits completed today • {percent}%</p>
          </div>
          <div className="ml-auto w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="space-y-2">
          {allHabits.map(habit => {
            const log = logs.find(l => l.habit === habit);
            const done = log?.completed || false;
            return (
              <button key={habit} onClick={() => toggleHabit(habit, log)} className={`w-full flex items-center gap-3 rounded-xl p-4 border transition-all active:scale-[0.99] ${done ? 'bg-accent/10 border-accent/30' : 'bg-card border-border'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${done ? 'bg-accent border-accent' : 'border-muted-foreground'}`}>
                  {done && <Check size={12} className="text-accent-foreground" />}
                </div>
                <span className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>{habit}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Input placeholder="Add custom habit..." value={newHabit} onChange={e => setNewHabit(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomHabit()} className="h-12 rounded-xl bg-card border-border flex-1" />
          <Button onClick={addCustomHabit} className="h-12 rounded-xl bg-accent text-accent-foreground">
            <Plus size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}