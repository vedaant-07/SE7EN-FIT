import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Moon, Check, X, Pencil } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { TodayProgressCard, AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import { useToast } from '@/components/ui/use-toast';

export default function SleepTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ hours: '', quality: 'good', bedtime: '23:00', wake_time: '06:30' });
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const today = getToday();
  const goal = profile?.sleep_goal_hours || 7;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.SleepLog.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const todayLog = data.find(l => l.date === today);
    const avg = data.length ? Math.round(data.slice(0, 7).reduce((s, l) => s + (l.hours || 0), 0) / Math.min(data.length, 7) * 10) / 10 : 0;
    const text = await getTrackingInsight('Sleep', todayLog?.hours || 0, goal, 'hours', avg, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const handleSave = async () => {
    if (!form.hours) return;
    const user = await base44.auth.me();
    const existing = logs.find(l => l.date === today);
    if (existing) {
      await base44.entities.SleepLog.update(existing.id, { hours: Number(form.hours), quality: form.quality, bedtime: form.bedtime, wake_time: form.wake_time });
    } else {
      await base44.entities.SleepLog.create({ user_id: user.id, date: today, hours: Number(form.hours), quality: form.quality, bedtime: form.bedtime, wake_time: form.wake_time });
    }
    toast({ title: 'Sleep logged 😴' });
    setForm({ hours: '', quality: 'good', bedtime: '23:00', wake_time: '06:30' });
    loadData();
  };

  const deleteLog = async (id) => { await base44.entities.SleepLog.delete(id); loadData(); };

  const saveEdit = async () => {
    await base44.entities.SleepLog.update(editId, { hours: Number(editForm.hours), quality: editForm.quality });
    setEditId(null);
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayLog = logs.find(l => l.date === today);
  const hours = todayLog?.hours || 0;
  const percent = Math.min((hours / goal) * 100, 100);
  const qualityMap = { poor: '😫', fair: '😕', good: '😊', excellent: '😁' };

  const weekData = buildWeekData(logs, 'date', 'hours', 'first');
  const monthData = buildMonthData(logs, 'date', 'hours', 'first');
  const streak = calcStreak(logs.filter(l => l.hours >= goal));

  return (
    <div className="space-y-4">
      <TodayProgressCard label="Sleep Last Night" value={hours} unit="hrs" goalValue={goal} goalUnit="hrs" percent={percent} color="hsl(260,60%,55%)">
        {todayLog && <p className="text-[11px] text-muted-foreground mt-1">{qualityMap[todayLog.quality]} {todayLog.quality} · {todayLog.bedtime} → {todayLog.wake_time}</p>}
      </TodayProgressCard>

      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="font-heading font-semibold text-sm flex items-center gap-1.5"><Moon size={14} className="text-purple-400" /> Log Sleep</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[11px]">Hours slept</Label><Input type="number" step="0.5" placeholder="7" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Quality</Label>
            <Select value={form.quality} onValueChange={v => setForm(p => ({ ...p, quality: v }))}>
              <SelectTrigger className="h-9 mt-0.5 rounded-lg bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>{['poor', 'fair', 'good', 'excellent'].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-[11px]">Bedtime</Label><Input type="time" value={form.bedtime} onChange={e => setForm(p => ({ ...p, bedtime: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Wake time</Label><Input type="time" value={form.wake_time} onChange={e => setForm(p => ({ ...p, wake_time: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
        </div>
        <Button onClick={handleSave} className="w-full h-10 rounded-xl bg-purple-500 text-white">
          <Check size={14} /> Log Sleep
        </Button>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Sleep Goal" emoji="😴" />
      <AchievementBadge streak={streak} count={logs.length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week</p>
        <WeekBarChart data={weekData} dataKey="hours" color="hsl(260,60%,55%)" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="hours" color="hsl(260,60%,55%)" goalValue={goal} />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">Sleep History</p>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => (
            editId === log.id ? (
              <div key={log.id} className="bg-card border border-purple-500/40 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <Input type="number" step="0.5" value={editForm.hours} onChange={e => setEditForm(p => ({ ...p, hours: e.target.value }))} className="h-9 flex-1 rounded-lg" placeholder="Hours" />
                  <Select value={editForm.quality} onValueChange={v => setEditForm(p => ({ ...p, quality: v }))}>
                    <SelectTrigger className="h-9 w-28 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{['poor', 'fair', 'good', 'excellent'].map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 h-8 rounded-lg bg-accent/20 text-accent text-xs font-medium flex items-center justify-center gap-1"><Check size={12} /> Save</button>
                  <button onClick={() => setEditId(null)} className="flex-1 h-8 rounded-lg bg-muted text-xs font-medium flex items-center justify-center gap-1"><X size={12} /> Cancel</button>
                </div>
              </div>
            ) : (
              <HistoryItem key={log.id}
                title={new Date(log.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                subtitle={`${qualityMap[log.quality] || ''} ${log.quality} · ${log.bedtime || '?'} → ${log.wake_time || '?'}`}
                value={log.hours} unit="hrs"
                onEdit={() => { setEditId(log.id); setEditForm({ hours: String(log.hours), quality: log.quality }); }}
                onDelete={() => deleteLog(log.id)}
              />
            )
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No sleep logged yet.</p>}
        </div>
      </div>
      <DeviceSyncBanner />
    </div>
  );
}