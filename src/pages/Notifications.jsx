import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import EmptyState from '@/components/se7enfit/EmptyState';
import { Bell, Dumbbell, Apple, Droplets, Footprints, Moon, Scale, Trophy, Crown, Zap, Info, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TYPE_ICONS = {
  workout: Dumbbell, meal: Apple, water: Droplets, steps: Footprints, sleep: Moon,
  weight: Scale, progress: Trophy, subscription: Crown, challenge: Zap,
  motivation: Trophy, report: Info, system: Bell,
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const notifs = await base44.entities.Notification.filter({ user_id: user.id }, '-created_date', 50);
      const rows = Array.isArray(notifs) ? notifs : [];
      setNotifications(rows);
      setLoading(false);

      const unread = rows.filter(n => !n.is_read);
      if (unread.length) {
        await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true }).catch(() => null)));
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }

      window.dispatchEvent(new Event('se7enfit:notifications-read'));
    } catch {
      setNotifications([]);
      setLoading(false);
      window.dispatchEvent(new Event('se7enfit:notifications-read'));
    }
  };

  const markRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await base44.entities.Notification.update(id, { is_read: true });
    window.dispatchEvent(new Event('se7enfit:notifications-read'));
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    window.dispatchEvent(new Event('se7enfit:notifications-read'));
  };

  if (loading) return <LoadingScreen />;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <TopBar title="Notifications" showBack />
      <div className="px-4 py-4 pb-6 space-y-4">

        {unreadCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{unreadCount} unread</span>
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-accent h-7 gap-1">
              <CheckCheck size={13} /> Mark all read
            </Button>
          </div>
        )}

        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You're all caught up! Notifications about your workouts, meals, and milestones will appear here."
          />
        ) : (
          <div className="space-y-2.5">
            {notifications.map(notif => {
              const Icon = TYPE_ICONS[notif.type] || Bell;
              const typeColors = {
                workout: 'bg-accent/15 text-accent', meal: 'bg-orange-400/15 text-orange-400',
                water: 'bg-blue-400/15 text-blue-400', steps: 'bg-purple-400/15 text-purple-400',
                sleep: 'bg-indigo-400/15 text-indigo-400', weight: 'bg-pink-400/15 text-pink-400',
                progress: 'bg-yellow-400/15 text-yellow-400', subscription: 'bg-yellow-500/15 text-yellow-400',
                challenge: 'bg-red-400/15 text-red-400', motivation: 'bg-green-400/15 text-green-400',
                report: 'bg-cyan-400/15 text-cyan-400', system: 'bg-muted text-muted-foreground',
              };
              const iconColor = typeColors[notif.type] || 'bg-muted text-muted-foreground';
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && markRead(notif.id)}
                  className={`bg-card border rounded-2xl p-4 flex gap-3.5 cursor-pointer transition-all active:scale-[0.99] ${
                    !notif.is_read ? 'border-accent/30' : 'border-border opacity-80'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-snug ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>{notif.title}</p>
                      {!notif.is_read && <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-medium">
                      {notif.created_date ? new Date(notif.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
