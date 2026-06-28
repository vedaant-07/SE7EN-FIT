import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  BarChart3,
  Building2,
  Users,
  UserPlus,
  CalendarCheck,
  LogOut,
  RefreshCw,
  Share2,
  Settings,
  ChevronRight,
  Megaphone,
} from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api').replace(/\/+$/, '');
const timeout = (ms) => new Promise((_, reject) => window.setTimeout(() => reject(new Error('Request timed out')), ms));
const withTimeout = (promise, ms = 9000) => Promise.race([promise, timeout(ms)]);
const asArray = (value) => Array.isArray(value) ? value : [];

async function ownerRequest(path, options = {}) {
  const token = base44.auth.getToken();
  if (!token) throw new Error('Missing login session. Please login again.');
  const response = await withTimeout(fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }), 9000);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
  return payload?.items ?? payload?.item ?? payload?.data ?? payload;
}

function normalizeOwner(result, cachedUser) {
  const item = result?.item || result || {};
  const owner = item.owner || item.gym_owner || item;
  const gym = item.gym || item.gyms?.[0] || owner.gym || owner.gyms?.[0] || {};
  const user = cachedUser || item.user || {};
  return {
    id: gym.gym_id || gym.id || owner.gym_id || user.id || 'gym-owner',
    gym_id: gym.gym_id || gym.id || owner.gym_id || '',
    user_id: owner.user_id || user.id || '',
    gym_name: gym.name || gym.gym_name || owner.gym_name || 'My Gym',
    owner_name: owner.owner_name || user.full_name || user.name || 'Gym Owner',
    email: gym.email || owner.email || user.email || '',
    phone: gym.phone || owner.phone || user.phone || '',
    city: gym.city || '',
    referral_code: gym.referral_code || owner.referral_code || '',
    status: gym.status || owner.status || 'active',
    onboarding_complete: Boolean(owner.onboarding_complete || owner.onboarding_completed || gym.gym_id || gym.id),
    monthly_fee: Number(gym.monthly_fee || gym.price_monthly || owner.monthly_fee || 999),
  };
}

function StatCard({ icon: Icon, label, value, sub, onClick }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper onClick={onClick} className="bg-card border border-border rounded-2xl p-4 min-h-[112px] text-left w-full active:scale-[0.98] transition-all">
      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
        <Icon size={16} className="text-emerald-400" />
      </div>
      <p className="font-heading font-black text-xl leading-tight text-foreground">{value}</p>
      <p className="text-xs font-semibold mt-0.5 text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </Wrapper>
  );
}

function EmptyPanel({ icon: Icon, title, text }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 text-center">
      <Icon size={28} className="text-emerald-400 mx-auto mb-2" />
      <p className="font-heading font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

export default function GymOwnerDashboardStable() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [owner, setOwner] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState({ members: [], leads: [], attendance: [], reports: null });

  const signOut = () => {
    base44.auth.logout();
    navigate('/welcome', { replace: true });
  };

  const loadDashboard = async ({ background = false } = {}) => {
    if (background) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const cachedUser = base44.auth.getCachedUser?.();
      const ownerResult = await ownerRequest('/gym-owners/me');
      const nextOwner = normalizeOwner(ownerResult, cachedUser);
      if (!nextOwner.onboarding_complete) {
        navigate('/gym-owner/onboarding', { replace: true });
        return;
      }
      setOwner(nextOwner);

      const [members, leads, attendance, reports] = await Promise.all([
        ownerRequest('/gym-owner/members').catch(() => []),
        ownerRequest('/gym-owner/leads').catch(() => []),
        ownerRequest('/gym-owner/attendance').catch(() => []),
        ownerRequest('/gym-owner/reports').catch(() => null),
      ]);

      setData({ members: asArray(members), leads: asArray(leads), attendance: asArray(attendance), reports });
    } catch (err) {
      console.error('[GymOwnerDashboardStable] load failed:', err);
      const cachedUser = base44.auth.getCachedUser?.();
      if (cachedUser) {
        setOwner((current) => current || normalizeOwner({ owner: { onboarding_complete: true }, gym: { name: 'My Gym' } }, cachedUser));
        setError(err.message || 'Dashboard data could not fully load. Showing offline-safe dashboard.');
      } else {
        setError(err.message || 'Could not load gym dashboard. Please login again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const safety = window.setTimeout(() => {
      if (!active) return;
      const cachedUser = base44.auth.getCachedUser?.();
      if (cachedUser && !owner) {
        setOwner(normalizeOwner({ owner: { onboarding_complete: true }, gym: { name: 'My Gym' } }, cachedUser));
        setError('Dashboard data is taking longer than expected. Refresh after backend is live.');
        setLoading(false);
      }
    }, 10000);
    loadDashboard();
    return () => { active = false; window.clearTimeout(safety); };
  }, []);

  const metrics = useMemo(() => {
    const reports = data.reports?.metrics || data.reports || {};
    const members = Number(reports.members ?? data.members.length ?? 0);
    const leads = Number(reports.leads ?? data.leads.length ?? 0);
    const attendance = Number(reports.attendance ?? data.attendance.length ?? 0);
    const revenue = members * Number(owner?.monthly_fee || 999);
    return { members, leads, attendance, revenue };
  }, [data, owner]);

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(owner?.referral_code || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (loading) {
    return (
      <div className="dark fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
        <div className="font-display font-bold text-3xl tracking-tight">SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span></div>
        <div className="w-8 h-8 border-4 border-transparent border-t-accent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading gym dashboard...</p>
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center">
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-5 text-center">
          <Building2 size={32} className="text-emerald-400 mx-auto mb-3" />
          <h1 className="font-heading font-bold text-lg">Dashboard loading failed</h1>
          <p className="text-sm text-muted-foreground mt-2">{error || 'Please login again.'}</p>
          <button onClick={() => loadDashboard()} className="mt-5 w-full h-11 rounded-xl bg-emerald-500 text-black font-bold flex items-center justify-center gap-2"><RefreshCw size={15} /> Try Again</button>
          <button onClick={signOut} className="mt-2 w-full h-11 rounded-xl border border-border text-sm font-semibold text-muted-foreground">Login Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-lg mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"><Building2 size={17} className="text-emerald-400" /></div>
            <div className="min-w-0"><p className="font-heading font-bold text-sm truncate">{owner.gym_name}</p><p className="text-[10px] text-muted-foreground">Gym Owner Dashboard</p></div>
          </div>
          <button onClick={signOut} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center" aria-label="Sign out"><LogOut size={16} className="text-muted-foreground" /></button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-3 text-xs">{error}</div>}

        {activeTab === 'home' && (
          <>
            <div className="bg-card border border-emerald-500/30 rounded-3xl p-5 bg-gradient-to-br from-emerald-500/10 to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                  <p className="font-heading font-black text-3xl mt-1">₹{metrics.revenue.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metrics.members} members • {metrics.leads} leads</p>
                </div>
                <button onClick={() => loadDashboard({ background: true })} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center" aria-label="Refresh"><RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-400' : 'text-muted-foreground'} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Members" value={metrics.members} icon={Users} sub="Gym users" onClick={() => setActiveTab('members')} />
              <StatCard label="New Leads" value={metrics.leads} icon={UserPlus} sub="Follow up" onClick={() => setActiveTab('leads')} />
              <StatCard label="Check-ins" value={metrics.attendance} icon={CalendarCheck} sub="Attendance logs" onClick={() => setActiveTab('attendance')} />
              <StatCard label="Offers" value="Post" icon={Megaphone} sub="Gym promotions" onClick={() => setActiveTab('settings')} />
            </div>
            {owner.referral_code ? (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="text-xs text-muted-foreground">Referral Code</p><p className="font-mono font-black text-lg text-emerald-400 tracking-wider truncate">{owner.referral_code}</p></div>
                <button onClick={copyReferral} className="h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-500 text-black"><Share2 size={13} /> {copied ? 'Copied' : 'Copy'}</button>
              </div>
            ) : null}
          </>
        )}

        {activeTab === 'members' && <ListTab title="Members" text="Users connected to your gym." rows={data.members} icon={Users} empty="No members yet" />}
        {activeTab === 'leads' && <ListTab title="Leads" text="People interested in your gym." rows={data.leads} icon={UserPlus} empty="No leads yet" />}
        {activeTab === 'attendance' && <ListTab title="Attendance" text="Gym check-ins and visits." rows={data.attendance} icon={CalendarCheck} empty="No attendance yet" />}
        {activeTab === 'settings' && (
          <div className="space-y-3">
            <div><h2 className="font-heading font-bold text-lg">Gym Settings</h2><p className="text-xs text-muted-foreground">Manage setup and refresh dashboard data.</p></div>
            <button onClick={() => navigate('/gym-owner/onboarding')} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left"><Settings size={18} className="text-emerald-400" /><div className="flex-1"><p className="font-semibold text-sm">Edit Gym Profile</p><p className="text-xs text-muted-foreground">Update gym information</p></div><ChevronRight size={16} className="text-muted-foreground" /></button>
            <button onClick={() => loadDashboard({ background: true })} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left"><RefreshCw size={18} className="text-emerald-400" /><div className="flex-1"><p className="font-semibold text-sm">Refresh Dashboard</p><p className="text-xs text-muted-foreground">Reload latest backend data</p></div><ChevronRight size={16} className="text-muted-foreground" /></button>
            <button onClick={signOut} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left"><LogOut size={18} className="text-red-400" /><div className="flex-1"><p className="font-semibold text-sm">Sign Out</p><p className="text-xs text-muted-foreground">Logout from gym owner account</p></div><ChevronRight size={16} className="text-muted-foreground" /></button>
          </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function ListTab({ title, text, rows, icon: Icon, empty }) {
  return (
    <div className="space-y-3">
      <div><h2 className="font-heading font-bold text-lg">{title}</h2><p className="text-xs text-muted-foreground">{text}</p></div>
      {rows.length === 0 ? <EmptyPanel icon={Icon} title={empty} text="Live production data will appear here after users interact with your gym." /> : rows.slice(0, 30).map((row, index) => (
        <div key={row.id || row.membership_id || row.lead_id || row.log_id || index} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold"><Icon size={16} /></div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{row.name || row.user_name || row.full_name || row.email || row.phone || title.slice(0, -1)}</p>
            <p className="text-[10px] text-muted-foreground truncate">{row.email || row.phone || row.status || row.date || row.created_at || 'Production record'}</p>
          </div>
          <span className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground uppercase">{row.status || 'active'}</span>
        </div>
      ))}
    </div>
  );
}

function BottomNav({ activeTab, setActiveTab }) {
  const items = [
    { key: 'home', label: 'Home', icon: BarChart3 },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'leads', label: 'Leads', icon: UserPlus },
    { key: 'attendance', label: 'Check-ins', icon: CalendarCheck },
    { key: 'settings', label: 'More', icon: Settings },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-lg mx-auto h-[68px] px-2 grid grid-cols-5">
        {items.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return <button key={key} onClick={() => setActiveTab(key)} className={`flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${active ? 'text-emerald-400' : 'text-muted-foreground'}`}><Icon size={20} strokeWidth={active ? 2.2 : 1.8} /><span className="text-[9px] font-semibold leading-none">{label}</span></button>;
        })}
      </div>
    </nav>
  );
}
