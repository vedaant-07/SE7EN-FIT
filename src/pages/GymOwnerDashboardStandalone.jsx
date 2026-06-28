import React, { useEffect, useState } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api').replace(/\/+$/, '');
const TOKEN_KEY = 'se7enfit_auth_token';
const USER_KEY = 'se7enfit_user';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('se7enfit_auth');
  } catch {}
}

async function api(path, token) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    return payload?.item ?? payload?.items ?? payload?.data ?? payload;
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeOwner(raw, cachedUser) {
  const item = raw?.item || raw || {};
  const owner = item.owner || item.gym_owner || item;
  const gym = item.gym || item.gyms?.[0] || owner.gym || owner.gyms?.[0] || {};
  const user = cachedUser || item.user || {};
  return {
    gymName: gym.name || gym.gym_name || owner.gym_name || 'My Gym',
    ownerName: owner.owner_name || user.full_name || user.name || 'Gym Owner',
    email: gym.email || owner.email || user.email || '',
    phone: gym.phone || owner.phone || user.phone || '',
    referralCode: gym.referral_code || owner.referral_code || '',
    status: gym.status || owner.status || 'active',
    monthlyFee: Number(gym.monthly_fee || gym.price_monthly || owner.monthly_fee || 999),
    onboardingComplete: Boolean(owner.onboarding_complete || gym.gym_id || gym.id),
  };
}

function Card({ title, value, sub, onClick }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left active:scale-[0.98] transition">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-bold text-white">{title}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
    </button>
  );
}

function List({ title, rows, empty }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black text-white">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
          <p className="font-bold text-white">{empty}</p>
          <p className="mt-1 text-xs text-zinc-500">Production data will appear here automatically.</p>
        </div>
      ) : rows.slice(0, 30).map((row, index) => (
        <div key={row.id || row.membership_id || row.lead_id || row.log_id || index} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-sm font-bold text-white">{row.name || row.user_name || row.full_name || row.email || row.phone || title}</p>
          <p className="mt-1 text-xs text-zinc-500">{row.email || row.phone || row.status || row.date || row.created_at || 'Active record'}</p>
        </div>
      ))}
    </div>
  );
}

export default function GymOwnerDashboardStandalone() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [error, setError] = useState('');
  const [owner, setOwner] = useState(null);
  const [members, setMembers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    const token = getToken();
    const cachedUser = getCachedUser();
    if (!token) {
      setOwner(null);
      setError('Login session missing. Please login again.');
      setLoading(false);
      return;
    }

    try {
      const ownerRaw = await api('/gym-owners/me', token);
      const nextOwner = normalizeOwner(ownerRaw, cachedUser);
      if (!nextOwner.onboardingComplete) {
        window.location.href = '/gym-owner/onboarding';
        return;
      }
      setOwner(nextOwner);
      const results = await Promise.all([
        api('/gym-owner/members', token).catch(() => []),
        api('/gym-owner/leads', token).catch(() => []),
        api('/gym-owner/attendance', token).catch(() => []),
      ]);
      setMembers(Array.isArray(results[0]) ? results[0] : []);
      setLeads(Array.isArray(results[1]) ? results[1] : []);
      setAttendance(Array.isArray(results[2]) ? results[2] : []);
    } catch (err) {
      if (cachedUser) {
        setOwner(normalizeOwner({ owner: { onboarding_complete: true }, gym: { name: 'My Gym' } }, cachedUser));
        setError(err.message || 'Backend data is taking longer than expected. Showing safe dashboard.');
      } else {
        setError(err.message || 'Could not load dashboard. Please login again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const signOut = () => {
    clearSession();
    window.location.href = '/welcome';
  };

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(owner?.referralCode || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white">
        <div className="text-3xl font-black tracking-tight">SE<span className="text-emerald-400">7</span>EN <span className="text-emerald-400">FIT</span></div>
        <div className="mt-5 h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-emerald-400" />
        <p className="mt-3 text-xs text-zinc-500">Loading gym dashboard...</p>
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-black px-4 py-12 text-white flex items-center justify-center">
        <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-center">
          <h1 className="text-xl font-black">Gym Dashboard</h1>
          <p className="mt-2 text-sm text-red-400">{error}</p>
          <button onClick={() => window.location.href = '/login/gym-owner'} className="mt-5 h-12 w-full rounded-xl bg-emerald-500 font-bold text-black">Login Again</button>
        </div>
      </div>
    );
  }

  const revenue = members.length * Number(owner.monthlyFee || 999);

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-black/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div>
            <p className="text-sm font-black">{owner.gymName}</p>
            <p className="text-[10px] text-zinc-500">Gym Owner Dashboard</p>
          </div>
          <button onClick={signOut} className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300">Logout</button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}

        {tab === 'home' && (
          <>
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-zinc-950 p-5">
              <p className="text-xs text-zinc-400">Monthly Revenue</p>
              <p className="mt-1 text-3xl font-black">₹{revenue.toLocaleString('en-IN')}</p>
              <p className="mt-1 text-xs text-zinc-500">{members.length} members • {leads.length} leads</p>
              {owner.referralCode && (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/50 p-3">
                  <div><p className="text-[10px] text-zinc-500">Referral Code</p><p className="font-mono text-lg font-black text-emerald-400">{owner.referralCode}</p></div>
                  <button onClick={copyReferral} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-black">{copied ? 'Copied' : 'Copy'}</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card title="Members" value={members.length} sub="Gym users" onClick={() => setTab('members')} />
              <Card title="Leads" value={leads.length} sub="Follow ups" onClick={() => setTab('leads')} />
              <Card title="Check-ins" value={attendance.length} sub="Attendance" onClick={() => setTab('attendance')} />
              <Card title="Settings" value="Open" sub="Profile" onClick={() => setTab('settings')} />
            </div>
          </>
        )}

        {tab === 'members' && <List title="Members" rows={members} empty="No members yet" />}
        {tab === 'leads' && <List title="Leads" rows={leads} empty="No leads yet" />}
        {tab === 'attendance' && <List title="Attendance" rows={attendance} empty="No attendance yet" />}
        {tab === 'settings' && (
          <div className="space-y-3">
            <h2 className="text-lg font-black">Settings</h2>
            <button onClick={() => window.location.href = '/gym-owner/onboarding'} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left font-bold">Edit Gym Profile</button>
            <button onClick={load} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left font-bold">Refresh Dashboard</button>
            <button onClick={signOut} className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-left font-bold text-red-300">Sign Out</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-900 bg-zinc-950">
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-4 px-2">
          {[['home','Home'],['members','Members'],['leads','Leads'],['settings','More']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={tab === key ? 'text-emerald-400 text-xs font-black' : 'text-zinc-500 text-xs font-bold'}>{label}</button>
          ))}
        </div>
      </nav>
    </div>
  );
}
