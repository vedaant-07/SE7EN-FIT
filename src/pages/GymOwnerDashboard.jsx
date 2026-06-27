import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Building2, Users, UserPlus, CalendarCheck, Coins, LogOut, Settings, RefreshCw, Share2, ChevronRight } from 'lucide-react';

const safeArray = (value) => Array.isArray(value) ? value : [];

async function safeEntityList(entityCall, fallback = []) {
  try {
    return safeArray(await entityCall());
  } catch {
    return fallback;
  }
}

export default function GymOwnerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ members: [], leads: [], attendance: [] });
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      let gymOwner = null;

      try {
        gymOwner = await base44.gymOwner.getMine();
      } catch {
        const owners = await safeEntityList(() => base44.entities.GymOwner.filter({ user_id: user.id }));
        gymOwner = owners[0] || null;
      }

      if (!gymOwner) {
        try {
          gymOwner = await base44.gymOwner.upsert({
            owner_name: user.full_name || user.name || 'Gym Owner',
            email: user.email,
            gym_name: '',
            onboarding_complete: false,
          });
        } catch {
          gymOwner = {
            id: user.id,
            user_id: user.id,
            owner_name: user.full_name || user.name || 'Gym Owner',
            email: user.email,
            gym_name: 'My Gym',
            onboarding_complete: false,
          };
        }
      }

      setOwner(gymOwner);

      const [members, leads, attendance] = await Promise.all([
        safeEntityList(() => base44.entities.UserGymMembership.filter({ gym_id: gymOwner.id })),
        safeEntityList(() => base44.entities.GymLead.filter({ owner_id: user.id })),
        safeEntityList(() => base44.entities.GymAttendanceLog.filter({ gym_id: gymOwner.id })),
      ]);

      setStats({ members, leads, attendance });
    } catch (err) {
      console.error('[GymOwnerDashboard] load failed', err);
      setError(err?.message || 'Could not load gym dashboard. Please login again.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    base44.auth.logout();
    navigate('/welcome', { replace: true });
  };

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(owner?.referral_code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center">
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-5 text-center">
          <Building2 size={32} className="text-accent mx-auto mb-3" />
          <h1 className="font-heading font-bold text-lg">Dashboard loading failed</h1>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <button onClick={loadDashboard} className="mt-5 w-full h-11 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2">
            <RefreshCw size={15} /> Try Again
          </button>
          <button onClick={signOut} className="mt-2 w-full h-11 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
            Login Again
          </button>
        </div>
      </div>
    );
  }

  if (!owner?.onboarding_complete) {
    return (
      <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center">
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-accent" />
          </div>
          <h1 className="font-heading font-bold text-xl">Complete Gym Setup</h1>
          <p className="text-sm text-muted-foreground mt-2">Your gym owner account is active. Complete onboarding to unlock the dashboard.</p>
          <button onClick={() => navigate('/gym-owner/onboarding', { replace: true })} className="mt-5 w-full h-12 rounded-xl bg-white text-black font-bold">
            Continue Setup
          </button>
          <button onClick={signOut} className="mt-2 w-full h-11 rounded-xl border border-border text-sm font-semibold text-muted-foreground">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const activeMembers = stats.members.filter(m => m.status === 'active').length;
  const pendingMembers = stats.members.filter(m => m.status === 'pending').length;
  const newLeads = stats.leads.filter(l => l.status === 'new').length;
  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = stats.attendance.filter(a => a.date === today).length;
  const monthlyRevenue = activeMembers * Number(owner.monthly_fee || 999);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-lg mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={17} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm truncate">{owner.gym_name || 'My Gym'}</p>
              <p className="text-[10px] text-muted-foreground">Gym Owner Dashboard</p>
            </div>
          </div>
          <button onClick={signOut} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
            <LogOut size={16} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="bg-card border border-border rounded-3xl p-5">
          <p className="text-xs text-muted-foreground">Monthly Revenue</p>
          <p className="font-heading font-black text-3xl mt-1">₹{monthlyRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground mt-1">{activeMembers} active members • {pendingMembers} pending</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Members', value: stats.members.length, icon: Users, sub: `${activeMembers} active` },
            { label: 'New Leads', value: newLeads, icon: UserPlus, sub: `${stats.leads.length} total` },
            { label: 'Today Check-ins', value: todayAttendance, icon: CalendarCheck, sub: today },
            { label: 'Earnings', value: `₹${monthlyRevenue.toLocaleString('en-IN')}`, icon: Coins, sub: 'This month' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-card border border-border rounded-2xl p-4">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                  <Icon size={16} className="text-accent" />
                </div>
                <p className="font-heading font-black text-xl">{item.value}</p>
                <p className="text-xs font-semibold mt-0.5">{item.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
              </div>
            );
          })}
        </div>

        {owner.referral_code && (
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Referral Code</p>
              <p className="font-mono font-black text-lg text-accent tracking-wider truncate">{owner.referral_code}</p>
            </div>
            <button onClick={copyReferral} className="h-10 px-4 rounded-xl bg-white text-black text-xs font-bold flex items-center gap-2">
              <Share2 size={13} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={() => navigate('/gym-owner/onboarding')} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left">
            <Settings size={18} className="text-accent" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Edit Gym Profile</p>
              <p className="text-xs text-muted-foreground">Update gym info, timings and pricing</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>

          <button onClick={loadDashboard} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left">
            <RefreshCw size={18} className="text-accent" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Refresh Dashboard</p>
              <p className="text-xs text-muted-foreground">Reload latest members and leads</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>
      </main>
    </div>
  );
}
