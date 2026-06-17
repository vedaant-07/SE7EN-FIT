import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Trophy, Plus, X, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmModal from '@/components/gym-owner/ConfirmModal';

const CHALLENGE_TYPES = ['attendance', 'steps', 'workout', 'water', 'protein', 'transformation', 'custom'];

const EMPTY_FORM = {
  name: '', type: 'attendance', duration_days: 21,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '', rules: '', reward_coins: 100, is_active: true,
};

export default function ChallengesTab({ owner, showToast }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadChallenges(); }, [owner.id]);

  const loadChallenges = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Challenge.filter({ created_by_id: owner.user_id });
      setChallenges(data);
    } catch { /* no challenges entity or empty */ setChallenges([]); }
    setLoading(false);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const saveChallenge = async () => {
    if (!form.name.trim()) { showToast('Challenge name is required', 'error'); return; }
    setSaving(true);
    try {
      const end = form.end_date || (() => {
        const d = new Date(form.start_date);
        d.setDate(d.getDate() + parseInt(form.duration_days));
        return d.toISOString().split('T')[0];
      })();
      const created = await base44.entities.Challenge.create({
        ...form,
        end_date: end,
        reward_coins: parseInt(form.reward_coins) || 100,
        duration_days: parseInt(form.duration_days) || 21,
        gym_id: owner.id,
      });
      setChallenges(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      showToast('Challenge created!', 'success');
    } catch (e) {
      showToast('Failed to create challenge', 'error');
    }
    setSaving(false);
  };

  const toggleStatus = async (ch) => {
    const updated = { ...ch, is_active: !ch.is_active };
    await base44.entities.Challenge.update(ch.id, { is_active: !ch.is_active });
    setChallenges(prev => prev.map(c => c.id === ch.id ? updated : c));
    showToast(updated.is_active ? 'Challenge activated' : 'Challenge deactivated', 'success');
  };

  const deleteChallenge = async () => {
    await base44.entities.Challenge.delete(deleteConfirm);
    setChallenges(prev => prev.filter(c => c.id !== deleteConfirm));
    setDeleteConfirm(null);
    showToast('Challenge deleted', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-heading font-bold text-lg">Challenges</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
          <Plus size={13} /> Create
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">New Challenge</p>
            <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
              <X size={13} />
            </button>
          </div>
          <Input placeholder="Challenge name *" value={form.name} onChange={set('name')} className="h-10 rounded-xl text-sm" />
          <select value={form.type} onChange={set('type')}
            className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Challenge</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Duration (days)</p>
              <Input type="number" value={form.duration_days} onChange={set('duration_days')} className="h-10 rounded-xl text-sm" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Reward Coins</p>
              <Input type="number" value={form.reward_coins} onChange={set('reward_coins')} className="h-10 rounded-xl text-sm" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Start Date</p>
            <Input type="date" value={form.start_date} onChange={set('start_date')} className="h-10 rounded-xl text-sm" />
          </div>
          <textarea placeholder="Rules (optional)" value={form.rules} onChange={set('rules')}
            className="w-full h-16 px-3 py-2 rounded-xl border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold">Cancel</button>
            <button onClick={saveChallenge} disabled={saving || !form.name.trim()}
              className="flex-1 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Challenge'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : challenges.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-2xl p-10 text-center">
          <Trophy size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold">No challenges yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a gym challenge to increase member engagement</p>
        </div>
      ) : (
        challenges.map(ch => (
          <div key={ch.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Trophy size={16} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ch.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{ch.type} • {ch.duration_days || '?'} days • {ch.reward_coins || 0} coins</p>
                {ch.start_date && <p className="text-[10px] text-muted-foreground mt-0.5">{ch.start_date} → {ch.end_date || 'TBD'}</p>}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${ch.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                {ch.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {ch.rules && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{ch.rules}</p>}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => toggleStatus(ch)}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all ${ch.is_active ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                {ch.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => showToast('Leaderboard — coming soon!', 'info')}
                className="text-[11px] px-3 py-1.5 rounded-lg font-semibold bg-accent/10 text-accent">
                Leaderboard
              </button>
              <button onClick={() => showToast('Participants view — coming soon!', 'info')}
                className="text-[11px] px-3 py-1.5 rounded-lg font-semibold bg-muted text-muted-foreground">
                <Users size={11} className="inline mr-1" />Participants
              </button>
              <button onClick={() => setDeleteConfirm(ch.id)}
                className="text-[11px] px-3 py-1.5 rounded-lg font-semibold bg-red-500/10 text-red-400">
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Challenge"
        message="This will permanently delete the challenge and all participant data."
        confirmLabel="Delete"
        onConfirm={deleteChallenge}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}