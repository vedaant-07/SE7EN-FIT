import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler, Check, X } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { MonthLineChart } from '../TrackingChart';
import { useToast } from '@/components/ui/use-toast';

const FIELDS = [
  { key: 'chest_cm', label: 'Chest' },
  { key: 'waist_cm', label: 'Waist' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'arms_cm', label: 'Arms' },
  { key: 'thighs_cm', label: 'Thighs' },
  { key: 'calves_cm', label: 'Calves' },
  { key: 'shoulders_cm', label: 'Shoulders' },
  { key: 'neck_cm', label: 'Neck' },
];

export default function MeasurementsTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.BodyMeasurement.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    if (data.length) fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const latest = data[0];
    const prev = data[1];
    const waistChange = latest?.waist_cm && prev?.waist_cm ? (latest.waist_cm - prev.waist_cm).toFixed(1) : 'N/A';
    const text = await getTrackingInsight('Body Measurements (waist focus)', latest?.waist_cm || 0, (profile?.goal === 'weight_loss' ? (latest?.waist_cm || 80) - 5 : latest?.waist_cm || 80), 'cm', 0, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const handleSave = async () => {
    const vals = Object.values(form).filter(v => v);
    if (!vals.length) return;
    const user = await base44.auth.me();
    await base44.entities.BodyMeasurement.create({ user_id: user.id, date: today, ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v ? Number(v) : undefined])) });
    toast({ title: 'Measurements saved 📏' });
    setForm({});
    loadData();
  };

  const deleteLog = async (id) => { await base44.entities.BodyMeasurement.delete(id); loadData(); };

  const saveEdit = async () => {
    await base44.entities.BodyMeasurement.update(editId, Object.fromEntries(Object.entries(editForm).map(([k, v]) => [k, v ? Number(v) : undefined])));
    setEditId(null);
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const latest = logs[0];
  const prev = logs[1];
  const streak = calcStreak(logs);

  // Waist trend for chart
  const waistLogs = logs.map(l => ({ date: l.date, waist_cm: l.waist_cm || 0 })).filter(l => l.waist_cm > 0).reverse();
  const monthData = waistLogs.map((l, i) => ({ label: i % 3 === 0 ? new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '', waist_cm: l.waist_cm }));

  return (
    <div className="space-y-4">
      {/* Latest snapshot */}
      {latest && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="font-heading font-semibold text-sm mb-3 flex items-center gap-1.5"><Ruler size={14} className="text-pink-400" /> Latest Measurements</p>
          <div className="grid grid-cols-4 gap-2">
            {FIELDS.map(f => (
              <div key={f.key} className="bg-muted/50 rounded-xl p-2 text-center">
                <p className="text-[9px] text-muted-foreground mb-0.5">{f.label}</p>
                <p className="text-xs font-bold">{latest[f.key] ? `${latest[f.key]}cm` : '—'}</p>
                {prev && prev[f.key] && latest[f.key] && (
                  <p className={`text-[8px] ${latest[f.key] < prev[f.key] ? 'text-green-400' : latest[f.key] > prev[f.key] ? 'text-orange-400' : 'text-muted-foreground'}`}>
                    {latest[f.key] < prev[f.key] ? '▼' : latest[f.key] > prev[f.key] ? '▲' : '='}{Math.abs(latest[f.key] - prev[f.key]).toFixed(1)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="font-heading font-semibold text-sm">Log Measurements (cm)</p>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(f => (
            <div key={f.key}>
              <Label className="text-[11px]">{f.label} (cm)</Label>
              <Input type="number" step="0.5" placeholder="e.g. 85" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="h-9 mt-0.5 rounded-lg bg-background border-border" />
            </div>
          ))}
        </div>
        <Button onClick={handleSave} className="w-full h-10 rounded-xl bg-pink-500 text-white">
          <Check size={14} /> Save Measurements
        </Button>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Measurement Logs" emoji="📏" />
      <AchievementBadge streak={streak} count={logs.length} />

      {monthData.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="font-heading font-semibold text-sm mb-3">Waist Trend</p>
          <MonthLineChart data={monthData} dataKey="waist_cm" color="#ec4899" />
        </div>
      )}

      <div>
        <p className="font-heading font-semibold text-sm mb-2">History</p>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => (
            editId === log.id ? (
              <div key={log.id} className="bg-card border border-pink-500/40 rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {FIELDS.map(f => (
                    <div key={f.key}>
                      <Label className="text-[11px]">{f.label}</Label>
                      <Input type="number" step="0.5" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} className="h-8 mt-0.5 rounded-lg text-sm" />
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
                title={new Date(log.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                subtitle={`W:${log.waist_cm || '—'}cm · C:${log.chest_cm || '—'}cm · H:${log.hips_cm || '—'}cm`}
                value="" unit=""
                onEdit={() => { setEditId(log.id); setEditForm(Object.fromEntries(FIELDS.map(f => [f.key, log[f.key] ? String(log[f.key]) : '']))); }}
                onDelete={() => deleteLog(log.id)}
              />
            )
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No measurements logged yet.</p>}
        </div>
      </div>
      <DeviceSyncBanner />
    </div>
  );
}