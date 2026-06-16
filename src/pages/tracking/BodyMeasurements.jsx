import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler, Check } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

const FIELDS = [
  { key: 'chest_cm', label: 'Chest' },
  { key: 'waist_cm', label: 'Waist' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'arms_cm', label: 'Arms' },
  { key: 'forearms_cm', label: 'Forearms' },
  { key: 'thighs_cm', label: 'Thighs' },
  { key: 'calves_cm', label: 'Calves' },
  { key: 'shoulders_cm', label: 'Shoulders' },
  { key: 'neck_cm', label: 'Neck' },
];

export default function BodyMeasurements() {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const logs = await base44.entities.BodyMeasurement.filter({ user_id: user.id }, '-date', 5);
    setHistory(logs);
    setLoading(false);
  };

  const handleSave = async () => {
    const hasAny = FIELDS.some(f => form[f.key]);
    if (!hasAny) return;
    setSaving(true);
    const user = await base44.auth.me();
    const data = { user_id: user.id, date: getToday() };
    FIELDS.forEach(f => { if (form[f.key]) data[f.key] = Number(form[f.key]); });
    await base44.entities.BodyMeasurement.create(data);
    toast({ title: 'Measurements saved 📏' });
    setForm({});
    loadData();
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const latest = history[0];

  return (
    <>
      <TopBar title="Body Measurements" showBack backTo="/tracking" />
      <div className="px-4 py-4 space-y-5 pb-24">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Ruler size={16} className="text-accent" />
            <h3 className="font-heading font-semibold text-sm">Log Measurements (cm)</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {FIELDS.map(f => (
              <div key={f.key}>
                <Label className="text-[10px] mb-1 block text-muted-foreground">{f.label}</Label>
                <Input
                  type="number"
                  placeholder={latest?.[f.key] ? String(latest[f.key]) : '—'}
                  value={form[f.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="h-10 rounded-xl bg-background border-border text-sm"
                />
              </div>
            ))}
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full h-10 rounded-xl bg-accent text-accent-foreground mt-4">
            <Check size={14} className="mr-1" /> {saving ? 'Saving...' : 'Save Measurements'}
          </Button>
        </div>

        {history.length > 0 && (
          <div>
            <h3 className="font-heading font-semibold text-sm mb-3">History</h3>
            <div className="space-y-3">
              {history.map(log => (
                <div key={log.id} className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground mb-3">{new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {FIELDS.filter(f => log[f.key]).map(f => (
                      <div key={f.key} className="text-center">
                        <p className="text-sm font-bold">{log[f.key]}</p>
                        <p className="text-[9px] text-muted-foreground">{f.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}