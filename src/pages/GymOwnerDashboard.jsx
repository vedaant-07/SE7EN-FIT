import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import GymEquipmentManager from '@/pages/gym-owner/GymEquipmentManager';
import {
  Building2, Users, Star, Bell, Settings, Plus,
  Trophy, Gift, Share2, LogOut, Clock, MapPin, Check, X, CalendarCheck,
  BarChart3, MessageSquare, Phone, Mail, Coins, UserPlus,
  Edit3, Send, TrendingUp, ChevronRight, Home, Dumbbell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const BOTTOM_NAV = [
  { key: 'overview', label: 'Home', icon: Home },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'leads', label: 'Leads', icon: UserPlus },
  { key: 'earnings', label: 'Earnings', icon: Coins },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const MORE_TABS = [
  { key: 'profile', label: 'Gym Profile', icon: Building2 },
  { key: 'equipment', label: 'Equipment', icon: Dumbbell },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'challenges', label: 'Challenges', icon: Trophy },
  { key: 'rewards', label: 'Rewards', icon: Gift },
  { key: 'referrals', label: 'Referrals', icon: Share2 },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'announcements', label: 'Announcements', icon: Bell },
];

const LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];

const statusColors = {
  active: 'bg-emerald-500/15 text-emerald-400',
  expired: 'bg-red-500/15 text-red-400',
  pending: 'bg-amber-500/15 text-amber-400',
  new: 'bg-blue-500/15 text-blue-400',
  contacted: 'bg-purple-500/15 text-purple-400',
  converted: 'bg-emerald-500/15 text-emerald-400',
  lost: 'bg-muted text-muted-foreground',
};

const MOCK_MEMBERS = [
  { name: 'Rahul Sharma', plan: 'Monthly', status: 'active', joined: '2026-06-01', phone: '9876543210' },
  { name: 'Priya Singh', plan: 'Quarterly', status: 'active', joined: '2026-05-15', phone: '9123456789' },
  { name: 'Amit Kumar', plan: 'Monthly', status: 'expired', joined: '2026-04-01', phone: '9988776655' },
  { name: 'Neha Gupta', plan: 'Annual', status: 'active', joined: '2026-01-10', phone: '9012345678' },
  { name: 'Vikram Mehta', plan: 'Monthly', status: 'pending', joined: '2026-06-15', phone: '9876501234' },
];

export default function GymOwnerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [leads, setLeads] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const [replyTexts, setReplyTexts] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
      if (owners.length === 0) {
        const newOwner = await base44.entities.GymOwner.create({
          user_id: user.id,
          owner_name: user.full_name || 'Gym Owner',
          gym_name: 'My Gym',
          onboarding_complete: false,
        });
        setOwner(newOwner);
        setLoading(false);
        return;
      }
      setOwner(owners[0]);
      const [gymLeads, gymReviews, gymMemberships, gymAttendance] = await Promise.all([
        base44.entities.GymLead.filter({ owner_id: user.id }),
        base44.entities.GymReview.filter({ gym_id: owners[0].id }),
        base44.entities.UserGymMembership.filter({ gym_id: owners[0].id }),
        base44.entities.GymAttendanceLog.filter({ gym_id: owners[0].id }),
      ]);
      setLeads(gymLeads);
      setReviews(gymReviews);
      setMemberships(gymMemberships);
      setAttendanceLogs(gymAttendance);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateLeadStatus = async (leadId, status) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    await base44.entities.GymLead.update(leadId, { status });
    toast({ title: `Lead marked as ${status}` });
  };

  const sendReply = async (reviewId) => {
    const reply = replyTexts[reviewId];
    if (!reply?.trim()) return;
    await base44.entities.GymReview.update(reviewId, { owner_reply: reply });
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, owner_reply: reply } : r));
    setReplyTexts(prev => ({ ...prev, [reviewId]: '' }));
    toast({ title: 'Reply sent!' });
  };

  if (loading) return <LoadingScreen />;
  if (!owner) return null;

  const today = new Date().toISOString().split('T')[0];
  const activeMembers = memberships.filter(m => m.status === 'active').length;
  const pendingMembers = memberships.filter(m => m.status === 'pending').length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const todayAttendance = attendanceLogs.filter(a => a.date === today).length;
  const totalRealMembers = memberships.length || MOCK_MEMBERS.length;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : (owner.rating || 4.5);

  const tabLabel = [...BOTTOM_NAV, ...MORE_TABS].find(t => t.key === activeTab)?.label || '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
              <Building2 size={15} className="text-accent" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm leading-none">{owner.gym_name || 'My Gym'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{tabLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${owner.is_approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {owner.is_approved ? '● Live' : '● Pending'}
            </div>
            <button onClick={() => setActiveTab('announcements')}
              className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center relative hover:bg-muted transition-colors">
              <Bell size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <>
              {/* Revenue Hero Card */}
              <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-3xl p-5 text-accent-foreground">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">Monthly Revenue</p>
                    <p className="font-heading font-black text-3xl mt-1">₹{(activeMembers * (owner.monthly_fee || 999)).toLocaleString()}</p>
                    <p className="text-xs opacity-70 mt-0.5">June 2026 • {activeMembers} active members</p>
                  </div>
                  <div className="bg-white/20 rounded-2xl p-3">
                    <TrendingUp size={22} />
                  </div>
                </div>
                <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: '72%' }} />
                </div>
                <p className="text-[11px] opacity-70 mt-1.5">72% of monthly target</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Members', value: totalRealMembers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
                  { label: 'New Leads', value: newLeads, icon: UserPlus, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
                  { label: 'Today Check-ins', value: todayAttendance, icon: CalendarCheck, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
                  { label: 'Pending Approval', value: pendingMembers, icon: Bell, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`bg-card border ${s.border} rounded-2xl p-4`}>
                      <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                        <Icon size={16} className={s.color} />
                      </div>
                      <p className={`font-heading font-black text-2xl ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* More Features */}
              <div>
                <p className="font-heading font-semibold text-sm mb-3">More Features</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {MORE_TABS.map(item => {

                    const Icon = item.icon;
                    return (
                      <button key={item.key} onClick={() => setActiveTab(item.key)}
                        className="bg-card border border-border rounded-2xl p-3.5 flex flex-col items-center gap-2 hover:border-accent/30 active:scale-95 transition-all">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                          <Icon size={16} className="text-accent" />
                        </div>
                        <span className="text-[10px] font-semibold text-center leading-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Referral Code Quick Access */}
              {owner.referral_code && (
                <div className="bg-accent/8 border border-accent/25 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Referral Code — share to get members</p>
                    <p className="font-mono font-black text-lg text-accent tracking-wider mt-0.5">{owner.referral_code}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(owner.referral_code); toast({ title: '✅ Copied!' }); }}
                    className="bg-accent text-accent-foreground px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all">
                    Copy
                  </button>
                </div>
              )}

              {/* Recent Activity */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-heading font-semibold text-sm">Recent Members</p>
                  <button onClick={() => setActiveTab('members')} className="text-xs text-accent font-medium">See all</button>
                </div>
                <div className="space-y-2">
                  {MOCK_MEMBERS.slice(0, 3).map((m, i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-black text-accent">{m.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.plan} • {m.joined}</p>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusColors[m.status]}`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── MEMBERS ── */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-bold text-lg">Members</p>
                  <p className="text-xs text-muted-foreground">{memberships.length} linked • {activeMembers} active</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Active', count: activeMembers, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Pending', count: pendingMembers, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                  { label: 'Rejected', count: memberships.filter(m => m.status === 'rejected').length, color: 'text-red-400', bg: 'bg-red-400/10' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                    <p className={`font-black text-xl ${s.color}`}>{s.count}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {memberships.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-2xl p-8 text-center">
                  <Users size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold">No members yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Share your referral code to get members</p>
                  <div className="mt-3 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
                    <p className="text-xs text-muted-foreground">Your code</p>
                    <p className="font-mono font-bold text-accent">{owner.referral_code || 'Set in profile'}</p>
                  </div>
                </div>
              ) : (
                memberships.map((m) => (
                  <div key={m.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <span className="font-black text-accent text-sm">{(m.user_id || 'U')[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">Member #{m.user_id?.slice(-6) || '------'}</p>
                        <p className="text-xs text-muted-foreground">Joined {m.joined_at || 'Recently'}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Code: {m.referral_code_used || 'N/A'} • {m.total_visits || 0} visits</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${statusColors[m.status] || 'bg-muted text-muted-foreground'}`}>
                          {m.status}
                        </span>
                        {m.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={async () => {
                                await base44.entities.UserGymMembership.update(m.id, { status: 'active', approved_at: new Date().toISOString().split('T')[0] });
                                setMemberships(prev => prev.map(x => x.id === m.id ? { ...x, status: 'active' } : x));
                                toast({ title: '✅ Member approved!' });
                              }}
                              className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                              <Check size={12} className="text-emerald-400" />
                            </button>
                            <button
                              onClick={async () => {
                                await base44.entities.UserGymMembership.update(m.id, { status: 'rejected' });
                                setMemberships(prev => prev.map(x => x.id === m.id ? { ...x, status: 'rejected' } : x));
                                toast({ title: 'Member rejected' });
                              }}
                              className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                              <X size={12} className="text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── LEADS ── */}
          {activeTab === 'leads' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-bold text-lg">Leads</p>
                  <p className="text-xs text-muted-foreground">{leads.length} total • {newLeads} new</p>
                </div>
                <span className="bg-blue-500/15 text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-xl">{newLeads} New</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {LEAD_STATUSES.map(s => (
                  <div key={s} className="bg-card border border-border rounded-xl p-2.5 text-center">
                    <p className="font-black text-lg">{leads.filter(l => l.status === s).length}</p>
                    <p className="text-[9px] text-muted-foreground capitalize mt-0.5">{s}</p>
                  </div>
                ))}
              </div>
              {leads.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-2xl p-10 text-center">
                  <UserPlus size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold">No leads yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Enquiries from the app appear here</p>
                </div>
              ) : (
                leads.map(lead => (
                  <div key={lead.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.mobile} • {lead.city}</p>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusColors[lead.status]}`}>
                        {lead.status}
                      </span>
                    </div>
                    {lead.notes && <p className="text-xs text-muted-foreground mb-2 italic">"{lead.notes}"</p>}
                    <div className="flex gap-1.5 flex-wrap">
                      {LEAD_STATUSES.filter(s => s !== lead.status).map(s => (
                        <button key={s} onClick={() => updateLeadStatus(lead.id, s)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-muted hover:bg-muted/60 transition-all capitalize">
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── EARNINGS ── */}
          {activeTab === 'earnings' && (
            <div className="space-y-4">
              <p className="font-heading font-bold text-lg">Earnings</p>
              <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-3xl p-5 text-accent-foreground">
                <p className="text-sm opacity-80">This Month</p>
                <p className="font-heading font-black text-3xl mt-1">₹{(activeMembers * (owner.monthly_fee || 999)).toLocaleString()}</p>
                <p className="text-xs opacity-70 mt-1">June 2026</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Last Month', value: '₹38,200', color: 'text-blue-400', border: 'border-blue-400/20' },
                  { label: 'Referral Earn', value: '₹3,600', color: 'text-amber-400', border: 'border-amber-400/20' },
                  { label: 'Total 2026', value: '₹2,15,400', color: 'text-purple-400', border: 'border-purple-400/20' },
                  { label: 'Avg/Member', value: `₹${owner.monthly_fee || 999}`, color: 'text-emerald-400', border: 'border-emerald-400/20' },
                ].map(e => (
                  <div key={e.label} className={`bg-card border ${e.border} rounded-2xl p-4`}>
                    <p className="text-xs text-muted-foreground">{e.label}</p>
                    <p className={`font-heading font-black text-xl mt-1.5 ${e.color}`}>{e.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-muted/30 border border-border rounded-2xl p-5 text-center">
                <Coins size={30} className="text-accent mx-auto mb-2" />
                <p className="text-sm font-semibold">Bank Payout Setup</p>
                <p className="text-xs text-muted-foreground mt-1">Direct bank payouts — coming soon</p>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              <p className="font-heading font-bold text-lg">Settings</p>
              {/* Profile Card */}
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{owner.gym_name || 'My Gym'}</p>
                  <p className="text-xs text-muted-foreground">{owner.owner_name || 'Owner'}</p>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${owner.is_approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {owner.is_approved ? '✓ Live' : '⏳ Pending'}
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Edit Gym Profile', action: () => navigate('/gym-owner/onboarding'), icon: Edit3, desc: 'Update gym info, timings, pricing' },
                  { label: 'Notification Preferences', action: () => {}, icon: Bell, desc: 'Manage alert settings' },
                  { label: 'Subscription & Billing', action: () => {}, icon: Coins, desc: 'View plans & invoices' },
                  { label: 'Help & Support', action: () => {}, icon: MessageSquare, desc: 'Get help anytime' },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-accent/30 active:scale-[0.99] transition-all">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <item.icon size={15} className="text-accent" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <ChevronRight size={15} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
              <button
                onClick={() => { base44.auth.logout(); navigate('/welcome'); }}
                className="w-full bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-400 active:scale-[0.99] transition-all">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <LogOut size={15} className="text-red-400" />
                </div>
                <span className="flex-1 text-sm font-semibold text-left">Sign Out</span>
              </button>
            </div>
          )}

          {/* ── GYM PROFILE ── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <p className="font-heading font-bold text-lg">Gym Profile</p>
              <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                {[
                  { label: 'Gym Name', value: owner.gym_name || 'Not set', icon: Building2 },
                  { label: 'City', value: owner.city || 'Not set', icon: MapPin },
                  { label: 'Address', value: owner.address || 'Not set', icon: MapPin },
                  { label: 'Timings', value: `${owner.opening_time || '6:00'} – ${owner.closing_time || '22:00'}`, icon: Clock },
                  { label: 'Email', value: owner.email || 'Not set', icon: Mail },
                  { label: 'Mobile', value: owner.mobile || 'Not set', icon: Phone },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon size={13} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{item.label}</p>
                      <p className="text-sm font-medium mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="font-heading font-semibold text-sm mb-3">Membership Pricing</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Monthly', value: owner.monthly_fee || 999 },
                    { label: 'Quarterly', value: owner.quarterly_fee || 2499 },
                    { label: 'Annual', value: owner.yearly_fee || 7999 },
                  ].map(p => (
                    <div key={p.label} className="bg-accent/8 border border-accent/20 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">{p.label}</p>
                      <p className="font-bold text-sm text-accent mt-1">₹{p.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              {owner.facilities?.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="font-heading font-semibold text-sm mb-3">Facilities</p>
                  <div className="flex flex-wrap gap-2">
                    {owner.facilities.map(f => (
                      <span key={f} className="text-[11px] bg-accent/10 text-accent px-2.5 py-1 rounded-full font-medium">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={() => navigate('/gym-owner/onboarding')} className="w-full h-12 rounded-2xl bg-accent text-accent-foreground">
                <Edit3 size={15} className="mr-2" /> Edit Gym Profile
              </Button>
            </div>
          )}

          {/* ── EQUIPMENT ── */}
          {activeTab === 'equipment' && owner && (
            <GymEquipmentManager gymId={owner.id} ownerId={owner.user_id} />
          )}

          {/* ── ATTENDANCE ── */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <p className="font-heading font-bold text-lg">Attendance</p>
              <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-3xl p-5 text-accent-foreground">
                <p className="text-sm opacity-80 mb-4">Today's Check-ins</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="font-black text-3xl">{todayAttendance}</p><p className="text-xs opacity-70 mt-0.5">Present</p></div>
                  <div><p className="font-black text-3xl">{Math.max(0, totalRealMembers - todayAttendance)}</p><p className="text-xs opacity-70 mt-0.5">Absent</p></div>
                  <div><p className="font-black text-3xl">{totalRealMembers > 0 ? Math.round((todayAttendance / totalRealMembers) * 100) : 0}%</p><p className="text-xs opacity-70 mt-0.5">Rate</p></div>
                </div>
                <div className="bg-white/25 rounded-full h-2 mt-4 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${totalRealMembers > 0 ? Math.round((todayAttendance / totalRealMembers) * 100) : 0}%` }} />
                </div>
              </div>
              {attendanceLogs.filter(a => a.date === today).length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Today's Check-ins</p>
                  {attendanceLogs.filter(a => a.date === today).map(a => (
                    <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-accent">M</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Member #{a.user_id?.slice(-6)}</p>
                        <p className="text-xs text-muted-foreground">In: {a.check_in_time}{a.check_out_time ? ` • Out: ${a.check_out_time}` : ' • Still inside'}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === 'checked_out' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {a.status === 'checked_out' ? 'Left' : 'Inside'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-muted/30 border border-border rounded-2xl p-6 text-center">
                <CalendarCheck size={32} className="text-accent mx-auto mb-3" />
                <p className="text-sm font-semibold">QR Code Check-In</p>
                <p className="text-xs text-muted-foreground mt-1">Generate QR for member check-in — coming soon</p>
              </div>
            </div>
          )}

          {/* ── CHALLENGES ── */}
          {activeTab === 'challenges' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-lg">Challenges</p>
                <button className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-2 rounded-xl text-xs font-semibold">
                  <Plus size={13} /> Create
                </button>
              </div>
              {['30-Day Transformation', '10K Steps Weekly', 'Best Attendance'].map((c, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm">{c}</p>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full font-semibold">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2.5">
                    <span>{[12, 8, 20][i]} participants</span>
                    <span>{[18, 4, 12][i]} days left</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${[60, 40, 80][i]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── REWARDS ── */}
          {activeTab === 'rewards' && (
            <div className="space-y-3">
              <p className="font-heading font-bold text-lg">Rewards</p>
              <div className="bg-gradient-to-br from-amber-400/20 to-amber-400/5 border border-amber-400/25 rounded-2xl p-4">
                <p className="font-semibold text-sm mb-1">Create Reward Offer</p>
                <p className="text-xs text-muted-foreground">Offer discounts & perks to loyal members</p>
                <Button className="mt-3 h-9 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-400/90">
                  <Plus size={13} className="mr-1" /> Create Offer
                </Button>
              </div>
              {['Free Month for Referral', '10% Off Annual Plan', 'Free PT Session'].map((r, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center flex-shrink-0">
                    <Gift size={16} className="text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{r}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{[3, 7, 2][i]} redeemed</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full font-semibold">Active</span>
                </div>
              ))}
            </div>
          )}

          {/* ── REFERRALS ── */}
          {activeTab === 'referrals' && (
            <div className="space-y-4">
              <p className="font-heading font-bold text-lg">Referrals</p>
              <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">🔑 Your Gym Referral Code</p>
                <p className="text-[11px] text-muted-foreground mb-3">Share this code with members so they can link your gym during signup</p>
                <div className="flex items-center justify-between bg-background/60 border border-accent/30 rounded-xl px-4 py-3">
                  <span className="font-mono font-black text-2xl tracking-widest text-accent">{owner.referral_code || '—'}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(owner.referral_code || ''); toast({ title: '✅ Copied to clipboard!' }); }}
                    className="text-xs text-accent font-semibold bg-accent/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
                    Copy
                  </button>
                </div>
                {!owner.referral_code && (
                  <p className="text-xs text-amber-400 mt-2">⚠️ Complete your gym profile to generate a referral code</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Referrals', value: '24', color: 'text-blue-400', border: 'border-blue-400/20' },
                  { label: 'Converted', value: '18', color: 'text-emerald-400', border: 'border-emerald-400/20' },
                  { label: 'Pending', value: '6', color: 'text-amber-400', border: 'border-amber-400/20' },
                  { label: 'Earnings', value: '₹3,600', color: 'text-purple-400', border: 'border-purple-400/20' },
                ].map(s => (
                  <div key={s.label} className={`bg-card border ${s.border} rounded-2xl p-4`}>
                    <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── REVIEWS ── */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              <p className="font-heading font-bold text-lg">Reviews</p>
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-5">
                <div className="text-center">
                  <p className="font-black text-5xl text-accent leading-none">{avgRating}</p>
                  <div className="flex gap-0.5 justify-center mt-2">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={13} className={parseFloat(avgRating) >= s ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{reviews.length} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(star => {
                    const count = reviews.filter(r => Math.round(r.rating) === star).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : (star === 5 ? 70 : star === 4 ? 20 : 10);
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-3">{star}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {reviews.length === 0 ? (
                <div className="bg-muted/30 border border-border rounded-2xl p-10 text-center">
                  <Star size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold">No reviews yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Member reviews will appear here</p>
                </div>
              ) : reviews.map(review => (
                <div key={review.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{review.user_name || 'Anonymous'}</p>
                      <div className="flex gap-0.5 mt-0.5">
                        {[1,2,3,4,5].map(s => <Star key={s} size={11} className={review.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />)}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{review.created_date ? new Date(review.created_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
                  </div>
                  {review.review_text && <p className="text-sm text-muted-foreground leading-relaxed mb-3">"{review.review_text}"</p>}
                  {review.owner_reply ? (
                    <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
                      <p className="text-[10px] text-accent font-semibold mb-1">Your Reply</p>
                      <p className="text-xs text-muted-foreground">{review.owner_reply}</p>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={replyTexts[review.id] || ''}
                        onChange={(e) => setReplyTexts(prev => ({ ...prev, [review.id]: e.target.value }))}
                        placeholder="Reply to this review..."
                        className="flex-1 h-9 px-3 rounded-xl border border-input bg-muted/40 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button onClick={() => sendReply(review.id)} className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                        <Send size={13} className="text-accent-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {activeTab === 'announcements' && (
            <div className="space-y-3">
              <p className="font-heading font-bold text-lg">Announcements</p>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-semibold mb-3">Send to All Members</p>
                <textarea
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="Write your message to all gym members..."
                  className="w-full h-24 px-3 py-2 rounded-xl border border-input bg-muted/40 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                onClick={async () => {
                  if (announcement.trim() && owner) {
                    await base44.entities.GymAnnouncement.create({
                      gym_id: owner.id,
                      owner_id: owner.user_id,
                      message: announcement.trim(),
                      is_active: true,
                    });
                    toast({ title: '📢 Announcement sent!' });
                    setAnnouncement('');
                  }
                }}
                className="mt-2.5 h-11 rounded-xl bg-accent text-accent-foreground text-sm w-full font-semibold"
                >
                  <Send size={14} className="mr-2" /> Send Announcement
                </Button>
              </div>
              <p className="text-xs font-semibold text-muted-foreground px-1">Recent</p>
              {['New batch starting Monday!', 'Holiday closure on Sunday', 'New equipment installed 🏋️'].map((a, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-sm font-medium">{a}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{['2 days ago', '5 days ago', '1 week ago'][i]}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 h-16">
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button key={item.key} onClick={() => setActiveTab(item.key)}
                className="flex flex-col items-center gap-1 flex-1 py-2 transition-all active:scale-95">
                <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-accent' : ''}`}>
                  <Icon size={18} className={isActive ? 'text-accent-foreground' : 'text-muted-foreground'} />
                </div>
                <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}