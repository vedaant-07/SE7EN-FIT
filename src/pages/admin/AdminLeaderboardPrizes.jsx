import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, Gift, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const safeArray = (value) => Array.isArray(value) ? value : [];

export default function AdminLeaderboardPrizes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [form, setForm] = useState({ gym_id: '', rank: '1', title: '', reward: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const profiles = safeArray(await base44.entities.UserProfile.filter({ user_id: user.id }).catch(() => []));
      const isAdmin = ['admin', 'super_admin'].includes(user.role) || ['admin', 'super_admin'].includes(profiles[0]?.role);
      if (!isAdmin) {
        window.location.href = '/';
        return;
      }
      const [ownersRaw, prizesRaw] = await Promise.all([
        base44.entities.GymOwner.list('-created_date', 200).catch(() => []),
        base44.entities.LeaderboardPrize.list('-created_date', 200).catch(() => []),
      ]);
      setGyms(safeArray(ownersRaw));
      setPrizes(safeArray(prizesRaw));
    } finally {
      setLoading(false);
    }
  };

  const createPrize = async (e) => {
    e.preventDefault();
    if (!form.gym_id || !form.title.trim() || !form.reward.trim()) return;
    setSaving(true);
    try {
      await base44.entities.LeaderboardPrize.create({
        gym_id: form.gym_id,
        rank: Number(form.rank),
        title: form.title.trim(),
        reward: form.reward.trim(),
        status: 'active',
      });
      setForm({ gym_id: form.gym_id, rank: '1', title: '', reward: '' });
      toast({ title: 'Prize saved' });
      await loadData();
    } catch (error) {
      toast({ title: 'Could not save prize', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (prize) => {
    await base44.entities.LeaderboardPrize.update(prize.id, {
      status: (prize.status || 'active') === 'active' ? 'inactive' : 'active',
    });
    await loadData();
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Leaderboard Prizes" showBack backTo="/admin" />
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center">
              <Trophy size={22} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg">Manage Top 3 Prizes</h2>
              <p className="text-xs text-muted-foreground">Set gym leaderboard prizes for rank 1, 2 and 3.</p>
            </div>
          </div>

          <form onSubmit={createPrize} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Gym</Label>
              <select value={form.gym_id} onChange={e => setForm(f => ({ ...f, gym_id: e.target.value }))} className="w-full h-11 rounded-xl bg-background border border-border px-3 text-sm">
                <option value="">Select gym</option>
                {gyms.map(gym => <option key={gym.id} value={gym.id}>{gym.gym_name || gym.owner_name || gym.email}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Rank</Label>
                <select value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} className="w-full h-11 rounded-xl bg-background border border-border px-3 text-sm">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Prize Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Gold Rank Prize" className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reward Details</Label>
              <Input value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} placeholder="Free gym month, coupon, merchandise..." className="h-11 rounded-xl" />
            </div>
            <Button type="submit" disabled={saving || !form.gym_id || !form.title || !form.reward} className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-bold">
              <Plus size={15} className="mr-1.5" /> {saving ? 'Saving...' : 'Add Prize'}
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-between px-0.5">
          <h3 className="font-heading font-semibold text-sm">Current Prizes</h3>
          <button onClick={loadData} className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw size={12} /> Refresh</button>
        </div>

        <div className="space-y-2">
          {prizes.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Gift size={26} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold">No prizes added yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add prizes to show them on user leaderboard.</p>
            </div>
          ) : prizes.map(prize => {
            const gym = gyms.find(g => String(g.id) === String(prize.gym_id));
            const active = (prize.status || 'active') === 'active';
            return (
              <div key={prize.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center font-black text-yellow-400">
                  #{prize.rank || 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{prize.title || prize.prize_title}</p>
                  <p className="text-xs text-muted-foreground truncate">{prize.reward || prize.description}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{gym?.gym_name || 'Gym'}</p>
                </div>
                <button onClick={() => toggleStatus(prize)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                  {active ? 'Active' : 'Inactive'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
