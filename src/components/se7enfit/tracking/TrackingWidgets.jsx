import React from 'react';
import ProgressRing from '@/components/se7enfit/ProgressRing';
import { Trophy, Flame, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TodayProgressCard({ icon, label, value, unit, goalValue, goalUnit, percent, color, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
      <ProgressRing percent={percent} size={72} strokeWidth={6} color={color}>
        <span className="text-[10px] font-bold">{Math.round(percent)}%</span>
      </ProgressRing>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <p className="text-2xl font-bold font-heading leading-tight mt-0.5">
          {value}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Goal: {goalValue} {goalUnit}</p>
        {children}
      </div>
    </div>
  );
}

export function AIInsightCard() {
  return null;
}

export function StreakCard({ streak, label, emoji }) {
  const milestones = [3, 7, 14, 30, 60, 90];
  const next = milestones.find(m => m > streak) || 100;
  const percent = (streak / next) * 100;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-orange-400/10 flex flex-col items-center justify-center flex-shrink-0">
        <Flame size={16} className="text-orange-400" />
        <p className="text-lg font-bold font-heading text-orange-400 leading-none">{streak}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm">{streak}-Day Streak {emoji}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Next milestone: {next} days</p>
        <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-orange-400 rounded-full transition-all duration-700" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

export function AchievementBadge({ streak, count }) {
  const getBadge = () => {
    if (streak >= 30 || count >= 50) return { label: '🏆 Legend', desc: '30-day streak or 50 logs', unlocked: true };
    if (streak >= 14 || count >= 20) return { label: '🥇 Champion', desc: '14-day streak or 20 logs', unlocked: true };
    if (streak >= 7 || count >= 10) return { label: '🥈 Dedicated', desc: '7-day streak or 10 logs', unlocked: true };
    if (streak >= 3 || count >= 5) return { label: '🥉 Starter', desc: '3-day streak or 5 logs', unlocked: true };
    return { label: '🎯 Beginner', desc: 'Start logging to earn badges', unlocked: false };
  };
  const badge = getBadge();
  return (
    <div className={`border rounded-2xl p-4 flex items-center gap-3 ${badge.unlocked ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-card border-border'}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${badge.unlocked ? 'bg-yellow-500/15' : 'bg-muted'}`}>
        {badge.label.split(' ')[0]}
      </div>
      <div>
        <p className={`font-heading font-semibold text-sm ${badge.unlocked ? 'text-yellow-400' : 'text-muted-foreground'}`}>
          {badge.label.split(' ').slice(1).join(' ')}
        </p>
        <p className="text-[11px] text-muted-foreground">{badge.desc}</p>
      </div>
      {badge.unlocked && <Trophy size={14} className="text-yellow-400 ml-auto flex-shrink-0" />}
    </div>
  );
}

export function HistoryItem({ title, subtitle, value, unit, onEdit, onDelete }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <p className="text-sm font-bold font-heading flex-shrink-0">{value}<span className="text-[11px] font-normal text-muted-foreground ml-0.5">{unit}</span></p>
      <div className="flex gap-1 flex-shrink-0">
        {onEdit && (
          <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted active:scale-95 transition-all">
            <Pencil size={12} className="text-muted-foreground" />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 active:scale-95 transition-all">
            <Trash2 size={12} className="text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DeviceSyncBanner() {
  return null;
}
