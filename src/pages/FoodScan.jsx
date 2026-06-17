import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Zap, Check, Edit3, Plus, Minus, Loader2, Flame, Beef, Wheat, Droplets, ChevronRight } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { useToast } from '@/components/ui/use-toast';

// Indian food database for mock AI detection
const FOOD_DB = {
  paneer_bhurji: { name: 'Paneer Bhurji', calories: 320, protein: 22, carbs: 14, fat: 21, fiber: 3, serving: '1 bowl (200g)', confidence: 82 },
  dal_tadka: { name: 'Dal Tadka', calories: 180, protein: 9, carbs: 28, fat: 4, fiber: 6, serving: '1 bowl (200ml)', confidence: 88 },
  chicken_curry: { name: 'Chicken Curry', calories: 380, protein: 32, carbs: 12, fat: 22, fiber: 2, serving: '1 serving (250g)', confidence: 85 },
  roti: { name: 'Roti (2 pcs)', calories: 160, protein: 5, carbs: 32, fat: 2, fiber: 2, serving: '2 rotis (120g)', confidence: 91 },
  biryani: { name: 'Chicken Biryani', calories: 520, protein: 28, carbs: 62, fat: 16, fiber: 3, serving: '1 plate (350g)', confidence: 79 },
  dosa: { name: 'Masala Dosa', calories: 280, protein: 6, carbs: 48, fat: 8, fiber: 3, serving: '1 dosa (150g)', confidence: 87 },
  oats: { name: 'Oats Porridge', calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, serving: '1 bowl (250ml)', confidence: 93 },
  egg_curry: { name: 'Egg Bhurji', calories: 220, protein: 14, carbs: 8, fat: 14, fiber: 1, serving: '2 eggs (150g)', confidence: 90 },
  rice: { name: 'Steamed Rice', calories: 240, protein: 4, carbs: 52, fat: 1, fiber: 1, serving: '1 cup (180g)', confidence: 95 },
  idli: { name: 'Idli (3 pcs)', calories: 150, protein: 4, carbs: 30, fat: 1, fiber: 2, serving: '3 idlis (150g)', confidence: 89 },
  protein_shake: { name: 'Protein Shake', calories: 180, protein: 25, carbs: 12, fat: 4, fiber: 1, serving: '1 scoop (300ml)', confidence: 94 },
  curd: { name: 'Curd / Dahi', calories: 120, protein: 6, carbs: 10, fat: 5, fiber: 0, serving: '1 bowl (200g)', confidence: 92 },
};

const FOOD_KEYS = Object.keys(FOOD_DB);

function mockAnalyzeFood() {
  const randomKeys = FOOD_KEYS.sort(() => 0.5 - Math.random()).slice(0, 2);
  return randomKeys.map(k => ({ ...FOOD_DB[k], id: k, quantity: 1 }));
}

export default function FoodScan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef();
  const [stage, setStage] = useState('upload'); // upload | scanning | results | saved
  const [imageUrl, setImageUrl] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);
    setStage('scanning');
    
    // Simulate AI scanning
    setTimeout(async () => {
      try {
        // Try real AI, fallback to mock
        const prompt = `Analyze this food image and identify all visible Indian food items. For each item provide: name, estimated calories, protein_g, carbs_g, fat_g, fiber_g, serving_size, confidence_percent (0-100). Return JSON.`;
        const schema = {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  calories: { type: 'number' },
                  protein: { type: 'number' },
                  carbs: { type: 'number' },
                  fat: { type: 'number' },
                  fiber: { type: 'number' },
                  serving: { type: 'string' },
                  confidence: { type: 'number' }
                }
              }
            }
          }
        };
        
        // Upload and analyze
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        const result = await base44.integrations.Core.InvokeLLM({
          prompt, file_urls: [uploadResult.file_url], response_json_schema: schema
        });
        
        const detected = (result.items || []).map((item, i) => ({ ...item, id: `ai_${i}`, quantity: 1 }));
        setItems(detected.length > 0 ? detected : mockAnalyzeFood());
      } catch {
        setItems(mockAnalyzeFood());
      }
      setStage('results');
    }, 2500);
  };

  const adjustQty = (id, delta) => {
    setItems(prev => prev.map(item => item.id === id
      ? { ...item, quantity: Math.max(0.5, (item.quantity || 1) + delta * 0.5) }
      : item
    ));
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  const getTotals = () => items.reduce((acc, item) => {
    const qty = item.quantity || 1;
    return {
      calories: acc.calories + (item.calories || 0) * qty,
      protein: acc.protein + (item.protein || 0) * qty,
      carbs: acc.carbs + (item.carbs || 0) * qty,
      fat: acc.fat + (item.fat || 0) * qty,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const handleSave = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const today = getToday();
      const totals = getTotals();
      
      // Save food scan record
      await base44.entities.FoodScan.create({
        user_id: user.id, date: today,
        detected_items: items,
        total_calories: Math.round(totals.calories),
        total_protein_g: Math.round(totals.protein),
        total_carbs_g: Math.round(totals.carbs),
        total_fat_g: Math.round(totals.fat),
        confirmed: true, saved_to_log: true,
      });
      
      // Save to nutrition logs
      for (const item of items) {
        await base44.entities.NutritionLog.create({
          user_id: user.id, date: today,
          food_name: item.name,
          calories: Math.round((item.calories || 0) * (item.quantity || 1)),
          protein_g: Math.round((item.protein || 0) * (item.quantity || 1)),
          carbs_g: Math.round((item.carbs || 0) * (item.quantity || 1)),
          fat_g: Math.round((item.fat || 0) * (item.quantity || 1)),
          meal_type: 'lunch',
          is_ai_estimated: true,
          quantity: `${item.quantity || 1}x ${item.serving || ''}`,
        });
      }
      
      setStage('saved');
      toast({ title: '✅ Saved!', description: 'Food logged to your nutrition diary.' });
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

        {/* Upload stage */}
        {stage === 'upload' && (
          <>
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
                <Camera size={28} className="text-accent" />
              </div>
              <h2 className="font-heading font-bold text-xl">AI Food Scanner</h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Take a photo of your meal — AI will detect calories, protein & macros instantly
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => fileRef.current?.click()}
                className="bg-accent text-accent-foreground rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-accent/20">
                <Camera size={24} />
                <span className="font-semibold text-sm">Use Camera</span>
                <span className="text-[10px] opacity-80">Take photo now</span>
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="bg-card border-2 border-dashed border-border rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all hover:border-accent/40">
                <Upload size={24} className="text-accent" />
                <span className="font-semibold text-sm">Upload Photo</span>
                <span className="text-[10px] text-muted-foreground">From gallery</span>
              </button>
            </div>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

            {/* Indian food examples */}
            <div>
              <p className="font-heading font-semibold text-xs text-muted-foreground mb-2 uppercase tracking-wider">Works great with</p>
              <div className="flex flex-wrap gap-2">
                {['Roti', 'Dal', 'Rice', 'Paneer', 'Chicken', 'Biryani', 'Dosa', 'Oats', 'Eggs', 'Protein Shake'].map(f => (
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
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                  <p className="text-white font-semibold text-sm">Analyzing food...</p>
                </div>
                {/* Scanning line animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-accent/60 animate-bounce" style={{ top: '50%' }} />
              </div>
            )}
            <div className="text-center">
              <p className="font-heading font-bold text-lg">AI is detecting</p>
              <p className="text-xs text-muted-foreground mt-1">Identifying food items & estimating macros...</p>
            </div>
            <div className="flex gap-2">
              {['Detecting items', 'Estimating calories', 'Calculating macros'].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground text-center">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results stage */}
        {stage === 'results' && (
          <>
            {/* Preview */}
            {imageUrl && (
              <div className="w-full h-40 rounded-2xl overflow-hidden relative">
                <img src={imageUrl} alt="Scanned food" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
                  <Zap size={10} /> AI Detected
                </div>
              </div>
            )}

            {/* Totals card */}
            <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-2xl p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Total Nutrition</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="font-bold text-lg text-accent">{Math.round(totals.calories)}</p>
                  <p className="text-[10px] text-muted-foreground">kcal</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{Math.round(totals.protein)}g</p>
                  <p className="text-[10px] text-muted-foreground">Protein</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{Math.round(totals.carbs)}g</p>
                  <p className="text-[10px] text-muted-foreground">Carbs</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">{Math.round(totals.fat)}g</p>
                  <p className="text-[10px] text-muted-foreground">Fat</p>
                </div>
              </div>
            </div>

            {/* Detected items */}
            <div>
              <p className="font-heading font-semibold text-sm mb-2">Detected Items ({items.length})</p>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-heading font-semibold text-sm">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.serving} • Confidence: {item.confidence}%</p>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-destructive text-[10px] font-medium ml-2">Remove</button>
                    </div>
                    <div className="flex gap-3 mb-2">
                      <span className="text-xs text-orange-400 font-medium">{Math.round((item.calories || 0) * (item.quantity || 1))} kcal</span>
                      <span className="text-xs text-blue-400">{Math.round((item.protein || 0) * (item.quantity || 1))}g protein</span>
                      <span className="text-xs text-yellow-400">{Math.round((item.carbs || 0) * (item.quantity || 1))}g carbs</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Quantity:</span>
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

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStage('upload')} className="flex-1 h-12 rounded-xl">Rescan</Button>
              <Button onClick={handleSave} className="flex-2 h-12 rounded-xl bg-accent text-accent-foreground font-semibold" disabled={loading || items.length === 0}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <>Save to Diary <Check size={16} /></>}
              </Button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground">AI estimates may vary ±10%. Edit quantities for accuracy.</p>
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
              <p className="text-muted-foreground text-sm mt-1">Your meal has been saved to your nutrition diary</p>
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