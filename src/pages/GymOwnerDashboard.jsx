import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Building2, Users, TrendingUp, Star, Bell, Settings, ChevronRight, Plus, Trophy, Coins, Activity, BarChart3, CalendarCheck, MessageSquare, Gift, Share2, LogOut, Dumbbell, Clock, Phone, MapPin, Check, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'profile', label: 'Gym Profile', icon: Building2 },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'challenges', label: 'Challenges', icon: Trophy },
  { key: 'rewards', label: 'Rewards', icon: Gift },
  { key: 'announcements', label: 'Announcements', icon: Bell },
  { key: 'earnings', label: 'Earnings', icon: TrendingUp },
];

export default function GymOwnerDashboard() {
  const navigate = useNavigate();
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [members] = useState([
    { name: 'Rahul Sharma', plan: 'Monthly', status: 'active', joined: '2026-06-01' },
    { name: 'Priya Singh', plan: 'Quarterly', status: 'active', joined: '2026-05-15' },
    { name: 'Amit Kumar', plan: 'Monthly', status: 'expired', joined: '2026-04-01' },
    { name: 'Neha Gupta', plan: 'Annual', status: 'active', joined: '2026-01-10' },
    { name: 'Vikram Mehta', plan: 'Monthly', status: 'pending', joined: '2026-06-15' },
  ]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
      if (owners.length === 0) { navigate('/gym-owner/onboarding'); return; }
      setOwner(owners[0]);
    } catch (e) { navigate('/gym-owner/login'); }
    setLoading(false);
  };

  if (loading) return <LoadingScreen />;
  if (!owner) return null;

  const stats = [
    { label: 'Total Members', value: owner.total_members || 42, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Active Members', value: 38, icon: Activity, color: 'text-accent', bg: 'bg-accent/10' },
    { label: 'Leads This Month', value: owner.total_leads || 12, icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Gym Rating', value: `${owner.rating || 4.5}★`, icon: Star, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-2xl border-b border-border/40" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div>
            <div className="font-display font-bold text-lg">SE<span className="text-accent">7</span>ENFIT</div>
            <div className="text-[10px] text-muted-foreground -mt-0.5">Gym Dashboard</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><Bell size={16} /></button>
            <button onClick={() => { base44.auth.logout(); navigate('/welcome'); }} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Gym name hero */}
        <div className="px-4 pt-5 pb-3">
          <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/25 rounded-3xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center">
                <Building2 size={22} className="text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-base">{owner.gym_name || 'Your Gym'}</p>
                <p className="text-xs text-muted-foreground">{owner.city} • {owner.opening_time || '6AM'} – {owner.closing_time || '10PM'}</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${owner.is_approved ? 'bg-accent/20 text-accent' : 'bg-yellow-400/20 text-yellow-400'}`}>
                {owner.is_approved ? '✓ Live' : 'Pending'}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.key} onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeTab === item.key ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-24 space-y-4">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {stats.map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
                      <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                        <Icon size={15} className={s.color} />
                      </div>
                      <p className="font-heading font-bold text-xl">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Monthly earnings placeholder */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-heading font-semibold text-sm">Monthly Revenue</p>
                  <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">June 2026</span>
                </div>
                <p className="text-2xl font-bold font-heading text-accent">₹41,850</p>
                <p className="text-xs text-muted-foreground mt-0.5">From 38 active members</p>
                <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '72%' }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">72% of monthly target</p>
              </div>

              {/* Quick actions */}
              <div>
                <p className="font-heading font-semibold text-sm mb-2">Quick Actions</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Add Member', icon: Plus, action: () => setActiveTab('members') },
                    { label: 'Mark Attendance', icon: CalendarCheck, action: () => setActiveTab('attendance') },
                    { label: 'Send Announcement', icon: Bell, action: () => setActiveTab('announcements') },
                  ].map(a => (
                    <button key={a.label} onClick={a.action} className="bg-muted rounded-2xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-all">
                      <a.icon size={18} className="text-accent" />
                      <span className="text-[10px] font-medium text-center">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent joins */}
              <div>
                <p className="font-heading font-semibold text-sm mb-2">Recent Joins</p>
                <div className="space-y-2">
                  {members.slice(0, 3).map((m, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-accent">{m.name[0]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.plan} • {m.joined}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.status === 'active' ? 'bg-accent/10 text-accent' : m.status === 'expired' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <p className="font-heading font-semibold text-sm">Gym Details</p>
                {[
                  { label: 'Gym Name', value: owner.gym_name, icon: Building2 },
                  { label: 'City', value: owner.city || 'Not set', icon: MapPin },
                  { label: 'Address', value: owner.address || 'Not set', icon: MapPin },
                  { label: 'Timings', value: `${owner.opening_time || '6:00'} – ${owner.closing_time || '22:00'}`, icon: Clock },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <item.icon size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div><p className="text-[10px] text-muted-foreground">{item.label}</p><p className="text-sm font-medium">{item.value}</p></div>
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
                      <p className="font-bold text-sm text-accent">₹{p.value}</p>
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
              <Button onClick={() => navigate('/gym-owner/onboarding')} variant="outline" className="w-full h-12 rounded-xl">Edit Gym Profile</Button>
            </div>
          )}

          {/* MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-sm">All Members ({members.length})</p>
                <button className="flex items-center gap-1 text-xs text-accent font-medium">
                  <Plus size={13} /> Add Member
                </button>
              </div>
              {members.map((m, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-accent">{m.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.plan} • Joined {m.joined}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.status === 'active' ? 'bg-accent/10 text-accent' : m.status === 'expired' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-400/10 text-yellow-400'}`}>
                      {m.status}
                    </span>
                    {m.status === 'pending' && (
                      <div className="flex gap-1">
                        <button className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center"><Check size={12} className="text-accent" /></button>
                        <button className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center"><X size={12} className="text-destructive" /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="font-heading font-semibold text-sm mb-3">Today's Attendance</p>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-accent">28</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">10</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-400">74%</p>
                    <p className="text-xs text-muted-foreground">Rate</p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '74%' }} />
                </div>
              </div>
              <div className="bg-muted/40 border border-border rounded-xl p-4 text-center">
                <CalendarCheck size={24} className="text-accent mx-auto mb-2" />
                <p className="text-sm font-medium">QR Code Attendance</p>
                <p className="text-xs text-muted-foreground mt-1">Generate QR for gym check-in — coming soon</p>
              </div>
            </div>
          )}

          {/* CHALLENGES */}
          {activeTab === 'challenges' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold text-sm">Active Challenges</p>
                <button className="text-xs text-accent font-medium flex items-center gap-1"><Plus size={13} /> Create</button>
              </div>
              {['30-Day Transformation', '10K Steps Weekly', 'Best Attendance'].map((c, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{c}</p>
                    <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">Active</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{[12, 8, 20][i]} participants</span>
                    <span>{[18, 4, 12][i]} days left</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${[60, 40, 80][i]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* REWARDS */}
          {activeTab === 'rewards' && (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-yellow-400/15 to-yellow-400/5 border border-yellow-400/25 rounded-2xl p-4">
                <p className="font-heading font-semibold text-sm mb-1">Create Reward Offer</p>
                <p className="text-xs text-muted-foreground">Offer discounts & perks to loyal members</p>
                <Button className="mt-3 h-9 rounded-xl bg-yellow-400 text-black text-xs font-bold hover:bg-yellow-400/90">
                  <Plus size={13} /> Create Offer
                </Button>
              </div>
              {['Free Month for Referral', '10% Off Annual Plan', 'Free PT Session'].map((r, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-yellow-400/10 flex items-center justify-center"><Gift size={16} className="text-yellow-400" /></div>
                  <div className="flex-1"><p className="text-sm font-medium">{r}</p><p className="text-xs text-muted-foreground">{[3, 7, 2][i]} redeemed</p></div>
                  <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">Active</span>
                </div>
              ))}
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="font-heading font-semibold text-sm mb-3">Send Announcement</p>
                <textarea placeholder="Write your message to all gym members..." className="w-full h-20 px-3 py-2 rounded-xl border border-input bg-muted/40 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                <Button className="mt-2 h-9 rounded-xl bg-accent text-accent-foreground text-xs w-full">
                  <Bell size={13} /> Send to All Members
                </Button>
              </div>
              <p className="font-heading font-semibold text-xs text-muted-foreground px-1">Recent Announcements</p>
              {['New batch starting Monday!', 'Holiday closure on Sunday', 'New equipment installed 🏋️'].map((a, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-sm">{a}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{['2 days ago', '5 days ago', '1 week ago'][i]}</p>
                </div>
              ))}
            </div>
          )}

          {/* EARNINGS */}
          {activeTab === 'earnings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'This Month', value: '₹41,850', color: 'text-accent' },
                  { label: 'Last Month', value: '₹38,200', color: 'text-blue-400' },
                  { label: 'Referrals', value: '₹2,400', color: 'text-yellow-400' },
                  { label: 'Total 2026', value: '₹2,15,400', color: 'text-purple-400' },
                ].map(e => (
                  <div key={e.label} className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground">{e.label}</p>
                    <p className={`font-heading font-bold text-lg mt-1 ${e.color}`}>{e.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-muted/40 border border-border rounded-xl p-4 text-center">
                <TrendingUp size={24} className="text-accent mx-auto mb-2" />
                <p className="text-sm font-medium">Payment Integration</p>
                <p className="text-xs text-muted-foreground mt-1">Connect your bank account for direct payouts — coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}