import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import EmptyState from '@/components/se7enfit/EmptyState';
import { Button } from '@/components/ui/button';
import { Plus, Flame, Zap, Wheat, Droplet, Utensils, ChevronRight, Trash2 } from 'lucide-react';
import { getToday, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget, getActivityLevel, MEAL_TYPES } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

export default function Nutrition() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = getToday();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [profiles, logs] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.NutritionLog.filter({ user_id: user.id, date: today }),
    ]);
    if (profiles.length) setProfile(profiles[0]);
    setMeals(logs);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.NutritionLog.delete(id);
    setMeals(prev => prev.filter(m => m.id !== id));
    toast({ title: 'Entry removed' });
  };

  if (loading) return <LoadingScreen />;

  const bmr = profile ? calculateBMR(profile.weight_kg, profile.height_cm, profile.age, profile.gender) : 1800;
  const tdee = profile ? calculateTDEE(bmr, getActivityLevel(profile.workout_days_per_week)) : 2200;
  const calorieTarget = profile ? calculateCalorieTarget(tdee, profile.goal) : 2000;
  const proteinTarget = profile ? calculateProteinTarget(profile.weight_kg, profile.goal) : 120;
  const carbTarget = Math.round(calorieTarget * 0.45 / 4);
  const fatTarget = Math.round(calorieTarget * 0.25 / 9);

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein_g || 0),
    carbs: acc.carbs + (m.carbs_g || 0),
    fat: acc.fat + (m.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calPercent = Math.min((totals.calories / calorieTarget) * 100, 100);
  const remaining = Math.max(calorieTarget - totals.calories, 0);
  const dietLabel = profile?.diet_preference?.replace(/_/g, ' ') || '';

  return (
    <>
      <TopBar title="Nutrition" showBack />
      <div className="px-4 py-4 space-y-5 pb-6">

        {/* Calorie Overview */}
        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-center gap-5">
            <ProgressRing percent={calPercent} size={96} strokeWidth={7}>
              <div className="text-center">
                <p className="text-base font-bold font-heading leading-none">{totals.calories}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">/ {calorieTarget}</p>
                <p className="text-[8px] text-accent uppercase tracking-wider">kcal</p>
              </div>
            </ProgressRing>
            <div className="flex-1 space-y-2.5">
              <MacroBar label="Protein" value={Math.round(totals.protein)} target={proteinTarget} unit="g" color="bg-green-400" />
              <MacroBar label="Carbs" value={Math.round(totals.carbs)} target={carbTarget} unit="g" color="bg-blue-400" />
              <MacroBar label="Fat" value={Math.round(totals.fat)} target={fatTarget} unit="g" color="bg-yellow-400" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
            <div className="text-center">
              <p className="text-base font-bold font-heading text-accent">{remaining}</p>
              <p className="text-[10px] text-muted-foreground">kcal left</p>
            </div>
            {dietLabel && (
              <span className="text-[11px] bg-muted text-muted-foreground px-3 py-1 rounded-full capitalize">{dietLabel}</span>
            )}
            <div className="text-center">
              <p className="text-base font-bold font-heading">{meals.length}</p>
              <p className="text-[10px] text-muted-foreground">entries</p>
            </div>
          </div>
        </div>

        {/* Macro pills */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: <Flame size={13} />, label: 'kcal', value: totals.calories, color: 'text-orange-400' },
            { icon: <Zap size={13} />, label: 'Protein', value: `${Math.round(totals.protein)}g`, color: 'text-green-400' },
            { icon: <Wheat size={13} />, label: 'Carbs', value: `${Math.round(totals.carbs)}g`, color: 'text-blue-400' },
            { icon: <Droplet size={13} />, label: 'Fat', value: `${Math.round(totals.fat)}g`, color: 'text-yellow-400' },
          ].map((m, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <span className={m.color}>{m.icon}</span>
              <p className="text-sm font-bold mt-1">{m.value}</p>
              <p className="text-[9px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => navigate('/nutrition/log')} className="w-full h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
          <Plus size={16} className="mr-2" /> Log Meal
        </Button>

        {/* Meals by Category */}
        {meals.length === 0 ? (
          <EmptyState
            icon={Utensils}
            title="No meals logged today"
            description="Start tracking your nutrition to hit your calorie and macro goals."
            actionLabel="Log First Meal"
            onAction={() => navigate('/nutrition/log')}
            compact
          />
        ) : (
          MEAL_TYPES.map(mealType => {
            const mealItems = meals.filter(m => m.meal_type === mealType.key);
            if (mealItems.length === 0) return null;
            return (
              <div key={mealType.key}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{mealType.icon}</span>
                    <h3 className="font-heading font-semibold text-sm">{mealType.label}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {mealItems.reduce((s, m) => s + (m.calories || 0), 0)} kcal
                  </span>
                </div>
                <div className="space-y-2">
                  {mealItems.map(item => (
                    <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.food_name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.quantity} • P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g</p>
                      </div>
                      <p className="text-sm font-bold text-accent flex-shrink-0">{item.calories} kcal</p>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
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

function MacroBar({ label, value, target, unit, color }) {
  const percent = Math.min((value / target) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-medium">{value}/{target}{unit}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}