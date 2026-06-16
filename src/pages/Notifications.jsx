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
    const user = await base44.auth.me();
    const notifs = await base44.entities.Notification.filter({ user_id: user.id }, '-created_date', 50);
    setNotifications(notifs);
    setLoading(false);
  };

  const markRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await base44.entities.Notification.update(id, { is_read: true });
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
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
          <div className="space-y-2">
            {notifications.map(notif => {
              const Icon = TYPE_ICONS[notif.type] || Bell;
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && markRead(notif.id)}
                  className={`bg-card border rounded-2xl p-4 flex gap-3 cursor-pointer transition-all active:scale-[0.99] ${
                    !notif.is_read ? 'border-accent/30 bg-accent/3' : 'border-border'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${!notif.is_read ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!notif.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>{notif.title}</p>
                      {!notif.is_read && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
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