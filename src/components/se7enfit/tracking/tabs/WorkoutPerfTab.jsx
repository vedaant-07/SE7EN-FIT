import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dumbbell, Flame, Clock, Check } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { TodayProgressCard, AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function WorkoutPerfTab({ profile }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const today = getToday();
  const weeklyGoal = profile?.workout_days_per_week || 4;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.WorkoutLog.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const thisWeek = data.filter(l => {
      const d = new Date(l.date); const now = new Date();
      const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }).filter(l => l.completed).length;
    const avgDuration = data.length ? Math.round(data.reduce((s, l) => s + (l.duration_minutes || 0), 0) / data.length) : 0;
    const text = await getTrackingInsight('Workout Performance', thisWeek, weeklyGoal, 'workouts/week', avgDuration, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayLog = logs.find(l => l.date === today && l.completed);
  const completedLogs = logs.filter(l => l.completed);
  const totalWorkouts = completedLogs.length;
  const avgDuration = totalWorkouts ? Math.round(completedLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0) / totalWorkouts) : 0;
  const avgCalories = totalWorkouts ? Math.round(completedLogs.reduce((s, l) => s + (l.calories_burned || 0), 0) / totalWorkouts) : 0;
  const thisWeekCount = completedLogs.filter(l => { const d = new Date(l.date); const wa = new Date(); wa.setDate(wa.getDate() - 7); return d >= wa; }).length;
  const weekPercent = Math.min((thisWeekCount / weeklyGoal) * 100, 100);

  const countLogs = completedLogs.map(l => ({ date: l.date, count: 1 }));
  const weekData = buildWeekData(countLogs, 'date', 'count', 'count');
  const monthData = buildMonthData(countLogs, 'date', 'count', 'count');
  const streak = calcStreak(completedLogs);

  return (
    <div className="space-y-4">
      <TodayProgressCard label="Workouts This Week" value={thisWeekCount} unit={`/ ${weeklyGoal} goal`} goalValue={weeklyGoal} goalUnit="workouts" percent={weekPercent} color="hsl(var(--accent))">
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] text-muted-foreground"><Clock size={10} className="inline mr-0.5" />Avg {avgDuration} min</span>
          <span className="text-[11px] text-muted-foreground"><Flame size={10} className="inline mr-0.5" />Avg {avgCalories} kcal</span>
        </div>
      </TodayProgressCard>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center"><p className="text-[10px] text-muted-foreground mb-1">Total</p><p className="text-sm font-bold">{totalWorkouts}</p><p className="text-[9px] text-muted-foreground">workouts</p></div>
        <div className="bg-card border border-border rounded-xl p-3 text-center"><p className="text-[10px] text-muted-foreground mb-1">Avg Time</p><p className="text-sm font-bold">{avgDuration}</p><p className="text-[9px] text-muted-foreground">minutes</p></div>
        <div className="bg-card border border-border rounded-xl p-3 text-center"><p className="text-[10px] text-muted-foreground mb-1">Today</p><p className="text-sm font-bold">{todayLog ? '✓' : '—'}</p><p className="text-[9px] text-muted-foreground">{todayLog ? 'Done!' : 'Pending'}</p></div>
      </div>

      {!todayLog && (
        <Link to="/workout/log" className="block">
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 flex items-center gap-3 hover:border-accent/50 active:scale-[0.99] transition-all">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Dumbbell size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-semibold text-sm leading-tight truncate">Log Today's Workout</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">Tap to log your session</p>
            </div>
            <Button size="sm" className="rounded-xl bg-white text-black hover:bg-white/90 h-8 px-4 text-xs font-bold flex-shrink-0">Log</Button>
          </div>
        </Link>
      )}

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Workout Days" emoji="💪" />
      <AchievementBadge streak={streak} count={totalWorkouts} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week</p>
        <WeekBarChart data={weekData} dataKey="count" color="hsl(var(--accent))" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="count" color="hsl(var(--accent))" goalValue={weeklyGoal / 7} />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">Recent Workouts</p>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => (
            <HistoryItem key={log.id}
              title={log.day_name || log.workout_type || 'Workout'}
              subtitle={`${log.duration_minutes || 0} min · ${log.calories_burned || 0} kcal · ${log.difficulty_rating ? `Difficulty ${log.difficulty_rating}/10` : ''}`}
              value={log.completed ? '✓' : '—'} unit=""
            />
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No workouts logged yet.</p>}
        </div>
      </div>
      <DeviceSyncBanner />
    </div>
  );
}
