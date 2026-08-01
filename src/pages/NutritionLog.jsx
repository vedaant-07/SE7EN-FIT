import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, Loader2 } from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { MEAL_TYPES } from '@/lib/fitnessUtils';
import { memberProductClient } from '@/api/memberProductClient';

const COMMON_FOODS = [
  { name: 'Roti (1 piece)', serving: '1 piece', calories: 71, protein_g: 2, carbs_g: 15, fat_g: 0.4, fiber_g: 2 },
  { name: 'Cooked rice', serving: '1 cup', calories: 206, protein_g: 4, carbs_g: 45, fat_g: 0.4, fiber_g: 1 },
  { name: 'Dal', serving: '1 cup', calories: 198, protein_g: 14, carbs_g: 34, fat_g: 1, fiber_g: 8 },
  { name: 'Paneer', serving: '100 g', calories: 265, protein_g: 18, carbs_g: 1.2, fat_g: 21, fiber_g: 0 },
  { name: 'Chicken breast', serving: '100 g cooked', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0 },
  { name: 'Whole egg', serving: '1 egg', calories: 78, protein_g: 6, carbs_g: 0.6, fat_g: 5, fiber_g: 0 },
  { name: 'Banana', serving: '1 medium', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3 },
  { name: 'Curd / yogurt', serving: '1 cup', calories: 98, protein_g: 11, carbs_g: 5, fat_g: 4, fiber_g: 0 },
  { name: 'Oats', serving: '1 cup cooked', calories: 154, protein_g: 5, carbs_g: 27, fat_g: 3, fiber_g: 4 },
  { name: 'Whey protein', serving: '1 scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: 0 },
  { name: 'Idli', serving: '2 pieces', calories: 156, protein_g: 4, carbs_g: 34, fat_g: 0.4, fiber_g: 2 },
  { name: 'Dosa', serving: '1 medium', calories: 133, protein_g: 4, carbs_g: 18, fat_g: 5, fiber_g: 1 },
  { name: 'Rajma', serving: '1 cup', calories: 225, protein_g: 15, carbs_g: 40, fat_g: 0.8, fiber_g: 11 },
  { name: 'Chana', serving: '1 cup', calories: 269, protein_g: 15, carbs_g: 45, fat_g: 4, fiber_g: 12 },
];

const INITIAL_MEAL = {
  meal_type: 'breakfast',
  food_name: '',
  quantity: '1 serving',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
  fiber_g: '',
};

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export default function NutritionLog() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [meal, setMeal] = useState(INITIAL_MEAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectFood = (food) => {
    setMeal((current) => ({
      ...current,
      food_name: food.name,
      quantity: food.serving,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g,
    }));
    setError('');
  };

  const save = async () => {
    const name = meal.food_name.trim();
    if (!name) {
      setError('Enter a food name.');
      return;
    }
    const values = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'].reduce((result, key) => ({ ...result, [key]: numericValue(meal[key]) }), {});
    if (Object.values(values).some((value) => value < 0)) {
      setError('Nutrition values cannot be negative.');
      return;
    }
    if (values.calories > 5000 || values.protein_g > 500 || values.carbs_g > 1000 || values.fat_g > 500 || values.fiber_g > 100) {
      setError('One or more values are outside a realistic single-entry range.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await memberProductClient.addNutritionLog({
        date: new Date().toLocaleDateString('en-CA'),
        meal_type: meal.meal_type,
        food_name: name,
        quantity: meal.quantity.trim() || '1 serving',
        serving_size: meal.quantity.trim() || '1 serving',
        ...values,
        external_id: memberProductClient.newRequestId('meal'),
      });
      toast({ title: 'Meal saved' });
      navigate('/nutrition', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Could not save this meal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Log Meal" showBack backTo="/nutrition" />
      <div className="px-4 py-4 space-y-5 pb-24 max-w-lg mx-auto">
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}

        <div>
          <Label className="text-sm mb-2 block">Meal type</Label>
          <Select value={meal.meal_type} onValueChange={(value) => setMeal((current) => ({ ...current, meal_type: value }))}>
            <SelectTrigger className="h-12 rounded-xl bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{MEAL_TYPES.map((type) => <SelectItem key={type.key} value={type.key}>{type.icon} {type.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm mb-2 block">Food name</Label>
          <Input value={meal.food_name} onChange={(event) => setMeal((current) => ({ ...current, food_name: event.target.value }))}
            placeholder="Example: chicken biryani" maxLength={160} className="h-12 rounded-xl bg-card border-border" />
          <p className="text-[10px] text-muted-foreground mt-2">Enter values from a label, trusted database, recipe calculation or your reviewed Food Scan result.</p>
        </div>

        {!meal.food_name && (
          <div>
            <h3 className="font-heading font-semibold text-sm mb-3">Common reference portions</h3>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_FOODS.map((food) => (
                <button key={`${food.name}-${food.serving}`} onClick={() => selectFood(food)} className="bg-card border border-border rounded-xl p-3 text-left hover:border-accent/30 active:scale-[0.98] transition-all">
                  <p className="text-xs font-medium">{food.name}</p><p className="text-[10px] text-muted-foreground mt-1">{food.serving} • {food.calories} kcal</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="text-sm mb-2 block">Serving / quantity</Label>
          <Input value={meal.quantity} onChange={(event) => setMeal((current) => ({ ...current, quantity: event.target.value }))}
            placeholder="1 serving" maxLength={80} className="h-12 rounded-xl bg-card border-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['calories', 'Calories'],
            ['protein_g', 'Protein (g)'],
            ['carbs_g', 'Carbs (g)'],
            ['fat_g', 'Fat (g)'],
            ['fiber_g', 'Fiber (g)'],
          ].map(([key, label]) => (
            <div key={key}>
              <Label className="text-sm mb-2 block">{label}</Label>
              <Input type="number" min="0" step="0.1" value={meal[key]} onChange={(event) => setMeal((current) => ({ ...current, [key]: event.target.value }))}
                placeholder="0" className="h-12 rounded-xl bg-card border-border" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-3 text-[10px] leading-relaxed text-muted-foreground">
          Nutrition values are estimates unless taken from a verified label or measured recipe. Medical nutrition needs should be reviewed with a qualified clinician or dietitian.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => navigate('/food-scan')} className="h-12 rounded-xl"><Camera size={16} className="mr-2" /> Scan instead</Button>
          <Button onClick={() => void save()} disabled={saving || !meal.food_name.trim()} className="h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
            {saving ? <><Loader2 size={16} className="mr-2 animate-spin" />Saving…</> : <><Check size={16} className="mr-2" />Save meal</>}
          </Button>
        </div>
      </div>
    </>
  );
}
