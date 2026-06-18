import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import ConfirmModal from '@/components/se7enfit/ConfirmModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut, Edit2, Check, Crown, Flame, Dumbbell, ChevronRight, Bell, Users, TrendingUp, Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Profile() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const [profiles, subs] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: u.id }),
      base44.entities.Subscription.filter({ user_id: u.id, status: 'active' }),
    ]);
    if (profiles.length) { setProfile(profiles[0]); setForm(profiles[0]); }
    setSubscription(subs[0] || null);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
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
      daily_step_goal: Number(form.daily_step_goal),
      daily_water_goal_ml: Number(form.daily_water_goal_ml),
      sleep_goal_hours: Number(form.sleep_goal_hours),
    });
    toast({ title: '✓ Profile updated', description: 'Your fitness profile has been saved.' });
    setEditing(false);
    setSaving(false);
    loadData();
  };

  if (loading) return <LoadingScreen />;

  const isPremium = subscription && subscription.plan !== 'free';
  const planLabel = subscription?.plan?.replace(/_/g, ' ') || 'Free Plan';

  const MENU_ITEMS = [
    { label: 'Progress & Transformation', icon: TrendingUp, path: '/progress', color: 'text-accent' },
    { label: 'My Workout Plans', icon: Dumbbell, path: '/workout', color: 'text-blue-400' },
    { label: 'Notifications', icon: Bell, path: '/notifications', color: 'text-yellow-400' },
    { label: 'Community', icon: Users, path: '/community', color: 'text-purple-400' },
    { label: 'Subscription & Plans', icon: Crown, path: '/subscription', color: 'text-yellow-500' },
  ];


  return (
    <>
      <TopBar title="Profile" showBack />
      <div className="px-4 py-4 space-y-5 pb-6">

        {/* Profile Header */}
        <div className="bg-card border border-border rounded-3xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <User size={28} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-lg truncate">{profile?.full_name || user?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {isPremium ? (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-yellow-500/15 text-yellow-400 px-2.5 py-0.5 rounded-full font-semibold">
                    <Crown size={9} /> {planLabel}
                  </span>
                ) : (
                  <Link to="/subscription">
                    <span className="inline-flex items-center gap-1 text-[11px] bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-medium hover:bg-accent/10 hover:text-accent transition-colors">
                      Free Plan — Upgrade
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-base font-bold font-heading flex items-center justify-center gap-1">
                <Flame size={13} className="text-orange-400" />{profile?.streak_days || 0}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Day Streak</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold font-heading">{profile?.total_workouts || 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Workouts</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold font-heading capitalize text-xs">{profile?.fitness_level || '—'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Level</p>
            </div>
          </div>
        </div>

        {/* Fitness Profile (view/edit) */}
        {!editing ? (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-sm">Fitness Profile</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-accent h-7 text-xs gap-1">
                <Edit2 size={11} /> Edit
              </Button>
            </div>
            <div className="space-y-0">
              {[
                { label: 'Goal', value: profile?.goal?.replace(/_/g, ' ') },
                { label: 'Fitness Level', value: profile?.fitness_level },
                { label: 'Diet Preference', value: profile?.diet_preference?.replace(/_/g, ' ') },
                { label: 'Height', value: profile?.height_cm ? `${profile.height_cm} cm` : null },
                { label: 'Current Weight', value: profile?.weight_kg ? `${profile.weight_kg} kg` : null },
                { label: 'Target Weight', value: profile?.target_weight_kg ? `${profile.target_weight_kg} kg` : null },
                { label: 'Workout Days', value: profile?.workout_days_per_week ? `${profile.workout_days_per_week}/week` : null },
                { label: 'Daily Steps Goal', value: profile?.daily_step_goal ? `${profile.daily_step_goal.toLocaleString()} steps` : null },
                { label: 'Water Goal', value: profile?.daily_water_goal_ml ? `${profile.daily_water_goal_ml}ml` : null },
              ].filter(r => r.value).map((row, i) => (
                <div key={i} className="flex justify-between py-2.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-medium capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm">Edit Profile</h3>
              <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground">Cancel</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs mb-1 block">Full Name</Label>
                <Input value={form.full_name || ''} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="h-10 rounded-xl bg-background" />
              </div>
              {[
                { key: 'age', label: 'Age' },
                { key: 'height_cm', label: 'Height (cm)' },
                { key: 'weight_kg', label: 'Weight (kg)' },
                { key: 'target_weight_kg', label: 'Target (kg)' },
                { key: 'workout_days_per_week', label: 'Workout Days/wk' },
                { key: 'daily_step_goal', label: 'Step Goal' },
                { key: 'daily_water_goal_ml', label: 'Water Goal (ml)' },
                { key: 'sleep_goal_hours', label: 'Sleep Goal (hrs)' },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-xs mb-1 block">{f.label}</Label>
                  <Input type="number" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="h-10 rounded-xl bg-background" />
                </div>
              ))}
              <div>
                <Label className="text-xs mb-1 block">Goal</Label>
                <Select value={form.goal || ''} onValueChange={v => setForm(p => ({ ...p, goal: v }))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['weight_loss', 'muscle_gain', 'fat_loss', 'general_fitness', 'maintenance', 'body_transformation'].map(g => (
                      <SelectItem key={g} value={g}>{g.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Diet</Label>
                <Select value={form.diet_preference || ''} onValueChange={v => setForm(p => ({ ...p, diet_preference: v }))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'].map(d => (
                      <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Fitness Level</Label>
                <Select value={form.fitness_level || ''} onValueChange={v => setForm(p => ({ ...p, fitness_level: v }))}>
                  <SelectTrigger className="h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['beginner', 'intermediate', 'advanced'].map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full h-11 rounded-xl bg-accent text-accent-foreground">
              {saving ? 'Saving...' : <><Check size={14} className="mr-1.5" /> Save Changes</>}
            </Button>
          </div>
        )}

        {/* Referral Code */}
        {profile?.referral_code && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <Share2 size={16} className="text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Your Referral Code</p>
                <p className="font-heading font-bold text-base tracking-wider">{profile.referral_code}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(profile.referral_code); toast({ title: 'Code copied!' }); }}
                className="text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-lg font-medium"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Menu */}
        <div className="space-y-2">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-accent/30 active:scale-[0.99] transition-all">
                  <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center ${item.color}`}>
                    <Icon size={15} />
                  </div>
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>

        <Button variant="outline" onClick={() => setShowLogout(true)} className="w-full h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 gap-2">
          <LogOut size={15} /> Log Out
        </Button>

        {/* Legal & version */}
        <div className="flex justify-center gap-5 pt-1">
          <Link to="/terms" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
        </div>
        <p className="text-center text-[10px] text-muted-foreground pb-2">SE7ENFIT v1.0.0</p>
      </div>

      <ConfirmModal
        open={showLogout}
        title="Log out?"
        description="You'll need to sign in again to access your fitness data."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => base44.auth.logout('/login')}
        onCancel={() => setShowLogout(false)}
      />
    </>
  );
}