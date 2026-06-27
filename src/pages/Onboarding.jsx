import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { title: 'About You', subtitle: 'Let\'s personalize your fitness journey' },
  { title: 'Your Body', subtitle: 'We need this to calculate your targets' },
  { title: 'Your Goal', subtitle: 'What do you want to achieve?' },
  { title: 'Your Routine', subtitle: 'Tell us about your workout habits' },
  { title: 'Diet & Health', subtitle: 'Almost there!' },
  { title: 'Your Targets', subtitle: 'Set your daily goals' },
];

const GOALS = [
  { key: 'weight_loss', label: 'Weight Loss', emoji: '🔥' },
  { key: 'muscle_gain', label: 'Muscle Gain', emoji: '💪' },
  { key: 'fat_loss', label: 'Fat Loss', emoji: '⚡' },
  { key: 'strength_gain', label: 'Strength Gain', emoji: '🏋️' },
  { key: 'general_fitness', label: 'General Fitness', emoji: '🏃' },
  { key: 'body_transformation', label: 'Body Transformation', emoji: '🔄' },
  { key: 'maintenance', label: 'Maintenance', emoji: '✅' },
];

const FITNESS_LEVELS = [
  { key: 'beginner', label: 'Beginner', desc: 'New to fitness' },
  { key: 'intermediate', label: 'Intermediate', desc: '6+ months experience' },
  { key: 'advanced', label: 'Advanced', desc: '2+ years experience' },
];

const DIETS = [
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥗' },
  { key: 'non_vegetarian', label: 'Non-Vegetarian', emoji: '🍗' },
  { key: 'eggetarian', label: 'Eggetarian', emoji: '🥚' },
  { key: 'vegan', label: 'Vegan', emoji: '🌱' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    full_name: '', age: '', gender: 'male',
    height_cm: '', weight_kg: '', target_weight_kg: '',
    goal: '', fitness_level: 'beginner',
    gym_access: true, workout_days_per_week: 4,
    preferred_workout_time: 'morning',
    diet_preference: 'non_vegetarian',
    medical_notes: '',
    transformation_duration_weeks: 12,
    daily_step_goal: 8000, daily_water_goal_ml: 2500,
    sleep_goal_hours: 7, motivation_level: 'high'
  });

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const handleFinish = async () => {
    setSaving(true);
    const user = await base44.auth.me();
    const code = 'SE7' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const pendingGymId = localStorage.getItem('pending_gym_id');
    const pendingGymCode = localStorage.getItem('pending_gym_code');
    await base44.entities.UserProfile.create({
      ...data,
      user_id: user.id,
      age: Number(data.age),
      height_cm: Number(data.height_cm),
      weight_kg: Number(data.weight_kg),
      target_weight_kg: Number(data.target_weight_kg),
      daily_step_goal: Number(data.daily_step_goal),
      daily_water_goal_ml: Number(data.daily_water_goal_ml),
      sleep_goal_hours: Number(data.sleep_goal_hours),
      workout_days_per_week: Number(data.workout_days_per_week),
      transformation_duration_weeks: Number(data.transformation_duration_weeks),
      onboarding_complete: true,
      referral_code: code,
      primary_gym_id: pendingGymId || undefined,
      gym_referral_code_used: pendingGymCode || undefined,
      gym_access: pendingGymId ? true : data.gym_access,
      role: 'user'
    });
    if (pendingGymId) {
      localStorage.removeItem('pending_gym_id');
      localStorage.removeItem('pending_gym_code');
    }
    navigate('/');
  };

  const OptionButton = ({ selected, onClick, children, className = '' }) => (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] ${
        selected ? 'border-accent bg-accent/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-accent/30'
      } ${className}`}
    >
      {children}
    </button>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Full Name</Label>
              <Input placeholder="Enter your name" value={data.full_name} onChange={e => update('full_name', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Age</Label>
              <Input type="number" placeholder="25" value={data.age} onChange={e => update('age', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-3 block">Gender</Label>
              <div className="grid grid-cols-3 gap-3">
                {['male', 'female', 'other'].map(g => (
                  <OptionButton key={g} selected={data.gender === g} onClick={() => update('gender', g)}>
                    <span className="text-sm font-medium capitalize">{g}</span>
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Height (cm)</Label>
              <Input type="number" placeholder="170" value={data.height_cm} onChange={e => update('height_cm', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Current Weight (kg)</Label>
              <Input type="number" placeholder="70" value={data.weight_kg} onChange={e => update('weight_kg', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Target Weight (kg)</Label>
              <Input type="number" placeholder="65" value={data.target_weight_kg} onChange={e => update('target_weight_kg', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            {GOALS.map(g => (
              <OptionButton key={g.key} selected={data.goal === g.key} onClick={() => update('goal', g.key)}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{g.emoji}</span>
                  <span className="font-medium text-sm">{g.label}</span>
                </div>
              </OptionButton>
            ))}
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-3 block">Fitness Level</Label>
              <div className="space-y-3">
                {FITNESS_LEVELS.map(l => (
                  <OptionButton key={l.key} selected={data.fitness_level === l.key} onClick={() => update('fitness_level', l.key)}>
                    <div>
                      <p className="font-medium text-sm">{l.label}</p>
                      <p className="text-xs text-muted-foreground">{l.desc}</p>
                    </div>
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm mb-3 block">Gym Access?</Label>
              <div className="grid grid-cols-2 gap-3">
                <OptionButton selected={data.gym_access} onClick={() => update('gym_access', true)}>
                  <span className="text-sm font-medium">🏋️ Yes, I go to gym</span>
                </OptionButton>
                <OptionButton selected={!data.gym_access} onClick={() => update('gym_access', false)}>
                  <span className="text-sm font-medium">🏠 Home workout</span>
                </OptionButton>
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Workout Days/Week: {data.workout_days_per_week}</Label>
              <input type="range" min="1" max="7" value={data.workout_days_per_week} onChange={e => update('workout_days_per_week', Number(e.target.value))} className="w-full accent-[hsl(142,76%,46%)]" />
            </div>
            <div>
              <Label className="text-sm mb-3 block">Preferred Time</Label>
              <div className="grid grid-cols-2 gap-3">
                {['morning', 'afternoon', 'evening', 'night'].map(t => (
                  <OptionButton key={t} selected={data.preferred_workout_time === t} onClick={() => update('preferred_workout_time', t)}>
                    <span className="text-sm font-medium capitalize">{t}</span>
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-3 block">Dietary Preference</Label>
              <div className="space-y-3">
                {DIETS.map(d => (
                  <OptionButton key={d.key} selected={data.diet_preference === d.key} onClick={() => update('diet_preference', d.key)}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{d.emoji}</span>
                      <span className="font-medium text-sm">{d.label}</span>
                    </div>
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Medical/Injury Notes (optional)</Label>
              <Input placeholder="e.g., knee pain, back issue" value={data.medical_notes} onChange={e => update('medical_notes', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Daily Step Goal</Label>
              <Input type="number" value={data.daily_step_goal} onChange={e => update('daily_step_goal', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Daily Water Goal (ml)</Label>
              <Input type="number" value={data.daily_water_goal_ml} onChange={e => update('daily_water_goal_ml', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Sleep Goal (hours)</Label>
              <Input type="number" value={data.sleep_goal_hours} onChange={e => update('sleep_goal_hours', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Transformation Duration (weeks)</Label>
              <Input type="number" value={data.transformation_duration_weeks} onChange={e => update('transformation_duration_weeks', e.target.value)} className="h-12 rounded-xl bg-card border-border" />
            </div>
            <div>
              <Label className="text-sm mb-3 block">Motivation Level</Label>
              <div className="grid grid-cols-2 gap-3">
                {['low', 'medium', 'high', 'very_high'].map(m => (
                  <OptionButton key={m} selected={data.motivation_level === m} onClick={() => update('motivation_level', m)}>
                    <span className="text-sm font-medium capitalize">{m.replace('_', ' ')}</span>
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display font-bold text-lg">SE<span className="text-accent">7</span>ENFIT</div>
            <span className="text-xs text-muted-foreground">{step + 1} of {STEPS.length}</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>

        {/* Step Title */}
        <div className="mb-6">
          <h2 className="text-xl font-heading font-bold">{STEPS[step].title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{STEPS[step].subtitle}</p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8 pb-8">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 h-12 rounded-xl border-border">
              <ChevronLeft size={16} className="mr-1" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} className="flex-1 h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
              Continue <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={saving} className="flex-1 h-12 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
              {saving ? 'Setting up...' : 'Start My Journey 🚀'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
