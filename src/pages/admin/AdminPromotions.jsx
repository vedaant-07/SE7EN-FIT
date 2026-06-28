import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import MediaUploadCropper from '@/components/se7enfit/MediaUploadCropper';
import { Megaphone, Plus, Trash2, RefreshCw } from 'lucide-react';

const safeArray = (value) => Array.isArray(value) ? value : [];
const blank = { title: '', description: '', offer_text: '', media_url: '', image_url: '', video_url: '', media_type: 'image', media_crop: 'center center', media_quality: '', media_width: 0, media_height: 0, media_duration: 0, cta_label: 'Explore' };

export default function AdminPromotions() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      const profiles = safeArray(await base44.entities.UserProfile.filter({ user_id: user.id }).catch(() => []));
      const ok = ['admin', 'super_admin'].includes(user.role) || ['admin', 'super_admin'].includes(profiles[0]?.role);
      setAuthorized(ok);
      if (!ok) return;
      const rows = await base44.entities.Advertisement.list('-created_date', 100).catch(() => []);
      setItems(safeArray(rows).filter(item => String(item.source_type || '').toLowerCase() === 'admin' && !['deleted', 'inactive'].includes(String(item.status || 'active'))));
    } catch (err) {
      setError(err?.message || 'Could not load promotions.');
    } finally {
      setLoading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.media_type === 'video' && Number(form.media_duration || 0) > 120) {
      setError('Video must be 2 minutes or less.');
      return;
    }
    setSaving(true);
    try {
      const mediaUrl = form.media_url || form.image_url || form.video_url || '';
      const row = await base44.entities.Advertisement.create({
        source_type: 'admin',
        source_name: 'SE7EN FIT',
        target_scope: 'all',
        show_to_all: true,
        title: form.title.trim(),
        description: form.description.trim(),
        offer_text: form.offer_text.trim() || 'Featured Offer',
        media_url: mediaUrl,
        image_url: form.media_type === 'image' ? mediaUrl : '',
        video_url: form.media_type === 'video' ? mediaUrl : '',
        media_type: form.media_type,
        media_crop: form.media_crop || 'center center',
        media_width: form.media_width,
        media_height: form.media_height,
        media_duration: form.media_duration,
        media_quality: form.media_quality || '1080p',
        cta_label: form.cta_label || 'Explore',
        status: 'active',
      });
      setItems(prev => [row, ...prev]);
      setForm(blank);
      setOpen(false);
    } catch (err) {
      setError(err?.message || 'Could not publish promotion.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    try {
      if (typeof base44.entities.Advertisement.delete === 'function') await base44.entities.Advertisement.delete(item.id);
      else await base44.entities.Advertisement.update(item.id, { status: 'deleted' });
      setItems(prev => prev.filter(row => row.id !== item.id));
    } catch {
      await base44.entities.Advertisement.update(item.id, { status: 'inactive' }).catch(() => null);
      setItems(prev => prev.filter(row => row.id !== item.id));
    }
  };

  if (loading) return <LoadingScreen />;
  if (!authorized) return null;

  return (
    <>
      <TopBar title="Admin Promotions" showBack backTo="/admin" />
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="bg-card border border-border rounded-3xl p-5 flex items-start justify-between gap-3">
          <div><h1 className="font-heading font-bold text-lg">Offers & Promotions</h1><p className="text-xs text-muted-foreground mt-1">Upload 1080p image/video, crop it, then publish globally.</p></div>
          <button onClick={() => setOpen(v => !v)} className="h-9 px-3 rounded-xl bg-white text-black text-xs font-bold flex items-center gap-1.5"><Plus size={13} /> New</button>
        </div>
        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-3 text-xs">{error}</div>}
        {open && <form onSubmit={save} className="bg-card border border-border rounded-2xl p-4 space-y-3"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Promotion title" className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm" required /><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details" rows={3} className="w-full rounded-xl bg-background border border-border p-3 text-sm resize-none" /><input value={form.offer_text} onChange={e => setForm(f => ({ ...f, offer_text: e.target.value }))} placeholder="Badge text" className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm" /><MediaUploadCropper label="Promotion Image / Video" helper="Upload 1080p or higher. Video max 2 minutes. Set crop before publishing." value={form} onChange={(media) => setForm(f => ({ ...f, ...media }))} /><button type="submit" disabled={saving || !form.title.trim()} className="w-full h-10 rounded-xl bg-white text-black text-sm font-bold disabled:opacity-50">{saving ? 'Publishing...' : 'Publish'}</button></form>}
        <div className="flex items-center justify-between px-0.5"><h2 className="font-heading font-semibold text-sm">Published</h2><button onClick={loadData} className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw size={12} /> Refresh</button></div>
        {items.length === 0 ? <div className="bg-card border border-border rounded-2xl p-6 text-center"><Megaphone size={28} className="text-muted-foreground mx-auto mb-2" /><p className="text-sm font-semibold">No promotions yet</p><p className="text-xs text-muted-foreground mt-1">Create a 1080p banner or short video.</p></div> : items.map(item => <div key={item.id} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><Megaphone size={16} className="text-white" /></div><div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{item.title}</p><p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description || 'Promotion'}</p><p className="text-[10px] text-muted-foreground mt-1">{item.offer_text || 'Offer'} • {item.media_quality || '1080p'}</p></div><button onClick={() => remove(item)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Trash2 size={13} className="text-red-400" /></button></div>)}
      </div>
    </>
  );
}
