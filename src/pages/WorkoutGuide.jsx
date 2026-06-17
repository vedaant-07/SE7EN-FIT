import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Play, Pause, ChevronRight, ChevronLeft, Check, Zap, Target, Clock, RotateCcw, AlertCircle, Dumbbell, Crown } from 'lucide-react';

const EXERCISES_DB = {
  pushup: {
    name: 'Push-Up', emoji: '💪', muscle: 'Chest', secondary: ['Triceps', 'Shoulders'], equipment: 'None',
    difficulty: 'Beginner', sets: 3, reps: '12-15', rest: '60s',
    instructions: [
      'Start in a high plank position with hands slightly wider than shoulders.',
      'Keep your body in a straight line from head to heels.',
      'Lower your chest to the floor by bending your elbows.',
      'Push back up to the starting position.',
      'Keep core engaged throughout the movement.',
    ],
    breathing: 'Inhale as you lower, exhale as you push up.',
    mistakes: ['Sagging hips', 'Flaring elbows too wide', 'Not going through full range'],
    tips: ['Keep head neutral, gaze at the floor', 'Squeeze chest at the top'],
    animation: 'pushup',
  },
  squat: {
    name: 'Squat', emoji: '🏋️', muscle: 'Quads', secondary: ['Glutes', 'Hamstrings', 'Core'], equipment: 'None',
    difficulty: 'Beginner', sets: 3, reps: '15-20', rest: '60s',
    instructions: [
      'Stand with feet shoulder-width apart, toes slightly turned out.',
      'Push your hips back and bend your knees.',
      'Lower until thighs are parallel to the floor.',
      'Drive through your heels to stand back up.',
      'Keep chest up and knees tracking over toes.',
    ],
    breathing: 'Inhale on the way down, exhale driving up.',
    mistakes: ['Knees caving in', 'Heels rising off floor', 'Rounding lower back'],
    tips: ['Push knees out in line with toes', 'Keep torso as upright as possible'],
    animation: 'squat',
  },
  plank: {
    name: 'Plank', emoji: '🪨', muscle: 'Core', secondary: ['Shoulders', 'Glutes'], equipment: 'None',
    difficulty: 'Beginner', sets: 3, reps: '30-60s', rest: '45s',
    instructions: [
      'Start in a forearm plank position.',
      'Keep elbows directly under shoulders.',
      'Body forms a straight line from head to heels.',
      'Engage core and glutes — do not let hips sag.',
      'Hold for the prescribed time.',
    ],
    breathing: 'Breathe steadily and controlled throughout.',
    mistakes: ['Hips too high or too low', 'Holding breath', 'Looking up'],
    tips: ['Imagine pulling your elbows toward your feet', 'Squeeze every muscle'],
    animation: 'plank',
  },
  deadlift: {
    name: 'Deadlift', emoji: '⚡', muscle: 'Back', secondary: ['Hamstrings', 'Glutes', 'Core'], equipment: 'Barbell',
    difficulty: 'Advanced', sets: 4, reps: '5-8', rest: '120s',
    instructions: [
      'Stand with feet hip-width apart, barbell over mid-foot.',
      'Hinge at hips, push them back and grab the bar.',
      'Brace your core and lats, lift the chest.',
      'Drive through the floor, keeping bar close to legs.',
      'Lock out hips at the top — do not hyperextend.',
    ],
    breathing: 'Deep breath before lift, exhale at top.',
    mistakes: ['Rounding lower back', 'Bar drifting away', 'Jerking the bar'],
    tips: ['Engage lats to protect spine', 'Push the floor away, don\'t pull the bar'],
    animation: 'deadlift',
  },
  benchpress: {
    name: 'Bench Press', emoji: '🏋️', muscle: 'Chest', secondary: ['Triceps', 'Shoulders'], equipment: 'Barbell + Bench',
    difficulty: 'Intermediate', sets: 4, reps: '8-12', rest: '90s',
    instructions: [
      'Lie flat on the bench, eyes under the bar.',
      'Grip bar slightly wider than shoulder-width.',
      'Unrack and lower bar to mid-chest.',
      'Press the bar back up to lockout.',
      'Keep shoulder blades retracted throughout.',
    ],
    breathing: 'Inhale as bar comes down, exhale pressing up.',
    mistakes: ['Bouncing bar off chest', 'Elbows flaring', 'Feet leaving the floor'],
    tips: ['Arch your upper back slightly', 'Think about bending the bar'],
    animation: 'benchpress',
  },
};

const DEFAULT_EXERCISE = Object.keys(EXERCISES_DB)[0];

// Animated exercise visualization
function ExerciseAnimation({ name, isPlaying }) {
  const animations = {
    pushup: { up: 'translateY(0px) rotate(-2deg)', down: 'translateY(8px) rotate(2deg)', label: '⬇️ ➡️ ⬆️' },
    squat: { up: 'translateY(0px) scaleY(1)', down: 'translateY(10px) scaleY(0.85)', label: '⬇️ ➡️ ⬆️' },
    plank: { up: 'translateX(0px)', down: 'translateX(3px)', label: 'HOLD POSITION' },
    deadlift: { up: 'translateY(0px)', down: 'translateY(12px)', label: '⬇️ ➡️ ⬆️' },
    benchpress: { up: 'translateY(-4px)', down: 'translateY(4px)', label: '⬇️ ➡️ ⬆️' },
  };

  const anim = animations[name] || animations.pushup;

  return (
    <div className="relative w-full h-44 bg-gradient-to-b from-card to-muted/40 rounded-3xl overflow-hidden flex items-center justify-center border border-border">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute w-full border-t border-foreground" style={{ top: `${i * 12.5}%` }} />
        ))}
      </div>

      {/* Stick figure animation */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div
          className="transition-all duration-700 ease-in-out"
          style={{
            transform: isPlaying ? anim.down : anim.up,
            animation: isPlaying ? 'none' : 'none',
          }}
        >
          {/* Simple stick figure */}
          <svg width="100" height="120" viewBox="0 0 100 120" className="text-accent">
            {/* Head */}
            <circle cx="50" cy="15" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {/* Body */}
            <line x1="50" y1="25" x2="50" y2="65" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            {/* Arms */}
            <line x1="50" y1="35" x2="25" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="50" y1="35" x2="75" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            {/* Legs */}
            <line x1="50" y1="65" x2="30" y2="100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="50" y1="65" x2="70" y2="100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className={`text-xs font-bold tracking-wider transition-all ${isPlaying ? 'text-accent animate-pulse' : 'text-muted-foreground'}`}>
          {isPlaying ? anim.label : '⏸ PAUSED'}
        </div>
      </div>

      {isPlaying && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkoutGuide() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const exerciseKey = searchParams.get('exercise') || DEFAULT_EXERCISE;
  const exercise = EXERCISES_DB[exerciseKey] || EXERCISES_DB[DEFAULT_EXERCISE];

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
  const [stage, setStage] = useState('guide'); // guide | workout | done
  const [coins] = useState(50);

  const handleCompleteSet = () => {
    if (completedSets < exercise.sets) {
      setCompletedSets(prev => prev + 1);
    }
    if (completedSets + 1 >= exercise.sets) {
      setStage('done');
    }
  };

  return (
    <>
      <TopBar title={exercise.name} showBack />
      <div className="px-4 py-4 pb-24 space-y-4 max-w-lg mx-auto">

        {stage === 'guide' && (
          <>
            {/* Animation */}
            <ExerciseAnimation name={exercise.animation} isPlaying={isPlaying} />

            {/* Play/Pause controls */}
            <div className="flex justify-center gap-4">
              <button onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/25 active:scale-95 transition-all">
                {isPlaying ? <Pause size={22} className="text-accent-foreground" /> : <Play size={22} className="text-accent-foreground ml-1" />}
              </button>
            </div>

            {/* Exercise info */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Sets', value: exercise.sets, icon: RotateCcw },
                { label: 'Reps', value: exercise.reps, icon: Zap },
                { label: 'Rest', value: exercise.rest, icon: Clock },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="bg-card border border-border rounded-2xl p-3 text-center">
                    <Icon size={14} className="text-accent mx-auto mb-1" />
                    <p className="font-bold text-sm">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Target muscles */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Target Muscles</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-accent/15 text-accent px-2.5 py-1 rounded-full font-medium">{exercise.muscle} (Primary)</span>
                {exercise.secondary.map(m => (
                  <span key={m} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">{m}</span>
                ))}
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="font-heading font-semibold text-sm">Step-by-Step Guide</p>
              {exercise.instructions.map((step, i) => (
                <button key={i} onClick={() => setCurrentStep(i)}
                  className={`w-full flex items-start gap-3 text-left p-2 rounded-xl transition-all ${currentStep === i ? 'bg-accent/10' : ''}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5 ${currentStep === i ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                  <p className={`text-xs leading-relaxed ${currentStep === i ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{step}</p>
                </button>
              ))}
            </div>

            {/* Breathing */}
            <div className="bg-blue-400/10 border border-blue-400/20 rounded-2xl p-3 flex items-start gap-2">
              <span className="text-lg">🫁</span>
              <div>
                <p className="font-semibold text-xs text-blue-400 mb-0.5">Breathing Tip</p>
                <p className="text-xs text-muted-foreground">{exercise.breathing}</p>
              </div>
            </div>

            {/* Common mistakes */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="font-heading font-semibold text-sm mb-2 flex items-center gap-2"><AlertCircle size={14} className="text-orange-400" /> Common Mistakes</p>
              {exercise.mistakes.map((m, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{m}</p>
                </div>
              ))}
            </div>

            {/* Pro tips */}
            <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4">
              <p className="font-heading font-semibold text-sm mb-2 flex items-center gap-2"><Target size={14} className="text-accent" /> Pro Tips</p>
              {exercise.tips.map((t, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{t}</p>
                </div>
              ))}
            </div>

            <Button onClick={() => setStage('workout')} className="w-full h-12 rounded-xl bg-accent text-accent-foreground font-semibold">
              <Play size={16} /> Start Exercise
            </Button>
          </>
        )}

        {stage === 'workout' && (
          <>
            <ExerciseAnimation name={exercise.animation} isPlaying={true} />

            <div className="bg-card border border-border rounded-2xl p-5 text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Sets Completed</p>
              <div className="flex items-center justify-center gap-2 my-3">
                {[...Array(exercise.sets)].map((_, i) => (
                  <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${i < completedSets ? 'bg-accent text-accent-foreground shadow-md shadow-accent/25' : 'bg-muted text-muted-foreground'}`}>
                    {i < completedSets ? <Check size={16} /> : i + 1}
                  </div>
                ))}
              </div>
              <p className="text-2xl font-heading font-bold">{completedSets} / {exercise.sets}</p>
              <p className="text-sm text-muted-foreground mt-1">Target: {exercise.reps} reps per set</p>
            </div>

            <Button onClick={handleCompleteSet} disabled={completedSets >= exercise.sets}
              className="w-full h-14 rounded-2xl bg-accent text-accent-foreground font-bold text-base shadow-lg shadow-accent/25">
              <Check size={20} /> Complete Set {completedSets + 1}
            </Button>

            <Button variant="outline" onClick={() => setStage('guide')} className="w-full h-11 rounded-xl">
              <ChevronLeft size={16} /> Back to Guide
            </Button>
          </>
        )}

        {stage === 'done' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
            <div className="text-7xl animate-bounce">{exercise.emoji}</div>
            <div>
              <h2 className="font-heading font-black text-3xl">Exercise Done! 🎉</h2>
              <p className="text-muted-foreground mt-1">{exercise.name} — {exercise.sets} sets completed</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-400/20 to-yellow-400/5 border border-yellow-400/30 rounded-2xl p-4 w-full">
              <p className="text-4xl mb-1">🪙</p>
              <p className="font-heading font-bold text-2xl text-yellow-400">+{coins} coins</p>
              <p className="text-xs text-muted-foreground">Reward for completing exercise</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={() => navigate('/workout')} className="flex-1 h-12 rounded-xl">Back to Workout</Button>
              <Button onClick={() => { setStage('guide'); setCompletedSets(0); setIsPlaying(false); }} className="flex-1 h-12 rounded-xl bg-accent text-accent-foreground">
                <RotateCcw size={16} /> Do Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}