import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Droplet, Flame, Plus, RefreshCw, Trash2, Utensils, Wheat, Zap } from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import EmptyState from '@/components/se7enfit/EmptyState';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { memberProductClient } from '@/api/memberProductClient';
import { MEAL_TYPES } from '@/lib/fitnessUtils';

const CACHE_KEY = 'se7enfit_nutrition_summary_v2';

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function saveCache(value) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch {}
}
function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export default function Nutrition() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [summary, setSummary] = useState(loadCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offlineCache, setOfflineCache] = useState(false);
  const today = new Date().toLocaleDateString('en-CA');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await memberProductClient.getNutritionSummary(today);
      setSummary(data);
      saveCache(data);
      setOfflineCache(false);
    } catch (requestError) {
      const cached = loadCache();
      setSummary(cached);
      setOfflineCache(Boolean(cached));
      setError(cached ? 'Showing your last saved nutrition summary.' : requestError.message || 'Could not load nutrition.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const deleteEntry = async (logId) => {
    try {
      await memberProductClient.deleteNutritionLog(logId);
      await loadData();
      toast({ title: 'Meal entry removed' });
    } catch (requestError) {
      toast({ title: 'Could not remove meal', description: requestError.message, variant: 'destructive' });
    }
  };

  const grouped = useMemo(() => {
    const groups = new Map(MEAL_TYPES.map((meal) => [meal.key, []]));
    for (const row of summary?.logs || []) {
      const key = groups.has(row.meal_type) ? row.meal_type : 'snack';
      groups.get(key)?.push(row);
    }
    return groups;
  }, [summary]);

  if (loading && !summary) return <LoadingScreen />;

  const targets = summary?.targets || { calorie_target: 2000, protein_g: 120, carbs_g: 225, fat_g: 67, fiber_g: 28, notes: [] };
  const totals = summary?.totals || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  const logs = summary?.logs || [];
  const caloriePercent = Math.min(100, targets.calorie_target > 0 ? (number(totals.calories) / targets.calorie_target) * 100 : 0);

  return (
    <>
      <TopBar title="Nutrition" showBack />
      <div className="px-4 py-4 space-y-5 pb-24">
        {(error || offlineCache) && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-100/90">{error}</p>
            <button onClick={() => void loadData()} className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-200"><RefreshCw size={11} /> Retry</button>
          </div>
        )}

        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-center gap-5">
            <ProgressRing percent={caloriePercent} size={96} strokeWidth={7}>
              <div className="text-center"><p className="text-base font-bold font-heading leading-none">{Math.round(number(totals.calories))}</p><p className="text-[9px] text-muted-foreground mt-0.5">/ {targets.calorie_target}</p><p className="text-[8px] text-accent uppercase tracking-wider">kcal</p></div>
            </ProgressRing>
            <div className="flex-1 space-y-2.5">
              <MacroBar label="Protein" value={number(totals.protein_g)} target={targets.protein_g} unit="g" />
              <MacroBar label="Carbs" value={number(totals.carbs_g)} target={targets.carbs_g} unit="g" />
              <MacroBar label="Fat" value={number(totals.fat_g)} target={targets.fat_g} unit="g" />
              <MacroBar label="Fiber" value={number(totals.fiber_g)} target={targets.fiber_g} unit="g" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-3">
            <div><p className="text-base font-bold font-heading text-accent">{Math.round(number(summary?.remaining?.calories))}</p><p className="text-[10px] text-muted-foreground">kcal remaining</p></div>
            <span className="rounded-full bg-muted px-3 py-1 text-[10px] capitalize text-muted-foreground">{String(targets.confidence || 'estimated').replace(/_/g, ' ')}</span>
            <div className="text-right"><p className="text-base font-bold font-heading">{logs.length}</p><p className="text-[10px] text-muted-foreground">entries</p></div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {[
            { icon: Flame, label: 'kcal', value: Math.round(number(totals.calories)) },
            { icon: Zap, label: 'Protein', value: `${Math.round(number(totals.protein_g))}g` },
            { icon: Wheat, label: 'Carbs', value: `${Math.round(number(totals.carbs_g))}g` },
            { icon: Droplet, label: 'Fat', value: `${Math.round(number(totals.fat_g))}g` },
            { icon: Utensils, label: 'Fiber', value: `${Math.round(number(totals.fiber_g))}g` },
          ].map(({ icon: Icon, label, value }) => <div key={label} className="bg-card border border-border rounded-xl p-2 text-center"><Icon size={12} className="text-accent mx-auto" /><p className="text-xs font-bold mt-1">{value}</p><p className="text-[8px] text-muted-foreground truncate">{label}</p></div>)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => navigate('/nutrition/log')} className="h-12 rounded-xl bg-white text-black hover:bg-white/90 font-semibold"><Plus size={16} className="mr-2" /> Log manually</Button>
          <Button onClick={() => navigate('/food-scan')} variant="outline" className="h-12 rounded-xl font-semibold"><Camera size={16} className="mr-2" /> Scan meal</Button>
        </div>

        {Array.isArray(targets.notes) && targets.notes.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-1">
            {targets.notes.map((note) => <p key={note} className="text-[10px] leading-relaxed text-muted-foreground">• {note}</p>)}
          </div>
        )}

        {logs.length === 0 ? (
          <EmptyState icon={Utensils} title="No meals logged today" description="Log food manually or scan your meal, then review every estimate before saving." actionLabel="Log first meal" onAction={() => navigate('/nutrition/log')} compact />
        ) : (
          MEAL_TYPES.map((mealType) => {
            const rows = grouped.get(mealType.key) || [];
            if (!rows.length) return null;
            return (
              <div key={mealType.key}>
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span>{mealType.icon}</span><h3 className="font-heading font-semibold text-sm">{mealType.label}</h3></div><span className="text-xs text-muted-foreground">{Math.round(rows.reduce((sum, row) => sum + number(row.calories), 0))} kcal</span></div>
                <div className="space-y-2">
                  {rows.map((item) => (
                    <div key={item.log_id || item.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{item.food_name || 'Meal'}</p><p className="text-[10px] text-muted-foreground mt-0.5">{item.quantity || item.serving_size || '1 serving'} • P {Math.round(number(item.protein_g))}g • C {Math.round(number(item.carbs_g))}g • F {Math.round(number(item.fat_g))}g</p><p className="text-[9px] text-muted-foreground mt-1 capitalize">{String(item.source || 'manual').replace(/_/g, ' ')}</p></div>
                      <p className="text-sm font-bold text-accent shrink-0">{Math.round(number(item.calories))}</p>
                      <button onClick={() => void deleteEntry(item.log_id || item.id)} aria-label="Delete meal" className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function MacroBar({ label, value, target, unit }) {
  const percentage = Math.min(100, target > 0 ? (number(value) / target) * 100 : 0);
  return <div><div className="flex justify-between text-[10px] mb-1"><span className="text-muted-foreground font-medium">{label}</span><span className="font-medium">{Math.round(number(value))}/{target}{unit}</span></div><div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${percentage}%` }} /></div></div>;
}
