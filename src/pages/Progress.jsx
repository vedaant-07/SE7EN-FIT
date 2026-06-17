import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import EmptyState from '@/components/se7enfit/EmptyState';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import { Button } from '@/components/ui/button';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingDown, TrendingUp, Scale, Camera, Ruler, Plus, Target, Award, ChevronDown, Bot, RefreshCw, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getToday, calculateBMI, getBMICategory } from '@/lib/fitnessUtils';

const TABS = ['Weight', 'Body', 'Photos', 'AI Report'];

export default function Progress() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [weightLogs, setWeightLogs] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Weight');
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [profiles, wl, bm, pp, wkl] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 30),
      base44.entities.BodyMeasurement.filter({ user_id: user.id }, '-date', 10),
      base44.entities.ProgressPhoto.filter({ user_id: user.id }, '-date', 20),
      base44.entities.WorkoutLog.filter({ user_id: user.id }, '-date', 30),
    ]);
    setProfile(profiles[0] || null);
    setWeightLogs(wl);
    setMeasurements(bm);
    setPhotos(pp);
    setWorkoutLogs(wkl);
    setLoading(false);
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    try {
      const user = await base44.auth.me();
      const [nl, wl, wkl, sl, stl] = await Promise.all([
        base44.entities.NutritionLog.filter({ user_id: user.id }, '-date', 30),
        base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 10),
        base44.entities.WorkoutLog.filter({ user_id: user.id }, '-date', 14),
        base44.entities.SleepLog.filter({ user_id: user.id }, '-date', 7),
        base44.entities.StepLog.filter({ user_id: user.id }, '-date', 7),
      ]);
      const logs = {
        weightLogs: wl.map(l => ({ date: l.date, weight_kg: l.weight_kg })),
        workoutLogs: wkl.map(l => ({ date: l.date, completed: l.completed, calories_burned: l.calories_burned })),
        nutritionLogs: nl.map(l => ({ date: l.date, calories: l.calories, protein_g: l.protein_g })),
        sleepLogs: sl.map(l => ({ date: l.date, hours: l.hours })),
        stepLogs: stl.map(l => ({ date: l.date, steps: l.steps })),
        profile: { goal: profile?.goal, fitness_level: profile?.fitness_level, weight_kg: profile?.weight_kg, target_weight_kg: profile?.target_weight_kg },
      };
      const res = await base44.functions.invoke('geminiService', { action: 'generateProgressReport', logs, period: 'weekly' });
      if (res.data?.error) throw new Error(res.data.error);
      setAiReport(res.data);
    } catch (e) {
      toast({ title: 'Report failed', description: e.message, variant: 'destructive' });
    }
    setLoadingReport(false);
  };

  const handleAddWeight = async () => {
    if (!newWeight || isNaN(newWeight)) return;
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.WeightLog.create({
      user_id: user.id,
      date: getToday(),
      weight_kg: parseFloat(newWeight),
    });
    toast({ title: 'Weight logged!', description: `${newWeight}kg recorded for today` });
    setShowAddWeight(false);
    setNewWeight('');
    setSaving(false);
    loadData();
  };

  if (loading) return <LoadingScreen />;

  const currentWeight = weightLogs[0]?.weight_kg || profile?.weight_kg;
  const startWeight = weightLogs[weightLogs.length - 1]?.weight_kg || profile?.weight_kg;
  const targetWeight = profile?.target_weight_kg;
  const weightChange = currentWeight && startWeight ? (currentWeight - startWeight).toFixed(1) : 0;
  const isLosing = weightChange < 0;
  const bmi = currentWeight && profile?.height_cm ? calculateBMI(currentWeight, profile.height_cm) : null;
  const bmiCat = bmi ? getBMICategory(bmi) : null;
  const completedWorkouts = workoutLogs.filter(w => w.completed).length;

  const weightChartData = [...weightLogs].reverse().slice(-14).map(l => ({
    date: new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    weight: l.weight_kg,
  }));

  const progressToTarget = targetWeight && startWeight && currentWeight
    ? Math.max(0, Math.min(100, Math.round(
        (Math.abs(startWeight - currentWeight) / Math.abs(startWeight - targetWeight)) * 100
      )))
    : 0;

  return (
    <>
      <TopBar title="Progress" showBack />
      <div className="px-4 py-4 pb-6 space-y-5">

        {/* Key Stats Hero */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-card border border-border rounded-2xl p-4 text-center col-span-1">
            <Scale size={16} className="text-accent mx-auto mb-1.5" />
            <p className="text-xl font-bold font-heading">{currentWeight || '—'}</p>
            <p className="text-[10px] text-muted-foreground">kg now</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <div className={`flex items-center justify-center gap-0.5 mb-1 ${isLosing ? 'text-green-400' : 'text-red-400'}`}>
              {isLosing ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            </div>
            <p className={`text-xl font-bold font-heading ${isLosing ? 'text-green-400' : weightChange > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {weightChange > 0 ? '+' : ''}{weightChange}
            </p>
            <p className="text-[10px] text-muted-foreground">kg change</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <Target size={16} className="text-accent mx-auto mb-1.5" />
            <p className="text-xl font-bold font-heading">{targetWeight || '—'}</p>
            <p className="text-[10px] text-muted-foreground">kg target</p>
          </div>
        </div>

        {/* Progress to Goal */}
        {targetWeight && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-heading font-semibold text-sm">Progress to Goal</p>
              <span className="text-xs font-bold text-accent">{progressToTarget}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-700" style={{ width: `${progressToTarget}%` }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">Start: {startWeight}kg</span>
              <span className="text-[10px] text-muted-foreground">Target: {targetWeight}kg</span>
            </div>
          </div>
        )}

        {/* BMI + Workouts row */}
        <div className="grid grid-cols-2 gap-2.5">
          {bmi && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">BMI</p>
              <p className="text-2xl font-bold font-heading">{bmi}</p>
              <p className={`text-xs font-medium mt-0.5 ${bmiCat?.color}`}>{bmiCat?.label}</p>
            </div>
          )}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Workouts</p>
            <p className="text-2xl font-bold font-heading">{completedWorkouts}</p>
            <p className="text-xs text-muted-foreground mt-0.5">last 30 days</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab: Weight */}
        {activeTab === 'Weight' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm">Weight Trend</h3>
              <Button onClick={() => setShowAddWeight(v => !v)} size="sm" className="h-8 rounded-xl bg-accent text-accent-foreground text-xs px-3 gap-1">
                <Plus size={12} /> Log Weight
              </Button>
            </div>

            {showAddWeight && (
              <div className="bg-card border border-border rounded-2xl p-4 flex gap-2">
                <input
                  type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)}
                  placeholder="e.g. 75.5" step="0.1"
                  className="flex-1 h-10 px-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <Button onClick={handleAddWeight} disabled={saving} className="h-10 rounded-xl bg-accent text-accent-foreground px-4">Save</Button>
              </div>
            )}

            {weightChartData.length > 1 ? (
              <div className="bg-card border border-border rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={weightChartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="weight" stroke="hsl(var(--accent))" fill="url(#wGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={Scale} title="Not enough data yet" description="Log your weight for at least 2 days to see a chart." compact />
            )}

            {/* Weight history */}
            {weightLogs.slice(0, 7).map(log => (
              <div key={log.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  {log.body_fat_pct && <p className="text-xs text-muted-foreground">Body fat: {log.body_fat_pct}%</p>}
                </div>
                <p className="text-base font-bold font-heading">{log.weight_kg} kg</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Body */}
        {activeTab === 'Body' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm">Body Measurements</h3>
              <button onClick={() => window.location.href = '/tracking/measurements'} className="text-xs text-accent font-medium">+ Add</button>
            </div>
            {measurements.length === 0 ? (
              <EmptyState icon={Ruler} title="No measurements yet" description="Track your body measurements to see how your physique is changing." actionLabel="Add Measurements" onAction={() => window.location.href = '/tracking/measurements'} compact />
            ) : (
              measurements.slice(0, 3).map(m => (
                <div key={m.id} className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground mb-3">{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Chest', value: m.chest_cm },
                      { label: 'Waist', value: m.waist_cm },
                      { label: 'Hips', value: m.hips_cm },
                      { label: 'Arms', value: m.arms_cm },
                      { label: 'Thighs', value: m.thighs_cm },
                      { label: 'Shoulders', value: m.shoulders_cm },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} className="text-center">
                        <p className="text-sm font-bold">{f.value}</p>
                        <p className="text-[10px] text-muted-foreground">{f.label} cm</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Photos */}
        {activeTab === 'Photos' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm">Transformation Photos</h3>
              <span className="text-xs text-muted-foreground">{photos.length} photos</span>
            </div>
            {photos.length === 0 ? (
              <EmptyState icon={Camera} title="No transformation photos" description="Document your journey with progress photos. They're the best way to see your transformation!" compact />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map(p => (
                  <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-muted border border-border">
                    {p.photo_url && <img src={p.photo_url} alt="Progress" className="w-full h-full object-cover" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: AI Report */}
        {activeTab === 'AI Report' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm">AI Progress Report</h3>
              <Button
                onClick={handleGenerateReport}
                disabled={loadingReport}
                size="sm"
                className="h-8 rounded-xl bg-accent text-accent-foreground text-xs px-3 gap-1.5"
              >
                {loadingReport ? <><RefreshCw size={11} className="animate-spin" /> Analyzing…</> : <><Bot size={11} /> Generate</>}
              </Button>
            </div>

            {!aiReport && !loadingReport && (
              <div className="bg-card border border-border rounded-3xl p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                  <Bot size={24} className="text-accent" />
                </div>
                <p className="font-heading font-semibold">AI will analyze your last 7–30 days</p>
                <p className="text-xs text-muted-foreground">Workouts, nutrition, sleep, steps, and weight trends — all in one smart report.</p>
                <Button onClick={handleGenerateReport} className="h-10 rounded-xl bg-accent text-accent-foreground text-sm px-6">Generate Report</Button>
              </div>
            )}

            {loadingReport && (
              <div className="bg-card border border-border rounded-3xl p-8 text-center">
                <RefreshCw size={28} className="animate-spin text-accent mx-auto mb-3" />
                <p className="text-sm font-medium">Analyzing your progress…</p>
                <p className="text-xs text-muted-foreground mt-1">This takes a few seconds</p>
              </div>
            )}

            {aiReport && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-3xl p-4">
                  <p className="text-[10px] text-accent uppercase tracking-wider font-bold mb-1.5">Summary</p>
                  <p className="text-sm leading-relaxed">{aiReport.summary}</p>
                </div>

                {/* Top Wins */}
                {aiReport.topWins?.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-bold text-emerald-400 mb-2">🏆 Top Wins</p>
                    <ul className="space-y-1">
                      {aiReport.topWins.map((w, i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-emerald-400">✓</span>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Problems */}
                {aiReport.problems?.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-bold text-orange-400 mb-2">⚠️ Areas to Improve</p>
                    <ul className="space-y-1">
                      {aiReport.problems.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-orange-400">•</span>{p}</li>)}
                    </ul>
                  </div>
                )}

                {/* Next Week Focus */}
                {aiReport.nextWeekFocus?.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-bold text-blue-400 mb-2">🎯 Next Week Focus</p>
                    <ul className="space-y-1">
                      {aiReport.nextWeekFocus.map((f, i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><ChevronRight size={11} className="text-blue-400 mt-0.5 flex-shrink-0" />{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* Analysis sections */}
                {[
                  { label: '🏋️ Workout', key: 'workoutAnalysis' },
                  { label: '🥗 Nutrition', key: 'nutritionAnalysis' },
                  { label: '💧 Water', key: 'waterAnalysis' },
                  { label: '😴 Sleep', key: 'sleepAnalysis' },
                  { label: '⚖️ Weight', key: 'weightAnalysis' },
                ].filter(s => aiReport[s.key]).map(s => (
                  <div key={s.key} className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-bold mb-1.5">{s.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiReport[s.key]}</p>
                  </div>
                ))}

                <Button onClick={handleGenerateReport} variant="outline" size="sm" className="w-full h-9 rounded-xl text-xs gap-1.5">
                  <RefreshCw size={11} /> Regenerate Report
                </Button>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}