import '@/screenshot-colors.css';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, ChevronLeft, Swords } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function TopBar({ title, showBack, backTo, rightElement }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };

  useEffect(() => {
    let mounted = true;

    const loadUnreadNotifications = async () => {
      try {
        if (!base44.auth.getToken()) {
          if (mounted) setHasUnreadNotifications(false);
          return;
        }

        const user = await base44.auth.me();
        const unread = await base44.entities.Notification.filter({ user_id: user.id, is_read: false }, '-created_date', 1);
        if (mounted) setHasUnreadNotifications(Array.isArray(unread) && unread.length > 0);
      } catch {
        if (mounted) setHasUnreadNotifications(false);
      }
    };

    loadUnreadNotifications();
    window.addEventListener('se7enfit:notifications-read', loadUnreadNotifications);

    return () => {
      mounted = false;
      window.removeEventListener('se7enfit:notifications-read', loadUnreadNotifications);
    };
  }, [location.pathname]);

  const isChallengesHome = location.pathname === '/challenges';

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-2xl"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        {showBack ? (
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-muted active:scale-95"
            aria-label="Go back"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div className="select-none font-display text-xl font-bold tracking-tight">
            SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span>
          </div>
        )}

        {title && (
          <h1 className="absolute left-1/2 -translate-x-1/2 font-heading text-base font-semibold">{title}</h1>
        )}

        <div className="flex items-center gap-1.5">
          {rightElement || (
            <>
              {isChallengesHome && (
                <Link
                  to="/challenges/battles"
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent transition-all hover:bg-accent/15 active:scale-95"
                  aria-label="Gym battles"
                >
                  <Swords size={17} strokeWidth={2.2} />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-orange-400 ring-2 ring-background" />
                </Link>
              )}
              <Link
                to="/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-muted active:scale-95"
                aria-label="Notifications"
              >
                <Bell size={18} strokeWidth={1.8} />
                {hasUnreadNotifications && location.pathname !== '/notifications' && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-1 ring-background" />
                )}
              </Link>
              <Link
                to="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted transition-all hover:bg-muted/80 active:scale-95"
                aria-label="Profile"
              >
                <User size={16} strokeWidth={1.8} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
