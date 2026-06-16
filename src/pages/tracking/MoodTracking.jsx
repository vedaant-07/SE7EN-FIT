import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Smile, Check } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

const MOODS = ['😔', '😕', '😐', '🙂', '😄'];
const MOOD_LABELS = ['Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];

export default function MoodTracking() {
  const { toast } = useToast();
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ mood_score: 3, energy_level: 3, stress_level: 3, notes: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const logs = await base44.entities.MoodLog.filter({ user_id: user.id, date: getToday() });
    if (logs.length) setTodayLog(logs[0]);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.MoodLog.create({
      user_id: user.id, date: getToday(),
      mood_score: form.mood_score,
      energy_level: form.energy_level,
      stress_level: form.stress_level,
      notes: form.notes || undefined,
    });
    toast({ title: 'Mood logged 😊' });
    loadData();
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  return (
    <>
      <TopBar title="Mood & Energy" showBack backTo="/tracking" />
      <div className="px-4 py-6 space-y-6 pb-24">
        {todayLog ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-5xl mb-3">{MOODS[todayLog.mood_score - 1]}</p>
            <p className="font-heading font-bold text-lg">{MOOD_LABELS[todayLog.mood_score - 1]}</p>
            <p className="text-xs text-muted-foreground mt-1">Logged today</p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-background rounded-xl p-3 text-center">
                <p className="text-lg">😊</p><p className="text-xs font-bold">{todayLog.mood_score}/5</p><p className="text-[9px] text-muted-foreground">Mood</p>
              </div>
              <div className="bg-background rounded-xl p-3 text-center">
                <p className="text-lg">⚡</p><p className="text-xs font-bold">{todayLog.energy_level}/5</p><p className="text-[9px] text-muted-foreground">Energy</p>
              </div>
              <div className="bg-background rounded-xl p-3 text-center">
                <p className="text-lg">😤</p><p className="text-xs font-bold">{todayLog.stress_level}/5</p><p className="text-[9px] text-muted-foreground">Stress</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-6">
            <h3 className="font-heading font-semibold text-sm">How are you feeling today?</h3>

            <div>
              <div className="flex justify-center gap-3 mb-2">
                {MOODS.map((m, i) => (
                  <button key={i} onClick={() => setForm(p => ({ ...p, mood_score: i + 1 }))} className={`text-3xl transition-transform ${form.mood_score === i + 1 ? 'scale-125' : 'opacity-50'}`}>{m}</button>
                ))}
              </div>
              <p className="text-center text-xs text-accent font-medium">{MOOD_LABELS[form.mood_score - 1]}</p>
            </div>

            <div>
              <Label className="text-xs mb-3 flex justify-between"><span>⚡ Energy Level</span><span className="text-accent">{form.energy_level}/5</span></Label>
              <Slider min={1} max={5} step={1} value={[form.energy_level]} onValueChange={([v]) => setForm(p => ({ ...p, energy_level: v }))} className="w-full" />
            </div>

            <div>
              <Label className="text-xs mb-3 flex justify-between"><span>😤 Stress Level</span><span className="text-accent">{form.stress_level}/5</span></Label>
              <Slider min={1} max={5} step={1} value={[form.stress_level]} onValueChange={([v]) => setForm(p => ({ ...p, stress_level: v }))} className="w-full" />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full h-10 rounded-xl bg-accent text-accent-foreground">
              <Check size={14} className="mr-1" /> Log Mood
            </Button>
          </div>
        )}
      </div>
    </>
  );
}