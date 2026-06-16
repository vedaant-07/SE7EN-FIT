import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut, Edit2, Check, Crown, Flame, Dumbbell, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export default function Profile() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const profiles = await base44.entities.UserProfile.filter({ user_id: u.id });
    if (profiles.length) { setProfile(profiles[0]); setForm(profiles[0]); }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (profile) {
      await base44.entities.UserProfile.update(profile.id, {
        full_name: form.full_name,
        age: Number(form.age),
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        target_weight_kg: Number(form.target_weight_kg),
        goal: form.goal,
        fitness_level: form.fitness_level,
        diet_preference: form.diet_preference,
        workout_days_per_week: Number(form.workout_days_per_week),
      });
    }
    toast({ title: 'Profile updated!' });
    setEditing(false);
    loadData();
    setSaving(false);
  };

  const handleLogout = () => { base44.auth.logout('/login'); };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const MENU_ITEMS = [
    { label: 'Progress & Transformation', path: '/progress', icon: '📈' },
    { label: 'My Workout Plans', path: '/workout', icon: '🏋️' },
    { label: 'Subscription', path: '/subscription', icon: '👑' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
    { label: 'Community', path: '/community', icon: '💬' },
  ];

  return (
    <>
      <TopBar title="Profile" showBack />
      <div className="px-4 py-4 space-y-5 pb-24">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
            <User size={36} className="text-accent" />
          </div>
          <div className="text-center">
            <p className="font-heading font-bold text-lg">{profile?.full_name || user?.full_name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            {profile?.role === 'premium' && (
              <div className="flex items-center gap-1 mt-1 justify-center">
                <Crown size={12} className="text-yellow-500" />
                <span className="text-xs text-yellow-500 font-medium">Premium</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Flame size={14} className="text-orange-500 mx-auto mb-1" />
            <p className="text-base font-bold">{profile?.streak_days || 0}</p>
            <p className="text-[9px] text-muted-foreground">Day Streak</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Dumbbell size={14} className="text-accent mx-auto mb-1" />
            <p className="text-base font-bold">{profile?.total_workouts || 0}</p>
            <p className="text-[9px] text-muted-foreground">Workouts</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Award size={14} className="text-yellow-500 mx-auto mb-1" />
            <p className="text-base font-bold">{profile?.fitness_level || 'N/A'}</p>
            <p className="text-[9px] text-muted-foreground">Level</p>
          </div>
        </div>

        {/* Edit profile */}
        {!editing ? (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-sm">Fitness Profile</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-accent h-7 text-xs">
                <Edit2 size={12} className="mr-1" /> Edit
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Goal', value: profile?.goal?.replace(/_/g, ' ') },
                { label: 'Fitness Level', value: profile?.fitness_level },
                { label: 'Diet', value: profile?.diet_preference?.replace(/_/g, ' ') },
                { label: 'Height', value: profile?.height_cm ? `${profile.height_cm} cm` : null },
                { label: 'Weight', value: profile?.weight_kg ? `${profile.weight_kg} kg` : null },
                { label: 'Target', value: profile?.target_weight_kg ? `${profile.target_weight_kg} kg` : null },
                { label: 'Workout Days', value: profile?.workout_days_per_week ? `${profile.workout_days_per_week} days/week` : null },
              ].filter(r => r.value).map((row, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-medium capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <h3 className="font-heading font-semibold text-sm">Edit Profile</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'full_name', label: 'Name', type: 'text', colSpan: true },
                { key: 'age', label: 'Age', type: 'number' },
                { key: 'height_cm', label: 'Height (cm)', type: 'number' },
                { key: 'weight_kg', label: 'Weight (kg)', type: 'number' },
                { key: 'target_weight_kg', label: 'Target (kg)', type: 'number' },
                { key: 'workout_days_per_week', label: 'Workout Days/Week', type: 'number' },
              ].map(f => (
                <div key={f.key} className={f.colSpan ? 'col-span-2' : ''}>
                  <Label className="text-xs mb-1 block">{f.label}</Label>
                  <Input type={f.type} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="h-10 rounded-xl bg-background border-border" />
                </div>
              ))}
              <div>
                <Label className="text-xs mb-1 block">Goal</Label>
                <Select value={form.goal || ''} onValueChange={v => setForm(p => ({ ...p, goal: v }))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['weight_loss', 'muscle_gain', 'fat_loss', 'general_fitness', 'maintenance'].map(g => (
                      <SelectItem key={g} value={g}>{g.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Diet</Label>
                <Select value={form.diet_preference || ''} onValueChange={v => setForm(p => ({ ...p, diet_preference: v }))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'].map(d => (
                      <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 h-10 rounded-xl">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 h-10 rounded-xl bg-accent text-accent-foreground">
                <Check size={14} className="mr-1" /> Save
              </Button>
            </div>
          </div>
        )}

        {/* Menu items */}
        <div className="space-y-2">
          {MENU_ITEMS.map(item => (
            <Link key={item.path} to={item.path} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-all active:scale-[0.99]">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium flex-1">{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          ))}
        </div>

        <Button variant="outline" onClick={handleLogout} className="w-full h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5">
          <LogOut size={16} className="mr-2" /> Log Out
        </Button>
      </div>
    </>
  );
}