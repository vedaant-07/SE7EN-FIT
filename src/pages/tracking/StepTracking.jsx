import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Footprints, Plus, Flame, MapPin } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function StepTracking() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [todaySteps, setTodaySteps] = useState(0);
  const [weekData, setWeekData] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
    if (profiles.length) setProfile(profiles[0]);
    const logs = await base44.entities.StepLog.filter({ user_id: user.id }, '-date', 7);
    const todayLog = logs.find(l => l.date === getToday());
    setTodaySteps(todayLog?.steps || 0);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const log = logs.find(l => l.date === dateStr);
      week.push({ day: days[d.getDay()], steps: log?.steps || 0 });
    }
    setWeekData(week);
    setLoading(false);
  };

  const addSteps = async () => {
    if (!input) return;
    const user = await base44.auth.me();
    const today = getToday();
    const existing = await base44.entities.StepLog.filter({ user_id: user.id, date: today });
    const steps = Number(input);
    const dist = Math.round(steps * 0.0008 * 100) / 100;
    const cal = Math.round(steps * 0.04);

    if (existing.length) {
      await base44.entities.StepLog.update(existing[0].id, {
        steps: existing[0].steps + steps,
        distance_km: (existing[0].distance_km || 0) + dist,
        calories_burned: (existing[0].calories_burned || 0) + cal,
      });
    } else {
      await base44.entities.StepLog.create({
        user_id: user.id, date: today, steps, distance_km: dist, calories_burned: cal, source: 'manual'
      });
    }
    toast({ title: `+${steps} steps added 🚶` });
    setInput('');
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const goal = profile?.daily_step_goal || 8000;
  const percent = (todaySteps / goal) * 100;
  const distance = Math.round(todaySteps * 0.0008 * 100) / 100;
  const caloriesBurned = Math.round(todaySteps * 0.04);

  return (
    <>
      <TopBar title="Step Tracking" showBack backTo="/tracking" />
      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-col items-center">
          <ProgressRing percent={percent} size={160} strokeWidth={10}>
            <div className="text-center">
              <Footprints size={20} className="mx-auto text-accent mb-1" />
              <p className="text-2xl font-bold font-heading">{todaySteps.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">of {goal.toLocaleString()}</p>
            </div>
          </ProgressRing>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <MapPin size={14} className="text-accent mx-auto mb-1" />
            <p className="text-sm font-bold">{distance} km</p>
            <p className="text-[9px] text-muted-foreground">Distance</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Flame size={14} className="text-orange-500 mx-auto mb-1" />
            <p className="text-sm font-bold">{caloriesBurned}</p>
            <p className="text-[9px] text-muted-foreground">Calories</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Footprints size={14} className="text-green-500 mx-auto mb-1" />
            <p className="text-sm font-bold">{Math.round(percent)}%</p>
            <p className="text-[9px] text-muted-foreground">Goal</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input type="number" placeholder="Add steps" value={input} onChange={e => setInput(e.target.value)} className="h-12 rounded-xl bg-card border-border flex-1" />
          <Button onClick={addSteps} className="h-12 rounded-xl bg-accent text-accent-foreground">
            <Plus size={16} /> Add
          </Button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-heading font-semibold text-sm mb-3">This Week</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekData}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Bar dataKey="steps" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground">📱 Device sync coming soon</p>
          <p className="text-[10px] text-muted-foreground mt-1">Google Fit • Apple Health • Health Connect</p>
        </div>
      </div>
    </>
  );
}