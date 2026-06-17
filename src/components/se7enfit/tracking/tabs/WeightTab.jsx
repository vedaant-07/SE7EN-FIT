import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scale, TrendingDown, TrendingUp, Check, X } from 'lucide-react';
import { getToday, calculateBMI, getBMICategory } from '@/lib/fitnessUtils';
import { buildMonthData, calcStreak, getTrackingInsight } from '@/lib/trackingUtils';
import { AIInsightCard, StreakCard, AchievementBadge, HistoryItem, DeviceSyncBanner } from '../TrackingWidgets';
import { MonthLineChart } from '../TrackingChart';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import { useToast } from '@/components/ui/use-toast';

export default function WeightTab({ profile }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 60);
    setLogs(data);
    setLoading(false);
    fetchInsight(data);
  };

  const fetchInsight = async (data) => {
    setInsightLoading(true);
    const current = data[0]?.weight_kg || profile?.weight_kg || 0;
    const target = profile?.target_weight_kg || current;
    const avg7 = data.length ? Math.round(data.slice(0, 7).reduce((s, l) => s + (l.weight_kg || 0), 0) / Math.min(data.length, 7) * 10) / 10 : current;
    const text = await getTrackingInsight('Body Weight', current, target, 'kg', avg7, profile?.goal);
    setInsight(text);
    setInsightLoading(false);
  };

  const logWeight = async () => {
    if (!weight) return;
    const user = await base44.auth.me();
    await base44.entities.WeightLog.create({ user_id: user.id, date: today, weight_kg: Number(weight), body_fat_pct: bodyFat ? Number(bodyFat) : undefined });
    toast({ title: 'Weight logged ⚖️' });
    setWeight(''); setBodyFat('');
    loadData();
  };

  const deleteLog = async (id) => { await base44.entities.WeightLog.delete(id); loadData(); };

  const saveEdit = async () => {
    if (!editVal) return;
    await base44.entities.WeightLog.update(editId, { weight_kg: Number(editVal) });
    setEditId(null); setEditVal('');
    loadData();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const current = logs[0]?.weight_kg || profile?.weight_kg || 0;
  const target = profile?.target_weight_kg || current;
  const startWeight = profile?.weight_kg || current;
  const change = logs.length >= 2 ? Math.round((logs[0].weight_kg - logs[1].weight_kg) * 10) / 10 : 0;
  const totalChange = Math.round((current - startWeight) * 10) / 10;
  const toGoal = Math.abs(current - target);
  const goalProgress = startWeight !== target ? Math.min(100, Math.abs((startWeight - current) / (startWeight - target)) * 100) : 100;
  const bmi = profile?.height_cm ? calculateBMI(current, profile.height_cm) : 0;
  const bmiCat = getBMICategory(bmi);

  const chartLogs = [...logs].reverse().map(l => ({ date: l.date, weight_kg: l.weight_kg }));
  const monthData = buildMonthData(chartLogs, 'date', 'weight_kg', 'first');
  const streak = calcStreak(logs);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
        <ProgressRing percent={goalProgress} size={72} strokeWidth={6} color="#22c55e">
          <Scale size={16} className="text-accent" />
        </ProgressRing>
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Current Weight</p>
          <p className="text-2xl font-bold font-heading">{current} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {change !== 0 && (change < 0 ? <TrendingDown size={12} className="text-green-400" /> : <TrendingUp size={12} className="text-orange-400" />)}
            <span className={`text-[11px] ${change < 0 ? 'text-green-400' : change > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
              {change !== 0 ? `${change > 0 ? '+' : ''}${change} kg` : 'No prev. data'}
            </span>
            <span className="text-[11px] text-muted-foreground">· Target: {target} kg ({toGoal.toFixed(1)} to go)</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">BMI</p>
          <p className="text-sm font-bold">{bmi}</p>
          <p className={`text-[9px] ${bmiCat.color}`}>{bmiCat.label}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Total Change</p>
          <p className={`text-sm font-bold ${totalChange < 0 ? 'text-green-400' : totalChange > 0 ? 'text-orange-400' : ''}`}>{totalChange > 0 ? '+' : ''}{totalChange} kg</p>
          <p className="text-[9px] text-muted-foreground">from start</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Body Fat</p>
          <p className="text-sm font-bold">{logs[0]?.body_fat_pct || '—'}{logs[0]?.body_fat_pct ? '%' : ''}</p>
          <p className="text-[9px] text-muted-foreground">logged</p>
        </div>
      </div>

      {/* Add */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="font-heading font-semibold text-sm">Log Weight</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-[11px]">Weight (kg)</Label><Input type="number" step="0.1" placeholder="72.5" value={weight} onChange={e => setWeight(e.target.value)} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
          <div><Label className="text-[11px]">Body Fat % (opt)</Label><Input type="number" step="0.1" placeholder="20" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className="h-9 mt-0.5 rounded-lg bg-background border-border" /></div>
        </div>
        <Button onClick={logWeight} className="w-full h-10 rounded-xl bg-green-500 text-white">
          <Check size={14} /> Log Weight
        </Button>
      </div>

      <AIInsightCard insight={insight} loading={insightLoading} />
      <StreakCard streak={streak} label="Weight Logs" emoji="⚖️" />
      <AchievementBadge streak={streak} count={logs.length} />

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-heading font-semibold text-sm mb-3">30-Day Trend</p>
        <MonthLineChart data={monthData} dataKey="weight_kg" color="#22c55e" goalValue={target} />
      </div>

      <div>
        <p className="font-heading font-semibold text-sm mb-2">Weight History</p>
        <div className="space-y-2">
          {logs.slice(0, 14).map(log => (
            editId === log.id ? (
              <div key={log.id} className="bg-card border border-green-500/40 rounded-xl p-3 flex gap-2">
                <Input type="number" step="0.1" value={editVal} onChange={e => setEditVal(e.target.value)} className="h-9 flex-1 rounded-lg" />
                <button onClick={saveEdit} className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center"><Check size={14} className="text-accent" /></button>
                <button onClick={() => setEditId(null)} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><X size={14} /></button>
              </div>
            ) : (
              <HistoryItem key={log.id}
                title={new Date(log.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                subtitle={log.body_fat_pct ? `Body fat: ${log.body_fat_pct}%` : 'No body fat data'}
                value={log.weight_kg} unit="kg"
                onEdit={() => { setEditId(log.id); setEditVal(String(log.weight_kg)); }}
                onDelete={() => deleteLog(log.id)}
              />
            )
          ))}
          {!logs.length && <p className="text-center text-sm text-muted-foreground py-4">No weight logged yet.</p>}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">⚠️ BMI is a general indicator. Consult a doctor for medical advice.</p>
      <DeviceSyncBanner />
    </div>
  );
}