import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Check, X } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { TodayProgressCard, AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import { useToast } from '@/components/ui/use-toast';

const ACTIVITIES = ['running', 'walking', 'cycling', 'treadmill', 'elliptical', 'skipping', 'swimming'];
const ACTIVITY_EMOJI = { running: '🏃', walking: '🚶', cycling: '🚴', treadmill: '🎽', elliptical: '⚡', skipping: '🪂', swimming: '🏊' };

export default function CardioTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ activity: 'running', duration_minutes: '', distance_km: '', calories_burned: '', avg_heart_rate: '' });
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const today = getToday();
  const cardioGoalMin = 150; // WHO weekly cardio recommendation in minutes

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.CardioLog.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const thisWeekMin = data.filter(l => { const d = new Date(l.date); const wa = new Date(); wa.setDate(wa.getDate() - 7); return d >= wa; }).reduce((s, l) => s + (l.duration_minutes || 0), 0);
    const text = await getTrackingInsight('Cardio', thisWeekMin, cardioGoalMin, 'min/week', 0, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const handleSave = async () => {
    if (!form.duration_minutes) return;
    const user = await base44.auth.me();
    await base44.entities.CardioLog.create({
      user_id: user.id, date: today, activity: form.activity,
      duration_minutes: Number(form.duration_minutes),
      distance_km: form.distance_km ? Number(form.distance_km) : undefined,
      calories_burned: form.calories_burned ? Number(form.calories_burned) : Math.round(Number(form.duration_minutes) * 8),
      avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : undefined,
    });
    toast({ title: `${ACTIVITY_EMOJI[form.activity]} ${form.activity} logged!` });
    setForm({ activity: 'running', duration_minutes: '', distance_km: '', calories_burned: '', avg_heart_rate: '' });
    loadData();
  };

  const deleteLog = async (id) => { await base44.entities.CardioLog.delete(id); loadData(); };

  const saveEdit = async () => {
    await base44.entities.CardioLog.update(editId, { activity: editForm.activity, duration_minutes: Number(editForm.duration_minutes), distance_km: editForm.distance_km ? Number(editForm.distance_km) : undefined });
    setEditId(null);
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayLogs = logs.filter(l => l.date === today);
  const todayMin = todayLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const weekMin = logs.filter(l => { const d = new Date(l.date); const wa = new Date(); wa.setDate(wa.getDate() - 7); return d >= wa; }).reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const percent = Math.min((weekMin / cardioGoalMin) * 100, 100);

  const durationLogs = logs.map(l => ({ date: l.date, duration_minutes: l.duration_minutes || 0 }));
  const weekData = buildWeekData(durationLogs, 'date', 'duration_minutes', 'sum');
  const monthData = buildMonthData(durationLogs, 'date', 'duration_minutes', 'sum');
  const streak = calcStreak(logs);

  return (
    <div className="space-y-4">
      <TodayProgressCard label="Cardio This Week" value={weekMin} unit="min" goalValue={cardioGoalMin} goalUnit="min (WHO)" percent={percent} color="#ef4444">
        <p className="text-[11px] text-muted-foreground mt-1">Today: {todayMin} min · {todayLogs.reduce((s, l) => s + (l.calories_burned || 0), 0)} kcal burned</p>
      </TodayProgressCard>

      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="font-heading font-semibold text-sm flex items-center gap-1.5"><Heart size={14} className="text-red-400" /> Log Cardio</p>
        <Select value={form.activity} onValueChange={v => setForm(p => ({ ...p, activity: v }))}>
          <SelectTrigger className="h-9 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
          <SelectContent>{ACTIVITIES.map(a => <SelectItem key={a} value={a}>{ACTIVITY_EMOJI[a]} {a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>)}</SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[11px]">Duration (min)</Label><Input type="number" placeholder="30" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Distance (km)</Label><Input type="number" step="0.1" placeholder="3.5" value={form.distance_km} onChange={e => setForm(p => ({ ...p, distance_km: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Calories burned</Label><Input type="number" placeholder="auto" value={form.calories_burned} onChange={e => setForm(p => ({ ...p, calories_burned: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Avg Heart Rate</Label><Input type="number" placeholder="140" value={form.avg_heart_rate} onChange={e => setForm(p => ({ ...p, avg_heart_rate: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
        </div>
        <Button onClick={handleSave} className="w-full h-10 rounded-xl bg-red-500 text-white">
          <Check size={14} /> Log Cardio
        </Button>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Cardio Days" emoji="🏃" />
      <AchievementBadge streak={streak} count={logs.length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week (min)</p>
        <WeekBarChart data={weekData} dataKey="duration_minutes" color="#ef4444" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="duration_minutes" color="#ef4444" />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">Cardio History</p>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => (
            editId === log.id ? (
              <div key={log.id} className="bg-card border border-red-500/40 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <Select value={editForm.activity} onValueChange={v => setEditForm(p => ({ ...p, activity: v }))}>
                    <SelectTrigger className="h-9 flex-1 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTIVITIES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" placeholder="min" value={editForm.duration_minutes || ''} onChange={e => setEditForm(p => ({ ...p, duration_minutes: e.target.value }))} className="h-9 w-20 rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 h-8 rounded-lg bg-accent/20 text-accent text-xs font-medium flex items-center justify-center gap-1"><Check size={12} /> Save</button>
                  <button onClick={() => setEditId(null)} className="flex-1 h-8 rounded-lg bg-muted text-xs font-medium flex items-center justify-center gap-1"><X size={12} /> Cancel</button>
                </div>
              </div>
            ) : (
              <HistoryItem key={log.id}
                title={`${ACTIVITY_EMOJI[log.activity] || '🏃'} ${log.activity}`}
                subtitle={`${new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${log.distance_km ? `${log.distance_km}km ·` : ''} ${log.calories_burned || 0} kcal${log.avg_heart_rate ? ` · ❤️ ${log.avg_heart_rate} bpm` : ''}`}
                value={log.duration_minutes} unit="min"
                onEdit={() => { setEditId(log.id); setEditForm({ activity: log.activity, duration_minutes: String(log.duration_minutes), distance_km: String(log.distance_km || '') }); }}
                onDelete={() => deleteLog(log.id)}
              />
            )
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No cardio logged yet.</p>}
        </div>
      </div>
      <DeviceSyncBanner />
    </div>
  );
}