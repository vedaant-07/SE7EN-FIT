import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Flame, Clock, Check } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';
import { syncNativeHealthDay } from '@/lib/healthSync';

const ACTIVITIES = [
  { key: 'running', label: '🏃 Running', met: 9.8 },
  { key: 'walking', label: '🚶 Walking', met: 3.5 },
  { key: 'cycling', label: '🚴 Cycling', met: 7.5 },
  { key: 'treadmill', label: '🏃 Treadmill', met: 8.0 },
  { key: 'elliptical', label: '⚡ Elliptical', met: 5.0 },
  { key: 'skipping', label: '🪢 Skipping', met: 12.3 },
  { key: 'swimming', label: '🏊 Swimming', met: 8.0 },
];

export default function CardioTracking() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ activity: 'running', duration_minutes: '', distance_km: '', avg_heart_rate: '', notes: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    await syncNativeHealthDay(base44, null, getToday()).catch(() => null);
    const cardioLogs = await base44.entities.CardioLog.filter({ user_id: user.id }, '-date', 20);
    setLogs(cardioLogs);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.duration_minutes) return;
    setSaving(true);
    const user = await base44.auth.me();
    const activity = ACTIVITIES.find(a => a.key === form.activity);
    const weight = 70;
    const calories = Math.round((activity.met * weight * Number(form.duration_minutes)) / 60);
    await base44.entities.CardioLog.create({
      user_id: user.id,
      date: getToday(),
      activity: form.activity,
      duration_minutes: Number(form.duration_minutes),
      distance_km: form.distance_km ? Number(form.distance_km) : undefined,
      avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : undefined,
      calories_burned: calories,
      notes: form.notes || undefined,
      source: 'manual',
    });
    toast({ title: 'Cardio logged 🔥' });
    setForm({ activity: 'running', duration_minutes: '', distance_km: '', avg_heart_rate: '', notes: '' });
    loadData();
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayLogs = logs.filter(l => l.date === getToday());
  const todayCalories = todayLogs.reduce((s, l) => s + (l.calories_burned || 0), 0);
  const todayMinutes = todayLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);

  return (
    <>
      <TopBar title="Cardio" showBack backTo="/tracking" />
      <div className="px-4 py-4 space-y-5 pb-24">
        {todayLogs.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 text-center"><Flame size={14} className="text-orange-500 mx-auto mb-1" /><p className="text-sm font-bold">{todayCalories}</p><p className="text-[9px] text-muted-foreground">kcal</p></div>
            <div className="bg-card border border-border rounded-xl p-3 text-center"><Clock size={14} className="text-accent mx-auto mb-1" /><p className="text-sm font-bold">{todayMinutes}m</p><p className="text-[9px] text-muted-foreground">duration</p></div>
            <div className="bg-card border border-border rounded-xl p-3 text-center"><Activity size={14} className="text-red-500 mx-auto mb-1" /><p className="text-sm font-bold">{todayLogs.length}</p><p className="text-[9px] text-muted-foreground">sessions</p></div>
          </div>
        )}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <h3 className="font-heading font-semibold text-sm">Log Cardio Session</h3>
          <div><Label className="text-xs mb-1 block">Activity</Label><Select value={form.activity} onValueChange={v => setForm(p => ({ ...p, activity: v }))}><SelectTrigger className="h-10 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger><SelectContent>{ACTIVITIES.map(a => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs mb-1 block">Duration (min)</Label><Input type="number" placeholder="30" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} className="h-10 rounded-xl bg-background border-border" /></div>
            <div><Label className="text-xs mb-1 block">Distance (km)</Label><Input type="number" placeholder="5" value={form.distance_km} onChange={e => setForm(p => ({ ...p, distance_km: e.target.value }))} className="h-10 rounded-xl bg-background border-border" step="0.1" /></div>
            <div><Label className="text-xs mb-1 block">Avg Heart Rate</Label><Input type="number" placeholder="150" value={form.avg_heart_rate} onChange={e => setForm(p => ({ ...p, avg_heart_rate: e.target.value }))} className="h-10 rounded-xl bg-background border-border" /></div>
            <div><Label className="text-xs mb-1 block">Notes</Label><Input placeholder="Optional" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="h-10 rounded-xl bg-background border-border" /></div>
          </div>
          <Button onClick={handleSave} disabled={saving || !form.duration_minutes} className="w-full h-10 rounded-xl bg-accent text-accent-foreground"><Check size={14} className="mr-1" /> Log Session</Button>
        </div>
        {logs.length > 0 && <div><h3 className="font-heading font-semibold text-sm mb-3">Recent Sessions</h3><div className="space-y-2">{logs.slice(0, 10).map(log => { const act = ACTIVITIES.find(a => a.key === log.activity); return <div key={log.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between"><div><p className="text-sm font-medium">{act?.label || log.activity}</p><p className="text-xs text-muted-foreground">{log.date} • {log.duration_minutes}min</p></div><div className="text-right"><p className="text-sm font-bold text-accent">{log.calories_burned} kcal</p>{log.distance_km && <p className="text-xs text-muted-foreground">{log.distance_km} km</p>}</div></div>; })}</div></div>}
      </div>
    </>
  );
}
