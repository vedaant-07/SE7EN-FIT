import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Bot, Dumbbell, Trophy, Activity } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/workout', icon: Dumbbell, label: 'Workout' },
  { path: '/ai-trainer', icon: Bot, label: 'AI' },
  { path: '/challenges', icon: Trophy, label: 'Challenges' },
  { path: '/tracking', icon: Activity, label: 'Track' },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-2xl"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-2 pt-2">
        {navItems.map(({ path, icon: NavIcon, label }) => {
          const Icon = NavIcon;
          const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-14 min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 transition-all duration-200 active:scale-95 ${
                isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`flex h-7 min-w-12 items-center justify-center rounded-full px-3 transition-colors ${isActive ? 'bg-accent/12' : ''}`}><Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} /></span>
              <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
