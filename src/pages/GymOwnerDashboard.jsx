import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import {
  Building2, Users, TrendingUp, Star, Bell, Settings, ChevronRight, Plus,
  Trophy, Gift, Share2, LogOut, Clock, MapPin, Check, X, CalendarCheck,
  BarChart3, MessageSquare, Phone, Mail, Coins, UserPlus,
  Edit3, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'profile', label: 'Gym Profile', icon: Building2 },
  { key: 'leads', label: 'Leads', icon: UserPlus },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'challenges', label: 'Challenges', icon: Trophy },
  { key: 'rewards', label: 'Rewards', icon: Gift },
  { key: 'referrals', label: 'Referrals', icon: Share2 },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'announcements', label: 'Announcements', icon: Bell },
  { key: 'earnings', label: 'Earnings', icon: Coins },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];
const statusColors = {
  active: 'bg-accent/10 text-accent',
  expired: 'bg-destructive/10 text-destructive',
  pending: 'bg-yellow-400/10 text-yellow-400',
  new: 'bg-blue-400/10 text-blue-400',
  contacted: 'bg-purple-400/10 text-purple-400',
  converted: 'bg-accent/10 text-accent',
  lost: 'bg-muted text-muted-foreground',
};

export default function GymOwnerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [leads, setLeads] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const [replyTexts, setReplyTexts] = useState({});

  const MOCK_MEMBERS = [
    { name: 'Rahul Sharma', plan: 'Monthly', status: 'active', joined: '2026-06-01', phone: '9876543210' },
    { name: 'Priya Singh', plan: 'Quarterly', status: 'active', joined: '2026-05-15', phone: '9123456789' },
    { name: 'Amit Kumar', plan: 'Monthly', status: 'expired', joined: '2026-04-01', phone: '9988776655' },
    { name: 'Neha Gupta', plan: 'Annual', status: 'active', joined: '2026-01-10', phone: '9012345678' },
    { name: 'Vikram Mehta', plan: 'Monthly', status: 'pending', joined: '2026-06-15', phone: '9876501234' },
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
      if (owners.length === 0) {
        // Create a minimal GymOwner record so the dashboard loads
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

      const [gymLeads, gymReviews] = await Promise.all([
        base44.entities.GymLead.filter({ owner_id: user.id }),
        base44.entities.GymReview.filter({ gym_id: owners[0].id }),
      ]);
      setLeads(gymLeads);
      setReviews(gymReviews);
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

  const activeMembers = MOCK_MEMBERS.filter(m => m.status === 'active').length;
  const pendingMembers = MOCK_MEMBERS.filter(m => m.status === 'pending').length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : (owner.rating || 4.5);

  const overviewStats = [
    { label: 'Total Members', value: owner.total_members || MOCK_MEMBERS.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Active Members', value: activeMembers, icon: Check, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'New Leads', value: newLeads || owner.total_leads || 0, icon: UserPlus, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Pending Requests', value: pendingMembers, icon: Bell, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Gym Rating', value: `${avgRating}★`, icon: Star, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Converted Leads', value: convertedLeads, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-2xl border-b border-border/40"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div>
            <div className="font-display font-bold text-lg">SE<span className="text-accent">7</span>ENFIT</div>
            <div className="text-[10px] text-muted-foreground -mt-0.5">Gym Owner Dashboard</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('announcements')} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center relative">
              <Bell size={16} />
            </button>
            <button onClick={() => { base44.auth.logout(); navigate('/welcome'); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Gym hero banner */}
        <div className="px-4 pt-4 pb-2">
          <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-3xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Building2 size={22} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-base">{owner.gym_name || 'Your Gym'}</p>
                <p className="text-xs text-muted-foreground truncate">{owner.city || 'City not set'} • {owner.opening_time || '6:00'} – {owner.closing_time || '22:00'}</p>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${owner.is_approved ? 'bg-accent/20 text-accent' : 'bg-yellow-400/20 text-yellow-400'}`}>
                {owner.is_approved ? '✓ Live' : '⏳ Pending'}
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal tab nav */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.key} onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeTab === item.key ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-24 space-y-4">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {overviewStats.map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
                      <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2.5`}>
                        <Icon size={16} className={s.color} />
                      </div>
                      <p className="font-heading font-bold text-xl">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Revenue */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-heading font-semibold text-sm">Monthly Revenue</p>
                  <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">June 2026</span>
                </div>
                <p className="text-2xl font-bold font-heading text-accent">₹{(activeMembers * (owner.monthly_fee || 999)).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">From {activeMembers} active members</p>
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '72%' }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">72% of monthly target</p>
              </div>

              {/* Quick actions */}
              <div>
                <p className="font-heading font-semibold text-sm mb-2.5">Quick Actions</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Add Lead', icon: UserPlus, tab: 'leads' },
                    { label: 'Attendance', icon: CalendarCheck, tab: 'attendance' },
                    { label: 'Announce', icon: Bell, tab: 'announcements' },
                    { label: 'Members', icon: Users, tab: 'members' },
                    { label: 'Reviews', icon: Star, tab: 'reviews' },
                    { label: 'Earnings', icon: Coins, tab: 'earnings' },
                  ].map(a => (
                    <button key={a.label} onClick={() => setActiveTab(a.tab)}
                      className="bg-muted rounded-2xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-all">
                      <a.icon size={18} className="text-accent" />
                      <span className="text-[10px] font-medium text-center">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent members */}
              <div>
                <p className="font-heading font-semibold text-sm mb-2">Recent Members</p>
                <div className="space-y-2">
                  {MOCK_MEMBERS.slice(0, 3).map((m, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-accent">{m.name[0]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.plan} • {m.joined}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[m.status] || 'bg-muted text-muted-foreground'}`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── GYM PROFILE ── */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <p className="font-heading font-semibold text-sm">Gym Details</p>
                {[
                  { label: 'Gym Name', value: owner.gym_name || 'Not set', icon: Building2 },
                  { label: 'City', value: owner.city || 'Not set', icon: MapPin },
                  { label: 'Address', value: owner.address || 'Not set', icon: MapPin },
                  { label: 'Timings', value: `${owner.opening_time || '6:00'} – ${owner.closing_time || '22:00'}`, icon: Clock },
                  { label: 'Email', value: owner.email || 'Not set', icon: Mail },
                  { label: 'Mobile', value: owner.mobile || 'Not set', icon: Phone },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <item.icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-medium">{item.value}</p>
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
                    <div key={p.label} className="bg-muted rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground">{p.label}</p>
                      <p className="font-bold text-sm text-accent mt-0.5">₹{p.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {owner.facilities?.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="font-heading font-semibold text-sm mb-3">Facilities</p>
                  <div className="flex flex-wrap gap-2">
                    {owner.facilities.map(f => (
                      <span key={f} className="text-[11px] bg-accent/10 text-accent px-2.5 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {owner.referral_code && (
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <Share2 size={16} className="text-accent" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Referral Code</p>
                    <p className="font-mono font-bold text-sm">{owner.referral_code}</p>
                  </div>
                </div>
              )}

              <Button onClick={() => navigate('/gym-owner/onboarding')} variant="outline" className="w-full h-12 rounded-xl">
                <Edit3 size={15} className="mr-2" /> Edit Gym Profile
              </Button>
            </div>
          )}

          {/* ── LEADS ── */}
          {activeTab === 'leads' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-sm">Leads ({leads.length})</p>
                <span className="text-xs text-accent font-medium">{newLeads} new</span>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                {LEAD_STATUSES.map(s => (
                  <div key={s} className="bg-card border border-border rounded-xl p-2.5 text-center">
                    <p className="font-bold text-lg">{leads.filter(l => l.status === s).length}</p>
                    <p className="text-[9px] text-muted-foreground capitalize">{s}</p>
                  </div>
                ))}
              </div>

              {leads.length === 0 ? (
                <div className="bg-muted/40 border border-border rounded-2xl p-8 text-center">
                  <UserPlus size={28} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">No leads yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Leads from app referrals & enquiries appear here</p>
                </div>
              ) : (
                leads.map(lead => (
                  <div key={lead.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.mobile} • {lead.city}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColors[lead.status] || 'bg-muted text-muted-foreground'}`}>
                        {lead.status}
                      </span>
                    </div>
                    {lead.notes && <p className="text-xs text-muted-foreground mb-2 italic">"{lead.notes}"</p>}
                    <div className="flex gap-1.5 flex-wrap">
                      {LEAD_STATUSES.filter(s => s !== lead.status).map(s => (
                        <button key={s} onClick={() => updateLeadStatus(lead.id, s)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-muted hover:bg-muted/80 transition-all capitalize">
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── MEMBERS ── */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-sm">Members ({MOCK_MEMBERS.length})</p>
                <button className="flex items-center gap-1 text-xs text-accent font-medium">
                  <Plus size={13} /> Add Member
                </button>
              </div>
              {MOCK_MEMBERS.map((m, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-accent">{m.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.plan} • {m.phone}</p>
                    <p className="text-[10px] text-muted-foreground">Joined {m.joined}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[m.status] || 'bg-muted text-muted-foreground'}`}>
                      {m.status}
                    </span>
                    {m.status === 'pending' && (
                      <div className="flex gap-1">
                        <button className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center active:scale-95"><Check size={12} className="text-accent" /></button>
                        <button className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center active:scale-95"><X size={12} className="text-destructive" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ATTENDANCE ── */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="font-heading font-semibold text-sm mb-3">Today's Attendance</p>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center"><p className="text-2xl font-bold text-accent">28</p><p className="text-xs text-muted-foreground">Present</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-muted-foreground">10</p><p className="text-xs text-muted-foreground">Absent</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-yellow-400">74%</p><p className="text-xs text-muted-foreground">Rate</p></div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '74%' }} />
                </div>
              </div>
              <div className="bg-muted/40 border border-border rounded-2xl p-5 text-center">
                <CalendarCheck size={28} className="text-accent mx-auto mb-2" />
                <p className="text-sm font-semibold">QR Code Check-In</p>
                <p className="text-xs text-muted-foreground mt-1">Generate a QR code for member check-in — coming soon</p>
              </div>
            </div>
          )}

          {/* ── CHALLENGES ── */}
          {activeTab === 'challenges' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-sm">Active Challenges</p>
                <button className="text-xs text-accent font-medium flex items-center gap-1"><Plus size={13} /> Create</button>
              </div>
              {['30-Day Transformation', '10K Steps Weekly', 'Best Attendance'].map((c, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm">{c}</p>
                    <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{[12, 8, 20][i]} participants</span>
                    <span>{[18, 4, 12][i]} days left</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${[60, 40, 80][i]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── REWARDS ── */}
          {activeTab === 'rewards' && (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-yellow-400/15 to-yellow-400/5 border border-yellow-400/25 rounded-2xl p-4">
                <p className="font-heading font-semibold text-sm mb-1">Create Reward Offer</p>
                <p className="text-xs text-muted-foreground">Offer discounts & perks to loyal members</p>
                <Button className="mt-3 h-9 rounded-xl bg-yellow-400 text-black text-xs font-bold hover:bg-yellow-400/90">
                  <Plus size={13} className="mr-1" /> Create Offer
                </Button>
              </div>
              {['Free Month for Referral', '10% Off Annual Plan', 'Free PT Session'].map((r, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-yellow-400/10 flex items-center justify-center flex-shrink-0">
                    <Gift size={15} className="text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{r}</p>
                    <p className="text-xs text-muted-foreground">{[3, 7, 2][i]} redeemed</p>
                  </div>
                  <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">Active</span>
                </div>
              ))}
            </div>
          )}

          {/* ── REFERRALS ── */}
          {activeTab === 'referrals' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center">
                    <Share2 size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Your Referral Code</p>
                    <p className="text-xs text-muted-foreground">Share to earn on each new member</p>
                  </div>
                </div>
                <div className="bg-background/50 rounded-xl p-3 flex items-center justify-between border border-border">
                  <span className="font-mono font-bold text-lg tracking-widest text-accent">{owner.referral_code || 'SE7EN-GYM'}</span>
                  <button className="text-xs text-accent font-medium underline">Copy</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Total Referrals', value: '24', icon: Users, color: 'text-blue-400' },
                  { label: 'Converted', value: '18', icon: Check, color: 'text-accent' },
                  { label: 'Pending', value: '6', icon: Bell, color: 'text-yellow-400' },
                  { label: 'Earnings', value: '₹3,600', icon: Coins, color: 'text-purple-400' },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-2xl p-3.5">
                    <p className={`font-bold text-xl ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="font-heading font-semibold text-sm mb-2">Recent Referrals</p>
                {['Ravi Sharma', 'Anjali Singh', 'Karan Mehta'].map((name, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-accent">{name[0]}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{['3 days ago', '1 week ago', '2 weeks ago'][i]}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${i < 2 ? 'bg-accent/10 text-accent' : 'bg-yellow-400/10 text-yellow-400'}`}>
                      {i < 2 ? 'converted' : 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── REVIEWS ── */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              {/* Rating summary */}
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                <div className="text-center">
                  <p className="font-heading font-black text-4xl text-accent">{avgRating}</p>
                  <div className="flex gap-0.5 justify-center mt-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={12} className={parseFloat(avgRating) >= s ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'} />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{reviews.length} reviews</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5,4,3,2,1].map(star => {
                    const count = reviews.filter(r => Math.round(r.rating) === star).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : (star === 5 ? 70 : star === 4 ? 20 : 10);
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-3">{star}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="bg-muted/40 border border-border rounded-2xl p-8 text-center">
                  <Star size={28} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">No reviews yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Member reviews will appear here</p>
                </div>
              ) : (
                reviews.map(review => (
                  <div key={review.id} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{review.user_name || 'Anonymous'}</p>
                        <div className="flex gap-0.5 mt-0.5">
                          {[1,2,3,4,5].map(s => <Star key={s} size={11} className={review.rating >= s ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'} />)}
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
                ))
              )}
            </div>
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {activeTab === 'announcements' && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="font-heading font-semibold text-sm mb-3">Send Announcement</p>
                <textarea
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="Write your message to all gym members..."
                  className="w-full h-24 px-3 py-2 rounded-xl border border-input bg-muted/40 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  onClick={() => { if (announcement.trim()) { toast({ title: '📢 Announcement sent!' }); setAnnouncement(''); } }}
                  className="mt-2 h-10 rounded-xl bg-accent text-accent-foreground text-sm w-full"
                >
                  <Send size={14} className="mr-2" /> Send to All Members
                </Button>
              </div>
              <p className="font-heading font-semibold text-xs text-muted-foreground px-1">Recent Announcements</p>
              {['New batch starting Monday!', 'Holiday closure on Sunday', 'New equipment installed 🏋️'].map((a, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3.5">
                  <p className="text-sm font-medium">{a}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{['2 days ago', '5 days ago', '1 week ago'][i]}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── EARNINGS ── */}
          {activeTab === 'earnings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'This Month', value: `₹${(activeMembers * (owner.monthly_fee || 999)).toLocaleString()}`, color: 'text-accent' },
                  { label: 'Last Month', value: '₹38,200', color: 'text-blue-400' },
                  { label: 'Referral Earn', value: '₹3,600', color: 'text-yellow-400' },
                  { label: 'Total 2026', value: '₹2,15,400', color: 'text-purple-400' },
                ].map(e => (
                  <div key={e.label} className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground">{e.label}</p>
                    <p className={`font-heading font-bold text-lg mt-1 ${e.color}`}>{e.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-muted/40 border border-border rounded-2xl p-5 text-center">
                <Coins size={28} className="text-accent mx-auto mb-2" />
                <p className="text-sm font-semibold">Bank Payout Setup</p>
                <p className="text-xs text-muted-foreground mt-1">Connect your bank account for direct payouts — coming soon</p>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              {[
                { label: 'Edit Gym Profile', action: () => navigate('/gym-owner/onboarding'), icon: Edit3 },
                { label: 'Notification Preferences', action: () => {}, icon: Bell },
                { label: 'Subscription & Billing', action: () => {}, icon: Coins },
                { label: 'Help & Support', action: () => {}, icon: MessageSquare },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-accent/30 active:scale-[0.99] transition-all">
                  <item.icon size={16} className="text-accent" />
                  <span className="flex-1 text-sm font-medium text-left">{item.label}</span>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </button>
              ))}
              <button
                onClick={() => { base44.auth.logout(); navigate('/welcome'); }}
                className="w-full bg-destructive/5 border border-destructive/20 rounded-2xl p-4 flex items-center gap-3 text-destructive active:scale-[0.99] transition-all"
              >
                <LogOut size={16} />
                <span className="flex-1 text-sm font-semibold text-left">Sign Out</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}