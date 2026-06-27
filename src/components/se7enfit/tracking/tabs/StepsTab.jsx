import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, Footprints, Plus, MapPin, Flame, Pencil, Check, X } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { TodayProgressCard, AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import LiveTracker from '@/components/se7enfit/tracking/LiveTracker';
import { useToast } from '@/components/ui/use-toast';

export default function StepsTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [showLive, setShowLive] = useState(false);
  const today = getToday();
  const goal = profile?.daily_step_goal || 8000;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.StepLog.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const todayLog = data.find(l => l.date === today);
    const todayVal = todayLog?.steps || 0;
    const avg = data.length ? Math.round(data.slice(0, 7).reduce((s, l) => s + (l.steps || 0), 0) / Math.min(data.length, 7)) : 0;
    const text = await getTrackingInsight('Steps', todayVal, goal, 'steps', avg, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const addSteps = async () => {
    if (!input) return;
    const user = await base44.auth.me();
    const existing = logs.find(l => l.date === today);
    const steps = Number(input);
    if (existing) {
      await base44.entities.StepLog.update(existing.id, {
        steps: existing.steps + steps,
        distance_km: (existing.distance_km || 0) + Math.round(steps * 0.0008 * 100) / 100,
        calories_burned: (existing.calories_burned || 0) + Math.round(steps * 0.04)
      });
    } else {
      await base44.entities.StepLog.create({
        user_id: user.id,
        date: today,
        steps,
        distance_km: Math.round(steps * 0.0008 * 100) / 100,
        calories_burned: Math.round(steps * 0.04),
        source: 'manual'
      });
    }
    toast({ title: `+${steps.toLocaleString()} steps added 🚶` });
    setInput('');
    loadData();
  };

  const deleteLog = async (id) => {
    await base44.entities.StepLog.delete(id);
    toast({ title: 'Log deleted' });
    loadData();
  };

  const saveEdit = async () => {
    if (!editVal) return;
    await base44.entities.StepLog.update(editId, { steps: Number(editVal) });
    setEditId(null); setEditVal('');
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayLog = logs.find(l => l.date === today);
  const todaySteps = todayLog?.steps || 0;
  const percent = Math.min((todaySteps / goal) * 100, 100);
  const weekData = buildWeekData(logs, 'date', 'steps', 'first');
  const monthData = buildMonthData(logs, 'date', 'steps', 'first');
  const streak = calcStreak(logs);

  const handleLiveSession = async (session) => {
    const user = await base44.auth.me();
    const existing = logs.find(l => l.date === today);
    if (existing) {
      await base44.entities.StepLog.update(existing.id, {
        steps: (existing.steps || 0) + session.steps,
        distance_km: Math.round(((existing.distance_km || 0) + session.distanceKm) * 100) / 100,
        calories_burned: (existing.calories_burned || 0) + session.calories,
      });
    } else {
      await base44.entities.StepLog.create({
        user_id: user.id,
        date: today,
        steps: session.steps,
        distance_km: Math.round(session.distanceKm * 100) / 100,
        calories_burned: session.calories,
        source: 'live_tracker',
      });
    }
    toast({ title: `Live session saved — ${session.steps.toLocaleString()} steps` });
    setShowLive(false);
    loadData();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Activity size={16} />
              </div>
              <div>
                <p className="font-heading text-sm font-bold text-foreground">Live Walk Session</p>
                <p className="text-xs text-muted-foreground">Track a focused walking session with a clean timer.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowLive(p => !p)}
            className={`h-9 shrink-0 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95 ${
              showLive
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {showLive ? 'Hide' : 'Open'}
          </button>
        </div>

        {!showLive && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-background/70 px-2 py-3">
              <p className="text-[10px] text-muted-foreground">Focus</p>
              <p className="mt-0.5 text-xs font-bold text-foreground">Walking</p>
            </div>
            <div className="rounded-xl bg-background/70 px-2 py-3">
              <p className="text-[10px] text-muted-foreground">Goal</p>
              <p className="mt-0.5 text-xs font-bold text-foreground">Steps</p>
            </div>
            <div className="rounded-xl bg-background/70 px-2 py-3">
              <p className="text-[10px] text-muted-foreground">Save</p>
              <p className="mt-0.5 text-xs font-bold text-foreground">Auto</p>
            </div>
          </div>
        )}

        {showLive && (
          <div className="mt-4">
            <LiveTracker activity="walking" weightKg={profile?.weight_kg || 70} onSessionEnd={handleLiveSession} />
          </div>
        )}
      </div>

      <TodayProgressCard label="Steps Today" value={todaySteps.toLocaleString()} unit="steps" goalValue={goal.toLocaleString()} goalUnit="steps" percent={percent} color="#a855f7">
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] text-muted-foreground"><MapPin size={10} className="inline mr-0.5" />{(todayLog?.distance_km || 0).toFixed(2)} km</span>
          <span className="text-[11px] text-muted-foreground"><Flame size={10} className="inline mr-0.5" />{todayLog?.calories_burned || 0} kcal</span>
        </div>
      </TodayProgressCard>

      <div className="grid grid-cols-4 gap-2">
        {[1000, 2000, 5000, 10000].map(s => (
          <button key={s} onClick={() => { setInput(String(s)); }}
            className="bg-card border border-border rounded-xl py-2 text-center text-xs font-medium hover:border-accent/50 active:scale-95 transition-all">
            {s.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input type="number" placeholder="Enter steps" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSteps()}
          className="h-11 rounded-xl bg-card border-border flex-1" />
        <Button onClick={addSteps} className="h-11 rounded-xl bg-accent text-accent-foreground px-4">
          <Plus size={15} /> Add
        </Button>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />

      <StreakCard streak={streak} label="Steps" emoji="🚶" />
      <AchievementBadge streak={streak} count={logs.length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week</p>
        <WeekBarChart data={weekData} dataKey="steps" color="#a855f7" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="steps" color="#a855f7" goalValue={goal} />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">History</p>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => (
            editId === log.id ? (
              <div key={log.id} className="bg-card border border-accent/40 rounded-xl p-3 flex gap-2">
                <Input type="number" value={editVal} onChange={e => setEditVal(e.target.value)} className="h-9 flex-1 rounded-lg" />
                <button onClick={saveEdit} className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center"><Check size={14} className="text-accent" /></button>
                <button onClick={() => setEditId(null)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><X size={14} /></button>
              </div>
            ) : (
              <HistoryItem key={log.id}
                title={new Date(log.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                subtitle={`${(log.distance_km || 0).toFixed(2)} km • ${log.calories_burned || 0} kcal`}
                value={log.steps?.toLocaleString()} unit="steps"
                onEdit={() => { setEditId(log.id); setEditVal(String(log.steps)); }}
                onDelete={() => deleteLog(log.id)}
              />
            )
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No steps logged yet.</p>}
        </div>
      </div>

      <DeviceSyncBanner />
    </div>
  );
}
