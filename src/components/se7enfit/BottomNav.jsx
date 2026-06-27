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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-2xl border-t border-border/60"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-3">
        {navItems.map(({ path, icon: NavIcon, label }) => {
          const Icon = NavIcon;
          const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={`relative flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
