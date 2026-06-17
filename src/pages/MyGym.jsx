import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Building2, MapPin, Clock, Star, Users, CheckCircle2, XCircle,
  QrCode, LogIn, LogOut, CalendarDays, Hash, ChevronRight,
  Dumbbell, Trophy, Bell, Gift, Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import TopBar from '@/components/se7enfit/TopBar';

export default function MyGym() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [gym, setGym] = useState(null);
  const [gymOwner, setGymOwner] = useState(null);
  const [membership, setMembership] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const profiles = await base44.entities.UserProfile.filter({ user_id: u.id });
      const p = profiles[0] || null;
      setProfile(p);

      if (p?.primary_gym_id) {
        const [owners, equip, attLogs, membershipRec] = await Promise.all([
          base44.entities.GymOwner.filter({ id: p.primary_gym_id }),
          base44.entities.GymEquipment.filter({ gym_id: p.primary_gym_id }),
          base44.entities.GymAttendanceLog.filter({ user_id: u.id, gym_id: p.primary_gym_id }),
          base44.entities.UserGymMembership.filter({ user_id: u.id, gym_id: p.primary_gym_id }),
        ]);
        if (owners[0]) setGym(owners[0]);
        setEquipment(equip.filter(e => e.available));
        setAttendance(attLogs);
        setMembership(membershipRec[0] || null);
        const tLog = attLogs.find(a => a.date === today);
        setTodayLog(tLog || null);

        // Load announcements
        try {
          const ann = await base44.entities.GymAnnouncement.filter({ gym_id: p.primary_gym_id });
          setAnnouncements(ann.filter(a => a.is_active).slice(0, 5));
        } catch {}
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleLinkGym = async () => {
    if (!referralCode.trim()) return;
    setLinking(true);
    try {
      const code = referralCode.trim().toUpperCase();
      const owners = await base44.entities.GymOwner.list();
      const matched = owners.find(o => o.referral_code?.toUpperCase() === code);
      if (!matched) {
        toast({ title: 'Invalid referral code', description: 'Please check with your gym owner.', variant: 'destructive' });
        setLinking(false);
        return;
      }

      // Update user profile
      if (profile) {
        await base44.entities.UserProfile.update(profile.id, {
          primary_gym_id: matched.id,
          gym_referral_code_used: code,
          gym_access: true,
        });
      }

      // Create membership record
      await base44.entities.UserGymMembership.create({
        user_id: user.id,
        gym_id: matched.id,
        owner_id: matched.user_id,
        referral_code_used: code,
        status: 'pending',
        joined_at: today,
      });

      // Create gym lead
      await base44.entities.GymLead.create({
        gym_id: matched.id,
        owner_id: matched.user_id,
        name: user.full_name || profile?.full_name || 'New User',
        source: 'app',
        status: 'new',
      });

      toast({
        title: `✅ Connected to ${matched.gym_name}!`,
        description: 'Your workouts will be personalized using this gym\'s equipment.',
      });
      await loadData();
    } catch (e) {
      toast({ title: 'Error linking gym', description: e.message, variant: 'destructive' });
    }
    setLinking(false);
  };

  const handleCheckIn = async () => {
    if (!gym || !user) return;
    setCheckingIn(true);
    try {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);

      if (todayLog && todayLog.status === 'checked_in') {
        // Check out
        const duration = Math.round((now - new Date(`${today}T${todayLog.check_in_time}`)) / 60000);
        await base44.entities.GymAttendanceLog.update(todayLog.id, {
          check_out_time: timeStr,
          status: 'checked_out',
          duration_minutes: duration > 0 ? duration : 0,
        });
        // Update membership visit count
        if (membership) {
          await base44.entities.UserGymMembership.update(membership.id, {
            total_visits: (membership.total_visits || 0) + 1,
            last_checkin: today,
          });
        }
        toast({ title: '👋 Checked out!', description: `Session: ${duration} minutes` });
      } else {
        // Check in
        await base44.entities.GymAttendanceLog.create({
          user_id: user.id,
          gym_id: gym.id,
          owner_id: gym.user_id,
          date: today,
          check_in_time: timeStr,
          check_in_method: 'self',
          status: 'checked_in',
        });
        toast({ title: '✅ Checked in!', description: `Welcome to ${gym.gym_name}` });
      }
      await loadData();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setCheckingIn(false);
  };

  const thisMonthAttendance = attendance.filter(a => a.date?.startsWith(today.slice(0, 7)));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="font-display font-bold text-2xl mb-4">SE<span className="text-accent">7</span>ENFIT</div>
          <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // No gym linked
  if (!profile?.primary_gym_id) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar title="My Gym" showBack backTo="/" />
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Building2 size={36} className="text-accent" />
            </div>
            <h2 className="font-heading font-bold text-2xl">Connect Your Gym</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Enter your gym's referral code to get workouts personalized<br />to your gym's actual machines & equipment.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 mb-4">
            <div>
              <p className="text-sm font-semibold mb-2">Enter Gym Referral Code</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. SE7EN-GYM-001"
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value.toUpperCase())}
                    className="pl-9 h-12 rounded-xl font-mono tracking-wider"
                  />
                </div>
                <Button onClick={handleLinkGym} disabled={linking || !referralCode.trim()} className="h-12 px-5 rounded-xl bg-accent text-accent-foreground font-semibold">
                  {linking ? 'Linking...' : 'Link'}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 text-center">
            <Dumbbell size={20} className="text-accent mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Ask your gym owner for their referral code, or skip to use generic workout plans.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = ['overview', 'equipment', 'attendance', 'offers'];

  return (
    <div className="min-h-screen bg-background">
      <TopBar title="My Gym" showBack backTo="/" />

      <div className="max-w-lg mx-auto px-4 pb-24">
        {/* Gym Hero */}
        <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-3xl p-5 mt-4 text-accent-foreground mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs opacity-75 mb-1">Connected Gym</p>
              <h2 className="font-heading font-black text-xl">{gym?.gym_name || 'Your Gym'}</h2>
              <p className="text-xs opacity-75 flex items-center gap-1 mt-1">
                <MapPin size={11} /> {gym?.city || 'Location not set'}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              membership?.status === 'active' ? 'bg-white/25' :
              membership?.status === 'pending' ? 'bg-amber-400/30 text-amber-200' :
              'bg-white/15'
            }`}>
              {membership?.status === 'active' ? '✓ Active' :
               membership?.status === 'pending' ? '⏳ Pending' : 'Member'}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs opacity-80 mb-4">
            <span className="flex items-center gap-1"><Clock size={11} /> {gym?.opening_time || '6:00'} – {gym?.closing_time || '22:00'}</span>
            <span className="flex items-center gap-1"><Users size={11} /> {thisMonthAttendance.length} visits this month</span>
          </div>
          {/* Check-in / Check-out */}
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className={`w-full h-12 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
              todayLog?.status === 'checked_in'
                ? 'bg-white/20 border-2 border-white/40'
                : 'bg-white text-accent'
            }`}
          >
            {todayLog?.status === 'checked_in' ? (
              <><LogOut size={16} /> Check Out — Since {todayLog.check_in_time}</>
            ) : (
              <><LogIn size={16} /> Check In to Gym</>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all capitalize ${
                activeTab === t ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
              }`}>
              {t === 'overview' ? 'Overview' : t === 'equipment' ? 'Equipment' : t === 'attendance' ? 'Attendance' : 'Offers'}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'This Month', value: thisMonthAttendance.length, unit: 'visits', color: 'text-accent' },
                { label: 'Streak', value: attendance.length > 0 ? Math.min(7, attendance.length) : 0, unit: 'days', color: 'text-blue-400' },
                { label: 'Total', value: membership?.total_visits || 0, unit: 'visits', color: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="bg-card border border-border rounded-2xl p-3 text-center">
                  <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.unit}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Gym Details */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="font-semibold text-sm">Gym Details</p>
              {[
                { icon: MapPin, label: 'Address', value: gym?.address || 'Not provided' },
                { icon: Clock, label: 'Timings', value: `${gym?.opening_time || '6:00'} – ${gym?.closing_time || '22:00'}` },
                { icon: Star, label: 'Rating', value: `${gym?.rating || 4.5} ★` },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <item.icon size={13} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-sm flex items-center gap-1.5"><Bell size={14} className="text-accent" /> Announcements</p>
                {announcements.map(a => (
                  <div key={a.id} className="bg-accent/5 border border-accent/15 rounded-xl p-3">
                    {a.title && <p className="text-xs font-semibold">{a.title}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Membership pricing */}
            {(gym?.monthly_fee || gym?.quarterly_fee || gym?.yearly_fee) && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="font-semibold text-sm mb-3">Membership Plans</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Monthly', value: gym.monthly_fee },
                    { label: 'Quarterly', value: gym.quarterly_fee },
                    { label: 'Annual', value: gym.yearly_fee },
                  ].filter(p => p.value).map(p => (
                    <div key={p.label} className="bg-accent/8 border border-accent/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">{p.label}</p>
                      <p className="font-bold text-sm text-accent mt-1">₹{p.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* EQUIPMENT */}
        {activeTab === 'equipment' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{equipment.length} items available at {gym?.gym_name}</p>
            {equipment.length === 0 ? (
              <div className="bg-muted/30 border border-border rounded-2xl p-8 text-center">
                <Dumbbell size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold">No equipment listed</p>
                <p className="text-xs text-muted-foreground mt-1">Ask your gym owner to add equipment</p>
              </div>
            ) : (
              <>
                {['cardio', 'strength_machine', 'free_weights', 'cable', 'functional', 'bodyweight', 'other'].map(cat => {
                  const items = equipment.filter(e => e.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className="bg-card border border-border rounded-2xl p-4">
                      <p className="font-semibold text-xs uppercase tracking-wider text-accent mb-3 capitalize">
                        {cat.replace('_', ' ')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {items.map(e => (
                          <div key={e.id} className="flex items-center gap-1.5 bg-accent/8 border border-accent/20 rounded-xl px-2.5 py-1.5">
                            <CheckCircle2 size={11} className="text-accent flex-shrink-0" />
                            <span className="text-xs font-medium">{e.equipment_name}</span>
                            {e.quantity > 1 && <span className="text-[10px] text-muted-foreground">×{e.quantity}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="font-black text-3xl text-accent">{thisMonthAttendance.length}</p>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <p className="font-black text-3xl text-blue-400">{membership?.total_visits || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Total visits</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-sm">Recent Visits</p>
              {attendance.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-2xl p-6 text-center">
                  <CalendarDays size={28} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-semibold">No visits yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Check in when you arrive at the gym</p>
                </div>
              ) : (
                attendance.slice().reverse().slice(0, 10).map(a => (
                  <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${a.status === 'checked_out' ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                      {a.status === 'checked_out' ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Wifi size={15} className="text-amber-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.date}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.check_in_time && `In: ${a.check_in_time}`}
                        {a.check_out_time && ` • Out: ${a.check_out_time}`}
                        {a.duration_minutes && ` • ${a.duration_minutes} min`}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === 'checked_out' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {a.status === 'checked_out' ? 'Done' : 'Active'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* OFFERS */}
        {activeTab === 'offers' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-amber-400/15 to-amber-400/5 border border-amber-400/25 rounded-2xl p-4 text-center">
              <Gift size={28} className="text-amber-400 mx-auto mb-2" />
              <p className="font-semibold text-sm">Gym Offers & Rewards</p>
              <p className="text-xs text-muted-foreground mt-1">Offers from {gym?.gym_name} will appear here</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <Trophy size={24} className="text-accent mx-auto mb-2" />
              <p className="text-sm font-semibold">Gym Challenges</p>
              <p className="text-xs text-muted-foreground mt-1">Join challenges created by your gym</p>
              <Button onClick={() => navigate('/challenges')} variant="outline" className="mt-3 h-9 rounded-xl text-xs w-full">
                View Challenges <ChevronRight size={13} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}