import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Send, Trash2, Edit3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmModal from '@/components/gym-owner/ConfirmModal';

export default function AnnouncementsTab({ owner, announcements, setAnnouncements, showToast }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editId, setEditId] = useState(null);

  const sendAnnouncement = async () => {
    if (!message.trim()) { showToast('Message cannot be empty', 'error'); return; }
    setSending(true);
    const newAnn = await base44.entities.GymAnnouncement.create({
      gym_id: owner.id,
      owner_id: owner.user_id,
      title: title.trim() || undefined,
      message: message.trim(),
      is_active: true,
    });
    setAnnouncements(prev => [newAnn, ...prev]);
    setTitle('');
    setMessage('');
    showToast('Announcement sent to all members!', 'success');
    setSending(false);
  };

  const deleteAnnouncement = async () => {
    await base44.entities.GymAnnouncement.update(deleteConfirm, { is_active: false });
    setAnnouncements(prev => prev.filter(a => a.id !== deleteConfirm));
    setDeleteConfirm(null);
    showToast('Announcement deleted', 'success');
  };

  return (
    <div className="space-y-3">
      <p className="font-heading font-bold text-lg">Announcements</p>

      {/* Compose */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold">Send to All Members</p>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full h-9 px-3 rounded-xl border border-input bg-muted/40 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Write your message to all gym members..."
          className="w-full h-24 px-3 py-2 rounded-xl border border-input bg-muted/40 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button
          onClick={sendAnnouncement}
          disabled={sending || !message.trim()}
          className="h-11 rounded-xl bg-accent text-accent-foreground text-sm w-full font-semibold disabled:opacity-50"
        >
          <Send size={14} className="mr-2" />
          {sending ? 'Sending...' : 'Send Announcement'}
        </Button>
      </div>

      {/* Past Announcements */}
      {announcements.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-2xl p-8 text-center">
          <Bell size={28} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold">No announcements sent yet</p>
          <p className="text-xs text-muted-foreground mt-1">Send your first message to all gym members</p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-muted-foreground px-1">Sent ({announcements.length})</p>
          {announcements.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {a.title && <p className="text-xs font-bold mb-0.5">{a.title}</p>}
                  <p className="text-sm font-medium leading-relaxed">{a.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {a.created_date ? new Date(a.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                  </p>
                </div>
                <button onClick={() => setDeleteConfirm(a.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Trash2 size={11} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Announcement"
        message="This will remove the announcement."
        confirmLabel="Delete"
        onConfirm={deleteAnnouncement}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}