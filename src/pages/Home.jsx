import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import StatCard from '@/components/se7enfit/StatCard';
import QuickAction from '@/components/se7enfit/QuickAction';
import { getGreeting, getToday, calculateBMR, calculateTDEE, calculateCalorieTarget, calculateProteinTarget, getActivityLevel, calculateFitnessScore, GOALS_LABELS } from '@/lib/fitnessUtils';
import { Flame, Droplets, Footprints, Moon, Dumbbell, Bot, Camera, Scale, Utensils, Plus, Trophy, TrendingUp, Zap } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState({ calories: 0, protein: 0, water: 0, steps: 0, sleep: 0, workoutDone: false });
  const today = getToday();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
    if (!profiles.length) { navigate('/onboarding'); return; }
    const p = profiles[0];
    setProfile(p);

    const [nutritionLogs, waterLogs, stepLogs, sleepLogs, workoutLogs] = await Promise.all([
      base44.entities.NutritionLog.filter({ user_id: user.id, date: today }),
      base44.entities.WaterLog.filter({ user_id: user.id, date: today }),
      base44.entities.StepLog.filter({ user_id: user.id, date: today }),
      base44.entities.SleepLog.filter({ user_id: user.id, date: today }),
      base44.entities.WorkoutLog.filter({ user_id: user.id, date: today }),
    ]);

    const totalCal = nutritionLogs.reduce((s, n) => s + (n.calories || 0), 0);
    const totalProtein = nutritionLogs.reduce((s, n) => s + (n.protein_g || 0), 0);
    const totalWater = waterLogs.reduce((s, w) => s + (w.amount_ml || 0), 0);
    const totalSteps = stepLogs.reduce((s, st) => s + (st.steps || 0), 0);
    const sleepHrs = sleepLogs.length > 0 ? sleepLogs[0].hours : 0;
    const workoutDone = workoutLogs.some(w => w.completed);

    setTodayData({ calories: totalCal, protein: totalProtein, water: totalWater, steps: totalSteps, sleep: sleepHrs, workoutDone });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const bmr = calculateBMR(profile.weight_kg, profile.height_cm, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, getActivityLevel(profile.workout_days_per_week));
  const calorieTarget = calculateCalorieTarget(tdee, profile.goal);
  const proteinTarget = calculateProteinTarget(profile.weight_kg, profile.goal);
  const waterGoal = profile.daily_water_goal_ml || 2500;
  const stepGoal = profile.daily_step_goal || 8000;

  const fitnessScore = calculateFitnessScore({
    workoutDone: todayData.workoutDone,
    stepsPercent: (todayData.steps / stepGoal) * 100,
    waterPercent: (todayData.water / waterGoal) * 100,
    caloriesOnTrack: todayData.calories > 0 && todayData.calories <= calorieTarget * 1.1,
    sleepHours: todayData.sleep,
    proteinOnTrack: todayData.protein >= proteinTarget * 0.8,
  });

  return (
    <>
      <TopBar />
      <div className="px-4 py-4 space-y-5">
        {/* Greeting */}
        <div>
          <p className="text-muted-foreground text-sm">{getGreeting()} 👋</p>
          <h1 className="text-2xl font-heading font-bold mt-0.5">{profile.full_name || 'Champ'}</h1>
          <p className="text-xs text-accent mt-1 font-medium">{GOALS_LABELS[profile.goal] || 'Fitness'} • Day {profile.streak_days || 1}</p>
        </div>

        {/* Fitness Score */}
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-5">
          <ProgressRing percent={fitnessScore} size={90} strokeWidth={7}>
            <div className="text-center">
              <p className="text-xl font-bold font-heading">{fitnessScore}</p>
              <p className="text-[9px] text-muted-foreground">SCORE</p>
            </div>
          </ProgressRing>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-sm">Today's Fitness Score</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {fitnessScore >= 80 ? 'Outstanding! Keep it up! 🔥' :
               fitnessScore >= 50 ? 'Good progress! Push harder! 💪' :
               'Let\'s get moving today! 🚀'}
            </p>
            <div className="flex gap-2 mt-3">
              {todayData.workoutDone && <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">✓ Workout</span>}
              {todayData.steps >= stepGoal && <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">✓ Steps</span>}
              {todayData.water >= waterGoal && <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">✓ Hydrated</span>}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Flame size={18} />} label="Calories" value={`${todayData.calories}/${calorieTarget}`} subtitle={`${Math.round((todayData.calories / calorieTarget) * 100)}% of target`} onClick={() => navigate('/nutrition')} />
          <StatCard icon={<Zap size={18} />} label="Protein" value={`${todayData.protein}g`} subtitle={`Target: ${proteinTarget}g`} onClick={() => navigate('/nutrition')} />
          <StatCard icon={<Droplets size={18} />} label="Water" value={`${Math.round(todayData.water / 250)} glasses`} subtitle={`${todayData.water}/${waterGoal}ml`} onClick={() => navigate('/tracking/water')} />
          <StatCard icon={<Footprints size={18} />} label="Steps" value={todayData.steps.toLocaleString()} subtitle={`Goal: ${stepGoal.toLocaleString()}`} onClick={() => navigate('/tracking/steps')} />
          <StatCard icon={<Moon size={18} />} label="Sleep" value={`${todayData.sleep}h`} subtitle={`Goal: ${profile.sleep_goal_hours || 7}h`} onClick={() => navigate('/tracking/sleep')} />
          <StatCard icon={<Dumbbell size={18} />} label="Workout" value={todayData.workoutDone ? 'Done ✓' : 'Pending'} subtitle={todayData.workoutDone ? 'Great job!' : 'Tap to start'} onClick={() => navigate('/workout')} />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="font-heading font-semibold text-sm mb-3">Quick Actions</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            <QuickAction icon={<Dumbbell size={18} />} label="Log Workout" onClick={() => navigate('/workout/log')} />
            <QuickAction icon={<Utensils size={18} />} label="Log Meal" onClick={() => navigate('/nutrition/log')} />
            <QuickAction icon={<Droplets size={18} />} label="Add Water" onClick={() => navigate('/tracking/water')} />
            <QuickAction icon={<Scale size={18} />} label="Log Weight" onClick={() => navigate('/tracking/weight')} />
            <QuickAction icon={<Bot size={18} />} label="Ask AI" onClick={() => navigate('/ai-trainer')} />
            <QuickAction icon={<Camera size={18} />} label="Progress Photo" onClick={() => navigate('/progress')} />
          </div>
        </div>

        {/* Today's Workout Card */}
        <Link to="/workout" className="block">
          <div className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading font-semibold text-sm">Today's Workout</h3>
              <span className="text-xs text-accent">View →</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {todayData.workoutDone ? 'Completed! Great effort today 💪' : 'You haven\'t worked out yet. Time to crush it! 🔥'}
            </p>
          </div>
        </Link>

        {/* AI Recommendation */}
        <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={16} className="text-accent" />
            <h3 className="font-heading font-semibold text-sm">AI Recommendation</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {profile.goal === 'weight_loss'
              ? 'Focus on maintaining a calorie deficit today. Aim for high-protein meals and at least 30 min of cardio.'
              : profile.goal === 'muscle_gain'
              ? 'Hit your protein target today — aim for 2g per kg bodyweight. Don\'t skip your compound lifts!'
              : 'Stay consistent with your routine. Every workout counts towards your goal. You\'ve got this!'}
          </p>
          <Link to="/ai-trainer" className="inline-flex items-center gap-1 text-xs text-accent font-medium mt-2">
            Chat with AI Trainer <Bot size={12} />
          </Link>
        </div>

        {/* Streak & Progress */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-accent" />
              <span className="text-xs text-muted-foreground">Streak</span>
            </div>
            <p className="text-2xl font-bold font-heading">{profile.streak_days || 0} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          </div>
          <Link to="/progress" className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-accent" />
              <span className="text-xs text-muted-foreground">Progress</span>
            </div>
            <p className="text-2xl font-bold font-heading">{profile.weight_kg}<span className="text-sm font-normal text-muted-foreground">kg</span></p>
            <p className="text-[10px] text-accent">Target: {profile.target_weight_kg}kg</p>
          </Link>
        </div>

        {/* More Sections */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/community" className="bg-card border border-border rounded-2xl p-3 text-center hover:border-accent/30 transition-all">
            <span className="text-lg">👥</span>
            <p className="text-[10px] font-medium mt-1">Community</p>
          </Link>
          <Link to="/gym" className="bg-card border border-border rounded-2xl p-3 text-center hover:border-accent/30 transition-all">
            <span className="text-lg">🏋️</span>
            <p className="text-[10px] font-medium mt-1">Gyms</p>
          </Link>
          <Link to="/subscription" className="bg-card border border-border rounded-2xl p-3 text-center hover:border-accent/30 transition-all">
            <span className="text-lg">⭐</span>
            <p className="text-[10px] font-medium mt-1">Premium</p>
          </Link>
        </div>
      </div>
    </>
  );
}