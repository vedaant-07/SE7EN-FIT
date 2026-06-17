import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Lock, Crown, ChevronDown, ChevronUp, ShoppingCart, Lightbulb } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AIMealPlan({ profile, subscription }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [locked, setLocked] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const isPremiumOrBasic = subscription && ['basic_monthly', 'premium_monthly', 'premium_quarterly', 'premium_annual', 'free_trial'].includes(subscription.plan);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('geminiService', { action: 'generateMealPlan', profile });
      const data = result.data;
      if (data?.locked) { setLocked(true); return; }
      if (data?.error) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return; }
      setPlan(data);
      // Save to entity
      const user = await base44.auth.me();
      await base44.entities.MealPlan.create({
        user_id: user.id, date: new Date().toISOString().slice(0, 10),
        daily_calories_target: data.dailyCaloriesTarget,
        daily_protein_target: data.dailyProteinTarget,
        meals: data.meals,
        shopping_list: data.shoppingList,
        tips: data.tips,
        is_ai_generated: true,
      });
      toast({ title: '🥗 Meal plan generated!' });
    } catch (e) {
      toast({ title: 'Error', description: 'AI is temporarily unavailable.', variant: 'destructive' });
    }
    setLoading(false);
  };

  if (locked) return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-center">
      <Lock size={24} className="text-yellow-400 mx-auto mb-2" />
      <p className="font-semibold text-sm mb-1">Meal Plan Locked</p>
      <p className="text-xs text-muted-foreground mb-3">Upgrade to generate AI-powered Indian meal plans.</p>
      <a href="/subscription" className="inline-flex items-center gap-1.5 bg-yellow-500 text-black text-xs font-semibold px-4 py-2 rounded-xl"><Crown size={12} /> Upgrade</a>
    </div>
  );

  if (!isPremiumOrBasic) return (
    <div className="bg-card border border-border rounded-2xl p-4 text-center">
      <Sparkles size={20} className="text-accent mx-auto mb-2" />
      <p className="font-heading font-semibold text-sm mb-1">AI Meal Plan</p>
      <p className="text-xs text-muted-foreground mb-3">Get a personalized Indian meal plan based on your goal & diet preference.</p>
      <a href="/subscription" className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-4 py-2 rounded-xl"><Crown size={12} /> Unlock</a>
    </div>
  );

  if (!plan) return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center"><Sparkles size={16} className="text-accent" /></div>
        <div>
          <p className="font-heading font-semibold text-sm">AI Meal Plan</p>
          <p className="text-xs text-muted-foreground">Personalized Indian diet for your goal</p>
        </div>
      </div>
      <Button onClick={generate} disabled={loading} className="w-full h-10 rounded-xl bg-accent text-accent-foreground text-sm">
        {loading ? <><Loader2 size={14} className="mr-2 animate-spin" />Generating...</> : <><Sparkles size={14} className="mr-2" />Generate My Meal Plan</>}
      </Button>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-accent/15 to-accent/5 p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading font-bold text-sm">Today's AI Meal Plan</p>
            <p className="text-xs text-muted-foreground">{plan.dailyCaloriesTarget} kcal • {plan.dailyProteinTarget}g protein</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPlan(null)} className="text-xs text-muted-foreground">Regenerate</Button>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {(plan.meals || []).map((meal, i) => (
          <div key={i} className="p-4">
            <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="font-medium text-sm">{meal.mealType}</p>
                  <p className="text-xs text-muted-foreground">{meal.mealName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-accent">{meal.calories} kcal</span>
                {expanded === i ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </div>
            </button>
            {expanded === i && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[10px] bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded-full">P: {meal.protein}g</span>
                  <span className="text-[10px] bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full">C: {meal.carbs}g</span>
                  <span className="text-[10px] bg-pink-400/10 text-pink-400 px-2 py-0.5 rounded-full">F: {meal.fat}g</span>
                  <span className="text-[10px] bg-green-400/10 text-green-400 px-2 py-0.5 rounded-full">Fiber: {meal.fiber}g</span>
                </div>
                <ul className="space-y-1">
                  {(meal.foods || []).map((f, j) => (
                    <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-accent mt-0.5">•</span>{f}
                    </li>
                  ))}
                </ul>
                {meal.notes && <p className="text-[10px] text-muted-foreground italic">{meal.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      {plan.tips?.length > 0 && (
        <div className="p-4 bg-muted/30 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={12} className="text-accent" />
            <p className="text-xs font-medium">Tips</p>
          </div>
          {plan.tips.slice(0, 3).map((tip, i) => (
            <p key={i} className="text-[11px] text-muted-foreground mb-1">• {tip}</p>
          ))}
        </div>
      )}
    </div>
  );
}