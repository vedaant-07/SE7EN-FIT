import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeIndianRupee,
  Bell,
  Building2,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  Dumbbell,
  IndianRupee,
  Loader2,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { platformClient } from '@/api/platformClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { endAuthSession } from '@/lib/authSessionSecurity';

const PERMISSION_TABS = [
  { key: 'home', label: 'Home', icon: Building2, permission: 'dashboard:read' },
  { key: 'members', label: 'Members', icon: Users, permission: 'members:read' },
  { key: 'attendance', label: 'Visits', icon: CalendarCheck, permission: 'attendance:read' },
  { key: 'business', label: 'Business', icon: Wallet, any: ['payments:read', 'plans:read', 'reports:read'] },
  { key: 'more', label: 'More', icon: Settings, any: ['equipment:read', 'leads:read', 'announcements:read', 'settings:write'] },
];

const emptyMember = { name: '', email: '', phone: '', notes: '' };
const emptyPayment = { member_id: '', member_type: 'manual', amount: '', method: 'cash', notes: '', payment_reference: '' };
const emptyEquipment = { name: '', category: 'Strength', quantity: 1 };
const emptyLead = { name: '', phone: '', email: '', source: 'Walk-in', message: '' };
const emptyAnnouncement = { title: '', body: '', audience: 'all_members' };
const emptyPlan = { name: '', price: '', billing_cycle: 'monthly', duration_days: '30', features: '' };
const emptyInvite = { name: '', email: '', phone: '', role: 'trainer', expires_in_days: 7 };

const itemId = (item) => item?.id || item?.membership_id || item?.log_id || item?.equipment_id || item?.lead_id || item?.plan_id || item?.commission_id;
const todayKey = () => new Date().toLocaleDateString('en-CA');
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};
const formatMoney = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

function hasPermission(workspace, permission) {
  return ['owner', 'admin'].includes(workspace?.access) || (workspace?.permissions || []).includes(permission);
}

function tabVisible(workspace, tab) {
  if (tab.permission) return hasPermission(workspace, tab.permission);
  return tab.any?.some((permission) => hasPermission(workspace, permission));
}

function friendlyError(error, fallback = 'The action could not be completed.') {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message && message !== '{}' && message !== '[object Object]' ? message : fallback;
}

export default function GymOwnerDashboardPhase3() {
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState('home');
  const [panel, setPanel] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [inviteForm, setInviteForm] = useState(emptyInvite);
  const [profileForm, setProfileForm] = useState({});
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [memberDirectory, setMemberDirectory] = useState(null);
  const [memberLoading, setMemberLoading] = useState(false);

  const load = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [data, commissionData] = await Promise.all([
        platformClient.getWorkspace(),
        platformClient.getCommissions().catch(() => null),
      ]);
      const merged = {
        ...data,
        commissions: commissionData?.items || data.commissions || [],
        commission_summary: commissionData?.summary || data.commission_summary || {},
      };
      setWorkspace(merged);
      setProfileForm({
        name: merged.gym?.name || '',
        phone: merged.gym?.phone || '',
        email: merged.gym?.email || merged.gym?.contact_email || '',
        address: merged.gym?.address || '',
        city: merged.gym?.city || '',
        state: merged.gym?.state || '',
        pincode: merged.gym?.pincode || '',
        description: merged.gym?.description || '',
      });
      const firstVisible = PERMISSION_TABS.find((item) => tabVisible(merged, item));
      if (!tabVisible(merged, PERMISSION_TABS.find((item) => item.key === tab))) setTab(firstVisible?.key || 'home');
    } catch (requestError) {
      const message = friendlyError(requestError, 'Could not load the gym workspace.');
      setError(message);
      if (requestError?.status === 401) {
        await endAuthSession('local').catch(() => null);
        window.location.replace('/login/gym-owner');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadMemberDirectory = async (page = memberPage, search = memberSearch) => {
    if (!workspace || !hasPermission(workspace, 'members:read')) return;
    setMemberLoading(true);
    try {
      const [appResult, manualResult] = await Promise.all([
        platformClient.getCollection('app-members', { page, page_size: 20, search }),
        platformClient.getCollection('manual-members', { page, page_size: 20, search }),
      ]);
      setMemberDirectory({
        app: appResult,
        manual: manualResult,
        items: [...(appResult.items || []), ...(manualResult.items || [])]
          .sort((a, b) => new Date(b.joined_at || b.created_at || 0) - new Date(a.joined_at || a.created_at || 0)),
        total: Number(appResult.total || 0) + Number(manualResult.total || 0),
        totalPages: Math.max(Number(appResult.total_pages || 1), Number(manualResult.total_pages || 1)),
      });
      setMemberPage(page);
    } catch (requestError) {
      toast({ title: 'Member directory unavailable', description: friendlyError(requestError), variant: 'destructive' });
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'members' && workspace && !memberDirectory) loadMemberDirectory(1, '');
  }, [tab, workspace]);

  const members = memberDirectory?.items || workspace?.members || [];
  const activeMembers = useMemo(() => (workspace?.members || []).filter((member) => ['active', 'approved'].includes(member.status)), [workspace]);
  const openAttendance = useMemo(() => (workspace?.attendance || []).filter((row) => row.status === 'checked_in' && !row.check_out_at), [workspace]);
  const todayAttendance = useMemo(() => (workspace?.attendance || []).filter((row) => row.date === todayKey() || String(row.check_in_at || '').startsWith(todayKey())), [workspace]);
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    return (workspace?.payments || []).filter((row) => {
      const date = new Date(row.paid_at || row.created_at);
      return row.status === 'paid' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [workspace]);

  const attendanceMember = (row) => {
    const source = workspace?.members || [];
    if (row.membership_id) return source.find((member) => member.member_type === 'app' && itemId(member) === row.membership_id);
    if (row.manual_member_id) return source.find((member) => member.member_type === 'manual' && itemId(member) === row.manual_member_id);
    return source.find((member) => member.user_id && member.user_id === row.user_id);
  };

  const mutate = async (operation, successMessage, after) => {
    setSaving(true);
    setError('');
    try {
      const result = await operation();
      toast({ title: successMessage });
      after?.(result);
      setMemberDirectory(null);
      await load({ background: true });
      return result;
    } catch (requestError) {
      const message = friendlyError(requestError);
      setError(message);
      toast({ title: 'Action failed', description: message, variant: 'destructive' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await endAuthSession('local').catch(() => null);
    window.location.replace('/welcome');
  };

  const copyText = async (value, title = 'Copied') => {
    if (!value) return;
    await navigator.clipboard?.writeText(value).catch(() => null);
    toast({ title });
  };

  const exportCsv = async (resource) => {
    setSaving(true);
    try {
      const blob = await platformClient.exportCsv(resource);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({ title: `${resource} export ready` });
    } catch (requestError) {
      toast({ title: 'Export failed', description: friendlyError(requestError), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addMember = (event) => {
    event.preventDefault();
    mutate(() => platformClient.addManualMember(memberForm), 'Member added', () => { setMemberForm(emptyMember); setPanel(''); });
  };
  const changeMemberStatus = (member, status) => mutate(
    () => platformClient.updateMember(member.member_type, itemId(member), { status }),
    'Member status updated',
  );
  const archiveManualMember = (member) => {
    if (!window.confirm(`Archive ${member.full_name || member.name}?`)) return;
    mutate(() => platformClient.archiveManualMember(itemId(member)), 'Member archived');
  };
  const checkIn = (member) => mutate(
    () => platformClient.checkIn({ member_type: member.member_type, member_id: itemId(member), method: 'manual', date: todayKey() }),
    `${member.full_name || member.name} checked in`,
  );
  const checkOut = (row) => mutate(() => platformClient.checkOut(itemId(row)), 'Member checked out');

  const addPayment = (event) => {
    event.preventDefault();
    const selectedMember = (workspace.members || []).find((member) => itemId(member) === paymentForm.member_id);
    mutate(() => platformClient.addPayment({
      member_id: paymentForm.member_id || null,
      member_type: selectedMember?.member_type,
      amount: Number(paymentForm.amount),
      currency: 'INR',
      status: 'paid',
      method: paymentForm.method,
      notes: paymentForm.notes,
      payment_reference: paymentForm.payment_reference || null,
    }), 'Payment recorded', () => { setPaymentForm(emptyPayment); setPanel(''); });
  };
  const updatePaymentStatus = (payment, status) => mutate(
    () => platformClient.updatePayment(itemId(payment), { status }),
    `Payment marked ${status}`,
  );

  const addPlan = (event) => {
    event.preventDefault();
    mutate(() => platformClient.addPlan({
      name: planForm.name,
      price: Number(planForm.price),
      billing_cycle: planForm.billing_cycle,
      duration_days: planForm.duration_days ? Number(planForm.duration_days) : null,
      features: planForm.features.split(',').map((value) => value.trim()).filter(Boolean),
      active: true,
    }), 'Membership plan created', () => { setPlanForm(emptyPlan); setPanel(''); });
  };
  const togglePlan = (plan) => mutate(
    () => platformClient.updatePlan(itemId(plan), { active: !plan.active }),
    plan.active ? 'Plan paused' : 'Plan activated',
  );

  const addEquipment = (event) => {
    event.preventDefault();
    mutate(() => platformClient.addEquipment({ ...equipmentForm, quantity: Number(equipmentForm.quantity), available: true }), 'Equipment added', () => { setEquipmentForm(emptyEquipment); setPanel(''); });
  };
  const toggleEquipment = (item) => mutate(() => platformClient.updateEquipment(itemId(item), { available: !item.available }), item.available ? 'Equipment unavailable' : 'Equipment available');
  const removeEquipment = (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    mutate(() => platformClient.deleteEquipment(itemId(item)), 'Equipment deleted');
  };

  const addLead = (event) => {
    event.preventDefault();
    mutate(() => platformClient.addLead(leadForm), 'Lead added', () => { setLeadForm(emptyLead); setPanel(''); });
  };
  const updateLead = (lead, status) => mutate(() => platformClient.updateLead(itemId(lead), { status }), 'Lead updated');
  const removeLead = (lead) => {
    if (!window.confirm(`Delete ${lead.name || lead.full_name}?`)) return;
    mutate(() => platformClient.deleteLead(itemId(lead)), 'Lead deleted');
  };

  const addAnnouncement = (event) => {
    event.preventDefault();
    mutate(() => platformClient.addAnnouncement({ ...announcementForm, is_published: true }), 'Announcement published', () => { setAnnouncementForm(emptyAnnouncement); setPanel(''); });
  };
  const toggleAnnouncement = (announcement) => mutate(() => platformClient.updateAnnouncement(itemId(announcement), { is_published: !announcement.is_published }), announcement.is_published ? 'Announcement hidden' : 'Announcement published');
  const removeAnnouncement = (announcement) => {
    if (!window.confirm(`Delete “${announcement.title}”?`)) return;
    mutate(() => platformClient.deleteAnnouncement(itemId(announcement)), 'Announcement deleted');
  };

  const inviteStaff = (event) => {
    event.preventDefault();
    mutate(() => platformClient.inviteStaff(inviteForm), 'Staff invitation created', (result) => {
      setInviteForm(emptyInvite);
      setPanel('');
      const shareUrl = result?.invitation_url || (result?.invitation_path ? `${window.location.origin}${result.invitation_path}` : '');
      if (shareUrl) copyText(shareUrl, result?.delivery === 'email' ? 'Invitation emailed and copied' : 'Invitation link copied');
      if (result?.configuration_required) {
        toast({ title: 'Email delivery needs configuration', description: 'Set STAFF_INVITATION_URL in Render. The manual link was copied.' });
      }
    });
  };
  const revokeInvite = (invite) => mutate(() => platformClient.revokeStaffInvitation(invite.invitation_id), 'Invitation revoked');
  const changeStaffStatus = (staff, status) => mutate(() => platformClient.updateStaff(staff.id, { status }), 'Staff access updated');
  const removeStaff = (staff) => {
    if (!window.confirm(`Remove ${staff.name || staff.email} from this gym?`)) return;
    mutate(() => platformClient.removeStaff(staff.id), 'Staff access removed');
  };

  const saveProfile = (event) => {
    event.preventDefault();
    mutate(() => platformClient.updateProfile(profileForm), 'Gym profile updated', () => setPanel(''));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-accent" size={30} /></div>;
  if (!workspace) return <div className="min-h-screen bg-background px-4 py-20 text-foreground"><div className="mx-auto max-w-md"><ErrorPanel message={error || 'Gym access is not active.'} onRetry={() => load()} /></div></div>;

  const gym = workspace.gym || {};
  const commission = workspace.commission_summary || {};
  const visibleTabs = PERMISSION_TABS.filter((item) => tabVisible(workspace, item));
  const isOwner = ['owner', 'admin'].includes(workspace.access);

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/92 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-accent">{workspace.access === 'staff' ? `${workspace.staff_profile?.role || 'Staff'} workspace` : 'Gym owner workspace'}</p>
            <h1 className="truncate font-heading text-lg font-black">{gym.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Refresh workspace" onClick={() => load({ background: true })} disabled={refreshing} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card"><RefreshCw size={16} className={refreshing ? 'animate-spin text-accent' : ''} /></button>
            <button type="button" aria-label="Sign out" onClick={signOut} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {error && <ErrorPanel message={error} onRetry={() => load({ background: true })} />}

        {tab === 'home' && (
          <>
            <section className="relative overflow-hidden rounded-[30px] border border-accent/20 bg-gradient-to-br from-accent/[0.15] via-card to-card p-5">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">Shared live platform</p><h2 className="mt-2 font-heading text-2xl font-black">{gym.city || 'Your gym'} at a glance</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">The app and website operate on the same verified gym records.</p></div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><ShieldCheck size={21} /></span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {hasPermission(workspace, 'members:read') && <MetricCard icon={Users} label="Active members" value={activeMembers.length} detail={`${workspace.members?.length || 0} loaded`} />}
                  {hasPermission(workspace, 'attendance:read') && <MetricCard icon={CalendarCheck} label="Today's visits" value={todayAttendance.length} detail={`${openAttendance.length} inside now`} />}
                  {hasPermission(workspace, 'payments:read') && <MetricCard icon={IndianRupee} label="Gym revenue" value={formatMoney(monthlyRevenue)} detail="Recorded this month" />}
                  {hasPermission(workspace, 'reports:read') && <MetricCard icon={BadgeIndianRupee} label="App commission" value={formatMoney(commission.pending || 0, commission.currency)} detail="Pending partner commission" />}
                </div>
              </div>
            </section>

            {gym.referral_code && (
              <button type="button" onClick={() => copyText(gym.referral_code, 'Referral code copied')} className="flex w-full items-center gap-3 rounded-[24px] border border-border bg-card p-4 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Copy size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gym referral code</span><span className="mt-1 block truncate font-mono text-lg font-black">{gym.referral_code}</span></span><ChevronRight size={17} className="text-muted-foreground" />
              </button>
            )}

            <SectionCard title="Quick actions" description="Only actions allowed for your role are shown">
              <div className="grid grid-cols-2 gap-2.5">
                {hasPermission(workspace, 'members:write') && <QuickAction icon={UserPlus} label="Add member" onClick={() => { setTab('members'); setPanel('member'); }} />}
                {hasPermission(workspace, 'attendance:write') && <QuickAction icon={UserCheck} label="Check in" onClick={() => setTab('attendance')} />}
                {hasPermission(workspace, 'payments:write') && <QuickAction icon={CreditCard} label="Record payment" onClick={() => { setTab('business'); setPanel('payment'); }} />}
                {hasPermission(workspace, 'announcements:write') && <QuickAction icon={Megaphone} label="Announcement" onClick={() => { setTab('more'); setPanel('announcement'); }} />}
              </div>
            </SectionCard>
          </>
        )}

        {tab === 'members' && (
          <SectionCard title="Members" description="App-linked and manual gym members" action={<div className="flex gap-2">{hasPermission(workspace, 'reports:read') && <IconButton label="Export members" onClick={() => exportCsv('members')} icon={Download} />}{hasPermission(workspace, 'members:write') && <IconButton label="Add member" onClick={() => setPanel(panel === 'member' ? '' : 'member')} icon={Plus} primary />}</div>}>
            {panel === 'member' && (
              <InlineForm title="Add manual member" onClose={() => setPanel('')}>
                <form onSubmit={addMember} className="space-y-3"><Field label="Full name"><Input value={memberForm.name} onChange={(event) => setMemberForm((form) => ({ ...form, name: event.target.value }))} required maxLength={120} /></Field><Field label="Email"><Input type="email" value={memberForm.email} onChange={(event) => setMemberForm((form) => ({ ...form, email: event.target.value }))} /></Field><Field label="Phone"><Input inputMode="tel" value={memberForm.phone} onChange={(event) => setMemberForm((form) => ({ ...form, phone: event.target.value }))} /></Field><Field label="Notes"><Input value={memberForm.notes} onChange={(event) => setMemberForm((form) => ({ ...form, notes: event.target.value }))} maxLength={500} /></Field><SaveButton saving={saving} label="Save member" /></form>
              </InlineForm>
            )}
            <form onSubmit={(event) => { event.preventDefault(); loadMemberDirectory(1, memberSearch); }} className="mt-3 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members" className="pl-9" /></div><Button type="submit" variant="outline" disabled={memberLoading}>Search</Button></form>
            <div className="mt-3 space-y-2.5">
              {memberLoading ? <CenteredLoader /> : members.length === 0 ? <EmptyState icon={Users} title="No members found" description="Add a member or change your search." /> : members.map((member) => {
                const active = ['active', 'approved'].includes(member.status);
                return <div key={`${member.member_type}-${itemId(member)}`} className="rounded-2xl border border-border bg-background/50 p-3.5"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading font-black ${active ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>{String(member.full_name || member.name || 'M').charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{member.full_name || member.name}</p><Badge text={member.member_type === 'app' ? 'App' : 'Manual'} /></div><p className="mt-1 truncate text-[10px] text-muted-foreground">{member.email || member.phone || formatDate(member.joined_at || member.created_at)}</p></div>{hasPermission(workspace, 'members:write') && <button type="button" aria-label={active ? 'Deactivate member' : 'Activate member'} disabled={saving} onClick={() => changeMemberStatus(member, active ? 'inactive' : 'active')} className={`flex h-9 w-9 items-center justify-center rounded-xl border ${active ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border bg-card text-muted-foreground'}`}>{active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>}</div>{active && hasPermission(workspace, 'attendance:write') && <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => checkIn(member)} className="mt-3 h-9 w-full rounded-xl"><UserCheck size={14} className="mr-2" /> Check in</Button>}{member.member_type === 'manual' && hasPermission(workspace, 'members:write') && <button type="button" onClick={() => archiveManualMember(member)} className="mt-2 w-full py-1 text-[9px] font-bold uppercase tracking-wider text-destructive">Archive manual member</button>}</div>;
              })}
            </div>
            {memberDirectory && memberDirectory.totalPages > 1 && <Pagination page={memberPage} totalPages={memberDirectory.totalPages} loading={memberLoading} onPage={(next) => loadMemberDirectory(next, memberSearch)} />}
          </SectionCard>
        )}

        {tab === 'attendance' && (
          <>
            <SectionCard title="Currently inside" description={`${openAttendance.length} open visits`} action={hasPermission(workspace, 'reports:read') ? <IconButton label="Export attendance" onClick={() => exportCsv('attendance')} icon={Download} /> : null}>
              <div className="space-y-2.5">{openAttendance.length === 0 ? <EmptyState icon={CalendarCheck} title="No active check-ins" description="Check in an active member from the Members tab." /> : openAttendance.map((row) => { const member = attendanceMember(row); return <div key={itemId(row)} className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] p-3.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Check size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{member?.full_name || member?.name || 'Gym member'}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Checked in {formatDate(row.check_in_at)}</p></div>{hasPermission(workspace, 'attendance:write') && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => checkOut(row)} className="h-9 rounded-xl">Check out</Button>}</div>; })}</div>
            </SectionCard>
            <SectionCard title="Recent attendance" description={`${todayAttendance.length} visits today`}><div className="space-y-2">{(workspace.attendance || []).slice(0, 100).map((row) => { const member = attendanceMember(row); return <div key={itemId(row)} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-2.5"><CalendarCheck size={15} className="text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{member?.full_name || member?.name || 'Gym member'}</p><p className="text-[9px] text-muted-foreground">{formatDate(row.check_in_at)} · {row.status}</p></div>{row.duration_minutes !== null && row.duration_minutes !== undefined && <span className="text-[10px] font-bold text-muted-foreground">{row.duration_minutes}m</span>}</div>; })}</div></SectionCard>
          </>
        )}

        {tab === 'business' && (
          <>
            {hasPermission(workspace, 'payments:read') && <section className="grid grid-cols-2 gap-2.5"><MetricCard icon={IndianRupee} label="Gym revenue" value={formatMoney(monthlyRevenue)} detail="This month" />{hasPermission(workspace, 'reports:read') && <MetricCard icon={BadgeIndianRupee} label="Partner commission" value={formatMoney(commission.total || 0, commission.currency)} detail="Verified app subscriptions" />}</section>}

            {hasPermission(workspace, 'plans:read') && <SectionCard title="Gym membership plans" description="Plans for gym fees, separate from SE7EN FIT app subscriptions" action={<div className="flex gap-2">{hasPermission(workspace, 'reports:read') && <IconButton label="Export plans" onClick={() => exportCsv('plans')} icon={Download} />}{hasPermission(workspace, 'plans:write') && <IconButton label="Add plan" onClick={() => setPanel(panel === 'plan' ? '' : 'plan')} icon={Plus} primary />}</div>}>
              {panel === 'plan' && <InlineForm title="Create membership plan" onClose={() => setPanel('')}><form onSubmit={addPlan} className="space-y-3"><Field label="Plan name"><Input value={planForm.name} onChange={(event) => setPlanForm((form) => ({ ...form, name: event.target.value }))} required /></Field><div className="grid grid-cols-2 gap-2"><Field label="Price"><Input type="number" min="0" step="0.01" value={planForm.price} onChange={(event) => setPlanForm((form) => ({ ...form, price: event.target.value }))} required /></Field><Field label="Duration days"><Input type="number" min="1" max="3650" value={planForm.duration_days} onChange={(event) => setPlanForm((form) => ({ ...form, duration_days: event.target.value }))} /></Field></div><Field label="Billing cycle"><select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={planForm.billing_cycle} onChange={(event) => setPlanForm((form) => ({ ...form, billing_cycle: event.target.value }))}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half-yearly</option><option value="annual">Annual</option><option value="weekly">Weekly</option><option value="custom">Custom</option></select></Field><Field label="Features (comma separated)"><Input value={planForm.features} onChange={(event) => setPlanForm((form) => ({ ...form, features: event.target.value }))} /></Field><SaveButton saving={saving} label="Create plan" /></form></InlineForm>}
              <div className="mt-3 space-y-2">{(workspace.plans || []).length === 0 ? <EmptyState icon={ClipboardList} title="No plans" description="Create your gym membership fee plans." /> : (workspace.plans || []).map((plan) => <div key={itemId(plan)} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><IndianRupee size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{plan.name}</p><p className="text-[9px] text-muted-foreground">{formatMoney(plan.price)} · {plan.billing_cycle?.replaceAll('_', ' ')} · {plan.duration_days || 'custom'} days</p></div>{hasPermission(workspace, 'plans:write') && <button type="button" onClick={() => togglePlan(plan)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">{plan.active ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}</button>}</div>)}</div>
            </SectionCard>}

            {hasPermission(workspace, 'payments:read') && <SectionCard title="Gym payments" description="Manual membership-fee records" action={<div className="flex gap-2">{hasPermission(workspace, 'reports:read') && <IconButton label="Export payments" onClick={() => exportCsv('payments')} icon={Download} />}{hasPermission(workspace, 'payments:write') && <IconButton label="Record payment" onClick={() => setPanel(panel === 'payment' ? '' : 'payment')} icon={Plus} primary />}</div>}>
              {panel === 'payment' && <InlineForm title="Record gym payment" onClose={() => setPanel('')}><form onSubmit={addPayment} className="space-y-3"><Field label="Member (optional)"><select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={paymentForm.member_id} onChange={(event) => setPaymentForm((form) => ({ ...form, member_id: event.target.value }))}><option value="">Walk-in / unassigned</option>{(workspace.members || []).map((member) => <option key={`${member.member_type}-${itemId(member)}`} value={itemId(member)}>{member.full_name || member.name}</option>)}</select></Field><Field label="Amount"><Input type="number" min="1" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((form) => ({ ...form, amount: event.target.value }))} required /></Field><Field label="Method"><select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={paymentForm.method} onChange={(event) => setPaymentForm((form) => ({ ...form, method: event.target.value }))}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></select></Field><Field label="Reference"><Input value={paymentForm.payment_reference} onChange={(event) => setPaymentForm((form) => ({ ...form, payment_reference: event.target.value }))} maxLength={120} /></Field><Field label="Notes"><Input value={paymentForm.notes} onChange={(event) => setPaymentForm((form) => ({ ...form, notes: event.target.value }))} maxLength={500} /></Field><SaveButton saving={saving} label="Save payment" /></form></InlineForm>}
              <div className="mt-3 space-y-2">{(workspace.payments || []).length === 0 ? <EmptyState icon={CreditCard} title="No gym payments" description="Record cash, UPI, card or bank-transfer payments." /> : (workspace.payments || []).slice(0, 100).map((payment) => <div key={itemId(payment)} className="rounded-xl border border-border bg-background/45 p-3"><div className="flex items-center gap-3"><CreditCard size={16} className="text-accent" /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{formatMoney(payment.amount, payment.currency)}</p><p className="text-[9px] text-muted-foreground">{payment.method || 'manual'} · {formatDate(payment.paid_at)}</p></div><Badge text={payment.status} tone={payment.status === 'paid' ? 'green' : payment.status === 'refunded' ? 'red' : 'neutral'} /></div>{hasPermission(workspace, 'payments:write') && payment.status === 'paid' && <div className="mt-2 flex gap-2"><SmallAction label="Refunded" onClick={() => updatePaymentStatus(payment, 'refunded')} /><SmallAction label="Cancelled" onClick={() => updatePaymentStatus(payment, 'cancelled')} /></div>}</div>)}</div>
            </SectionCard>}

            {hasPermission(workspace, 'reports:read') && <SectionCard title="SE7EN FIT commission ledger" description="20% from successful attributed app subscriptions"><div className="grid grid-cols-2 gap-2.5"><MiniMetric label="Pending" value={formatMoney(commission.pending || 0, commission.currency)} /><MiniMetric label="Approved" value={formatMoney(commission.approved || 0, commission.currency)} /><MiniMetric label="Paid" value={formatMoney(commission.paid || 0, commission.currency)} /><MiniMetric label="Reversed" value={formatMoney(commission.reversed || 0, commission.currency)} /></div><div className="mt-3 space-y-2">{(workspace.commissions || []).length === 0 ? <EmptyState icon={Wallet} title="No commission yet" description="Commission appears after a referred member completes a paid app subscription." /> : (workspace.commissions || []).slice(0, 100).map((row) => <div key={row.commission_id} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-3"><BadgeIndianRupee size={16} className="text-accent" /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{formatMoney(row.commission_amount, row.currency)}</p><p className="text-[9px] text-muted-foreground">From {formatMoney(row.gross_amount, row.currency)} · {formatDate(row.created_at)}</p></div><Badge text={row.status} tone={row.status === 'paid' ? 'green' : row.status === 'reversed' ? 'red' : 'neutral'} /></div>)}</div></SectionCard>}
          </>
        )}

        {tab === 'more' && (
          <>
            {hasPermission(workspace, 'equipment:read') && <SectionCard title="Equipment" description="Shared inventory" action={<div className="flex gap-2">{hasPermission(workspace, 'reports:read') && <IconButton label="Export equipment" onClick={() => exportCsv('equipment')} icon={Download} />}{hasPermission(workspace, 'equipment:write') && <IconButton label="Add equipment" onClick={() => setPanel(panel === 'equipment' ? '' : 'equipment')} icon={Plus} primary />}</div>}>
              {panel === 'equipment' && <InlineForm title="Add equipment" onClose={() => setPanel('')}><form onSubmit={addEquipment} className="space-y-3"><Field label="Name"><Input value={equipmentForm.name} onChange={(event) => setEquipmentForm((form) => ({ ...form, name: event.target.value }))} required /></Field><Field label="Category"><Input value={equipmentForm.category} onChange={(event) => setEquipmentForm((form) => ({ ...form, category: event.target.value }))} /></Field><Field label="Quantity"><Input type="number" min="1" max="100000" value={equipmentForm.quantity} onChange={(event) => setEquipmentForm((form) => ({ ...form, quantity: event.target.value }))} required /></Field><SaveButton saving={saving} label="Save equipment" /></form></InlineForm>}
              <div className="mt-3 space-y-2">{(workspace.equipment || []).length === 0 ? <EmptyState icon={Dumbbell} title="No equipment" description="Add real equipment to your inventory." /> : (workspace.equipment || []).map((item) => <div key={itemId(item)} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-3"><Dumbbell size={16} className={item.available ? 'text-accent' : 'text-muted-foreground'} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.name}</p><p className="text-[9px] text-muted-foreground">{item.category || 'General'} · Qty {item.quantity}</p></div>{hasPermission(workspace, 'equipment:write') && <><button type="button" onClick={() => toggleEquipment(item)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">{item.available ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}</button><button type="button" onClick={() => removeEquipment(item)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/25 text-destructive"><Trash2 size={14} /></button></>}</div>)}</div>
            </SectionCard>}

            {hasPermission(workspace, 'leads:read') && <SectionCard title="Leads" description="Potential gym members" action={<div className="flex gap-2">{hasPermission(workspace, 'reports:read') && <IconButton label="Export leads" onClick={() => exportCsv('leads')} icon={Download} />}{hasPermission(workspace, 'leads:write') && <IconButton label="Add lead" onClick={() => setPanel(panel === 'lead' ? '' : 'lead')} icon={Plus} primary />}</div>}>
              {panel === 'lead' && <InlineForm title="Add lead" onClose={() => setPanel('')}><form onSubmit={addLead} className="space-y-3"><Field label="Name"><Input value={leadForm.name} onChange={(event) => setLeadForm((form) => ({ ...form, name: event.target.value }))} required /></Field><Field label="Phone"><Input value={leadForm.phone} onChange={(event) => setLeadForm((form) => ({ ...form, phone: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={leadForm.email} onChange={(event) => setLeadForm((form) => ({ ...form, email: event.target.value }))} /></Field><Field label="Source"><Input value={leadForm.source} onChange={(event) => setLeadForm((form) => ({ ...form, source: event.target.value }))} /></Field><Field label="Message"><Input value={leadForm.message} onChange={(event) => setLeadForm((form) => ({ ...form, message: event.target.value }))} /></Field><SaveButton saving={saving} label="Save lead" /></form></InlineForm>}
              <div className="mt-3 space-y-2">{(workspace.leads || []).length === 0 ? <EmptyState icon={ClipboardList} title="No leads" description="Add walk-ins or connect website enquiries." /> : (workspace.leads || []).map((lead) => <div key={itemId(lead)} className="rounded-xl border border-border bg-background/45 p-3"><div className="flex items-start gap-3"><ClipboardList size={16} className="mt-0.5 text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{lead.name || lead.full_name}</p><p className="mt-0.5 truncate text-[9px] text-muted-foreground">{lead.phone || lead.email || lead.source}</p></div><Badge text={lead.status} /></div>{hasPermission(workspace, 'leads:write') && <div className="mt-2 grid grid-cols-3 gap-2"><SmallAction label="Contacted" onClick={() => updateLead(lead, 'contacted')} /><SmallAction label="Converted" onClick={() => updateLead(lead, 'converted')} primary /><SmallAction label="Delete" onClick={() => removeLead(lead)} destructive /></div>}</div>)}</div>
            </SectionCard>}

            {hasPermission(workspace, 'announcements:read') && <SectionCard title="Announcements" description="Updates for connected members" action={hasPermission(workspace, 'announcements:write') ? <IconButton label="New announcement" onClick={() => setPanel(panel === 'announcement' ? '' : 'announcement')} icon={Plus} primary /> : null}>
              {panel === 'announcement' && <InlineForm title="Publish announcement" onClose={() => setPanel('')}><form onSubmit={addAnnouncement} className="space-y-3"><Field label="Title"><Input value={announcementForm.title} onChange={(event) => setAnnouncementForm((form) => ({ ...form, title: event.target.value }))} required /></Field><Field label="Message"><textarea className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={announcementForm.body} onChange={(event) => setAnnouncementForm((form) => ({ ...form, body: event.target.value }))} required maxLength={4000} /></Field><Field label="Audience"><select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={announcementForm.audience} onChange={(event) => setAnnouncementForm((form) => ({ ...form, audience: event.target.value }))}><option value="all_members">All members</option><option value="active_members">Active members</option><option value="staff">Staff</option></select></Field><SaveButton saving={saving} label="Publish" /></form></InlineForm>}
              <div className="mt-3 space-y-2">{(workspace.announcements || []).length === 0 ? <EmptyState icon={Bell} title="No announcements" description="Publish your first member update." /> : (workspace.announcements || []).map((announcement) => <div key={itemId(announcement)} className="flex items-start gap-3 rounded-xl border border-border bg-background/45 p-3"><Bell size={15} className={announcement.is_published ? 'mt-0.5 text-accent' : 'mt-0.5 text-muted-foreground'} /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{announcement.title}</p><p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{announcement.body}</p></div>{hasPermission(workspace, 'announcements:write') && <><button type="button" onClick={() => toggleAnnouncement(announcement)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">{announcement.is_published ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}</button><button type="button" onClick={() => removeAnnouncement(announcement)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/25 text-destructive"><Trash2 size={14} /></button></>}</div>)}</div>
            </SectionCard>}

            {isOwner && <SectionCard title="Team access" description="Invite staff and control role permissions" action={<IconButton label="Invite staff" onClick={() => setPanel(panel === 'invite' ? '' : 'invite')} icon={UserPlus} primary />}>
              {panel === 'invite' && <InlineForm title="Invite staff member" onClose={() => setPanel('')}><form onSubmit={inviteStaff} className="space-y-3"><Field label="Name"><Input value={inviteForm.name} onChange={(event) => setInviteForm((form) => ({ ...form, name: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm((form) => ({ ...form, email: event.target.value }))} required /></Field><Field label="Phone"><Input value={inviteForm.phone} onChange={(event) => setInviteForm((form) => ({ ...form, phone: event.target.value }))} /></Field><Field label="Role"><select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={inviteForm.role} onChange={(event) => setInviteForm((form) => ({ ...form, role: event.target.value }))}><option value="manager">Manager</option><option value="receptionist">Receptionist</option><option value="trainer">Trainer</option><option value="accountant">Accountant</option></select></Field><SaveButton saving={saving} label="Create invitation" /></form></InlineForm>}
              <div className="mt-3 space-y-2">{(workspace.staff || []).map((staff) => <div key={staff.id} className="rounded-xl border border-border bg-background/45 p-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 font-heading font-black text-accent">{String(staff.name || staff.email || 'S').charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{staff.name || staff.email}</p><p className="text-[9px] text-muted-foreground">{staff.role} · {staff.status}</p></div><button type="button" onClick={() => changeStaffStatus(staff, staff.status === 'active' ? 'suspended' : 'active')} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">{staff.status === 'active' ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}</button><button type="button" onClick={() => removeStaff(staff)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/25 text-destructive"><Trash2 size={14} /></button></div></div>)}{!(workspace.staff || []).length && <EmptyState icon={Users} title="No staff accounts" description="Invite managers, receptionists, trainers or accountants." />}</div>
              {(workspace.staff_invitations || []).some((invite) => invite.status === 'pending') && <div className="mt-4 border-t border-border pt-4"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Pending invitations</p><div className="space-y-2">{workspace.staff_invitations.filter((invite) => invite.status === 'pending').map((invite) => <div key={invite.invitation_id} className="flex items-center gap-3 rounded-xl border border-border p-3"><UserPlus size={15} className="text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{invite.email}</p><p className="text-[9px] text-muted-foreground">{invite.role} · expires {formatDate(invite.expires_at)}</p></div><button type="button" onClick={() => revokeInvite(invite)} className="text-[9px] font-bold uppercase text-destructive">Revoke</button></div>)}</div></div>}
            </SectionCard>}

            {hasPermission(workspace, 'settings:write') && <SectionCard title="Gym profile" description="Shared across app and website" action={<IconButton label="Edit profile" onClick={() => setPanel(panel === 'profile' ? '' : 'profile')} icon={Pencil} />}>
              {panel === 'profile' ? <InlineForm title="Edit gym profile" onClose={() => setPanel('')}><form onSubmit={saveProfile} className="space-y-3"><Field label="Gym name"><Input value={profileForm.name || ''} onChange={(event) => setProfileForm((form) => ({ ...form, name: event.target.value }))} required /></Field><Field label="Phone"><Input value={profileForm.phone || ''} onChange={(event) => setProfileForm((form) => ({ ...form, phone: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={profileForm.email || ''} onChange={(event) => setProfileForm((form) => ({ ...form, email: event.target.value }))} /></Field><Field label="Address"><Input value={profileForm.address || ''} onChange={(event) => setProfileForm((form) => ({ ...form, address: event.target.value }))} /></Field><div className="grid grid-cols-2 gap-2"><Field label="City"><Input value={profileForm.city || ''} onChange={(event) => setProfileForm((form) => ({ ...form, city: event.target.value }))} /></Field><Field label="Pincode"><Input value={profileForm.pincode || ''} onChange={(event) => setProfileForm((form) => ({ ...form, pincode: event.target.value }))} /></Field></div><Field label="Description"><textarea className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={profileForm.description || ''} onChange={(event) => setProfileForm((form) => ({ ...form, description: event.target.value }))} maxLength={2000} /></Field><SaveButton saving={saving} label="Save profile" /></form></InlineForm> : <div className="rounded-2xl bg-background/50 p-4"><p className="text-sm font-bold">{gym.name}</p><p className="mt-1 text-xs text-muted-foreground">{[gym.address, gym.city, gym.state, gym.pincode].filter(Boolean).join(', ') || 'Address not added'}</p><p className="mt-2 text-[10px] text-muted-foreground">{gym.phone || gym.email || 'Contact details not added'}</p></div>}
            </SectionCard>}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-2">{visibleTabs.map(({ key, label, icon: Icon }) => { const selected = tab === key; return <button key={key} type="button" onClick={() => { setTab(key); setPanel(''); }} className={`flex min-h-14 min-w-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[9px] font-bold ${selected ? 'text-accent' : 'text-muted-foreground'}`}><span className={`flex h-8 w-12 items-center justify-center rounded-full ${selected ? 'bg-accent/12' : ''}`}><Icon size={19} /></span>{label}</button>; })}</div>
      </nav>
    </div>
  );
}

function SectionCard({ title, description, action, children }) {
  return <section className="rounded-[26px] border border-border bg-card p-4"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-heading text-base font-black">{title}</h2>{description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}</div>{action}</div>{children}</section>;
}
function MetricCard({ icon: Icon, label, value, detail }) {
  return <div className="rounded-[22px] border border-border bg-card p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon size={17} /></span><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 font-heading text-lg font-black">{value}</p>{detail && <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>}</div>;
}
function MiniMetric({ label, value }) {
  return <div className="rounded-2xl border border-border bg-background/45 p-3"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}
function InlineForm({ title, onClose, children }) {
  return <div className="rounded-[22px] border border-accent/25 bg-accent/[0.06] p-4"><div className="mb-4 flex items-center justify-between gap-3"><p className="font-heading text-sm font-black">{title}</p><button type="button" aria-label="Close form" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background"><X size={15} /></button></div>{children}</div>;
}
function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}
function SaveButton({ saving, label }) {
  return <Button disabled={saving} className="h-11 w-full rounded-xl">{saving && <Loader2 size={14} className="mr-2 animate-spin" />}{label}</Button>;
}
function QuickAction({ icon: Icon, label, onClick }) {
  return <button type="button" onClick={onClick} className="flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-border bg-background/55 p-3 text-left active:scale-[0.98]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon size={17} /></span><span className="text-xs font-bold">{label}</span></button>;
}
function IconButton({ icon: Icon, label, onClick, primary = false }) {
  return <button type="button" aria-label={label} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-xl border ${primary ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-background text-foreground'}`}><Icon size={15} /></button>;
}
function SmallAction({ label, onClick, primary = false, destructive = false }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border py-2 text-[9px] font-bold ${destructive ? 'border-destructive/25 text-destructive' : primary ? 'border-accent bg-accent text-accent-foreground' : 'border-border'}`}>{label}</button>;
}
function Badge({ text, tone = 'neutral' }) {
  const style = tone === 'green' ? 'bg-accent/10 text-accent' : tone === 'red' ? 'bg-destructive/10 text-destructive' : 'border border-border text-muted-foreground';
  return <span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase ${style}`}>{String(text || 'unknown').replaceAll('_', ' ')}</span>;
}
function EmptyState({ icon: Icon, title, description }) {
  return <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center"><Icon size={25} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}
function ErrorPanel({ message, onRetry }) {
  return <div className="rounded-[24px] border border-destructive/25 bg-destructive/10 p-5 text-center"><p className="text-sm font-semibold text-destructive">{message}</p><Button type="button" onClick={onRetry} variant="outline" className="mt-4 h-10 rounded-xl"><RefreshCw size={15} className="mr-2" /> Try again</Button></div>;
}
function CenteredLoader() {
  return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-accent" size={22} /></div>;
}
function Pagination({ page, totalPages, loading, onPage }) {
  return <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-2"><button type="button" disabled={loading || page <= 1} onClick={() => onPage(page - 1)} className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold disabled:opacity-35"><ChevronLeft size={15} /> Previous</button><span className="text-[10px] font-bold text-muted-foreground">{page} / {totalPages}</span><button type="button" disabled={loading || page >= totalPages} onClick={() => onPage(page + 1)} className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold disabled:opacity-35">Next <ChevronRight size={15} /></button></div>;
}
