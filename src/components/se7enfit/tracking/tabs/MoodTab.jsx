import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Smile, Check, X } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { buildWeekData, buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { WeekBarChart, MonthLineChart } from '../TrackingChart';
import { useToast } from '@/components/ui/use-toast';

const MOODS = [
  { score: 1, emoji: '😞', label: 'Terrible' },
  { score: 2, emoji: '😕', label: 'Bad' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😄', label: 'Great' },
];

export default function MoodTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ mood_score: 4, energy_level: 3, stress_level: 3, notes: '' });
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.MoodLog.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const todayLog = data.find(l => l.date === today);
    const avg = data.length ? Math.round(data.slice(0, 7).reduce((s, l) => s + (l.mood_score || 3), 0) / Math.min(data.length, 7) * 10) / 10 : 3;
    const text = await getTrackingInsight('Mood & Energy', todayLog?.mood_score || 0, 5, '/5', avg, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const handleSave = async () => {
    const user = await base44.auth.me();
    const existing = logs.find(l => l.date === today);
    if (existing) {
      await base44.entities.MoodLog.update(existing.id, { mood_score: form.mood_score, energy_level: form.energy_level, stress_level: form.stress_level, notes: form.notes });
    } else {
      await base44.entities.MoodLog.create({ user_id: user.id, date: today, mood_score: form.mood_score, energy_level: form.energy_level, stress_level: form.stress_level, notes: form.notes });
    }
    toast({ title: 'Mood logged 😊' });
    loadData();
  };

  const deleteLog = async (id) => { await base44.entities.MoodLog.delete(id); loadData(); };

  const saveEdit = async () => {
    await base44.entities.MoodLog.update(editId, { mood_score: Number(editForm.mood_score), energy_level: Number(editForm.energy_level), stress_level: Number(editForm.stress_level) });
    setEditId(null);
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const todayLog = logs.find(l => l.date === today);
  const streak = calcStreak(logs);
  const weekData = buildWeekData(logs, 'date', 'mood_score', 'first');
  const monthData = buildMonthData(logs, 'date', 'mood_score', 'first');

  return (
    <div className="space-y-4">
      {/* Today's mood display */}
      {todayLog ? (
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-5xl mb-2">{MOODS.find(m => m.score === todayLog.mood_score)?.emoji || '😐'}</p>
          <p className="font-heading font-bold text-lg">{MOODS.find(m => m.score === todayLog.mood_score)?.label}</p>
          <div className="flex justify-center gap-4 mt-2">
            <span className="text-[11px] text-muted-foreground">⚡ Energy: {todayLog.energy_level}/5</span>
            <span className="text-[11px] text-muted-foreground">😤 Stress: {todayLog.stress_level}/5</span>
          </div>
          {todayLog.notes && <p className="text-xs text-muted-foreground mt-2 italic">"{todayLog.notes}"</p>}
        </div>
      ) : (
        <div className="bg-card border border-dashed border-border rounded-2xl p-4 text-center">
          <Smile size={28} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">How are you feeling today?</p>
        </div>
      )}

      {/* Mood picker form */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <p className="font-heading font-semibold text-sm">Log Today's Mood</p>

        <div>
          <Label className="text-[11px] mb-2 block">Mood</Label>
          <div className="flex justify-between">
            {MOODS.map(m => (
              <button key={m.score} onClick={() => setForm(p => ({ ...p, mood_score: m.score }))}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-90 ${form.mood_score === m.score ? 'bg-accent/20 border border-accent/40 scale-110' : 'hover:bg-muted'}`}>
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px] text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px]">Energy (1-5)</Label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setForm(p => ({ ...p, energy_level: n }))}
                  className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all active:scale-90 ${form.energy_level === n ? 'bg-yellow-400 text-black' : 'bg-muted hover:bg-muted/80'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Stress (1-5)</Label>
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setForm(p => ({ ...p, stress_level: n }))}
                  className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all active:scale-90 ${form.stress_level === n ? 'bg-red-400 text-white' : 'bg-muted hover:bg-muted/80'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Input placeholder="Notes (optional)..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="h-9 rounded-xl bg-background border-border" />
        <Button onClick={handleSave} className="w-full h-10 rounded-xl bg-teal-500 text-white">
          <Check size={14} /> Save Mood
        </Button>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Mood Logs" emoji="😊" />
      <AchievementBadge streak={streak} count={logs.length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">This Week</p>
        <WeekBarChart data={weekData} dataKey="mood_score" color="#14b8a6" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">Last 30 Days</p>
        <MonthLineChart data={monthData} dataKey="mood_score" color="#14b8a6" goalValue={4} />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">Mood History</p>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => (
            editId === log.id ? (
              <div key={log.id} className="bg-card border border-teal-500/40 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {['mood_score', 'energy_level', 'stress_level'].map(k => (
                    <div key={k}><Label className="text-[10px]">{k.replace('_', ' ')}</Label>
                      <Input type="number" min="1" max="5" value={editForm[k] || ''} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} className="h-8 rounded-lg mt-0.5" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 h-8 rounded-lg bg-accent/20 text-accent text-xs font-medium flex items-center justify-center gap-1"><Check size={12} /> Save</button>
                  <button onClick={() => setEditId(null)} className="flex-1 h-8 rounded-lg bg-muted text-xs font-medium flex items-center justify-center gap-1"><X size={12} /> Cancel</button>
                </div>
              </div>
            ) : (
              <HistoryItem key={log.id}
                title={`${MOODS.find(m => m.score === log.mood_score)?.emoji || '😐'} ${MOODS.find(m => m.score === log.mood_score)?.label || 'Okay'}`}
                subtitle={`${new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · Energy ${log.energy_level}/5 · Stress ${log.stress_level}/5`}
                value={log.mood_score} unit="/5"
                onEdit={() => { setEditId(log.id); setEditForm({ mood_score: String(log.mood_score), energy_level: String(log.energy_level), stress_level: String(log.stress_level) }); }}
                onDelete={() => deleteLog(log.id)}
              />
            )
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No mood logs yet.</p>}
        </div>
      </div>
      <DeviceSyncBanner />
    </div>
  );
}