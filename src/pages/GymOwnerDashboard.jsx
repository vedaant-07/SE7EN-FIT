import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import {
  BarChart3,
  Building2,
  Users,
  UserPlus,
  CalendarCheck,
  Coins,
  LogOut,
  Settings,
  RefreshCw,
  Share2,
  ChevronRight,
  Megaphone,
  Plus,
  Check,
  Clock,
  Phone,
  Mail,
  MapPin,
  Trophy,
  Image as ImageIcon,
  Video,
  Trash2,
} from 'lucide-react';

const safeArray = (value) => Array.isArray(value) ? value : [];
const todayIso = () => new Date().toISOString().split('T')[0];

async function safeEntityList(entityCall, fallback = []) {
  try {
    return safeArray(await entityCall());
  } catch {
    return fallback;
  }
}

function getMemberName(member, profiles) {
  const profile = profiles.find(p => String(p.user_id) === String(member.user_id));
  return profile?.full_name || profile?.name || member.user_name || member.name || member.email || 'Gym Member';
}

function getMemberSub(member, profiles) {
  const profile = profiles.find(p => String(p.user_id) === String(member.user_id));
  return profile?.email || member.email || member.mobile || member.phone || 'Connected user';
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 min-h-[112px]">
      <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border flex items-center justify-center mb-3">
        <Icon size={16} className="text-white" />
      </div>
      <p className="font-heading font-black text-xl leading-tight">{value}</p>
      <p className="text-xs font-semibold mt-0.5">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, text }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 text-center">
      <Icon size={28} className="text-muted-foreground mx-auto mb-2" />
      <p className="font-heading font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

export default function GymOwnerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ members: [], leads: [], attendance: [], ads: [], profiles: [] });
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [adForm, setAdForm] = useState({ title: '', description: '', offer_text: '', media_url: '', media_type: 'image', cta_label: 'View Offer' });
  const [savingAd, setSavingAd] = useState(false);

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

      const [members, leads, attendance, ads, profiles] = await Promise.all([
        safeEntityList(() => base44.entities.UserGymMembership.filter({ gym_id: gymOwner.id })),
        safeEntityList(() => base44.entities.GymLead.filter({ owner_id: user.id })),
        safeEntityList(() => base44.entities.GymAttendanceLog.filter({ gym_id: gymOwner.id })),
        safeEntityList(() => base44.entities.Advertisement.filter({ gym_id: gymOwner.id })),
        safeEntityList(() => base44.entities.UserProfile.list('-created_date', 300)),
      ]);

      setStats({ members, leads, attendance, ads, profiles });
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

  const saveAd = async (e) => {
    e.preventDefault();
    if (!owner?.id || !adForm.title.trim()) return;
    setSavingAd(true);
    try {
      const ad = await base44.entities.Advertisement.create({
        gym_id: owner.id,
        owner_gym_id: owner.id,
        target_gym_id: owner.id,
        owner_id: owner.user_id,
        source_type: 'gym_owner',
        source_name: owner.gym_name || 'Gym Offer',
        title: adForm.title.trim(),
        description: adForm.description.trim(),
        offer_text: adForm.offer_text.trim() || 'Gym Offer',
        media_url: adForm.media_url.trim(),
        media_type: adForm.media_type,
        cta_label: adForm.cta_label.trim() || 'View Offer',
        target_scope: 'referred_users',
        status: 'active',
      });
      setStats(prev => ({ ...prev, ads: [ad, ...prev.ads] }));
      setAdForm({ title: '', description: '', offer_text: '', media_url: '', media_type: 'image', cta_label: 'View Offer' });
      setAdFormOpen(false);
    } catch (err) {
      setError(err?.message || 'Could not post advertisement.');
    } finally {
      setSavingAd(false);
    }
  };

  const deleteAd = async (ad) => {
    try {
      if (typeof base44.entities.Advertisement.delete === 'function') await base44.entities.Advertisement.delete(ad.id);
      else await base44.entities.Advertisement.update(ad.id, { status: 'deleted' });
      setStats(prev => ({ ...prev, ads: prev.ads.filter(item => item.id !== ad.id) }));
    } catch {
      await base44.entities.Advertisement.update(ad.id, { status: 'inactive' }).catch(() => null);
      setStats(prev => ({ ...prev, ads: prev.ads.filter(item => item.id !== ad.id) }));
    }
  };

  const approveMember = async (member) => {
    try {
      await base44.entities.UserGymMembership.update(member.id, { status: 'active', approved_date: todayIso() });
      setStats(prev => ({
        ...prev,
        members: prev.members.map(m => m.id === member.id ? { ...m, status: 'active', approved_date: todayIso() } : m),
      }));
    } catch (err) {
      setError(err?.message || 'Could not approve member.');
    }
  };

  const updateLeadStatus = async (lead, status) => {
    try {
      await base44.entities.GymLead.update(lead.id, { status });
      setStats(prev => ({
        ...prev,
        leads: prev.leads.map(l => l.id === lead.id ? { ...l, status } : l),
      }));
    } catch (err) {
      setError(err?.message || 'Could not update lead.');
    }
  };

  if (loading) return <LoadingScreen />;

  if (error && !owner) {
    return (
      <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center">
        <div className="max-w-sm w-full bg-card border border-border rounded-3xl p-5 text-center">
          <Building2 size={32} className="text-white mx-auto mb-3" />
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
          <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="font-heading font-bold text-xl">Complete Gym Setup</h1>
          <p className="text-sm text-muted-foreground mt-2">Your gym owner account is active. Complete onboarding to unlock the full dashboard.</p>
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

  const activeMembers = stats.members.filter(m => (m.status || 'active') === 'active').length;
  const pendingMembers = stats.members.filter(m => m.status === 'pending').length;
  const newLeads = stats.leads.filter(l => (l.status || 'new') === 'new').length;
  const today = todayIso();
  const todayAttendance = stats.attendance.filter(a => a.date === today || String(a.created_date || '').startsWith(today)).length;
  const monthlyRevenue = activeMembers * Number(owner.monthly_fee || owner.price_monthly || 999);
  const latestCheckins = [...stats.attendance].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || ''))).slice(0, 8);
  const activeAds = stats.ads.filter(ad => !['deleted', 'inactive'].includes(String(ad.status || 'active')));

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-lg mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border flex items-center justify-center flex-shrink-0">
              <Building2 size={17} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm truncate">{owner.gym_name || 'My Gym'}</p>
              <p className="text-[10px] text-muted-foreground">Gym Owner Dashboard</p>
            </div>
          </div>
          <button onClick={signOut} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center" aria-label="Sign out">
            <LogOut size={16} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-3 text-xs">
            {error}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardTab
            owner={owner}
            activeMembers={activeMembers}
            pendingMembers={pendingMembers}
            newLeads={newLeads}
            todayAttendance={todayAttendance}
            monthlyRevenue={monthlyRevenue}
            copyReferral={copyReferral}
            copied={copied}
            setActiveTab={setActiveTab}
            latestCheckins={latestCheckins}
            profiles={stats.profiles}
          />
        )}

        {activeTab === 'members' && (
          <MembersTab members={stats.members} profiles={stats.profiles} approveMember={approveMember} />
        )}

        {activeTab === 'leads' && (
          <LeadsTab leads={stats.leads} updateLeadStatus={updateLeadStatus} />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab attendance={stats.attendance} profiles={stats.profiles} />
        )}

        {activeTab === 'ads' && (
          <AdsTab
            ads={activeAds}
            adFormOpen={adFormOpen}
            setAdFormOpen={setAdFormOpen}
            adForm={adForm}
            setAdForm={setAdForm}
            saveAd={saveAd}
            savingAd={savingAd}
            deleteAd={deleteAd}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab owner={owner} navigate={navigate} loadDashboard={loadDashboard} signOut={signOut} copyReferral={copyReferral} copied={copied} />
        )}
      </main>

      <GymOwnerBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function DashboardTab({ owner, activeMembers, pendingMembers, newLeads, todayAttendance, monthlyRevenue, copyReferral, copied, setActiveTab, latestCheckins, profiles }) {
  return (
    <>
      <div className="bg-card border border-border rounded-3xl p-5">
        <p className="text-xs text-muted-foreground">Monthly Revenue</p>
        <p className="font-heading font-black text-3xl mt-1">₹{monthlyRevenue.toLocaleString('en-IN')}</p>
        <p className="text-xs text-muted-foreground mt-1">{activeMembers} active members • {pendingMembers} pending approvals</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setActiveTab('members')} className="text-left"><StatCard label="Members" value={activeMembers} icon={Users} sub={`${pendingMembers} pending`} /></button>
        <button onClick={() => setActiveTab('leads')} className="text-left"><StatCard label="New Leads" value={newLeads} icon={UserPlus} sub="Tap to follow up" /></button>
        <button onClick={() => setActiveTab('attendance')} className="text-left"><StatCard label="Today Check-ins" value={todayAttendance} icon={CalendarCheck} sub={todayIso()} /></button>
        <button onClick={() => setActiveTab('ads')} className="text-left"><StatCard label="Ads & Offers" value="Post" icon={Megaphone} sub="Only referred users see" /></button>
      </div>

      {owner.referral_code && (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Referral Code</p>
            <p className="font-mono font-black text-lg text-white tracking-wider truncate">{owner.referral_code}</p>
          </div>
          <button onClick={copyReferral} className="h-10 px-4 rounded-xl bg-white text-black text-xs font-bold flex items-center gap-2">
            <Share2 size={13} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading font-semibold text-sm">Latest Check-ins</h3>
          <button onClick={() => setActiveTab('attendance')} className="text-xs text-muted-foreground">View all</button>
        </div>
        {latestCheckins.length === 0 ? (
          <EmptyPanel icon={CalendarCheck} title="No check-ins yet" text="Member attendance will appear here once users check in from the app." />
        ) : (
          <div className="space-y-2">
            {latestCheckins.map(log => (
              <div key={log.id || `${log.user_id}-${log.created_date}`} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><CalendarCheck size={15} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{getMemberName(log, profiles)}</p>
                  <p className="text-[10px] text-muted-foreground">{log.date || String(log.created_date || '').slice(0, 10)} • {log.status || 'checked in'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MembersTab({ members, profiles, approveMember }) {
  const sorted = [...members].sort((a, b) => String(a.status || '').localeCompare(String(b.status || '')));
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading font-bold text-lg">Members</h2>
        <p className="text-xs text-muted-foreground">Approve requests and view active gym users.</p>
      </div>
      {sorted.length === 0 ? (
        <EmptyPanel icon={Users} title="No members yet" text="Share your referral code. Users who join through it will appear here." />
      ) : sorted.map(member => (
        <div key={member.id || member.user_id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold">
            {getMemberName(member, profiles).slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{getMemberName(member, profiles)}</p>
            <p className="text-[10px] text-muted-foreground truncate">{getMemberSub(member, profiles)}</p>
            <span className="inline-flex mt-1 text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground uppercase">{member.status || 'active'}</span>
          </div>
          {(member.status || 'active') === 'pending' ? (
            <button onClick={() => approveMember(member)} className="h-9 px-3 rounded-xl bg-white text-black text-xs font-bold flex items-center gap-1">
              <Check size={13} /> Approve
            </button>
          ) : (
            <Users size={17} className="text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

function LeadsTab({ leads, updateLeadStatus }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading font-bold text-lg">Leads</h2>
        <p className="text-xs text-muted-foreground">Follow up with people interested in your gym.</p>
      </div>
      {leads.length === 0 ? (
        <EmptyPanel icon={UserPlus} title="No leads yet" text="Leads from your gym profile and campaigns will appear here." />
      ) : leads.map(lead => (
        <div key={lead.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><UserPlus size={16} className="text-white" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{lead.name || lead.full_name || 'New Lead'}</p>
              <div className="mt-1 space-y-0.5">
                {lead.phone && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone size={10} /> {lead.phone}</p>}
                {lead.email && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail size={10} /> {lead.email}</p>}
                {lead.city && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {lead.city}</p>}
              </div>
            </div>
            <span className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground uppercase">{lead.status || 'new'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => updateLeadStatus(lead, 'contacted')} className="h-9 rounded-xl bg-card border border-border text-xs font-semibold">Contacted</button>
            <button onClick={() => updateLeadStatus(lead, 'converted')} className="h-9 rounded-xl bg-white text-black text-xs font-bold">Converted</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AttendanceTab({ attendance, profiles }) {
  const sorted = [...attendance].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading font-bold text-lg">Attendance</h2>
        <p className="text-xs text-muted-foreground">Track daily check-ins and gym visits.</p>
      </div>
      {sorted.length === 0 ? (
        <EmptyPanel icon={CalendarCheck} title="No attendance yet" text="When members check in from My Gym, their logs will appear here." />
      ) : sorted.map(log => (
        <div key={log.id || `${log.user_id}-${log.created_date}`} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center"><CalendarCheck size={16} className="text-white" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{getMemberName(log, profiles)}</p>
            <p className="text-[10px] text-muted-foreground">{log.date || String(log.created_date || '').slice(0, 10)} • {log.check_in_time || 'Check-in'} {log.check_out_time ? `- ${log.check_out_time}` : ''}</p>
          </div>
          <span className="text-[9px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground uppercase">{log.status || 'in'}</span>
        </div>
      ))}
    </div>
  );
}

function AdsTab({ ads, adFormOpen, setAdFormOpen, adForm, setAdForm, saveAd, savingAd, deleteAd }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-lg">Ads & Offers</h2>
          <p className="text-xs text-muted-foreground">Post image/video offers. Only your referred users will see them.</p>
        </div>
        <button onClick={() => setAdFormOpen(v => !v)} className="h-9 px-3 rounded-xl bg-white text-black text-xs font-bold flex items-center gap-1.5">
          <Plus size={13} /> Post
        </button>
      </div>

      {adFormOpen && (
        <form onSubmit={saveAd} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <input value={adForm.title} onChange={e => setAdForm(f => ({ ...f, title: e.target.value }))} placeholder="Offer title" className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm" required />
          <textarea value={adForm.description} onChange={e => setAdForm(f => ({ ...f, description: e.target.value }))} placeholder="Offer details" rows={3} className="w-full rounded-xl bg-background border border-border p-3 text-sm resize-none" />
          <input value={adForm.offer_text} onChange={e => setAdForm(f => ({ ...f, offer_text: e.target.value }))} placeholder="Badge text e.g. 50% OFF" className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm" />
          <input value={adForm.media_url} onChange={e => setAdForm(f => ({ ...f, media_url: e.target.value }))} placeholder="Image / Video URL" className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAdForm(f => ({ ...f, media_type: 'image' }))} className={`h-9 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 ${adForm.media_type === 'image' ? 'bg-white text-black border-white' : 'bg-card border-border text-muted-foreground'}`}><ImageIcon size={13} /> Image</button>
            <button type="button" onClick={() => setAdForm(f => ({ ...f, media_type: 'video' }))} className={`h-9 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 ${adForm.media_type === 'video' ? 'bg-white text-black border-white' : 'bg-card border-border text-muted-foreground'}`}><Video size={13} /> Video</button>
          </div>
          <button type="submit" disabled={savingAd || !adForm.title.trim()} className="w-full h-10 rounded-xl bg-white text-black text-sm font-bold disabled:opacity-50">
            {savingAd ? 'Posting...' : 'Publish Offer'}
          </button>
        </form>
      )}

      {ads.length === 0 ? (
        <EmptyPanel icon={Megaphone} title="No ads posted" text="Create your first gym offer to show it to users who joined through your referral code." />
      ) : ads.map(ad => (
        <div key={ad.id} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            {String(ad.media_type).toLowerCase() === 'video' ? <Video size={16} className="text-white" /> : <Megaphone size={16} className="text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{ad.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ad.description || 'Gym offer'}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{ad.offer_text || 'Offer'} • {ad.status || 'active'}</p>
          </div>
          <button onClick={() => deleteAd(ad)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Trash2 size={13} className="text-red-400" /></button>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ owner, navigate, loadDashboard, signOut, copyReferral, copied }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading font-bold text-lg">Gym Settings</h2>
        <p className="text-xs text-muted-foreground">Manage profile, referral and dashboard tools.</p>
      </div>
      {owner.referral_code && (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Referral Code</p>
            <p className="font-mono font-black text-lg text-white tracking-wider truncate">{owner.referral_code}</p>
          </div>
          <button onClick={copyReferral} className="h-10 px-4 rounded-xl bg-white text-black text-xs font-bold flex items-center gap-2">
            <Share2 size={13} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <button onClick={() => navigate('/gym-owner/onboarding')} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left">
        <Settings size={18} className="text-white" />
        <div className="flex-1"><p className="font-semibold text-sm">Edit Gym Profile</p><p className="text-xs text-muted-foreground">Update gym info, timings and pricing</p></div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>
      <button onClick={loadDashboard} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left">
        <RefreshCw size={18} className="text-white" />
        <div className="flex-1"><p className="font-semibold text-sm">Refresh Dashboard</p><p className="text-xs text-muted-foreground">Reload latest members and leads</p></div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>
      <button onClick={signOut} className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left">
        <LogOut size={18} className="text-red-400" />
        <div className="flex-1"><p className="font-semibold text-sm">Sign Out</p><p className="text-xs text-muted-foreground">Logout from gym owner account</p></div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>
    </div>
  );
}

function GymOwnerBottomNav({ activeTab, setActiveTab }) {
  const items = useMemo(() => [
    { key: 'dashboard', label: 'Home', icon: BarChart3 },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'leads', label: 'Leads', icon: UserPlus },
    { key: 'attendance', label: 'Check-ins', icon: CalendarCheck },
    { key: 'ads', label: 'Ads', icon: Megaphone },
    { key: 'settings', label: 'More', icon: Settings },
  ], []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-lg mx-auto h-[68px] px-2 grid grid-cols-6">
        {items.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button key={key} onClick={() => setActiveTab(key)} className={`flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${active ? 'text-white' : 'text-muted-foreground'}`}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[9px] font-semibold leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
