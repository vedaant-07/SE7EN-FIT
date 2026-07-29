import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Home, Bot, Dumbbell, Trophy, Activity } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/workout', icon: Dumbbell, label: 'Train' },
  { path: '/ai-trainer', icon: Bot, label: 'Coach' },
  { path: '/challenges', icon: Trophy, label: 'Compete' },
  { path: '/tracking', icon: Activity, label: 'Track' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-2xl"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-2 pt-2">
        {navItems.map(({ path, icon: NavIcon, label }) => {
          const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-14 min-w-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 transition-all active:scale-95 ${
                isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="relative flex h-8 min-w-12 items-center justify-center rounded-full px-3">
                {isActive && (
                  <motion.span
                    layoutId="se7enfit-primary-nav-pill"
                    className="absolute inset-0 rounded-full bg-accent/12"
                    transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 320, damping: 28 }}
                  />
                )}
                <motion.span
                  className="relative z-10 flex"
                  animate={reduceMotion ? {} : isActive ? { y: [0, -1.5, 0], scale: [1, 1.06, 1] } : {}}
                  transition={{ duration: 0.55 }}
                >
                  <NavIcon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                </motion.span>
              </span>
              <span className={`text-[10px] tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
