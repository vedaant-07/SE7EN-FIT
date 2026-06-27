import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Zap, Check, Plus, Minus, Loader2, ChevronRight, Crown, Lock } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

export default function FoodScan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stage, setStage] = useState('upload');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [items, setItems] = useState([]);
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [mealType, setMealType] = useState('lunch');
  const [locked, setLocked] = useState(false);

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose a food photo image.', variant: 'destructive' });
      return;
    }

    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setStage('scanning');

    try {
      const base64 = await toBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const result = await base44.functions.invoke('geminiService', {
        action: 'analyzeFoodImage',
        imageBase64: base64,
        mimeType,
        mealType,
      });

      const data = result.data;
      if (data?.locked) {
        setLocked(true);
        setStage('upload');
        return;
      }
      if (data?.error) {
        toast({ title: 'Scan failed', description: data.error, variant: 'destructive' });
        setStage('upload');
        return;
      }

      const detected = (data.detectedFoods || []).map((item, i) => ({
        id: `gemini_${i}`,
        name: item.name,
        calories: item.estimatedCalories || 0,
        protein: item.protein || 0,
        carbs: item.carbs || 0,
        fat: item.fat || 0,
        fiber: item.fiber || 0,
        serving: item.servingSize || '1 serving',
        confidence: item.confidence || 75,
        quantity: 1,
      }));

      setItems(detected);
      setOverallConfidence(data.overallConfidence || 0);
      setNotes(data.notes || '');
      setStage(detected.length > 0 ? 'results' : 'upload');
      if (detected.length === 0) {
        toast({ title: 'No food detected', description: 'Upload a clearer photo of your meal.', variant: 'destructive' });
      }
    } catch (e) {
      console.error('[FoodScan] scan failed:', e);
      toast({ title: 'Food scan is not connected', description: 'Camera/gallery opened successfully, but the Gemini scan backend failed. Check the geminiService function.', variant: 'destructive' });
      setStage('upload');
    }
  };

  const adjustQty = (id, delta) =>
    setItems(prev => prev.map(item => item.id === id
      ? { ...item, quantity: Math.max(0.5, (item.quantity || 1) + delta * 0.5) }
      : item
    ));
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  const getTotals = () => items.reduce((acc, item) => {
    const qty = item.quantity || 1;
    return {
      calories: acc.calories + (item.calories || 0) * qty,
      protein: acc.protein + (item.protein || 0) * qty,
      carbs: acc.carbs + (item.carbs || 0) * qty,
      fat: acc.fat + (item.fat || 0) * qty,
      fiber: acc.fiber + (item.fiber || 0) * qty,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const handleSave = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const today = getToday();
      const totals = getTotals();

      await base44.entities.FoodScan.create({
        user_id: user.id, date: today,
        detected_items: items,
        total_calories: Math.round(totals.calories),
        total_protein_g: Math.round(totals.protein),
        total_carbs_g: Math.round(totals.carbs),
        total_fat_g: Math.round(totals.fat),
        confidence_score: overallConfidence,
        confirmed: true, saved_to_log: true,
      });

      for (const item of items) {
        await base44.entities.NutritionLog.create({
          user_id: user.id, date: today,
          food_name: item.name,
          calories: Math.round((item.calories || 0) * (item.quantity || 1)),
          protein_g: Math.round((item.protein || 0) * (item.quantity || 1)),
          carbs_g: Math.round((item.carbs || 0) * (item.quantity || 1)),
          fat_g: Math.round((item.fat || 0) * (item.quantity || 1)),
          fiber_g: Math.round((item.fiber || 0) * (item.quantity || 1)),
          meal_type: mealType,
          quantity: `${item.quantity || 1}x ${item.serving || ''}`,
          source: 'food_scan',
        });
      }

      setStage('saved');
      toast({ title: '✅ Saved to diary!' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save. Try again.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const totals = getTotals();

  return (
    <>
      <TopBar title="Food Scan" showBack />
      <div className="px-4 py-4 pb-24 space-y-4 max-w-lg mx-auto">

        {/* Locked state */}
        {locked && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-center">
            <Lock size={28} className="text-yellow-400 mx-auto mb-3" />
            <h3 className="font-heading font-bold text-base mb-1">Food Scan Locked</h3>
            <p className="text-xs text-muted-foreground mb-4">Upgrade to unlock AI Food Scanning with calorie & macro detection.</p>
            <a href="/subscription" className="inline-flex items-center gap-2 bg-yellow-500 text-black font-semibold text-sm px-5 py-2.5 rounded-xl">
              <Crown size={14} /> Upgrade Plan
            </a>
          </div>
        )}

        {/* Upload stage */}
        {stage === 'upload' && !locked && (
          <>
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
                <Camera size={28} className="text-accent" />
              </div>
              <h2 className="font-heading font-bold text-xl">AI Food Scanner</h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Powered by Google Gemini Vision — detects Indian food, calories & macros instantly
              </p>
            </div>

            {/* Meal type selector */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Meal Type</p>
              <div className="flex gap-2 flex-wrap">
                {['breakfast', 'lunch', 'dinner', 'snack'].map(mt => (
                  <button key={mt} type="button" onClick={() => setMealType(mt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${mealType === mt ? 'bg-white text-black' : 'bg-muted text-muted-foreground'}`}>
                    {mt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="food-camera-input"
                className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all cursor-pointer hover:border-white/20">
                <Camera size={24} className="text-accent" />
                <span className="font-semibold text-sm">Use Camera</span>
                <span className="text-[10px] text-muted-foreground">Take photo now</span>
              </label>
              <label htmlFor="food-gallery-input"
                className="bg-card border-2 border-dashed border-border rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all cursor-pointer hover:border-white/20">
                <Upload size={24} className="text-accent" />
                <span className="font-semibold text-sm">Upload Photo</span>
                <span className="text-[10px] text-muted-foreground">From gallery</span>
              </label>
            </div>

            <input id="food-camera-input" type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileChange} />
            <input id="food-gallery-input" type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

            <div>
              <p className="font-heading font-semibold text-xs text-muted-foreground mb-2 uppercase tracking-wider">Works great with</p>
              <div className="flex flex-wrap gap-2">
                {['Roti', 'Dal', 'Rice', 'Paneer', 'Chicken', 'Biryani', 'Dosa', 'Oats', 'Eggs', 'Curd', 'Protein Shake', 'Fruits'].map(f => (
                  <span key={f} className="text-[11px] bg-muted px-2.5 py-1 rounded-full text-muted-foreground border border-border">{f}</span>
                ))}
              </div>
            </div>

            <div className="bg-muted/40 border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">📸 <span className="font-medium">Tip:</span> Take photo in good lighting for best results</p>
            </div>
          </>
        )}

        {/* Scanning stage */}
        {stage === 'scanning' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            {imageUrl && (
              <div className="relative w-64 h-64 rounded-3xl overflow-hidden border-2 border-accent/30">
                <img src={imageUrl} alt="Food" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                  <p className="text-white font-semibold text-sm">Gemini analyzing...</p>
                </div>
              </div>
            )}
            <div className="text-center">
              <p className="font-heading font-bold text-lg">AI is detecting food</p>
              <p className="text-xs text-muted-foreground mt-1">Identifying items, estimating calories & macros...</p>
            </div>
            <div className="flex gap-4">
              {['Detecting', 'Estimating', 'Calculating'].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results stage */}
        {stage === 'results' && (
          <>
            {imageUrl && (
              <div className="w-full h-40 rounded-2xl overflow-hidden relative">
                <img src={imageUrl} alt="Scanned food" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
                  <Zap size={10} /> Gemini Detected
                </div>
                {overallConfidence > 0 && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
                    {overallConfidence}% confidence
                  </div>
                )}
              </div>
            )}

            <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-2xl p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Total Nutrition Estimate</p>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: 'kcal', val: Math.round(totals.calories), color: 'text-orange-400' },
                  { label: 'Protein', val: `${Math.round(totals.protein)}g`, color: 'text-blue-400' },
                  { label: 'Carbs', val: `${Math.round(totals.carbs)}g`, color: 'text-yellow-400' },
                  { label: 'Fat', val: `${Math.round(totals.fat)}g`, color: 'text-pink-400' },
                  { label: 'Fiber', val: `${Math.round(totals.fiber)}g`, color: 'text-green-400' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="text-center">
                    <p className={`font-bold text-sm ${color}`}>{val}</p>
                    <p className="text-[9px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-heading font-semibold text-sm mb-2">Detected Items ({items.length})</p>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-heading font-semibold text-sm">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.serving} • {item.confidence}% confidence</p>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-destructive text-[10px] font-medium ml-2">Remove</button>
                    </div>
                    <div className="flex gap-2 flex-wrap mb-2">
                      <span className="text-xs bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded-full">{Math.round((item.calories || 0) * (item.quantity || 1))} kcal</span>
                      <span className="text-xs bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded-full">P: {Math.round((item.protein || 0) * (item.quantity || 1))}g</span>
                      <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full">C: {Math.round((item.carbs || 0) * (item.quantity || 1))}g</span>
                      <span className="text-xs bg-pink-400/10 text-pink-400 px-2 py-0.5 rounded-full">F: {Math.round((item.fat || 0) * (item.quantity || 1))}g</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Qty:</span>
                      <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-1">
                        <button onClick={() => adjustQty(item.id, -1)} className="text-muted-foreground active:scale-75 transition-all"><Minus size={12} /></button>
                        <span className="text-sm font-bold min-w-[24px] text-center">{item.quantity || 1}</span>
                        <button onClick={() => adjustQty(item.id, 1)} className="text-accent active:scale-75 transition-all"><Plus size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {notes && <p className="text-center text-[10px] text-muted-foreground">{notes}</p>}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStage('upload'); setImageUrl(null); setItems([]); }} className="flex-1 h-12 rounded-xl">Rescan</Button>
              <Button onClick={handleSave} className="flex-1 h-12 rounded-xl bg-accent text-accent-foreground font-semibold" disabled={loading || items.length === 0}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check size={16} className="mr-1" /> Save to Diary</>}
              </Button>
            </div>
          </>
        )}

        {/* Saved stage */}
        {stage === 'saved' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/15 border-2 border-accent flex items-center justify-center">
              <Check size={36} className="text-accent" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-2xl">Logged! 🎉</h2>
              <p className="text-muted-foreground text-sm mt-1">Saved to your nutrition diary</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 w-full">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{Math.round(totals.calories)}</p>
                  <p className="text-xs text-muted-foreground">calories logged</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{Math.round(totals.protein)}g</p>
                  <p className="text-xs text-muted-foreground">protein logged</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={() => { setStage('upload'); setImageUrl(null); setItems([]); }} className="flex-1 h-12 rounded-xl">Scan More</Button>
              <Button onClick={() => navigate('/nutrition')} className="flex-1 h-12 rounded-xl bg-accent text-accent-foreground">View Diary <ChevronRight size={16} /></Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
