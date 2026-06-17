import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Gift, Plus, X, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ConfirmModal from '@/components/gym-owner/ConfirmModal';

const EMPTY_FORM = { title: '', description: '', required_coins: 100, quantity: 10, expiry_date: '', terms: '', is_active: true };

export default function RewardsTab({ owner, showToast }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadOffers(); }, [owner.id]);

  const loadOffers = async () => {
    setLoading(true);
    try {
      // Use GymAnnouncement as a stand-in; in a real scenario a GymRewardOffer entity would exist
      // For now just use in-memory state (offers not persisted unless entity exists)
      setOffers([]);
    } catch { setOffers([]); }
    setLoading(false);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const saveOffer = async () => {
    if (!form.title.trim()) { showToast('Offer title is required', 'error'); return; }
    setSaving(true);
    // Stub save — creates locally until GymRewardOffer entity exists
    const newOffer = { ...form, id: Date.now().toString(), gym_id: owner.id, required_coins: parseInt(form.required_coins) || 100, quantity: parseInt(form.quantity) || 10 };
    setOffers(prev => [newOffer, ...prev]);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    showToast('Reward offer created!', 'success');
    setSaving(false);
  };

  const toggleStatus = (id) => {
    setOffers(prev => prev.map(o => o.id === id ? { ...o, is_active: !o.is_active } : o));
    showToast('Offer status updated', 'success');
  };

  const deleteOffer = () => {
    setOffers(prev => prev.filter(o => o.id !== deleteConfirm));
    setDeleteConfirm(null);
    showToast('Offer deleted', 'success');
  };

  const EXAMPLES = [
    '10% gym membership discount',
    'Free body composition check',
    'Free nutrition consultation',
    'Supplement discount voucher',
    'Gym merchandise',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-heading font-bold text-lg">Rewards & Offers</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
          <Plus size={13} /> Create
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">New Reward Offer</p>
            <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"><X size={13} /></button>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-2">Quick Examples</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setForm(f => ({ ...f, title: ex }))}
                  className="text-[10px] bg-muted px-2.5 py-1 rounded-lg font-medium hover:bg-accent/10 hover:text-accent transition-all">
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <Input placeholder="Offer title *" value={form.title} onChange={set('title')} className="h-10 rounded-xl text-sm" />
          <textarea placeholder="Description" value={form.description} onChange={set('description')}
            className="w-full h-16 px-3 py-2 rounded-xl border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Required Coins</p>
              <Input type="number" value={form.required_coins} onChange={set('required_coins')} className="h-10 rounded-xl text-sm" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Quantity Available</p>
              <Input type="number" value={form.quantity} onChange={set('quantity')} className="h-10 rounded-xl text-sm" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Expiry Date</p>
            <Input type="date" value={form.expiry_date} onChange={set('expiry_date')} className="h-10 rounded-xl text-sm" />
          </div>
          <Input placeholder="Terms & conditions" value={form.terms} onChange={set('terms')} className="h-10 rounded-xl text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold">Cancel</button>
            <button onClick={saveOffer} disabled={saving || !form.title.trim()}
              className="flex-1 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Offer'}
            </button>
          </div>
        </div>
      )}

      {/* Offers List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : offers.length === 0 ? (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-amber-400/15 to-amber-400/5 border border-amber-400/25 rounded-2xl p-4">
            <p className="font-semibold text-sm mb-1">Why create rewards?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Offer discounts and perks to members who earn coins through workouts, challenges, and check-ins. Increases retention and engagement.</p>
          </div>
          <div className="bg-muted/30 border border-border rounded-2xl p-8 text-center">
            <Gift size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold">No reward offers yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first offer to reward loyal members</p>
          </div>
        </div>
      ) : (
        offers.map(offer => (
          <div key={offer.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                <Tag size={16} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{offer.title}</p>
                {offer.description && <p className="text-xs text-muted-foreground mt-0.5">{offer.description}</p>}
                <p className="text-xs text-accent mt-0.5">{offer.required_coins} coins • {offer.quantity} available{offer.expiry_date ? ` • Expires ${offer.expiry_date}` : ''}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${offer.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                {offer.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => toggleStatus(offer.id)}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold ${offer.is_active ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                {offer.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => showToast('Reward claims view — coming soon!', 'info')}
                className="text-[11px] px-3 py-1.5 rounded-lg font-semibold bg-muted text-muted-foreground">
                View Claims
              </button>
              <button onClick={() => setDeleteConfirm(offer.id)}
                className="text-[11px] px-3 py-1.5 rounded-lg font-semibold bg-red-500/10 text-red-400">
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Offer"
        message="This will permanently delete this reward offer."
        confirmLabel="Delete"
        onConfirm={deleteOffer}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}