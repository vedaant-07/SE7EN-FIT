import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Droplets, Footprints, Moon, Scale, Ruler, Heart, Smile, CheckSquare, Dumbbell, Activity, ChevronRight } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';

const ITEMS = [
  { route: '/tracking/water', icon: Droplets, label: 'Water Intake', desc: 'Daily hydration log', color: 'text-blue-400 bg-blue-400/10', dataKey: 'water' },
  { route: '/tracking/steps', icon: Footprints, label: 'Steps', desc: 'Daily step count', color: 'text-purple-400 bg-purple-400/10', dataKey: 'steps' },
  { route: '/tracking/sleep', icon: Moon, label: 'Sleep', desc: 'Sleep duration & quality', color: 'text-indigo-400 bg-indigo-400/10', dataKey: 'sleep' },
  { route: '/tracking/weight', icon: Scale, label: 'Weight & BMI', desc: 'Body weight tracking', color: 'text-green-400 bg-green-400/10', dataKey: 'weight' },
  { route: '/tracking/measurements', icon: Ruler, label: 'Body Measurements', desc: 'Chest, waist, hips etc.', color: 'text-pink-400 bg-pink-400/10', dataKey: null },
  { route: '/tracking/cardio', icon: Heart, label: 'Cardio', desc: 'Running, cycling, swimming', color: 'text-red-400 bg-red-400/10', dataKey: 'cardio' },
  { route: '/tracking/habits', icon: CheckSquare, label: 'Habits', desc: 'Daily habit streaks', color: 'text-yellow-400 bg-yellow-400/10', dataKey: 'habits' },
  { route: '/tracking/mood', icon: Smile, label: 'Mood & Energy', desc: 'Mental wellness tracking', color: 'text-teal-400 bg-teal-400/10', dataKey: null },
  { route: '/tracking/gym-attendance', icon: Dumbbell, label: 'Gym Attendance', desc: 'Check-in & duration', color: 'text-accent bg-accent/10', dataKey: null },
];

export default function Tracking() {
  const [todaySummary, setTodaySummary] = useState({});
  const [loading, setLoading] = useState(true);
  const today = getToday();

  useEffect(() => { loadSummary(); }, []);

  const loadSummary = async () => {
    const user = await base44.auth.me();
    const [water, steps, sleep, weight, cardio, habits] = await Promise.all([
      base44.entities.WaterLog.filter({ user_id: user.id, date: today }),
      base44.entities.StepLog.filter({ user_id: user.id, date: today }),
      base44.entities.SleepLog.filter({ user_id: user.id, date: today }),
      base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 1),
      base44.entities.CardioLog.filter({ user_id: user.id, date: today }),
      base44.entities.HabitLog.filter({ user_id: user.id, date: today }),
    ]);
    setTodaySummary({
      water: water.reduce((s, w) => s + (w.amount_ml || 0), 0),
      steps: steps.reduce((s, st) => s + (st.steps || 0), 0),
      sleep: sleep[0]?.hours || null,
      weight: weight[0]?.weight_kg || null,
      cardio: cardio.length,
      habits: habits.filter(h => h.completed).length,
    });
    setLoading(false);
  };

  const getSummaryText = (dataKey, summary) => {
    if (!dataKey || summary[dataKey] == null) return null;
    switch (dataKey) {
      case 'water': return `${summary.water}ml today`;
      case 'steps': return `${summary.steps.toLocaleString()} steps`;
      case 'sleep': return `${summary.sleep}h sleep`;
      case 'weight': return `${summary.weight}kg logged`;
      case 'cardio': return summary.cardio > 0 ? `${summary.cardio} session${summary.cardio > 1 ? 's' : ''}` : null;
      case 'habits': return summary.habits > 0 ? `${summary.habits} done` : null;
      default: return null;
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Tracking" showBack />
      <div className="px-4 py-4 pb-6">
        <div className="mb-4">
          <h2 className="font-heading font-bold text-lg">Health Tracking</h2>
          <p className="text-xs text-muted-foreground mt-0.5">All your metrics, logged daily</p>
        </div>

        <div className="space-y-2.5">
          {ITEMS.map(item => {
            const Icon = item.icon;
            const summary = getSummaryText(item.dataKey, todaySummary);
            const hasTodayData = summary !== null;

            return (
              <Link key={item.route} to={item.route}>
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-accent/30 active:scale-[0.99] transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {hasTodayData ? (
                        <span className="text-accent font-medium">{summary}</span>
                      ) : item.desc}
                    </p>
                  </div>
                  {hasTodayData && (
                    <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  )}
                  <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}