import React from 'react';
import { Link } from 'react-router-dom';
import TopBar from '@/components/se7enfit/TopBar';
import { Footprints, Droplets, Moon, Scale, Ruler, Activity, Heart, Dumbbell, Calendar, Brain, Smile } from 'lucide-react';

const TRACKING_ITEMS = [
  { path: '/tracking/steps', icon: Footprints, label: 'Steps', desc: 'Track daily steps & distance', color: 'text-green-500' },
  { path: '/tracking/water', icon: Droplets, label: 'Water', desc: 'Hydration tracking', color: 'text-blue-500' },
  { path: '/tracking/sleep', icon: Moon, label: 'Sleep', desc: 'Sleep hours & quality', color: 'text-purple-500' },
  { path: '/tracking/weight', icon: Scale, label: 'Weight', desc: 'Weight & body fat tracking', color: 'text-orange-500' },
  { path: '/tracking/measurements', icon: Ruler, label: 'Body Measurements', desc: 'Chest, waist, arms & more', color: 'text-pink-500' },
  { path: '/tracking/cardio', icon: Activity, label: 'Cardio', desc: 'Running, cycling & more', color: 'text-red-500' },
  { path: '/tracking/gym-attendance', icon: Calendar, label: 'Gym Attendance', desc: 'Check-in & attendance streak', color: 'text-yellow-500' },
  { path: '/tracking/habits', icon: Brain, label: 'Habits', desc: 'Daily habit tracking', color: 'text-cyan-500' },
  { path: '/tracking/mood', icon: Smile, label: 'Mood & Energy', desc: 'Track mood, energy & stress', color: 'text-amber-500' },
];

export default function Tracking() {
  return (
    <>
      <TopBar title="Tracking" showBack />
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-muted-foreground mb-2">Track every aspect of your fitness journey</p>
        {TRACKING_ITEMS.map(item => (
          <Link key={item.path} to={item.path} className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all active:scale-[0.99]">
            <div className={`w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center ${item.color}`}>
              <item.icon size={20} />
            </div>
            <div className="flex-1">
              <p className="font-heading font-semibold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><path d="M9 18l6-6-6-6"/></svg>
          </Link>
        ))}
      </div>
    </>
  );
}