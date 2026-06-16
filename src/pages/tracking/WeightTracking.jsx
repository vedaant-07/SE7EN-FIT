import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scale, TrendingDown, TrendingUp, Check } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

function calculateBMI(weight, height_cm) {
  if (!weight || !height_cm) return 0;
  return Math.round((weight / Math.pow(height_cm / 100, 2)) * 10) / 10;
}
function getBMICategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
  if (bmi < 25) return { label: 'Normal', color: 'text-green-500' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-500' };
  return { label: 'Obese', color: 'text-red-500' };
}

export default function WeightTracking() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [profiles, weightLogs] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 30),
    ]);
    if (profiles.length) setProfile(profiles[0]);
    setLogs(weightLogs);
    setLoading(false);
  };

  const logWeight = async () => {
    if (!weight) return;
    const user = await base44.auth.me();
    await base44.entities.WeightLog.create({ user_id: user.id, date: getToday(), weight_kg: Number(weight) });
    toast({ title: 'Weight logged ⚖️' });
    setWeight('');
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const currentWeight = logs.length > 0 ? logs[0].weight_kg : profile?.weight_kg || 0;
  const targetWeight = profile?.target_weight_kg || currentWeight;
  const startWeight = profile?.weight_kg || currentWeight;
  const bmi = profile ? calculateBMI(currentWeight, profile.height_cm) : 0;
  const bmiCat = getBMICategory(bmi);
  const change = logs.length >= 2 ? Math.round((logs[0].weight_kg - logs[1].weight_kg) * 10) / 10 : 0;
  const totalChange = Math.round((currentWeight - startWeight) * 10) / 10;

  const chartData = [...logs].reverse().map(l => ({
    date: new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    weight: l.weight_kg,
  }));

  return (
    <>
      <TopBar title="Weight Tracking" showBack backTo="/tracking" />
      <div className="px-4 py-6 space-y-6 pb-24">
        <div className="bg-card border border-border rounded-2xl p-5 text-center">
          <Scale size={24} className="text-accent mx-auto mb-2" />
          <p className="text-3xl font-bold font-heading">{currentWeight} kg</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            {change !== 0 && (change < 0 ? <TrendingDown size={14} className="text-green-500" /> : <TrendingUp size={14} className="text-orange-500" />)}
            <span className={`text-xs ${change < 0 ? 'text-green-500' : change > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
              {change !== 0 ? `${change > 0 ? '+' : ''}${change} kg from last` : 'No previous data'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">BMI</p>
            <p className="text-sm font-bold">{bmi}</p>
            <p className={`text-[9px] ${bmiCat.color}`}>{bmiCat.label}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Target</p>
            <p className="text-sm font-bold">{targetWeight} kg</p>
            <p className="text-[9px] text-accent">{Math.abs(currentWeight - targetWeight).toFixed(1)} kg to go</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Total Change</p>
            <p className="text-sm font-bold">{totalChange > 0 ? '+' : ''}{totalChange} kg</p>
            <p className="text-[9px] text-muted-foreground">from start</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input type="number" placeholder="Weight in kg" value={weight} onChange={e => setWeight(e.target.value)} className="h-12 rounded-xl bg-card border-border flex-1" step="0.1" />
          <Button onClick={logWeight} className="h-12 rounded-xl bg-accent text-accent-foreground">
            <Check size={16} /> Log
          </Button>
        </div>

        {chartData.length > 1 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-heading font-semibold text-sm mb-3">Weight Trend</h3>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--accent))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-center">⚠️ BMI is a basic indicator. Consult a doctor for medical advice.</p>
      </div>
    </>
  );
}