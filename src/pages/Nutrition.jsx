import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import { Button } from '@/components/ui/button';
import { Plus, Flame, Zap, Wheat, Droplet } from 'lucide-react';
import { getToday, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget, getActivityLevel, MEAL_TYPES } from '@/lib/fitnessUtils';

export default function Nutrition() {
  const navigate = useNavigate();
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

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const bmr = profile ? calculateBMR(profile.weight_kg, profile.height_cm, profile.age, profile.gender) : 1800;
  const tdee = profile ? calculateTDEE(bmr, getActivityLevel(profile.workout_days_per_week)) : 2200;
  const calorieTarget = profile ? calculateCalorieTarget(tdee, profile.goal) : 2000;
  const proteinTarget = profile ? calculateProteinTarget(profile.weight_kg, profile.goal) : 120;

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein_g || 0),
    carbs: acc.carbs + (m.carbs_g || 0),
    fat: acc.fat + (m.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calPercent = Math.min((totals.calories / calorieTarget) * 100, 100);

  return (
    <>
      <TopBar title="Nutrition" showBack />
      <div className="px-4 py-4 space-y-5">
        {/* Calorie Overview */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-5">
            <ProgressRing percent={calPercent} size={100} strokeWidth={8}>
              <div className="text-center">
                <p className="text-lg font-bold font-heading">{totals.calories}</p>
                <p className="text-[9px] text-muted-foreground">/ {calorieTarget}</p>
              </div>
            </ProgressRing>
            <div className="flex-1 space-y-3">
              <MacroBar label="Protein" value={totals.protein} target={proteinTarget} unit="g" color="bg-green-500" />
              <MacroBar label="Carbs" value={totals.carbs} target={Math.round(calorieTarget * 0.45 / 4)} unit="g" color="bg-blue-500" />
              <MacroBar label="Fat" value={totals.fat} target={Math.round(calorieTarget * 0.25 / 9)} unit="g" color="bg-yellow-500" />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Flame size={16} className="text-accent mx-auto mb-1" />
            <p className="text-sm font-bold">{totals.calories}</p>
            <p className="text-[9px] text-muted-foreground">kcal</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Zap size={16} className="text-green-500 mx-auto mb-1" />
            <p className="text-sm font-bold">{totals.protein}g</p>
            <p className="text-[9px] text-muted-foreground">Protein</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Wheat size={16} className="text-blue-500 mx-auto mb-1" />
            <p className="text-sm font-bold">{totals.carbs}g</p>
            <p className="text-[9px] text-muted-foreground">Carbs</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Droplet size={16} className="text-yellow-500 mx-auto mb-1" />
            <p className="text-sm font-bold">{totals.fat}g</p>
            <p className="text-[9px] text-muted-foreground">Fat</p>
          </div>
        </div>

        <Button onClick={() => navigate('/nutrition/log')} className="w-full h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus size={16} className="mr-2" /> Log Meal
        </Button>

        {/* Meals by Category */}
        {MEAL_TYPES.map(mealType => {
          const mealItems = meals.filter(m => m.meal_type === mealType.key);
          return (
            <div key={mealType.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{mealType.icon}</span>
                  <h3 className="font-heading font-semibold text-sm">{mealType.label}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{mealItems.reduce((s, m) => s + (m.calories || 0), 0)} kcal</span>
              </div>
              {mealItems.length > 0 ? (
                <div className="space-y-2">
                  {mealItems.map(item => (
                    <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{item.food_name}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{item.calories} kcal</p>
                        <p className="text-[10px] text-muted-foreground">P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-card/50 border border-dashed border-border rounded-xl p-3 text-center">
                  <button onClick={() => navigate('/nutrition/log')} className="text-xs text-muted-foreground">+ Add {mealType.label}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function MacroBar({ label, value, target, unit, color }) {
  const percent = Math.min((value / target) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}/{target}{unit}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}