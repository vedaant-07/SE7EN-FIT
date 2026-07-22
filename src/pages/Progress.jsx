import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import EmptyState from '@/components/se7enfit/EmptyState';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, TrendingUp, Scale, Camera, Ruler, Plus, Target, Bot, RefreshCw, ChevronRight, BarChart2, Calendar, Dumbbell, Flame, Footprints, Moon, Droplets } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getToday, calculateBMI, getBMICategory } from '@/lib/fitnessUtils';

const TABS = ['Weight', 'Body', 'Photos', 'Reports', 'AI Report'];

export default function Progress() {
  const navigate = useNavigate();
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
  const [summaryReports, setSummaryReports] = useState([]);
  const [summaryPeriod, setSummaryPeriod] = useState('weekly');

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
    // Load summary reports
    const reports = await base44.entities.WeeklySummaryReport.filter({ user_id: user.id }, '-week_start', 20);
    setSummaryReports(reports);
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
              <button onClick={() => navigate('/tracking?metric=measurements')} className="text-xs text-accent font-medium">+ Add</button>
            </div>
            {measurements.length === 0 ? (
              <EmptyState icon={Ruler} title="No measurements yet" description="Track your body measurements to see how your physique is changing." actionLabel="Add Measurements" onAction={() => navigate('/tracking?metric=measurements')} compact />
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

        {/* Tab: Reports */}
        {activeTab === 'Reports' && (
          <div className="space-y-4">
            {/* Period toggle */}
            <div className="flex gap-2">
              {['weekly', 'monthly'].map(p => (
                <button key={p} onClick={() => setSummaryPeriod(p)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    summaryPeriod === p ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'
                  }`}>
                  {p === 'weekly' ? '📅 Weekly' : '🗓️ Monthly'}
                </button>
              ))}
            </div>

            {summaryReports.filter(r => r.period === summaryPeriod).length === 0 ? (
              <div className="bg-card border border-border rounded-3xl p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                  <BarChart2 size={24} className="text-accent" />
                </div>
                <p className="font-heading font-semibold">No {summaryPeriod} reports yet</p>
                <p className="text-xs text-muted-foreground">
                  {summaryPeriod === 'weekly'
                    ? 'Weekly reports are auto-generated every Sunday night. Keep logging your data!'
                    : 'Monthly reports are auto-generated on the 1st of each month. Keep logging daily!'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {summaryReports.filter(r => r.period === summaryPeriod).map(report => {
                  const start = new Date(report.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  const end = new Date(report.week_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const wChange = report.weight_change_kg;
                  return (
                    <div key={report.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                      {/* Header */}
                      <div className="bg-accent/10 border-b border-border/50 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-heading font-bold text-sm">{start} – {end}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{report.period} Report</p>
                        </div>
                        {wChange !== null && wChange !== undefined && (
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            wChange < 0 ? 'bg-green-400/15 text-green-400' : wChange > 0 ? 'bg-red-400/15 text-red-400' : 'bg-muted text-muted-foreground'
                          }`}>
                            {wChange < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                            {wChange > 0 ? '+' : ''}{wChange} kg
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Stats grid */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: Dumbbell, label: 'Workouts', value: report.total_workouts || 0, unit: '', color: 'text-accent bg-accent/10' },
                            { icon: Flame, label: 'Avg Cals', value: report.avg_daily_calories || 0, unit: 'kcal', color: 'text-orange-400 bg-orange-400/10' },
                            { icon: Footprints, label: 'Avg Steps', value: report.avg_daily_steps ? Math.round(report.avg_daily_steps).toLocaleString() : 0, unit: '', color: 'text-purple-400 bg-purple-400/10' },
                            { icon: Moon, label: 'Avg Sleep', value: report.avg_sleep_hours || 0, unit: 'h', color: 'text-indigo-400 bg-indigo-400/10' },
                            { icon: Droplets, label: 'Avg Water', value: report.avg_water_ml ? Math.round(report.avg_water_ml / 250) : 0, unit: 'glasses', color: 'text-blue-400 bg-blue-400/10' },
                            { icon: Calendar, label: 'Days Logged', value: report.days_logged || 0, unit: `/${summaryPeriod === 'weekly' ? 7 : 30}`, color: 'text-yellow-400 bg-yellow-400/10' },
                          ].map(s => (
                            <div key={s.label} className={`rounded-xl p-2.5 ${s.color.split(' ')[1]} flex flex-col items-center text-center`}>
                              <s.icon size={13} className={s.color.split(' ')[0]} />
                              <p className={`font-bold text-sm mt-1 ${s.color.split(' ')[0]}`}>{s.value}<span className="text-[9px] font-normal ml-0.5">{s.unit}</span></p>
                              <p className="text-[9px] text-muted-foreground">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* AI Summary */}
                        {report.ai_summary && (
                          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">AI Summary</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{report.ai_summary}</p>
                          </div>
                        )}

                        {/* Wins */}
                        {report.top_wins?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-emerald-400 mb-1.5">🏆 Top Wins</p>
                            <ul className="space-y-1">
                              {report.top_wins.map((w, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-2 items-start">
                                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>{w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Improve */}
                        {report.areas_to_improve?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-orange-400 mb-1.5">⚠️ Improve</p>
                            <ul className="space-y-1">
                              {report.areas_to_improve.map((a, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-2 items-start">
                                  <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>{a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Next focus */}
                        {report.next_focus?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-blue-400 mb-1.5">🎯 Next Focus</p>
                            <ul className="space-y-1">
                              {report.next_focus.map((f, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex gap-2 items-start">
                                  <ChevronRight size={10} className="text-blue-400 mt-0.5 flex-shrink-0" />{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
