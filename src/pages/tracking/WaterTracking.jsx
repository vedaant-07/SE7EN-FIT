import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Droplets, Plus, Minus } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

export default function WaterTracking() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customMl, setCustomMl] = useState('');
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [profiles, waterLogs] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.WaterLog.filter({ user_id: user.id, date: today }),
    ]);
    if (profiles.length) setProfile(profiles[0]);
    setLogs(waterLogs);
    setLoading(false);
  };

  const addWater = async (ml) => {
    const user = await base44.auth.me();
    await base44.entities.WaterLog.create({
      user_id: user.id, date: today, amount_ml: ml,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    });
    toast({ title: `+${ml}ml added 💧` });
    loadData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const goal = profile?.daily_water_goal_ml || 2500;
  const total = logs.reduce((s, l) => s + (l.amount_ml || 0), 0);
  const percent = (total / goal) * 100;
  const glasses = Math.round(total / 250);

  return (
    <>
      <TopBar title="Water Tracking" showBack backTo="/tracking" />
      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-col items-center">
          <ProgressRing percent={percent} size={160} strokeWidth={10} color="hsl(200, 80%, 55%)">
            <div className="text-center">
              <Droplets size={20} className="mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold font-heading">{total}ml</p>
              <p className="text-[10px] text-muted-foreground">of {goal}ml</p>
            </div>
          </ProgressRing>
          <p className="text-sm text-muted-foreground mt-3">{glasses} glasses today</p>
        </div>

        {/* Quick Add */}
        <div className="grid grid-cols-4 gap-2">
          {[150, 250, 500, 750].map(ml => (
            <Button key={ml} variant="outline" onClick={() => addWater(ml)} className="rounded-xl border-border h-12 flex-col gap-0.5">
              <span className="text-xs font-bold">{ml}ml</span>
              <span className="text-[9px] text-muted-foreground">{ml === 250 ? '1 glass' : `${Math.round(ml / 250 * 10) / 10} glass`}</span>
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input type="number" placeholder="Custom ml" value={customMl} onChange={e => setCustomMl(e.target.value)} className="h-12 rounded-xl bg-card border-border flex-1" />
          <Button onClick={() => { if (customMl) { addWater(Number(customMl)); setCustomMl(''); } }} className="h-12 rounded-xl bg-accent text-accent-foreground">
            <Plus size={16} /> Add
          </Button>
        </div>

        {/* Log */}
        {logs.length > 0 && (
          <div>
            <h3 className="font-heading font-semibold text-sm mb-3">Today's Log</h3>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets size={14} className="text-blue-500" />
                    <span className="text-sm">{log.amount_ml}ml</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}