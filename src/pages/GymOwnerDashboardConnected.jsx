import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeIndianRupee,
  Bell,
  Building2,
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  CreditCard,
  Dumbbell,
  IndianRupee,
  Loader2,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
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
import { base44 } from '@/api/base44Client';
import { platformClient } from '@/api/platformClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const TABS = [
  { key: 'overview', label: 'Home', icon: Building2 },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'earnings', label: 'Earnings', icon: Wallet },
  { key: 'more', label: 'More', icon: Settings },
];

const emptyMember = { name: '', email: '', phone: '', notes: '' };
const emptyEquipment = { name: '', category: 'Strength', quantity: 1 };
const emptyLead = { name: '', phone: '', email: '', source: 'Walk-in', message: '' };
const emptyPayment = { member_id: '', member_type: 'manual', amount: '', method: 'cash', notes: '' };
const emptyAnnouncement = { title: '', body: '', audience: 'all_members' };

const formatMoney = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const itemId = (item) => item?.id || item?.membership_id || item?.log_id || item?.equipment_id || item?.lead_id;

function ErrorPanel({ message, onRetry }) {
  return (
    <div className="rounded-[24px] border border-destructive/25 bg-destructive/10 p-5 text-center">
      <p className="text-sm font-semibold text-destructive">{message}</p>
      <Button type="button" onClick={onRetry} variant="outline" className="mt-4 h-10 rounded-xl">
        <RefreshCw size={15} className="mr-2" /> Try again
      </Button>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-[22px] border border-border bg-card p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon size={17} /></span>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-black">{value}</p>
      {detail && <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>}
    </div>
  );
}

function SectionCard({ title, description, action, children }) {
  return (
    <section className="rounded-[26px] border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-black">{title}</h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InlineForm({ title, onClose, children }) {
  return (
    <div className="rounded-[22px] border border-accent/25 bg-accent/[0.06] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-black">{title}</p>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background"><X size={15} /></button>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
      <Icon size={25} className="mx-auto text-muted-foreground" />
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default function GymOwnerDashboardConnected() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState('');
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement);
  const [profileForm, setProfileForm] = useState({});

  const load = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await platformClient.getWorkspace();
      setWorkspace(data);
      setProfileForm({
        name: data.gym?.name || '',
        phone: data.gym?.phone || '',
        email: data.gym?.email || data.gym?.contact_email || '',
        address: data.gym?.address || '',
        city: data.gym?.city || '',
        state: data.gym?.state || '',
        pincode: data.gym?.pincode || '',
        description: data.gym?.description || '',
      });
    } catch (requestError) {
      console.error('[GymOwnerDashboard] load failed:', requestError);
      if (requestError?.status === 401) {
        base44.auth.logout();
        navigate('/login/gym-owner', { replace: true });
        return;
      }
      setError(requestError?.message || 'Could not load the gym dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const members = workspace?.members || [];
  const activeMembers = useMemo(() => members.filter((member) => ['active', 'approved'].includes(member.status)), [members]);
  const openAttendance = useMemo(() => (workspace?.attendance || []).filter((row) => row.status === 'checked_in' && !row.check_out_at), [workspace]);
  const today = new Date().toLocaleDateString('en-CA');
  const todayAttendance = useMemo(() => (workspace?.attendance || []).filter((row) => row.date === today || String(row.check_in_at || '').startsWith(today)), [workspace, today]);
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    return (workspace?.payments || []).filter((row) => {
      const date = new Date(row.paid_at || row.created_at);
      return row.status === 'paid' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }, [workspace]);

  const memberMap = useMemo(() => new Map(members.map((member) => [`${member.member_type}:${itemId(member)}`, member])), [members]);
  const attendanceMember = (row) => {
    if (row.membership_id) return memberMap.get(`app:${row.membership_id}`);
    if (row.manual_member_id) return memberMap.get(`manual:${row.manual_member_id}`);
    return members.find((member) => member.user_id && member.user_id === row.user_id);
  };

  const mutate = async (operation, successMessage, after) => {
    setSaving(true);
    setError('');
    try {
      await operation();
      toast({ title: successMessage });
      after?.();
      await load({ background: true });
    } catch (requestError) {
      console.error('[GymOwnerDashboard] mutation failed:', requestError);
      const message = requestError?.message || 'The change could not be saved.';
      setError(message);
      toast({ title: 'Action failed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    base44.auth.logout();
    navigate('/welcome', { replace: true });
  };

  const copyReferral = async () => {
    const code = workspace?.gym?.referral_code;
    if (!code) return;
    await navigator.clipboard.writeText(code).catch(() => null);
    toast({ title: 'Referral code copied' });
  };

  const addMember = (event) => {
    event.preventDefault();
    mutate(
      () => platformClient.addManualMember(memberForm),
      'Member added',
      () => { setMemberForm(emptyMember); setPanel(''); },
    );
  };

  const changeMemberStatus = (member, status) => mutate(
    () => platformClient.updateMember(member.member_type, itemId(member), { status }),
    status === 'active' ? 'Member activated' : 'Member status updated',
  );

  const checkIn = (member) => mutate(
    () => platformClient.checkIn({ member_type: member.member_type, member_id: itemId(member), method: 'manual', date: today }),
    `${member.full_name || member.name} checked in`,
  );

  const checkOut = (row) => mutate(
    () => platformClient.checkOut(itemId(row)),
    'Member checked out',
  );

  const addEquipment = (event) => {
    event.preventDefault();
    mutate(
      () => platformClient.addEquipment({ ...equipmentForm, quantity: Number(equipmentForm.quantity || 1), available: true }),
      'Equipment added',
      () => { setEquipmentForm(emptyEquipment); setPanel(''); },
    );
  };

  const toggleEquipment = (item) => mutate(
    () => platformClient.updateEquipment(itemId(item), { available: !item.available }),
    item.available ? 'Equipment marked unavailable' : 'Equipment marked available',
  );

  const removeEquipment = (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    mutate(() => platformClient.deleteEquipment(itemId(item)), 'Equipment deleted');
  };

  const addLead = (event) => {
    event.preventDefault();
    mutate(
      () => platformClient.addLead(leadForm),
      'Lead added',
      () => { setLeadForm(emptyLead); setPanel(''); },
    );
  };

  const updateLead = (lead, status) => mutate(
    () => platformClient.updateLead(itemId(lead), { status }),
    'Lead updated',
  );

  const addPayment = (event) => {
    event.preventDefault();
    const selectedMember = members.find((member) => itemId(member) === paymentForm.member_id);
    mutate(
      () => platformClient.addPayment({
        ...paymentForm,
        member_id: paymentForm.member_id || null,
        member_type: selectedMember?.member_type,
        amount: Number(paymentForm.amount),
        currency: 'INR',
        status: 'paid',
      }),
      'Payment recorded',
      () => { setPaymentForm(emptyPayment); setPanel(''); },
    );
  };

  const addAnnouncement = (event) => {
    event.preventDefault();
    mutate(
      () => platformClient.addAnnouncement({ ...announcementForm, is_published: true }),
      'Announcement published',
      () => { setAnnouncementForm(emptyAnnouncement); setPanel(''); },
    );
  };

  const toggleAnnouncement = (announcement) => mutate(
    () => platformClient.updateAnnouncement(itemId(announcement), { is_published: !announcement.is_published }),
    announcement.is_published ? 'Announcement hidden' : 'Announcement published',
  );

  const saveProfile = (event) => {
    event.preventDefault();
    mutate(
      () => platformClient.updateProfile(profileForm),
      'Gym profile updated',
      () => setPanel(''),
    );
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-accent" size={30} /></div>;
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-background px-4 py-20 text-foreground">
        <div className="mx-auto max-w-md"><ErrorPanel message={error || 'Gym access is not active.'} onRetry={() => load()} /></div>
      </div>
    );
  }

  const gym = workspace.gym || {};
  const commission = workspace.commission_summary || {};

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/92 backdrop-blur-xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-accent">Gym owner</p>
            <h1 className="truncate font-heading text-lg font-black">{gym.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => load({ background: true })} disabled={refreshing} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card">
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-accent' : ''} />
            </button>
            <button type="button" onClick={signOut} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        {error && <ErrorPanel message={error} onRetry={() => load({ background: true })} />}

        {tab === 'overview' && (
          <>
            <section className="relative overflow-hidden rounded-[30px] border border-accent/20 bg-gradient-to-br from-accent/[0.15] via-card to-card p-5">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">Connected platform</p>
                    <h2 className="mt-2 font-heading text-2xl font-black">{gym.city || 'Your gym'} at a glance</h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">The mobile app and website now read and write the same Supabase records.</p>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><ShieldCheck size={21} /></span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <MetricCard icon={Users} label="Active members" value={activeMembers.length} detail={`${members.length} total records`} />
                  <MetricCard icon={CalendarCheck} label="Today's visits" value={todayAttendance.length} detail={`${openAttendance.length} currently inside`} />
                  <MetricCard icon={IndianRupee} label="Gym revenue" value={formatMoney(monthlyRevenue)} detail="Manual gym payments this month" />
                  <MetricCard icon={BadgeIndianRupee} label="App commission" value={formatMoney(commission.pending || 0, commission.currency)} detail="Pending 20% partner commission" />
                </div>
              </div>
            </section>

            {gym.referral_code && (
              <button type="button" onClick={copyReferral} className="flex w-full items-center gap-3 rounded-[24px] border border-border bg-card p-4 text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Copy size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gym referral code</span><span className="mt-1 block truncate font-mono text-lg font-black">{gym.referral_code}</span></span>
                <ChevronRight size={17} className="text-muted-foreground" />
              </button>
            )}

            <SectionCard title="Quick actions" description="Daily actions shared with the website dashboard">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Add member', icon: UserPlus, action: () => { setTab('members'); setPanel('member'); } },
                  { label: 'Check in', icon: UserCheck, action: () => setTab('attendance') },
                  { label: 'Record payment', icon: CreditCard, action: () => { setTab('earnings'); setPanel('payment'); } },
                  { label: 'Announcement', icon: Megaphone, action: () => { setTab('more'); setPanel('announcement'); } },
                ].map(({ label, icon: Icon, action }) => (
                  <button key={label} type="button" onClick={action} className="flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-border bg-background/55 p-3 text-left active:scale-[0.98]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon size={17} /></span>
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </SectionCard>
          </>
        )}

        {tab === 'members' && (
          <SectionCard
            title="Members"
            description="App-linked members and manually added gym members"
            action={<Button type="button" size="sm" onClick={() => setPanel(panel === 'member' ? '' : 'member')} className="h-9 rounded-xl"><Plus size={14} className="mr-1" /> Add</Button>}
          >
            {panel === 'member' && (
              <InlineForm title="Add manual member" onClose={() => setPanel('')}>
                <form onSubmit={addMember} className="space-y-3">
                  <Field label="Full name"><Input value={memberForm.name} onChange={(event) => setMemberForm((form) => ({ ...form, name: event.target.value }))} required maxLength={120} /></Field>
                  <Field label="Email"><Input type="email" value={memberForm.email} onChange={(event) => setMemberForm((form) => ({ ...form, email: event.target.value }))} /></Field>
                  <Field label="Phone"><Input inputMode="tel" value={memberForm.phone} onChange={(event) => setMemberForm((form) => ({ ...form, phone: event.target.value }))} /></Field>
                  <Field label="Notes"><Input value={memberForm.notes} onChange={(event) => setMemberForm((form) => ({ ...form, notes: event.target.value }))} maxLength={500} /></Field>
                  <Button disabled={saving} className="h-11 w-full rounded-xl">{saving && <Loader2 size={14} className="mr-2 animate-spin" />}Save member</Button>
                </form>
              </InlineForm>
            )}

            <div className="mt-3 space-y-2.5">
              {members.length === 0 ? <EmptyState icon={Users} title="No members yet" description="Add a manual member or share the gym referral code with app users." /> : members.map((member) => {
                const active = ['active', 'approved'].includes(member.status);
                return (
                  <div key={`${member.member_type}-${itemId(member)}`} className="rounded-2xl border border-border bg-background/50 p-3.5">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading font-black ${active ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>{String(member.full_name || member.name || 'M').charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{member.full_name || member.name}</p><span className="rounded-full border border-border px-2 py-0.5 text-[8px] uppercase text-muted-foreground">{member.member_type === 'app' ? 'App' : 'Manual'}</span></div>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground">{member.email || member.phone || formatDate(member.joined_at || member.created_at)}</p>
                      </div>
                      <button type="button" disabled={saving} onClick={() => changeMemberStatus(member, active ? 'inactive' : 'active')} className={`flex h-9 w-9 items-center justify-center rounded-xl border ${active ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border bg-card text-muted-foreground'}`}>
                        {active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </div>
                    {active && <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => checkIn(member)} className="mt-3 h-9 w-full rounded-xl"><UserCheck size={14} className="mr-2" /> Check in</Button>}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {tab === 'attendance' && (
          <>
            <SectionCard title="Currently inside" description="Open attendance sessions">
              <div className="space-y-2.5">
                {openAttendance.length === 0 ? <EmptyState icon={CalendarCheck} title="No active check-ins" description="Check in an active member from the Members tab." /> : openAttendance.map((row) => {
                  const member = attendanceMember(row);
                  return (
                    <div key={itemId(row)} className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] p-3.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Check size={18} /></span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{member?.full_name || member?.name || 'Gym member'}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Checked in {formatDate(row.check_in_at)}</p></div>
                      <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => checkOut(row)} className="h-9 rounded-xl">Check out</Button>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Recent attendance" description={`${todayAttendance.length} visits recorded today`}>
              <div className="space-y-2">
                {(workspace.attendance || []).slice(0, 30).map((row) => {
                  const member = attendanceMember(row);
                  return <div key={itemId(row)} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-2.5"><CalendarCheck size={15} className="text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{member?.full_name || member?.name || 'Gym member'}</p><p className="text-[9px] text-muted-foreground">{formatDate(row.check_in_at)} · {row.status}</p></div>{row.duration_minutes !== null && row.duration_minutes !== undefined && <span className="text-[10px] font-bold text-muted-foreground">{row.duration_minutes}m</span>}</div>;
                })}
              </div>
            </SectionCard>
          </>
        )}

        {tab === 'earnings' && (
          <>
            <section className="grid grid-cols-2 gap-2.5">
              <MetricCard icon={IndianRupee} label="Gym revenue" value={formatMoney(monthlyRevenue)} detail="This month" />
              <MetricCard icon={BadgeIndianRupee} label="Partner commission" value={formatMoney(commission.total || 0, commission.currency)} detail="All verified app payments" />
              <MetricCard icon={Wallet} label="Available / approved" value={formatMoney(commission.approved || 0, commission.currency)} detail="Awaiting payout processing" />
              <MetricCard icon={Check} label="Paid commission" value={formatMoney(commission.paid || 0, commission.currency)} detail="Completed payouts" />
            </section>

            <SectionCard title="Gym payments" description="Manual membership-fee records for your gym" action={<Button type="button" size="sm" onClick={() => setPanel(panel === 'payment' ? '' : 'payment')} className="h-9 rounded-xl"><Plus size={14} className="mr-1" /> Record</Button>}>
              {panel === 'payment' && (
                <InlineForm title="Record gym payment" onClose={() => setPanel('')}>
                  <form onSubmit={addPayment} className="space-y-3">
                    <Field label="Member (optional)"><select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={paymentForm.member_id} onChange={(event) => setPaymentForm((form) => ({ ...form, member_id: event.target.value }))}><option value="">Walk-in / unassigned</option>{members.map((member) => <option key={`${member.member_type}-${itemId(member)}`} value={itemId(member)}>{member.full_name || member.name}</option>)}</select></Field>
                    <Field label="Amount"><Input type="number" inputMode="decimal" min="1" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((form) => ({ ...form, amount: event.target.value }))} required /></Field>
                    <Field label="Method"><select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={paymentForm.method} onChange={(event) => setPaymentForm((form) => ({ ...form, method: event.target.value }))}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></select></Field>
                    <Field label="Notes"><Input value={paymentForm.notes} onChange={(event) => setPaymentForm((form) => ({ ...form, notes: event.target.value }))} maxLength={500} /></Field>
                    <Button disabled={saving} className="h-11 w-full rounded-xl">{saving && <Loader2 size={14} className="mr-2 animate-spin" />}Save payment</Button>
                  </form>
                </InlineForm>
              )}
              <div className="mt-3 space-y-2">
                {(workspace.payments || []).length === 0 ? <EmptyState icon={CreditCard} title="No gym payments" description="Record cash, UPI, card or bank-transfer payments." /> : (workspace.payments || []).slice(0, 50).map((payment) => <div key={itemId(payment)} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-3"><CreditCard size={16} className="text-accent" /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{formatMoney(payment.amount, payment.currency)}</p><p className="text-[9px] text-muted-foreground">{payment.method || 'manual'} · {formatDate(payment.paid_at)}</p></div><span className="rounded-full bg-accent/10 px-2 py-1 text-[9px] font-bold text-accent">{payment.status}</span></div>)}
              </div>
            </SectionCard>

            <SectionCard title="SE7EN FIT commission ledger" description="20% is generated only from attributed successful app subscription payments">
              <div className="space-y-2">
                {(workspace.commissions || []).length === 0 ? <EmptyState icon={Wallet} title="No commission yet" description="Commission appears after a referred member completes a paid app subscription." /> : (workspace.commissions || []).slice(0, 50).map((row) => <div key={row.commission_id} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-3"><BadgeIndianRupee size={16} className="text-accent" /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{formatMoney(row.commission_amount, row.currency)}</p><p className="text-[9px] text-muted-foreground">From {formatMoney(row.gross_amount, row.currency)} · {formatDate(row.created_at)}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.status === 'reversed' ? 'bg-destructive/10 text-destructive' : row.status === 'paid' ? 'bg-accent/10 text-accent' : 'bg-amber-400/10 text-amber-300'}`}>{row.status}</span></div>)}
              </div>
            </SectionCard>
          </>
        )}

        {tab === 'more' && (
          <>
            <SectionCard title="Equipment" description="Shared inventory for app and website" action={<Button type="button" size="sm" onClick={() => setPanel(panel === 'equipment' ? '' : 'equipment')} className="h-9 rounded-xl"><Plus size={14} className="mr-1" /> Add</Button>}>
              {panel === 'equipment' && (
                <InlineForm title="Add equipment" onClose={() => setPanel('')}>
                  <form onSubmit={addEquipment} className="space-y-3"><Field label="Name"><Input value={equipmentForm.name} onChange={(event) => setEquipmentForm((form) => ({ ...form, name: event.target.value }))} required /></Field><Field label="Category"><Input value={equipmentForm.category} onChange={(event) => setEquipmentForm((form) => ({ ...form, category: event.target.value }))} /></Field><Field label="Quantity"><Input type="number" min="1" max="100000" value={equipmentForm.quantity} onChange={(event) => setEquipmentForm((form) => ({ ...form, quantity: event.target.value }))} required /></Field><Button disabled={saving} className="h-11 w-full rounded-xl">Save equipment</Button></form>
                </InlineForm>
              )}
              <div className="mt-3 space-y-2">
                {(workspace.equipment || []).length === 0 ? <EmptyState icon={Dumbbell} title="No equipment" description="Add real equipment to your shared inventory." /> : (workspace.equipment || []).map((item) => <div key={itemId(item)} className="flex items-center gap-3 rounded-xl border border-border bg-background/45 px-3 py-3"><Dumbbell size={16} className={item.available ? 'text-accent' : 'text-muted-foreground'} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.name}</p><p className="text-[9px] text-muted-foreground">{item.category || 'General'} · Qty {item.quantity}</p></div><button type="button" onClick={() => toggleEquipment(item)} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">{item.available ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}</button><button type="button" onClick={() => removeEquipment(item)} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/25 text-destructive"><Trash2 size={14} /></button></div>)}
              </div>
            </SectionCard>

            <SectionCard title="Leads" description="Potential members from website and walk-ins" action={<Button type="button" size="sm" onClick={() => setPanel(panel === 'lead' ? '' : 'lead')} className="h-9 rounded-xl"><Plus size={14} className="mr-1" /> Add</Button>}>
              {panel === 'lead' && (
                <InlineForm title="Add lead" onClose={() => setPanel('')}>
                  <form onSubmit={addLead} className="space-y-3"><Field label="Name"><Input value={leadForm.name} onChange={(event) => setLeadForm((form) => ({ ...form, name: event.target.value }))} required /></Field><Field label="Phone"><Input value={leadForm.phone} onChange={(event) => setLeadForm((form) => ({ ...form, phone: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={leadForm.email} onChange={(event) => setLeadForm((form) => ({ ...form, email: event.target.value }))} /></Field><Field label="Source"><Input value={leadForm.source} onChange={(event) => setLeadForm((form) => ({ ...form, source: event.target.value }))} /></Field><Field label="Message"><Input value={leadForm.message} onChange={(event) => setLeadForm((form) => ({ ...form, message: event.target.value }))} /></Field><Button disabled={saving} className="h-11 w-full rounded-xl">Save lead</Button></form>
                </InlineForm>
              )}
              <div className="mt-3 space-y-2">
                {(workspace.leads || []).length === 0 ? <EmptyState icon={ClipboardList} title="No leads" description="Add walk-ins or connect website enquiry forms." /> : (workspace.leads || []).slice(0, 50).map((lead) => <div key={itemId(lead)} className="rounded-xl border border-border bg-background/45 p-3"><div className="flex items-start gap-3"><ClipboardList size={16} className="mt-0.5 text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{lead.name || lead.full_name}</p><p className="mt-0.5 truncate text-[9px] text-muted-foreground">{lead.phone || lead.email || lead.source}</p></div><span className="rounded-full border border-border px-2 py-1 text-[8px] uppercase text-muted-foreground">{lead.status}</span></div><div className="mt-2 flex gap-2"><button type="button" onClick={() => updateLead(lead, 'contacted')} className="flex-1 rounded-lg border border-border py-2 text-[9px] font-bold">Contacted</button><button type="button" onClick={() => updateLead(lead, 'converted')} className="flex-1 rounded-lg bg-accent py-2 text-[9px] font-bold text-accent-foreground">Converted</button></div></div>)}
              </div>
            </SectionCard>

            <SectionCard title="Announcements" description="Publish updates for connected gym members" action={<Button type="button" size="sm" onClick={() => setPanel(panel === 'announcement' ? '' : 'announcement')} className="h-9 rounded-xl"><Plus size={14} className="mr-1" /> New</Button>}>
              {panel === 'announcement' && (
                <InlineForm title="Publish announcement" onClose={() => setPanel('')}>
                  <form onSubmit={addAnnouncement} className="space-y-3"><Field label="Title"><Input value={announcementForm.title} onChange={(event) => setAnnouncementForm((form) => ({ ...form, title: event.target.value }))} required /></Field><Field label="Message"><textarea className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={announcementForm.body} onChange={(event) => setAnnouncementForm((form) => ({ ...form, body: event.target.value }))} required maxLength={4000} /></Field><Button disabled={saving} className="h-11 w-full rounded-xl">Publish</Button></form>
                </InlineForm>
              )}
              <div className="mt-3 space-y-2">{(workspace.announcements || []).length === 0 ? <EmptyState icon={Bell} title="No announcements" description="Publish your first member update." /> : (workspace.announcements || []).slice(0, 30).map((announcement) => <div key={itemId(announcement)} className="flex items-start gap-3 rounded-xl border border-border bg-background/45 p-3"><Bell size={15} className={announcement.is_published ? 'mt-0.5 text-accent' : 'mt-0.5 text-muted-foreground'} /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{announcement.title}</p><p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{announcement.body}</p></div><button type="button" onClick={() => toggleAnnouncement(announcement)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">{announcement.is_published ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}</button></div>)}</div>
            </SectionCard>

            <SectionCard title="Gym profile" description="Update the shared profile shown across the platform" action={<Button type="button" size="sm" variant="outline" onClick={() => setPanel(panel === 'profile' ? '' : 'profile')} className="h-9 rounded-xl"><Pencil size={14} className="mr-1" /> Edit</Button>}>
              {panel === 'profile' ? (
                <InlineForm title="Edit gym profile" onClose={() => setPanel('')}>
                  <form onSubmit={saveProfile} className="space-y-3"><Field label="Gym name"><Input value={profileForm.name || ''} onChange={(event) => setProfileForm((form) => ({ ...form, name: event.target.value }))} required /></Field><Field label="Phone"><Input value={profileForm.phone || ''} onChange={(event) => setProfileForm((form) => ({ ...form, phone: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={profileForm.email || ''} onChange={(event) => setProfileForm((form) => ({ ...form, email: event.target.value }))} /></Field><Field label="Address"><Input value={profileForm.address || ''} onChange={(event) => setProfileForm((form) => ({ ...form, address: event.target.value }))} /></Field><div className="grid grid-cols-2 gap-2"><Field label="City"><Input value={profileForm.city || ''} onChange={(event) => setProfileForm((form) => ({ ...form, city: event.target.value }))} /></Field><Field label="Pincode"><Input value={profileForm.pincode || ''} onChange={(event) => setProfileForm((form) => ({ ...form, pincode: event.target.value }))} /></Field></div><Field label="Description"><textarea className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={profileForm.description || ''} onChange={(event) => setProfileForm((form) => ({ ...form, description: event.target.value }))} maxLength={2000} /></Field><Button disabled={saving} className="h-11 w-full rounded-xl">Save profile</Button></form>
                </InlineForm>
              ) : (
                <div className="rounded-2xl bg-background/50 p-4"><p className="text-sm font-bold">{gym.name}</p><p className="mt-1 text-xs text-muted-foreground">{[gym.address, gym.city, gym.state, gym.pincode].filter(Boolean).join(', ') || 'Address not added'}</p><p className="mt-2 text-[10px] text-muted-foreground">{gym.phone || gym.email || 'Contact details not added'}</p></div>
              )}
            </SectionCard>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-2">
          {TABS.map(({ key, label, icon: Icon }) => {
            const selected = tab === key;
            return <button key={key} type="button" onClick={() => { setTab(key); setPanel(''); }} className={`flex min-h-14 min-w-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[9px] font-bold ${selected ? 'text-accent' : 'text-muted-foreground'}`}><span className={`flex h-8 w-12 items-center justify-center rounded-full ${selected ? 'bg-accent/12' : ''}`}><Icon size={19} /></span>{label}</button>;
          })}
        </div>
      </nav>
    </div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
