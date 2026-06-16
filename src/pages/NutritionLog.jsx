import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Sparkles, Check } from 'lucide-react';
import { getToday, MEAL_TYPES } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

const COMMON_FOODS = [
  { name: 'Roti (1 piece)', calories: 71, protein_g: 2, carbs_g: 15, fat_g: 0.4 },
  { name: 'Rice (1 cup)', calories: 206, protein_g: 4, carbs_g: 45, fat_g: 0.4 },
  { name: 'Dal (1 cup)', calories: 198, protein_g: 14, carbs_g: 34, fat_g: 1 },
  { name: 'Paneer (100g)', calories: 265, protein_g: 18, carbs_g: 1.2, fat_g: 21 },
  { name: 'Chicken Breast (100g)', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  { name: 'Egg (1 whole)', calories: 78, protein_g: 6, carbs_g: 0.6, fat_g: 5 },
  { name: 'Banana (1 medium)', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
  { name: 'Curd/Yogurt (1 cup)', calories: 98, protein_g: 11, carbs_g: 5, fat_g: 4 },
  { name: 'Oats (1 cup)', calories: 154, protein_g: 5, carbs_g: 27, fat_g: 3 },
  { name: 'Whey Protein (1 scoop)', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5 },
  { name: 'Peanut Butter (2 tbsp)', calories: 190, protein_g: 8, carbs_g: 6, fat_g: 16 },
  { name: 'Milk (1 glass)', calories: 103, protein_g: 8, carbs_g: 12, fat_g: 2.4 },
  { name: 'Idli (2 pieces)', calories: 156, protein_g: 4, carbs_g: 34, fat_g: 0.4 },
  { name: 'Dosa (1 piece)', calories: 133, protein_g: 4, carbs_g: 18, fat_g: 5 },
  { name: 'Rajma (1 cup)', calories: 225, protein_g: 15, carbs_g: 40, fat_g: 0.8 },
  { name: 'Chana (1 cup)', calories: 269, protein_g: 15, carbs_g: 45, fat_g: 4 },
];

export default function NutritionLog() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [meal, setMeal] = useState({
    meal_type: 'breakfast',
    food_name: '',
    quantity: '1 serving',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
  });
  const [showCommon, setShowCommon] = useState(true);

  const selectFood = (food) => {
    setMeal(prev => ({
      ...prev,
      food_name: food.name,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
    }));
    setShowCommon(false);
  };

  const handleSave = async () => {
    if (!meal.food_name) return;
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.NutritionLog.create({
      user_id: user.id,
      date: getToday(),
      meal_type: meal.meal_type,
      food_name: meal.food_name,
      quantity: meal.quantity,
      calories: Number(meal.calories) || 0,
      protein_g: Number(meal.protein_g) || 0,
      carbs_g: Number(meal.carbs_g) || 0,
      fat_g: Number(meal.fat_g) || 0,
    });
    toast({ title: 'Meal logged! 🍽️' });
    navigate('/nutrition');
  };

  const handleAIEstimate = async () => {
    if (!meal.food_name) return;
    setSaving(true);
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Estimate the nutritional values for: "${meal.food_name}" (Indian serving size). Return JSON with: calories (number), protein_g (number), carbs_g (number), fat_g (number). Be practical for Indian food portions.`,
      response_json_schema: {
        type: 'object',
        properties: {
          calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' }
        }
      }
    });
    setMeal(prev => ({ ...prev, ...response }));
    setSaving(false);
  };

  return (
    <>
      <TopBar title="Log Meal" showBack backTo="/nutrition" />
      <div className="px-4 py-4 space-y-5 pb-24">
        <div>
          <Label className="text-sm mb-2 block">Meal Type</Label>
          <Select value={meal.meal_type} onValueChange={v => setMeal(p => ({ ...p, meal_type: v }))}>
            <SelectTrigger className="h-12 rounded-xl bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEAL_TYPES.map(mt => (
                <SelectItem key={mt.key} value={mt.key}>{mt.icon} {mt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm mb-2 block">Food Name</Label>
          <Input placeholder="e.g., Chicken Biryani, 2 Roti with Dal" value={meal.food_name} onChange={e => { setMeal(p => ({ ...p, food_name: e.target.value })); setShowCommon(true); }} className="h-12 rounded-xl bg-card border-border" />
          {meal.food_name && (
            <Button variant="ghost" size="sm" onClick={handleAIEstimate} disabled={saving} className="text-accent text-xs mt-2">
              <Sparkles size={12} className="mr-1" /> AI Estimate Nutrition
            </Button>
          )}
        </div>

        {showCommon && !meal.food_name && (
          <div>
            <h3 className="font-heading font-semibold text-sm mb-3">Common Indian Foods</h3>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_FOODS.map((food, i) => (
                <button key={i} onClick={() => selectFood(food)} className="bg-card border border-border rounded-xl p-3 text-left hover:border-accent/30 transition-all active:scale-[0.98]">
                  <p className="text-xs font-medium">{food.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{food.calories} kcal • P:{food.protein_g}g</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="text-sm mb-2 block">Quantity</Label>
          <Input placeholder="1 serving" value={meal.quantity} onChange={e => setMeal(p => ({ ...p, quantity: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm mb-2 block">Calories</Label>
            <Input type="number" placeholder="0" value={meal.calories} onChange={e => setMeal(p => ({ ...p, calories: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
          </div>
          <div>
            <Label className="text-sm mb-2 block">Protein (g)</Label>
            <Input type="number" placeholder="0" value={meal.protein_g} onChange={e => setMeal(p => ({ ...p, protein_g: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
          </div>
          <div>
            <Label className="text-sm mb-2 block">Carbs (g)</Label>
            <Input type="number" placeholder="0" value={meal.carbs_g} onChange={e => setMeal(p => ({ ...p, carbs_g: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
          </div>
          <div>
            <Label className="text-sm mb-2 block">Fat (g)</Label>
            <Input type="number" placeholder="0" value={meal.fat_g} onChange={e => setMeal(p => ({ ...p, fat_g: e.target.value }))} className="h-12 rounded-xl bg-card border-border" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || !meal.food_name} className="w-full h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
          <Check size={16} className="mr-2" /> {saving ? 'Saving...' : 'Log Meal'}
        </Button>
      </div>
    </>
  );
}