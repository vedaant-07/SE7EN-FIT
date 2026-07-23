import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bot,
  Camera,
  Dumbbell,
  Flame,
  Footprints,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  Zap,
} from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';

const FEATURES = [
  {
    title: 'AI Coach',
    detail: 'Ask questions, adapt your plan and get guidance based on your fitness data.',
    route: '/ai-trainer',
    icon: Bot,
    tone: 'bg-accent/12 text-accent',
    tag: 'Personalized',
  },
  {
    title: 'Gym Workouts',
    detail: 'Follow personalized training sessions, exercise guidance and progress logging.',
    route: '/workout',
    icon: Dumbbell,
    tone: 'bg-blue-400/12 text-blue-300',
    tag: 'Train',
  },
  {
    title: 'Food Scan',
    detail: 'Scan a meal, review nutrition estimates and save it to your daily intake.',
    route: '/food-scan',
    icon: Camera,
    tone: 'bg-purple-400/12 text-purple-300',
    tag: 'Camera',
  },
  {
    title: 'Calories & Nutrition',
    detail: 'See calorie and protein targets, log food and understand your daily balance.',
    route: '/nutrition',
    icon: Utensils,
    tone: 'bg-orange-400/12 text-orange-300',
    tag: 'Fuel',
  },
  {
    title: 'Step Tracker',
    detail: 'Track daily steps, movement goals and verified progress toward challenges.',
    route: '/tracking?metric=steps',
    icon: Footprints,
    tone: 'bg-pink-400/12 text-pink-300',
    tag: 'Move',
  },
  {
    title: 'Cardio & Challenges',
    detail: 'Record cardio, join verified challenges and compete in gym member battles.',
    route: '/challenges',
    icon: Trophy,
    tone: 'bg-yellow-400/12 text-yellow-300',
    tag: 'Compete',
  },
];

export default function CoreFeatures() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <>
      <TopBar title="Core Features" showBack backTo="/" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.55 }}
          className="relative overflow-hidden rounded-[30px] border border-accent/25 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.18),transparent_45%),linear-gradient(145deg,hsl(var(--card)),hsl(var(--background)))] p-5"
        >
          <motion.div className="absolute -right-14 -top-14 h-44 w-44 rounded-full border border-accent/10" animate={reduceMotion ? {} : { rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-accent"><Sparkles size={14} /><span className="text-[10px] font-black uppercase tracking-[0.16em]">Your fitness command centre</span></div>
              <h1 className="mt-2 font-heading text-2xl font-black">Everything important, without the mess</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Start with coaching, training, food, movement or competition. Every feature connects to the same profile and progress system.</p>
            </div>
            <motion.div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-accent text-accent-foreground" animate={reduceMotion ? {} : { scale: [1, 1.06, 1], rotate: [0, 4, -4, 0] }} transition={{ duration: 3.6, repeat: Infinity }}><Zap size={25} /></motion.div>
          </div>
          <div className="relative mt-4 flex items-center gap-2 rounded-2xl bg-background/60 px-3 py-2.5 text-[10px] text-muted-foreground"><ShieldCheck size={13} className="shrink-0 text-accent" /> Activity and challenge rewards use verified data from your account.</div>
        </motion.section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.button
                key={feature.title}
                type="button"
                onClick={() => navigate(feature.route)}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.45, delay: reduceMotion ? 0 : index * 0.055 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                className="group min-h-[142px] rounded-[24px] border border-border bg-card p-4 text-left transition-colors hover:border-accent/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${feature.tone}`}><Icon size={20} /></span>
                  <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-muted-foreground">{feature.tag}</span>
                </div>
                <h2 className="mt-3 font-heading text-base font-black">{feature.title}</h2>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{feature.detail}</p>
                <div className="mt-3 flex items-center gap-1 text-[10px] font-black text-accent">Open feature <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" /></div>
              </motion.button>
            );
          })}
        </section>

        <section className="rounded-[26px] border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Target size={20} /></span>
            <div><h2 className="font-heading text-base font-black">Simple daily flow</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ask your coach → complete the workout → scan or log food → track movement → verify challenge progress.</p></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-background/60 px-2 py-3"><Bot size={15} className="mx-auto text-accent" /><p className="mt-1 text-[9px] font-bold">Plan</p></div>
            <div className="rounded-2xl bg-background/60 px-2 py-3"><Activity size={15} className="mx-auto text-blue-300" /><p className="mt-1 text-[9px] font-bold">Perform</p></div>
            <div className="rounded-2xl bg-background/60 px-2 py-3"><Flame size={15} className="mx-auto text-orange-300" /><p className="mt-1 text-[9px] font-bold">Progress</p></div>
          </div>
        </section>
      </main>
    </>
  );
}
