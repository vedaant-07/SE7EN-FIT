import '@/screenshot-colors.css';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, ChevronLeft } from 'lucide-react';
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

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-2xl border-b border-border/40"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
        {showBack ? (
          <button
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted active:scale-95 transition-all"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div className="font-display font-bold text-xl tracking-tight select-none">
            SE<span className="text-accent">7</span>ENFIT
          </div>
        )}

        {title && (
          <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-heading font-semibold">{title}</h1>
        )}

        <div className="flex items-center gap-1.5">
          {rightElement || (
            <>
              <Link
                to="/notifications"
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted relative active:scale-95 transition-all"
                aria-label="Notifications"
              >
                <Bell size={18} strokeWidth={1.8} />
                {hasUnreadNotifications && location.pathname !== '/notifications' && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full ring-1 ring-background" />
                )}
              </Link>
              <Link
                to="/profile"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all"
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
