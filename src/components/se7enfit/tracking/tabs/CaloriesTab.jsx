import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flame, Plus, Zap, Check, X, Utensils } from 'lucide-react';
import { getToday, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget, getActivityLevel } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { TodayProgressCard, AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner', 'pre_workout', 'post_workout', 'supplements'];

export default function CaloriesTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [monthLogs, setMonthLogs] = useState([]);
  const [form, setForm] = useState({ food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', meal_type: 'lunch' });
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const today = getToday();

  const bmr = profile ? calculateBMR(profile.weight_kg, profile.height_cm, profile.age, profile.gender) : 2000;
  const tdee = calculateTDEE(bmr, getActivityLevel(profile?.workout_days_per_week));
  const calorieGoal = calculateCalorieTarget(tdee, profile?.goal);
  const proteinGoal = calculateProteinTarget(profile?.weight_kg, profile?.goal);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [todayData, hist] = await Promise.all([
      base44.entities.NutritionLog.filter({ user_id: user.id, date: today }),
      base44.entities.NutritionLog.filter({ user_id: user.id }, '-date', 200),
    ]);
    setLogs(todayData);
    setMonthLogs(hist);
    setLoading(false);
    fetchInsight(todayData, hist);
  };

  const fetchInsight = async (todayData, hist) => {
    setInsightLoading(true);
    const todayCal = todayData.reduce((s, l) => s + (l.calories || 0), 0);
    const avgCal = hist.length ? Math.round(hist.slice(0, 30).reduce((s, l) => s + (l.calories || 0), 0) / Math.min(hist.length, 30)) : 0;
    const text = await getTrackingInsight('Calories', todayCal, calorieGoal, 'kcal', avgCal, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const addEntry = async () => {
    if (!form.food_name || !form.calories) return;
    const user = await base44.auth.me();
    await base44.entities.NutritionLog.create({
      user_id: user.id, date: today,
      food_name: form.food_name,
      calories: Number(form.calories),
      protein_g: Number(form.protein_g) || 0,
      carbs_g: Number(form.carbs_g) || 0,
      fat_g: Number(form.fat_g) || 0,
      meal_type: form.meal_type,
    });
    toast({ title: 'Meal logged 🍽️' });
    setForm({ food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', meal_type: 'lunch' });
    loadData();
  };

  const deleteLog = async (id) => {
    await base44.entities.NutritionLog.delete(id);
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayCal = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const todayProtein = logs.reduce((s, l) => s + (l.protein_g || 0), 0);
  const percent = Math.min((todayCal / calorieGoal) * 100, 100);

  // Aggregate daily calories for charts
  const allDates = [...new Set(monthLogs.map(l => l.date))];
  const dailyCalMap = {};
  monthLogs.forEach(l => { dailyCalMap[l.date] = (dailyCalMap[l.date] || 0) + (l.calories || 0); });
  const augLogs = allDates.map(d => ({ date: d, calories: dailyCalMap[d] || 0 }));
  const weekData = buildWeekData(augLogs, 'date', 'calories', 'first');
  const monthData = buildMonthData(augLogs, 'date', 'calories', 'first');
  const streak = calcStreak(augLogs.filter(l => l.calories > 0));

  return (
    <div className="space-y-4">
      <TodayProgressCard label="Calories Today" value={todayCal} unit="kcal" goalValue={calorieGoal} goalUnit="kcal" percent={percent} color="hsl(var(--accent))">
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] text-muted-foreground"><Zap size={10} className="inline mr-0.5" />{Math.round(todayProtein)}g protein</span>
          <span className="text-[11px] text-muted-foreground"><Flame size={10} className="inline mr-0.5" />{calorieGoal - todayCal > 0 ? calorieGoal - todayCal : 0} kcal remaining</span>
        </div>
      </TodayProgressCard>

      {/* Macro summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Protein', val: Math.round(todayProtein), goal: proteinGoal, unit: 'g', color: 'bg-green-400' },
          { label: 'Carbs', val: Math.round(logs.reduce((s, l) => s + (l.carbs_g || 0), 0)), goal: Math.round(calorieGoal * 0.45 / 4), unit: 'g', color: 'bg-yellow-400' },
          { label: 'Fat', val: Math.round(logs.reduce((s, l) => s + (l.fat_g || 0), 0)), goal: Math.round(calorieGoal * 0.25 / 9), unit: 'g', color: 'bg-orange-400' },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
            <p className="text-sm font-bold font-heading">{m.val}<span className="text-[10px] text-muted-foreground font-normal">/{m.goal}{m.unit}</span></p>
            <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${m.color}`} style={{ width: `${Math.min((m.val / m.goal) * 100, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="font-heading font-semibold text-sm flex items-center gap-1.5"><Utensils size={14} className="text-accent" /> Log Meal</p>
        <Input placeholder="Food name" value={form.food_name} onChange={e => setForm(p => ({ ...p, food_name: e.target.value }))} className="h-10 rounded-xl bg-background border-border" />
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[11px]">Calories (kcal)</Label><Input type="number" placeholder="200" value={form.calories} onChange={e => setForm(p => ({ ...p, calories: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Protein (g)</Label><Input type="number" placeholder="15" value={form.protein_g} onChange={e => setForm(p => ({ ...p, protein_g: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Carbs (g)</Label><Input type="number" placeholder="30" value={form.carbs_g} onChange={e => setForm(p => ({ ...p, carbs_g: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Fat (g)</Label><Input type="number" placeholder="8" value={form.fat_g} onChange={e => setForm(p => ({ ...p, fat_g: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
        </div>
        <Select value={form.meal_type} onValueChange={v => setForm(p => ({ ...p, meal_type: v }))}>
          <SelectTrigger className="h-9 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
          <SelectContent>{MEAL_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={addEntry} className="w-full h-10 rounded-xl bg-accent text-accent-foreground">
          <Plus size={14} /> Add Entry
        </Button>
        <Link to="/nutrition/log" className="block text-center text-[11px] text-accent hover:underline">→ AI-powered meal log (with photo scan)</Link>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Calories" emoji="🔥" />
      <AchievementBadge streak={streak} count={monthLogs.length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week</p>
        <WeekBarChart data={weekData} dataKey="calories" color="hsl(var(--accent))" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="calories" color="hsl(var(--accent))" goalValue={calorieGoal} />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">Today's Meals</p>
        <div className="space-y-2">
          {logs.map(log => (
            <HistoryItem key={log.id}
              title={log.food_name}
              subtitle={`${log.meal_type?.replace('_', ' ')} • P:${log.protein_g || 0}g C:${log.carbs_g || 0}g F:${log.fat_g || 0}g`}
              value={log.calories} unit="kcal"
              onDelete={() => deleteLog(log.id)}
            />
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No meals logged today.</p>}
        </div>
      </div>
      <DeviceSyncBanner />
    </div>
  );
}