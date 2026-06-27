import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Users, Dumbbell, CreditCard, TrendingUp, Shield, ChevronRight, CheckCircle, Crown, ClipboardList, MessageSquare, Mail, RefreshCw } from 'lucide-react';
import ProductionReport from '@/pages/admin/ProductionReport';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const TABS = ['Overview', 'Users', 'Gyms', 'Subscriptions', 'Support', 'Launch Report'];

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const replyHref = (ticket) => {
  const email = ticket.contact_email || ticket.user_email || '';
  const subject = encodeURIComponent(`Re: ${ticket.subject || 'SE7EN FIT Support'}`);
  return `mailto:${email}?subject=${subject}`;
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState({ users: 0, gyms: 0, activeSubs: 0, revenue: 0, openSupport: 0 });
  const [users, setUsers] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [subs, setSubs] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const u = await base44.auth.me();
    const profiles = await base44.entities.UserProfile.filter({ user_id: u.id });
    const isAdmin = u.role === 'admin' || u.role === 'super_admin' || profiles[0]?.role === 'admin' || profiles[0]?.role === 'super_admin';
    if (!isAdmin) { navigate('/'); return; }
    setAuthorized(true);

    const [allProfiles, allGyms, allSubs, tickets] = await Promise.all([
      base44.entities.UserProfile.list('-created_date', 50),
      base44.entities.Gym.list('-created_date', 50),
      base44.entities.Subscription.filter({ status: 'active' }, '-created_date', 50),
      base44.entities.SupportTicket.list('-created_date', 100).catch(() => []),
    ]);

    setUsers(allProfiles);
    setGyms(allGyms);
    setSubs(allSubs);
    setSupportTickets(tickets);
    setStats({
      users: allProfiles.length,
      gyms: allGyms.length,
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

  const updateTicketStatus = async (ticket, status) => {
    await base44.entities.SupportTicket.update(ticket.id, {
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    });
    toast({ title: status === 'resolved' ? 'Support request resolved' : 'Support request reopened' });
    loadData();
  };

  if (loading) return <LoadingScreen />;
  if (!authorized) return null;

  return (
    <>
      <TopBar title="Admin Dashboard" showBack />
      <div className="px-4 py-4 pb-6 space-y-5">

        {/* Admin badge */}
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <Shield size={14} className="text-red-400" />
          <span className="text-xs font-medium text-red-400">Admin Access — Handle with care</span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-400' },
            { label: 'Gyms Listed', value: stats.gyms, icon: Dumbbell, color: 'text-accent' },
            { label: 'Active Subs', value: stats.activeSubs, icon: CreditCard, color: 'text-green-400' },
            { label: 'Open Support', value: stats.openSupport, icon: MessageSquare, color: 'text-purple-400' },
            { label: 'Revenue (₹)', value: `₹${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'text-yellow-400' },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="bg-card border border-border rounded-2xl p-4">
                <Icon size={16} className={`mb-2 ${s.color}`} />
                <p className="text-xl font-bold font-heading">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`min-w-fit flex-1 py-2 px-2 text-[11px] font-semibold rounded-lg transition-all ${activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'Users' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{users.length} registered users</p>
            {users.slice(0, 20).map(u => (
              <div key={u.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-accent">{u.full_name?.[0] || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{u.email || u.user_email || u.goal?.replace(/_/g, ' ')} • {u.fitness_level}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.role === 'premium' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
                  {u.role || 'user'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Gyms Tab */}
        {activeTab === 'Gyms' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{gyms.length} gyms listed</p>
            {gyms.map(gym => (
              <div key={gym.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-heading font-semibold text-sm">{gym.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{gym.city} • {gym.monthly_fee ? `₹${gym.monthly_fee}/mo` : 'Fees not set'}</p>
                  </div>
                  {gym.is_approved ? (
                    <span className="flex items-center gap-1 text-[10px] bg-green-400/10 text-green-400 px-2 py-1 rounded-lg font-medium">
                      <CheckCircle size={10} /> Approved
                    </span>
                  ) : (
                    <Button onClick={() => approveGym(gym)} size="sm" className="h-7 text-[10px] rounded-lg bg-accent text-accent-foreground px-2">
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {gyms.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No gyms registered yet.</p>}
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'Subscriptions' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{subs.length} active subscriptions</p>
            {subs.map(sub => (
              <div key={sub.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <Crown size={16} className="text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{sub.plan?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{sub.start_date} → {sub.end_date || 'Ongoing'}</p>
                </div>
                <p className="text-sm font-bold text-accent">₹{sub.amount || sub.paid_amount || 0}</p>
              </div>
            ))}
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'Support' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{supportTickets.length} support request{supportTickets.length === 1 ? '' : 's'}</p>
              <button onClick={loadData} className="text-xs text-accent font-semibold flex items-center gap-1">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {supportTickets.map(ticket => {
              const status = ticket.status || 'open';
              const email = ticket.contact_email || ticket.user_email || '';
              return (
                <div key={ticket.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${status === 'resolved' ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                          {status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(ticket.created_date)}</span>
                      </div>
                      <p className="font-heading font-semibold text-sm leading-snug">{ticket.subject || 'Support request'}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
                    </div>
                    <MessageSquare size={17} className="text-accent flex-shrink-0 mt-1" />
                  </div>

                  <div className="rounded-xl bg-muted/50 border border-border/50 p-3 space-y-1.5">
                    <p className="text-xs"><span className="text-muted-foreground">User:</span> {ticket.user_name || 'User'}</p>
                    <p className="text-xs break-all"><span className="text-muted-foreground">Email:</span> {email || 'Not provided'}</p>
                    {ticket.user_id && <p className="text-[10px] text-muted-foreground break-all">User ID: {ticket.user_id}</p>}
                  </div>

                  <div className="flex gap-2">
                    {email && (
                      <a href={replyHref(ticket)} className="flex-1 h-9 rounded-xl bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Mail size={13} /> Reply by Email
                      </a>
                    )}
                    <button
                      onClick={() => updateTicketStatus(ticket, status === 'resolved' ? 'open' : 'resolved')}
                      className="h-9 px-3 rounded-xl bg-muted text-xs font-semibold hover:bg-muted/80"
                    >
                      {status === 'resolved' ? 'Reopen' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>
              );
            })}

            {supportTickets.length === 0 && (
              <div className="text-center py-8 bg-card border border-border rounded-2xl">
                <ClipboardList size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold">No support requests yet</p>
                <p className="text-xs text-muted-foreground mt-1">New messages from Help & Support will appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* Launch Report Tab */}
        {activeTab === 'Launch Report' && <ProductionReport />}

        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-heading font-semibold text-sm mb-3">Platform Summary</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Users with goals set', value: users.filter(u => u.goal).length },
                  { label: 'Premium subscribers', value: subs.filter(s => s.plan !== 'free').length },
                  { label: 'Gym owner accounts', value: users.filter(u => u.role === 'gym_owner').length },
                  { label: 'Trainer accounts', value: users.filter(u => u.role === 'trainer').length },
                  { label: 'Gyms awaiting approval', value: gyms.filter(g => !g.is_approved).length },
                  { label: 'Open support requests', value: stats.openSupport },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
