import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Moon, Check } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';
import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts';

export default function SleepTracking() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [todaySleep, setTodaySleep] = useState(null);
  const [weekData, setWeekData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ hours: '', quality: 'good', bedtime: '23:00', wake_time: '06:30' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
    if (profiles.length) setProfile(profiles[0]);
    const logs = await base44.entities.SleepLog.filter({ user_id: user.id }, '-date', 7);
    const today = logs.find(l => l.date === getToday());
    setTodaySleep(today);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const log = logs.find(l => l.date === dateStr);
      week.push({ day: days[d.getDay()], hours: log?.hours || 0 });
    }
    setWeekData(week);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.hours) return;
    const user = await base44.auth.me();
    await base44.entities.SleepLog.create({
      user_id: user.id, date: getToday(),
      hours: Number(form.hours), quality: form.quality,
      bedtime: form.bedtime, wake_time: form.wake_time,
    });
    toast({ title: 'Sleep logged 😴' });
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const goal = profile?.sleep_goal_hours || 7;
  const hours = todaySleep?.hours || 0;
  const percent = (hours / goal) * 100;

  return (
    <>
      <TopBar title="Sleep Tracking" showBack backTo="/tracking" />
      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-col items-center">
          <ProgressRing percent={percent} size={140} strokeWidth={10} color="hsl(260, 60%, 55%)">
            <div className="text-center">
              <Moon size={18} className="mx-auto text-purple-500 mb-1" />
              <p className="text-xl font-bold font-heading">{hours}h</p>
              <p className="text-[10px] text-muted-foreground">of {goal}h</p>
            </div>
          </ProgressRing>
          {todaySleep && <p className="text-xs text-muted-foreground mt-2">Quality: {todaySleep.quality}</p>}
        </div>

        {!todaySleep && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <h3 className="font-heading font-semibold text-sm">Log Last Night's Sleep</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Hours</Label>
                <Input type="number" placeholder="7" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} className="h-10 rounded-xl bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Quality</Label>
                <Select value={form.quality} onValueChange={v => setForm(p => ({ ...p, quality: v }))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['poor', 'fair', 'good', 'excellent'].map(q => (
                      <SelectItem key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Bedtime</Label>
                <Input type="time" value={form.bedtime} onChange={e => setForm(p => ({ ...p, bedtime: e.target.value }))} className="h-10 rounded-xl bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Wake time</Label>
                <Input type="time" value={form.wake_time} onChange={e => setForm(p => ({ ...p, wake_time: e.target.value }))} className="h-10 rounded-xl bg-background border-border" />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full h-10 rounded-xl bg-accent text-accent-foreground">
              <Check size={14} className="mr-1" /> Log Sleep
            </Button>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-heading font-semibold text-sm mb-3">This Week</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekData}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Bar dataKey="hours" fill="hsl(260, 60%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}