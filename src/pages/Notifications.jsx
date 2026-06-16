import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TYPE_ICONS = {
  workout: '🏋️', meal: '🍽️', water: '💧', steps: '🚶', sleep: '😴',
  weight: '⚖️', progress: '📈', subscription: '👑', challenge: '🏆',
  motivation: '💪', report: '📊', system: '⚙️',
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

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (n) => {
    if (n.is_read) return;
    await base44.entities.Notification.update(n.id, { is_read: true });
    setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, is_read: true } : p));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <TopBar title="Notifications" showBack />
      <div className="px-4 py-4 space-y-3 pb-24">
        {unreadCount > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-accent text-xs h-7">
              <CheckCheck size={12} className="mr-1" /> Mark all read
            </Button>
          </div>
        )}

        {notifications.length === 0 && (
          <div className="text-center py-16">
            <Bell size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        )}

        <div className="space-y-2">
          {notifications.map(n => (
            <button key={n.id} onClick={() => markRead(n)} className={`w-full flex items-start gap-3 rounded-xl p-4 border text-left transition-all ${n.is_read ? 'bg-card border-border opacity-70' : 'bg-accent/5 border-accent/20'}`}>
              <span className="text-xl flex-shrink-0">{TYPE_ICONS[n.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}