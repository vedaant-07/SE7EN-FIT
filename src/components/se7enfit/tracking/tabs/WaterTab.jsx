import React, { useState, useEffect } from 'react';
// WaterTab — full water tracking with history, charts, AI insight, streak
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Droplets, Plus, Check, X } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { TodayProgressCard, AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import { useToast } from '@/components/ui/use-toast';

export default function WaterTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const today = getToday();
  const goal = profile?.daily_water_goal_ml || 2500;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.WaterLog.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const todayTotal = data.filter(l => l.date === today).reduce((s, l) => s + (l.amount_ml || 0), 0);
    const avg7 = data.length ? Math.round(data.slice(0, 14).reduce((s, l) => s + (l.amount_ml || 0), 0) / 7) : 0;
    const text = await getTrackingInsight('Water Intake', todayTotal, goal, 'ml', avg7, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const addWater = async (ml) => {
    const user = await base44.auth.me();
    await base44.entities.WaterLog.create({ user_id: user.id, date: today, amount_ml: ml, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
    toast({ title: `+${ml}ml 💧` });
    loadData();
  };

  const deleteLog = async (id) => { await base44.entities.WaterLog.delete(id); loadData(); };

  const saveEdit = async () => {
    if (!editVal) return;
    await base44.entities.WaterLog.update(editId, { amount_ml: Number(editVal) });
    setEditId(null); setEditVal('');
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayLogs = logs.filter(l => l.date === today);
  const todayTotal = todayLogs.reduce((s, l) => s + (l.amount_ml || 0), 0);
  const glasses = Math.round(todayTotal / 250);
  const percent = Math.min((todayTotal / goal) * 100, 100);

  // Aggregate by day
  const dayMap = {};
  logs.forEach(l => { dayMap[l.date] = (dayMap[l.date] || 0) + (l.amount_ml || 0); });
  const dailyLogs = Object.entries(dayMap).map(([date, amount_ml]) => ({ date, amount_ml }));
  const weekData = buildWeekData(dailyLogs, 'date', 'amount_ml', 'first');
  const monthData = buildMonthData(dailyLogs, 'date', 'amount_ml', 'first');
  const streak = calcStreak(dailyLogs.filter(l => l.amount_ml >= goal * 0.8));

  return (
    <div className="space-y-4">
      <TodayProgressCard label="Water Today" value={todayTotal} unit="ml" goalValue={goal} goalUnit="ml" percent={percent} color="#3b82f6">
        <p className="text-[11px] text-muted-foreground mt-1">{glasses} glasses · {goal - todayTotal > 0 ? goal - todayTotal : 0}ml remaining</p>
      </TodayProgressCard>

      {/* Quick presets */}
      <div className="grid grid-cols-4 gap-2">
        {[150, 250, 500, 750].map(ml => (
          <button key={ml} onClick={() => addWater(ml)}
            className="bg-card border border-border rounded-xl py-2.5 text-center active:scale-95 transition-all hover:border-blue-500/40">
            <Droplets size={12} className="text-blue-400 mx-auto mb-0.5" />
            <p className="text-xs font-medium">{ml}ml</p>
          </button>
        ))}
      </div>

      {/* Custom add */}
      <div className="flex gap-2">
        <Input type="number" placeholder="Custom ml" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && input && addWater(Number(input))}
          className="h-11 rounded-xl bg-card border-border flex-1" />
        <Button onClick={() => { if (input) { addWater(Number(input)); setInput(''); } }}
          className="h-11 rounded-xl bg-blue-500 text-white px-4">
          <Plus size={15} /> Add
        </Button>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Water Goal" emoji="💧" />
      <AchievementBadge streak={streak} count={dailyLogs.length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week</p>
        <WeekBarChart data={weekData} dataKey="amount_ml" color="#3b82f6" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="amount_ml" color="#3b82f6" goalValue={goal} />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">Today's Log</p>
        <div className="space-y-2">
          {todayLogs.map(log => (
            editId === log.id ? (
              <div key={log.id} className="bg-card border border-blue-500/40 rounded-xl p-3 flex gap-2">
                <Input type="number" value={editVal} onChange={e => setEditVal(e.target.value)} className="h-9 flex-1 rounded-lg" />
                <button onClick={saveEdit} className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center"><Check size={14} className="text-accent" /></button>
                <button onClick={() => setEditId(null)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><X size={14} /></button>
              </div>
            ) : (
              <HistoryItem key={log.id} title={`${log.amount_ml}ml`} subtitle={log.time || ''} value={log.amount_ml} unit="ml"
                onEdit={() => { setEditId(log.id); setEditVal(String(log.amount_ml)); }}
                onDelete={() => deleteLog(log.id)} />
            )
          ))}
          {!todayLogs.length && <p className="text-center text-sm text-muted-foreground py-4">No water logged today.</p>}
        </div>
      </div>
      <DeviceSyncBanner />
    </div>
  );
}