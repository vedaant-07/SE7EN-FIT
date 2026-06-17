import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare, Square, Plus, X, Flame } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { AIInsightCard, StreakCard, AchievementBadge, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_HABITS = ['Morning workout', 'Drink 8 glasses of water', 'Eat protein at every meal', 'No junk food', '7+ hours sleep', 'Evening walk', 'Meditate 10 min', 'Read 20 pages'];

export default function HabitsTab({ profile }) {
  const { toast } = useToast();
  const [todayLogs, setTodayLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [newHabit, setNewHabit] = useState('');
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [todayData, histData] = await Promise.all([
      base44.entities.HabitLog.filter({ user_id: user.id, date: today }),
      base44.entities.HabitLog.filter({ user_id: user.id }, '-date', 120),
    ]);
    setTodayLogs(todayData);
    setAllLogs(histData);
    setLoading(false);
    fetchInsight(todayData, histData);
  };

  const fetchInsight = async (todayData, histData) => {
    setInsightLoading(true);
    const completed = todayData.filter(h => h.completed).length;
    const total = todayData.length;
    const avg7 = histData.length ? Math.round(histData.slice(0, 70).filter(h => h.completed).length / 10) : 0;
    const text = await getTrackingInsight('Habit Completion', completed, total || 5, 'habits/day', avg7, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const toggleHabit = async (log) => {
    await base44.entities.HabitLog.update(log.id, { completed: !log.completed });
    loadData();
  };

  const addHabit = async (habitName) => {
    if (!habitName.trim()) return;
    const user = await base44.auth.me();
    const existing = todayLogs.find(l => l.habit === habitName.trim());
    if (existing) return;
    await base44.entities.HabitLog.create({ user_id: user.id, date: today, habit: habitName.trim(), completed: false });
    setNewHabit('');
    loadData();
  };

  const deleteHabit = async (id) => { await base44.entities.HabitLog.delete(id); loadData(); };

  const initDefaultHabits = async () => {
    const user = await base44.auth.me();
    const toAdd = DEFAULT_HABITS.filter(h => !todayLogs.find(l => l.habit === h));
    await Promise.all(toAdd.map(habit => base44.entities.HabitLog.create({ user_id: user.id, date: today, habit, completed: false })));
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const completed = todayLogs.filter(h => h.completed).length;
  const total = todayLogs.length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Build daily completion for charts
  const dateSet = [...new Set(allLogs.map(l => l.date))];
  const dailyCompleted = dateSet.map(date => {
    const dayLogs = allLogs.filter(l => l.date === date);
    return { date, count: dayLogs.filter(l => l.completed).length };
  });
  const weekData = buildWeekData(dailyCompleted, 'date', 'count', 'first');
  const monthData = buildMonthData(dailyCompleted, 'date', 'count', 'first');
  const streak = calcStreak(dailyCompleted.filter(l => l.count > 0));

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-heading font-bold text-2xl">{completed}<span className="text-sm font-normal text-muted-foreground">/{total} habits</span></p>
            <p className="text-[11px] text-muted-foreground">{completionPct}% complete today</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame size={16} className="text-orange-400" />
            <span className="font-bold text-orange-400">{streak}</span>
            <span className="text-[11px] text-muted-foreground">day streak</span>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-yellow-400 rounded-full transition-all duration-700" style={{ width: `${completionPct}%` }} />
        </div>
      </div>

      {/* Today habits */}
      <div className="space-y-2">
        {todayLogs.map(log => (
          <div key={log.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${log.completed ? 'bg-accent/8 border-accent/30' : 'bg-card border-border'}`}>
            <button onClick={() => toggleHabit(log)} className="flex-shrink-0 active:scale-90 transition-transform">
              {log.completed
                ? <CheckSquare size={20} className="text-accent" />
                : <Square size={20} className="text-muted-foreground" />}
            </button>
            <span className={`flex-1 text-sm ${log.completed ? 'line-through text-muted-foreground' : ''}`}>{log.habit}</span>
            <button onClick={() => deleteHabit(log.id)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted active:scale-90">
              <X size={12} className="text-muted-foreground" />
            </button>
          </div>
        ))}
        {!todayLogs.length && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">No habits for today.</p>
            <Button onClick={initDefaultHabits} variant="outline" className="rounded-xl h-9 text-xs">
              + Add default habits
            </Button>
          </div>
        )}
      </div>

      {/* Custom habit add */}
      <div className="flex gap-2">
        <Input placeholder="Add a custom habit..." value={newHabit} onChange={e => setNewHabit(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addHabit(newHabit)}
          className="h-11 rounded-xl bg-card border-border flex-1" />
        <Button onClick={() => addHabit(newHabit)} className="h-11 rounded-xl bg-yellow-500 text-white px-4">
          <Plus size={15} />
        </Button>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-2">
        {DEFAULT_HABITS.filter(h => !todayLogs.find(l => l.habit === h)).slice(0, 4).map(h => (
          <button key={h} onClick={() => addHabit(h)}
            className="text-[11px] bg-card border border-border rounded-full px-3 py-1.5 hover:border-accent/50 active:scale-95 transition-all">
            + {h}
          </button>
        ))}
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Habit Days" emoji="✅" />
      <AchievementBadge streak={streak} count={allLogs.filter(l => l.completed).length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week</p>
        <WeekBarChart data={weekData} dataKey="count" color="#eab308" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="count" color="#eab308" />
      </div>
      <DeviceSyncBanner />
    </div>
  );
}