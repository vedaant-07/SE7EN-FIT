import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, ChevronRight, Crown, Loader2, Lock, Minus, Plus, RefreshCw, Upload, Zap } from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { getNativeFoodPhoto, isNativeApp, nativeTap } from '@/lib/nativeBridge';
import { memberProductClient } from '@/api/memberProductClient';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const EMPTY_TOTALS = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeItems(rows) {
  return (Array.isArray(rows) ? rows : []).map((item, index) => ({
    id: item.id || `food:${index}:${Date.now()}`,
    name: String(item.name || 'Food item'),
    calories: safeNumber(item.calories ?? item.estimatedCalories),
    protein: safeNumber(item.protein),
    carbs: safeNumber(item.carbs),
    fat: safeNumber(item.fat),
    fiber: safeNumber(item.fiber),
    serving: String(item.serving || item.servingSize || '1 serving'),
    confidence: Math.min(100, Math.max(0, safeNumber(item.confidence))),
    quantity: Math.min(10, Math.max(0.25, safeNumber(item.quantity) || 1)),
  }));
}

function revokePreview(value) {
  if (value?.startsWith('blob:')) URL.revokeObjectURL(value);
}

export default function FoodScan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stage, setStage] = useState('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [items, setItems] = useState([]);
  const [scanId, setScanId] = useState(null);
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [notes, setNotes] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => () => revokePreview(imageUrl), [imageUrl]);

  const totals = useMemo(() => items.reduce((sum, item) => {
    const quantity = Math.min(10, Math.max(0.25, safeNumber(item.quantity) || 1));
    return {
      calories: sum.calories + safeNumber(item.calories) * quantity,
      protein: sum.protein + safeNumber(item.protein) * quantity,
      carbs: sum.carbs + safeNumber(item.carbs) * quantity,
      fat: sum.fat + safeNumber(item.fat) * quantity,
      fiber: sum.fiber + safeNumber(item.fiber) * quantity,
    };
  }, EMPTY_TOTALS), [items]);

  const reset = () => {
    revokePreview(imageUrl);
    setImageUrl('');
    setItems([]);
    setScanId(null);
    setOverallConfidence(0);
    setNotes('');
    setError('');
    setStage('upload');
  };

  const analyzeFile = async (file, previewUrl) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(file.type || '').toLowerCase())) {
      toast({ title: 'Unsupported photo', description: 'Choose a JPEG, PNG or WebP image.', variant: 'destructive' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Photo is too large', description: 'Choose an image smaller than 8 MB.', variant: 'destructive' });
      return;
    }

    revokePreview(imageUrl);
    setImageUrl(previewUrl || URL.createObjectURL(file));
    setStage('scanning');
    setLoading(true);
    setError('');

    try {
      const result = await memberProductClient.analyzeFood({ file, mealType });
      const detected = normalizeItems(result.detectedFoods || result.scan?.detected_items);
      if (!detected.length) throw new Error('No food could be identified. Try a clearer photo with the full plate visible.');
      setScanId(result.scan?.scan_id);
      setItems(detected);
      setOverallConfidence(safeNumber(result.overallConfidence ?? result.scan?.confidence_score));
      setNotes(String(result.notes || result.scan?.notes || 'Nutrition values are estimates. Review each item before saving.'));
      setRemaining(result.usage?.remaining ?? null);
      setStage('results');
    } catch (requestError) {
      if (requestError.code === 'feature_locked') setLocked(true);
      if (requestError.code === 'quota_exceeded') setLimitReached(true);
      setError(requestError.message || 'Food Scan is temporarily unavailable.');
      setStage('upload');
    } finally {
      setLoading(false);
    }
  };

  const choosePhoto = async (source) => {
    await nativeTap();
    if (isNativeApp()) {
      try {
        const photo = await getNativeFoodPhoto(source);
        if (photo?.file) await analyzeFile(photo.file, photo.imageUrl);
      } catch (requestError) {
        if (/cancel/i.test(String(requestError?.message || ''))) return;
        toast({ title: 'Permission needed', description: 'Allow camera or photo access and try again.', variant: 'destructive' });
      }
      return;
    }
    document.getElementById(source === 'camera' ? 'food-camera-input' : 'food-gallery-input')?.click();
  };

  const onFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await analyzeFile(file);
  };

  const updateItem = (id, field, value) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (field === 'name' || field === 'serving') return { ...item, [field]: value };
      const number = safeNumber(value);
      const limits = { calories: 5000, protein: 500, carbs: 1000, fat: 500, fiber: 100, confidence: 100, quantity: 10 };
      const minimum = field === 'quantity' ? 0.25 : 0;
      return { ...item, [field]: Math.min(limits[field] || 5000, Math.max(minimum, number)) };
    }));
  };

  const adjustQuantity = (id, delta) => {
    const current = items.find((item) => item.id === id);
    if (current) updateItem(id, 'quantity', safeNumber(current.quantity) + delta);
  };

  const confirmAndSave = async () => {
    if (!scanId || items.length === 0) return;
    if (items.some((item) => !item.name.trim())) {
      toast({ title: 'Check detected foods', description: 'Every food item needs a name.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setError('');
    try {
      await memberProductClient.confirmFood(scanId, {
        meal_type: mealType,
        date: new Date().toLocaleDateString('en-CA'),
        items: items.map(({ id: _id, ...item }) => item),
      });
      setStage('saved');
      toast({ title: 'Meal saved to your diary' });
    } catch (requestError) {
      setError(requestError.message || 'Could not save this meal.');
      toast({ title: 'Save failed', description: requestError.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopBar title="Food Scan" showBack />
      <div className="px-4 py-4 pb-24 space-y-4 max-w-lg mx-auto">
        {(locked || limitReached) && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-center">
            <Lock size={28} className="text-yellow-400 mx-auto mb-3" />
            <h3 className="font-heading font-bold text-base">{locked ? 'Food Scan is not included in this plan' : 'Food Scan limit reached'}</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Upgrade for more AI food scans and nutrition assistance.</p>
            <a href="/subscription" className="inline-flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-xl"><Crown size={14} /> View plans</a>
          </div>
        )}

        {error && !locked && !limitReached && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-red-200">{error}</p>
            <button onClick={() => setError('')} className="shrink-0 text-[10px] font-semibold text-red-100">Dismiss</button>
          </div>
        )}

        {stage === 'upload' && !locked && !limitReached && (
          <>
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3"><Camera size={28} className="text-accent" /></div>
              <h2 className="font-heading font-bold text-xl">AI Food Scanner</h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Photograph your meal, review the estimates, correct them, then save.</p>
              {remaining !== null && <p className="text-[10px] text-accent mt-2">{remaining} scans remaining in this plan period</p>}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Meal type</p>
              <div className="flex gap-2 flex-wrap">
                {MEALS.map((value) => (
                  <button key={value} type="button" onClick={() => setMealType(value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize ${mealType === value ? 'bg-white text-black' : 'bg-muted text-muted-foreground'}`}>{value}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => void choosePhoto('camera')} className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all">
                <Camera size={24} className="text-accent" /><span className="font-semibold text-sm">Use camera</span><span className="text-[10px] text-muted-foreground">Take a photo now</span>
              </button>
              <button type="button" onClick={() => void choosePhoto('gallery')} className="bg-card border-2 border-dashed border-border rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition-all">
                <Upload size={24} className="text-accent" /><span className="font-semibold text-sm">Upload photo</span><span className="text-[10px] text-muted-foreground">Choose from gallery</span>
              </button>
            </div>
            <input id="food-camera-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={onFileChange} />
            <input id="food-gallery-input" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFileChange} />

            <div className="bg-muted/40 border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Use good lighting and keep the entire plate visible. Results are estimates, not medical measurements.</p>
            </div>
          </>
        )}

        {stage === 'scanning' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            {imageUrl && <div className="relative w-64 h-64 rounded-3xl overflow-hidden border-2 border-accent/30"><img src={imageUrl} alt="Meal being analyzed" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-3"><div className="w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin" /><p className="text-white font-semibold text-sm">Analyzing your meal…</p></div></div>}
            <div className="text-center"><p className="font-heading font-bold text-lg">Detecting food and portions</p><p className="text-xs text-muted-foreground mt-1">This can take several seconds.</p></div>
          </div>
        )}

        {stage === 'results' && (
          <>
            {imageUrl && <div className="w-full h-40 rounded-2xl overflow-hidden relative"><img src={imageUrl} alt="Scanned meal" className="w-full h-full object-cover" /><div className="absolute bottom-2 right-2 bg-accent text-accent-foreground text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"><Zap size={10} /> AI estimate</div><div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded-full">{Math.round(overallConfidence)}% confidence</div></div>}

            <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-2xl p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Current total estimate</p>
              <div className="grid grid-cols-5 gap-1">
                {[['kcal', Math.round(totals.calories)], ['Protein', `${Math.round(totals.protein)}g`], ['Carbs', `${Math.round(totals.carbs)}g`], ['Fat', `${Math.round(totals.fat)}g`], ['Fiber', `${Math.round(totals.fiber)}g`]].map(([label, value]) => <div key={label} className="text-center"><p className="font-bold text-sm">{value}</p><p className="text-[9px] text-muted-foreground">{label}</p></div>)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between"><h3 className="font-heading font-semibold text-sm">Review detected items</h3><span className="text-[10px] text-muted-foreground">Edit before saving</span></div>
              {items.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input value={item.name} onChange={(event) => updateItem(item.id, 'name', event.target.value)} aria-label="Food name" className="h-10 rounded-xl bg-background" />
                    <button onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))} className="text-[10px] text-red-400 px-2">Remove</button>
                  </div>
                  <Input value={item.serving} onChange={(event) => updateItem(item.id, 'serving', event.target.value)} aria-label="Serving size" className="h-9 rounded-xl bg-background text-xs" />
                  <div className="grid grid-cols-3 gap-2">
                    {[['calories', 'kcal'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g'], ['fiber', 'Fiber g']].map(([field, label]) => (
                      <label key={field} className="text-[9px] text-muted-foreground">{label}<Input type="number" min="0" step="0.1" value={item[field]} onChange={(event) => updateItem(item.id, field, event.target.value)} className="mt-1 h-9 rounded-lg bg-background text-xs" /></label>
                    ))}
                    <div className="text-[9px] text-muted-foreground">Quantity<div className="mt-1 h-9 flex items-center justify-between rounded-lg bg-background border border-border px-2"><button onClick={() => adjustQuantity(item.id, -0.25)}><Minus size={12} /></button><span className="text-xs font-bold">{item.quantity}</span><button onClick={() => adjustQuantity(item.id, 0.25)}><Plus size={12} /></button></div></div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">AI confidence: {Math.round(item.confidence)}%. Verify ingredients, oil and serving size yourself.</p>
                </div>
              ))}
            </div>

            {notes && <p className="text-[10px] text-muted-foreground text-center">{notes}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1 h-12 rounded-xl"><RefreshCw size={14} className="mr-2" /> Rescan</Button>
              <Button onClick={() => void confirmAndSave()} disabled={loading || items.length === 0} className="flex-1 h-12 rounded-xl bg-white text-black hover:bg-white/90 font-semibold">
                {loading ? <><Loader2 size={15} className="mr-2 animate-spin" />Saving…</> : <><Check size={16} className="mr-1" /> Save meal</>}
              </Button>
            </div>
          </>
        )}

        {stage === 'saved' && (
          <div className="flex flex-col items-center justify-center min-h-[55vh] gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/15 border-2 border-accent flex items-center justify-center"><Check size={36} className="text-accent" /></div>
            <div><h2 className="font-heading font-bold text-2xl">Meal logged</h2><p className="text-muted-foreground text-sm mt-1">Your reviewed items were saved atomically.</p></div>
            <div className="bg-card border border-border rounded-2xl p-4 w-full grid grid-cols-2 gap-3"><div><p className="text-2xl font-bold text-accent">{Math.round(totals.calories)}</p><p className="text-xs text-muted-foreground">calories</p></div><div><p className="text-2xl font-bold">{Math.round(totals.protein)}g</p><p className="text-xs text-muted-foreground">protein</p></div></div>
            <div className="flex gap-3 w-full"><Button variant="outline" onClick={reset} className="flex-1 h-12 rounded-xl">Scan another</Button><Button onClick={() => navigate('/nutrition')} className="flex-1 h-12 rounded-xl bg-white text-black">View diary <ChevronRight size={16} /></Button></div>
          </div>
        )}
      </div>
    </>
  );
}
