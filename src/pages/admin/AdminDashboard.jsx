import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Users, Dumbbell, CreditCard, TrendingUp, Shield, CheckCircle, Crown, ClipboardList, MessageSquare, Mail, RefreshCw, Building2, Ban, Power } from 'lucide-react';
import ProductionReport from '@/pages/admin/ProductionReport';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api').replace(/\/+$/, '');
const TABS = ['Overview', 'Users', 'Gym Owners', 'Gyms', 'Subscriptions', 'Support', 'Launch Report'];

const formatDate = (value) => {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return value; }
};

const replyHref = (ticket) => {
  const email = ticket.contact_email || ticket.user_email || '';
  const subject = encodeURIComponent(`Re: ${ticket.subject || 'SE7EN FIT Support'}`);
  return `mailto:${email}?subject=${subject}`;
};

async function adminRequest(path, options = {}) {
  const token = base44.auth.getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || 'Admin request failed');
  return data;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState({ users: 0, gyms: 0, gymOwners: 0, pendingOwners: 0, activeSubs: 0, revenue: 0, openSupport: 0 });
  const [users, setUsers] = useState([]);
  const [gymOwners, setGymOwners] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [subs, setSubs] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const u = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_id: u.id }).catch(() => []);
    const isAdmin = ['admin', 'super_admin'].includes(u.role) || ['admin', 'super_admin'].includes(profiles[0]?.role);
    if (!isAdmin) { navigate('/'); return; }
    setAuthorized(true);

    const [allProfiles, allGyms, allSubs, tickets, ownersResponse] = await Promise.all([
      base44.entities.UserProfile.list('-created_date', 50).catch(() => []),
      base44.entities.Gym.list('-created_date', 50).catch(() => []),
      base44.entities.Subscription.filter({ status: 'active' }, '-created_date', 50).catch(() => []),
      base44.entities.SupportTicket.list('-created_date', 100).catch(() => []),
      adminRequest('/admin/gym-owners').catch(() => ({ items: [] })),
    ]);

    const owners = ownersResponse.items || [];
    setUsers(allProfiles);
    setGyms(allGyms);
    setSubs(allSubs);
    setSupportTickets(tickets);
    setGymOwners(owners);
    setStats({
      users: allProfiles.length,
      gyms: allGyms.length,
      gymOwners: owners.length,
      pendingOwners: owners.filter(o => (o.account_status || o.status) === 'pending').length,
      activeSubs: allSubs.length,
      revenue: allSubs.reduce((s, sub) => s + (sub.amount || sub.paid_amount || 0), 0),
      openSupport: tickets.filter(t => (t.status || 'open') !== 'resolved').length,
    });
    setLoading(false);
  };

  const approveGym = async (gym) => {
    await base44.entities.Gym.update(gym.id, { is_approved: true });
    toast({ title: '✓ Gym approved' });
    loadData();
  };

  const setOwnerStatus = async (owner, status) => {
    await adminRequest(`/admin/gym-owners/${owner.user_id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    toast({ title: status === 'active' ? 'Gym owner activated' : status === 'blocked' ? 'Gym owner blocked' : 'Gym owner deactivated' });
    loadData();
  };

  const updateTicketStatus = async (ticket, status) => {
    await base44.entities.SupportTicket.update(ticket.id, { status, resolved_at: status === 'resolved' ? new Date().toISOString() : null });
    toast({ title: status === 'resolved' ? 'Support request resolved' : 'Support request reopened' });
    loadData();
  };

  if (loading) return <LoadingScreen />;
  if (!authorized) return null;

  return (
    <>
      <TopBar title="Admin Dashboard" showBack />
      <div className="px-4 py-4 pb-6 space-y-5">
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"><Shield size={14} className="text-red-400" /><span className="text-xs font-medium text-red-400">Admin Access — Handle with care</span></div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-400' },
            { label: 'Gym Owners', value: stats.gymOwners, icon: Building2, color: 'text-accent' },
            { label: 'Pending Owners', value: stats.pendingOwners, icon: Shield, color: 'text-yellow-400' },
            { label: 'Gyms Listed', value: stats.gyms, icon: Dumbbell, color: 'text-accent' },
            { label: 'Active Subs', value: stats.activeSubs, icon: CreditCard, color: 'text-green-400' },
            { label: 'Open Support', value: stats.openSupport, icon: MessageSquare, color: 'text-purple-400' },
            { label: 'Revenue (₹)', value: `₹${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'text-yellow-400' },
          ].map((s, i) => { const Icon = s.icon; return <div key={i} className="bg-card border border-border rounded-2xl p-4"><Icon size={16} className={`mb-2 ${s.color}`} /><p className="text-xl font-bold font-heading">{s.value}</p><p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p></div>; })}
        </div>

        <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`min-w-fit flex-1 py-2 px-2 text-[11px] font-semibold rounded-lg transition-all ${activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{tab}</button>)}
        </div>

        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4"><p className="font-heading font-semibold">Admin Control Center</p><p className="text-xs text-muted-foreground mt-1">Approve gym owners, deactivate accounts, manage support, subscriptions, users, and gyms.</p></div>
            {stats.pendingOwners > 0 && <button onClick={() => setActiveTab('Gym Owners')} className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4 text-left"><p className="font-semibold text-yellow-400">{stats.pendingOwners} gym owner approval pending</p><p className="text-xs text-muted-foreground mt-1">Tap to review and activate accounts.</p></button>}
          </div>
        )}

        {activeTab === 'Users' && <div className="space-y-2"><p className="text-xs text-muted-foreground">{users.length} registered users</p>{users.slice(0, 20).map(u => <div key={u.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0"><span className="text-sm font-bold text-accent">{u.full_name?.[0] || '?'}</span></div><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{u.full_name || 'Unnamed'}</p><p className="text-xs text-muted-foreground truncate">{u.email || u.user_email || 'No email'}</p></div><span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">{u.role || 'user'}</span></div>)}</div>}

        {activeTab === 'Gym Owners' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{gymOwners.length} gym owner account{gymOwners.length === 1 ? '' : 's'}</p><button onClick={loadData} className="text-xs text-accent font-semibold flex items-center gap-1"><RefreshCw size={12} /> Refresh</button></div>
            {gymOwners.map(owner => {
              const status = owner.account_status || owner.status || 'pending';
              const gym = owner.gym || {};
              return <div key={owner.user_id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-heading font-semibold text-sm truncate">{owner.full_name || owner.owner?.owner_name || 'Gym Owner'}</p><p className="text-xs text-muted-foreground break-all mt-0.5">{owner.email}</p><p className="text-xs text-muted-foreground mt-0.5">{owner.phone || 'No phone'} {gym?.name ? `• ${gym.name}` : ''}</p></div><span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase ${status === 'active' ? 'bg-green-400/10 text-green-400' : status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-red-400/10 text-red-400'}`}>{status}</span></div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setOwnerStatus(owner, 'active')} size="sm" className="h-8 rounded-lg bg-accent text-accent-foreground"><CheckCircle size={13} className="mr-1" /> Approve/Activate</Button>
                  <Button onClick={() => setOwnerStatus(owner, 'deactivated')} size="sm" variant="outline" className="h-8 rounded-lg"><Power size={13} className="mr-1" /> Deactivate</Button>
                  <Button onClick={() => setOwnerStatus(owner, 'blocked')} size="sm" variant="destructive" className="h-8 rounded-lg"><Ban size={13} className="mr-1" /> Block</Button>
                </div>
              </div>;
            })}
            {gymOwners.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No gym owner accounts found.</p>}
          </div>
        )}

        {activeTab === 'Gyms' && <div className="space-y-2"><p className="text-xs text-muted-foreground">{gyms.length} gyms listed</p>{gyms.map(gym => <div key={gym.id} className="bg-card border border-border rounded-xl p-4"><div className="flex items-start justify-between gap-3"><div className="flex-1"><p className="font-heading font-semibold text-sm">{gym.name}</p><p className="text-xs text-muted-foreground mt-0.5">{gym.city} • {gym.monthly_fee ? `₹${gym.monthly_fee}/mo` : 'Fees not set'}</p></div>{gym.is_approved ? <span className="flex items-center gap-1 text-[10px] bg-green-400/10 text-green-400 px-2 py-1 rounded-lg font-medium"><CheckCircle size={10} /> Approved</span> : <Button onClick={() => approveGym(gym)} size="sm" className="h-7 text-[10px] rounded-lg bg-accent text-accent-foreground px-2">Approve</Button>}</div></div>)}{gyms.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No gyms registered yet.</p>}</div>}

        {activeTab === 'Subscriptions' && <div className="space-y-2"><p className="text-xs text-muted-foreground">{subs.length} active subscriptions</p>{subs.map(sub => <div key={sub.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"><Crown size={16} className="text-yellow-400 flex-shrink-0" /><div className="flex-1"><p className="text-sm font-medium capitalize">{sub.plan?.replace(/_/g, ' ')}</p><p className="text-xs text-muted-foreground">{sub.start_date} → {sub.end_date || 'Ongoing'}</p></div><p className="text-sm font-bold text-accent">₹{sub.amount || sub.paid_amount || 0}</p></div>)}</div>}

        {activeTab === 'Support' && <div className="space-y-3"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{supportTickets.length} support request{supportTickets.length === 1 ? '' : 's'}</p><button onClick={loadData} className="text-xs text-accent font-semibold flex items-center gap-1"><RefreshCw size={12} /> Refresh</button></div>{supportTickets.map(ticket => { const status = ticket.status || 'open'; const email = ticket.contact_email || ticket.user_email || ''; return <div key={ticket.id} className="bg-card border border-border rounded-2xl p-4 space-y-3"><div className="flex items-start justify-between gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${status === 'resolved' ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>{status}</span><span className="text-[10px] text-muted-foreground">{formatDate(ticket.created_date)}</span></div><p className="font-heading font-semibold text-sm leading-snug">{ticket.subject || 'Support request'}</p><p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">{ticket.message}</p></div><MessageSquare size={17} className="text-accent flex-shrink-0 mt-1" /></div><div className="rounded-xl bg-muted/50 border border-border/50 p-3 space-y-1.5"><p className="text-xs"><span className="text-muted-foreground">User:</span> {ticket.user_name || 'User'}</p><p className="text-xs break-all"><span className="text-muted-foreground">Email:</span> {email || 'Not provided'}</p></div><div className="flex gap-2">{email && <a href={replyHref(ticket)} className="flex-1 h-9 rounded-xl bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center gap-1.5"><Mail size={13} /> Reply by Email</a>}<button onClick={() => updateTicketStatus(ticket, status === 'resolved' ? 'open' : 'resolved')} className="h-9 px-3 rounded-xl bg-muted text-xs font-semibold hover:bg-muted/80">{status === 'resolved' ? 'Reopen' : 'Mark Resolved'}</button></div></div>; })}{supportTickets.length === 0 && <div className="text-center py-8 bg-card border border-border rounded-2xl"><ClipboardList size={28} className="text-muted-foreground mx-auto mb-2" /><p className="text-sm font-semibold">No support requests yet</p><p className="text-xs text-muted-foreground mt-1">New messages from Help & Support will appear here.</p></div>}</div>}

        {activeTab === 'Launch Report' && <ProductionReport />}
      </div>
    </>
  );
}
