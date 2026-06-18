import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import GymEquipmentManager from '@/pages/gym-owner/GymEquipmentManager';
import GymProfileTab from '@/pages/gym-owner/GymProfileTab';
import MembersTab from '@/pages/gym-owner/MembersTab';
import LeadsTab from '@/pages/gym-owner/LeadsTab';
import AttendanceTab from '@/pages/gym-owner/AttendanceTab';
import ChallengesTab from '@/pages/gym-owner/ChallengesTab';
import RewardsTab from '@/pages/gym-owner/RewardsTab';
import ReferralsTab from '@/pages/gym-owner/ReferralsTab';
import ReviewsTab from '@/pages/gym-owner/ReviewsTab';
import AnnouncementsTab from '@/pages/gym-owner/AnnouncementsTab';
import EarningsTab from '@/pages/gym-owner/EarningsTab';
import GymToast from '@/components/gym-owner/Toast';
import ConfirmModal from '@/components/gym-owner/ConfirmModal';
import {
  Building2, Users, Star, Bell, Settings,
  Trophy, Gift, Share2, LogOut, Check, CalendarCheck,
  MessageSquare, Coins, UserPlus,
  Edit3, TrendingUp, ChevronRight, Home, Dumbbell
} from 'lucide-react';

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

const statusColors = {
  active: 'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  rejected: 'bg-red-500/15 text-red-400',
  inactive: 'bg-muted text-muted-foreground',
  new: 'bg-blue-500/15 text-blue-400',
  contacted: 'bg-purple-500/15 text-purple-400',
  converted: 'bg-emerald-500/15 text-emerald-400',
  lost: 'bg-muted text-muted-foreground',
};

export default function GymOwnerDashboard() {
  const navigate = useNavigate();
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [settingsSection, setSettingsSection] = useState(null);

  // Data
  const [leads, setLeads] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Toast
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'success') => setToasts(prev => [...prev, { message, type }]);

  // Copy state for referral code on overview
  const [copied, setCopied] = useState(false);
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Copied!', 'success');
  };

  // Logout confirm
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
      if (owners.length === 0) {
        const newOwner = await base44.entities.GymOwner.create({
          user_id: user.id, owner_name: user.full_name || 'Gym Owner',
          gym_name: 'My Gym', onboarding_complete: false,
        });
        setOwner(newOwner);
        setLoading(false);
        return;
      }
      setOwner(owners[0]);
      const [gymLeads, gymReviews, gymMemberships, gymAttendance, gymAnnouncements] = await Promise.all([
        base44.entities.GymLead.filter({ owner_id: user.id }),
        base44.entities.GymReview.filter({ gym_id: owners[0].id }),
        base44.entities.UserGymMembership.filter({ gym_id: owners[0].id }),
        base44.entities.GymAttendanceLog.filter({ gym_id: owners[0].id }),
        base44.entities.GymAnnouncement.filter({ gym_id: owners[0].id }),
      ]);
      setLeads(gymLeads);
      setReviews(gymReviews);
      setMemberships(gymMemberships);
      setAttendanceLogs(gymAttendance);
      setAnnouncements(gymAnnouncements.filter(a => a.is_active));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const goTab = (key) => { setActiveTab(key); setSettingsSection(null); };

  if (loading) return <LoadingScreen />;
  if (!owner) return null;

  const today = new Date().toISOString().split('T')[0];
  const activeMembers = memberships.filter(m => m.status === 'active').length;
  const pendingMembers = memberships.filter(m => m.status === 'pending').length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const todayAttendance = attendanceLogs.filter(a => a.date === today).length;
  const insideNow = attendanceLogs.filter(a => a.date === today && a.status === 'checked_in').length;
  const totalRealMembers = memberships.length;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : (owner.rating || 0);
  const monthlyRevenue = activeMembers * (owner.monthly_fee || 999);
  const tabLabel = [...BOTTOM_NAV, ...MORE_TABS].find(t => t.key === activeTab)?.label || '';

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient background glow layers */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-accent/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 -right-24 w-64 h-64 bg-accent/8 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-48 bg-accent/6 rounded-full blur-[80px]" />
      </div>
      <GymToast toasts={toasts} setToasts={setToasts} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40"
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
            <button onClick={() => goTab('announcements')}
              className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
              <Bell size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-4">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <>
              {/* Revenue Hero */}
              <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-3xl p-5 text-accent-foreground">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium opacity-80">Monthly Revenue</p>
                    <p className="font-heading font-black text-3xl mt-1">₹{monthlyRevenue.toLocaleString()}</p>
                    <p className="text-xs opacity-70 mt-0.5">{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })} • {activeMembers} active</p>
                  </div>
                  <button onClick={() => goTab('earnings')} className="bg-white/20 rounded-2xl p-3 active:scale-95 transition-all">
                    <TrendingUp size={22} />
                  </button>
                </div>
                <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${activeMembers > 0 ? Math.min(100, activeMembers * 10) : 5}%` }} />
                </div>
                <p className="text-[11px] opacity-70 mt-1.5">{activeMembers} active • {pendingMembers} pending • {todayAttendance} today</p>
              </div>

              {/* Clickable Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Members', value: totalRealMembers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', tab: 'members' },
                  { label: 'New Leads', value: newLeads, icon: UserPlus, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', tab: 'leads' },
                  { label: 'Today Check-ins', value: todayAttendance, icon: CalendarCheck, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', tab: 'attendance' },
                  { label: 'Pending Approval', value: pendingMembers, icon: Bell, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', tab: 'members' },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <button key={s.label} onClick={() => goTab(s.tab)}
                      className={`bg-card border ${s.border} rounded-2xl p-4 text-left active:scale-[0.98] transition-all hover:border-opacity-60`}>
                      <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                        <Icon size={16} className={s.color} />
                      </div>
                      <p className={`font-heading font-black text-2xl ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </button>
                  );
                })}
              </div>

              {/* Secondary stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Inside Now', value: insideNow, tab: 'attendance', color: 'text-cyan-400' },
                  { label: 'Avg Rating', value: avgRating > 0 ? avgRating : '—', tab: 'reviews', color: 'text-amber-400' },
                  { label: 'Total Leads', value: leads.length, tab: 'leads', color: 'text-purple-400' },
                ].map(s => (
                  <button key={s.label} onClick={() => goTab(s.tab)}
                    className="bg-card border border-border rounded-2xl p-3 text-center active:scale-[0.98] transition-all hover:border-accent/30">
                    <p className={`font-black text-xl ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                  </button>
                ))}
              </div>

              {/* More Features Grid */}
              <div>
                <p className="font-heading font-semibold text-sm mb-3">More Features</p>
                <div className="grid grid-cols-4 gap-2">
                  {MORE_TABS.map(item => {
                    const Icon = item.icon;
                    return (
                      <button key={item.key} onClick={() => goTab(item.key)}
                        className="bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:border-accent/30 active:scale-95 transition-all">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                          <Icon size={15} className="text-accent" />
                        </div>
                        <span className="text-[9px] font-semibold text-center leading-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Referral Code Quick Access */}
              {owner.referral_code && (
                <div className="bg-accent/8 border border-accent/25 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Referral Code</p>
                    <p className="font-mono font-black text-lg text-accent tracking-wider mt-0.5">{owner.referral_code}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleCopy(owner.referral_code)}
                      className="bg-accent text-accent-foreground px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all min-w-[60px]">
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                    <button onClick={() => goTab('referrals')}
                      className="border border-accent/30 text-accent px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all">
                      View
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Members */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-heading font-semibold text-sm">Recent Members</p>
                  <button onClick={() => goTab('members')} className="text-xs text-accent font-medium">See all</button>
                </div>
                {memberships.length === 0 ? (
                  <div className="bg-muted/30 border border-border rounded-2xl p-5 text-center">
                    <Users size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs font-semibold">No members yet</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Share your referral code to get your first member</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberships.slice(0, 3).map((m) => (
                      <button key={m.id} onClick={() => goTab('members')}
                        className="w-full bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-all">
                        <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-black text-accent">{(m.user_id || 'U')[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">Member #{m.user_id?.slice(-6)}</p>
                          <p className="text-xs text-muted-foreground">Joined {m.joined_at || 'Recently'} • {m.total_visits || 0} visits</p>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusColors[m.status] || 'bg-muted text-muted-foreground'}`}>
                          {m.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── MEMBERS ── */}
          {activeTab === 'members' && (
            <MembersTab
              owner={owner}
              memberships={memberships}
              setMemberships={setMemberships}
              attendanceLogs={attendanceLogs}
              showToast={showToast}
            />
          )}

          {/* ── LEADS ── */}
          {activeTab === 'leads' && (
            <LeadsTab
              owner={owner}
              leads={leads}
              setLeads={setLeads}
              memberships={memberships}
              setMemberships={setMemberships}
              showToast={showToast}
            />
          )}

          {/* ── EARNINGS ── */}
          {activeTab === 'earnings' && (
            <EarningsTab
              owner={owner}
              memberships={memberships}
              attendanceLogs={attendanceLogs}
              showToast={showToast}
            />
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && !settingsSection && (
            <div className="space-y-3">
              <p className="font-heading font-bold text-lg">Settings</p>
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{owner.gym_name || 'My Gym'}</p>
                  <p className="text-xs text-muted-foreground">{owner.owner_name || 'Owner'}</p>
                </div>

              </div>
              <div className="space-y-2">
                {[
                  { label: 'Edit Gym Profile', action: () => navigate('/gym-owner/onboarding'), icon: Edit3, desc: 'Update gym info, timings & pricing' },
                  { label: 'Notification Preferences', action: () => setSettingsSection('notifications'), icon: Bell, desc: 'Manage alert settings' },
                  { label: 'Subscription & Billing', action: () => setSettingsSection('billing'), icon: Coins, desc: 'View plans & invoices' },
                  { label: 'Terms & Privacy', action: () => navigate('/terms'), icon: MessageSquare, desc: 'Legal documents' },
                  { label: 'Help & Support', action: () => setSettingsSection('help'), icon: MessageSquare, desc: 'Get help anytime' },
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
              <button onClick={() => setLogoutConfirm(true)}
                className="w-full bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-400 active:scale-[0.99] transition-all">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <LogOut size={15} className="text-red-400" />
                </div>
                <span className="flex-1 text-sm font-semibold text-left">Sign Out</span>
              </button>
            </div>
          )}

          {/* SETTINGS: NOTIFICATIONS */}
          {activeTab === 'settings' && settingsSection === 'notifications' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setSettingsSection(null)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <p className="font-heading font-bold text-lg">Notification Preferences</p>
              </div>
              {[
                { label: 'New Member Requests', desc: 'Alert when someone requests to join' },
                { label: 'New Lead Enquiry', desc: 'Alert when a new lead is captured' },
                { label: 'Member Check-in', desc: 'Alert when a member checks in' },
                { label: 'Review Posted', desc: 'Alert when a member leaves a review' },
                { label: 'Announcement Delivery', desc: 'Alert when announcements are delivered' },
              ].map(item => (
                <div key={item.label} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <div className="w-10 h-6 bg-accent/30 rounded-full flex items-center px-1">
                    <div className="w-4 h-4 bg-accent rounded-full ml-auto" />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground text-center px-4">Push notification controls coming soon. Email alerts are always active.</p>
            </div>
          )}

          {/* SETTINGS: BILLING */}
          {activeTab === 'settings' && settingsSection === 'billing' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setSettingsSection(null)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <p className="font-heading font-bold text-lg">Subscription & Billing</p>
              </div>
              <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-2xl p-5">
                <p className="text-xs text-muted-foreground">Current Plan</p>
                <p className="font-heading font-black text-xl mt-1">Free Plan</p>
                <p className="text-xs text-muted-foreground mt-1">Basic gym management features included</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
                <p className="font-semibold text-sm">Pro Plan — Coming Soon</p>
                {['Unlimited members & leads', 'Advanced analytics & reports', 'Priority support', 'Custom branding', 'Multiple gym locations'].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check size={13} className="text-accent flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">{f}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => showToast('Billing portal — coming soon!', 'info')}
                className="w-full h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">
                View Invoices & Payment History
              </button>
            </div>
          )}

          {/* SETTINGS: HELP */}
          {activeTab === 'settings' && settingsSection === 'help' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setSettingsSection(null)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <ChevronRight size={16} className="rotate-180" />
                </button>
                <p className="font-heading font-bold text-lg">Help & Support</p>
              </div>
              {[
                { q: 'How do members join my gym?', a: 'Share your referral code. Members enter it during signup on SE7ENFIT to link your gym.' },
                { q: 'How do I approve a member?', a: 'Go to Members tab → tap the ✓ button next to any pending member.' },
                { q: 'How do I add equipment?', a: 'Go to More Features → Equipment. Add from presets or create custom equipment.' },
                { q: 'How do I send announcements?', a: 'Go to More Features → Announcements to broadcast messages to all connected members.' },
                { q: 'How do I track attendance?', a: 'Go to More Features → Attendance. Generate a daily PIN or manually check in members.' },
                { q: 'How do I create challenges?', a: 'Go to More Features → Challenges. Create attendance, steps, or workout challenges.' },
              ].map(item => (
                <div key={item.q} className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-sm font-semibold mb-1">{item.q}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
              <div className="bg-accent/8 border border-accent/20 rounded-2xl p-4 text-center">
                <MessageSquare size={24} className="text-accent mx-auto mb-2" />
                <p className="text-sm font-semibold">Contact Support</p>
                <p className="text-xs text-muted-foreground mt-1">support@se7enfit.com</p>
                <button onClick={() => showToast('Support request sent! We\'ll email you within 24 hours.', 'success')}
                  className="mt-3 bg-accent text-accent-foreground text-xs font-semibold px-4 py-2 rounded-xl w-full">
                  Send Support Request
                </button>
              </div>
            </div>
          )}

          {/* ── GYM PROFILE ── */}
          {activeTab === 'profile' && (
            <GymProfileTab
              owner={owner}
              setOwner={setOwner}
              showToast={showToast}
              onEditFull={() => navigate('/gym-owner/onboarding')}
            />
          )}

          {/* ── EQUIPMENT ── */}
          {activeTab === 'equipment' && owner && (
            <GymEquipmentManager gymId={owner.id} ownerId={owner.user_id} />
          )}

          {/* ── ATTENDANCE ── */}
          {activeTab === 'attendance' && (
            <AttendanceTab
              owner={owner}
              memberships={memberships}
              attendanceLogs={attendanceLogs}
              setAttendanceLogs={setAttendanceLogs}
              showToast={showToast}
            />
          )}

          {/* ── CHALLENGES ── */}
          {activeTab === 'challenges' && (
            <ChallengesTab owner={owner} showToast={showToast} />
          )}

          {/* ── REWARDS ── */}
          {activeTab === 'rewards' && (
            <RewardsTab owner={owner} showToast={showToast} />
          )}

          {/* ── REFERRALS ── */}
          {activeTab === 'referrals' && (
            <ReferralsTab
              owner={owner}
              setOwner={setOwner}
              memberships={memberships}
              showToast={showToast}
              onNavigateToEarnings={() => goTab('earnings')}
            />
          )}

          {/* ── REVIEWS ── */}
          {activeTab === 'reviews' && (
            <ReviewsTab
              reviews={reviews}
              setReviews={setReviews}
              showToast={showToast}
            />
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {activeTab === 'announcements' && (
            <AnnouncementsTab
              owner={owner}
              announcements={announcements}
              setAnnouncements={setAnnouncements}
              showToast={showToast}
            />
          )}

        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 h-16">
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key || (item.key === 'settings' && activeTab === 'settings');
            return (
              <button key={item.key} onClick={() => goTab(item.key)}
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

      {/* Logout Confirm */}
      <ConfirmModal
        open={logoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of your gym dashboard?"
        confirmLabel="Sign Out"
        confirmClass="bg-red-500 text-white"
        onConfirm={() => { base44.auth.logout(); navigate('/welcome'); }}
        onCancel={() => setLogoutConfirm(false)}
      />
    </div>
  );
}