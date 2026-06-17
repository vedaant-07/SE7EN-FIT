import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Check, X, Search, UserCheck, UserX, Clock, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';

const statusColors = {
  active: 'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  rejected: 'bg-red-500/15 text-red-400',
  inactive: 'bg-muted text-muted-foreground',
};

export default function MembersTab({ owner, memberships, setMemberships, attendanceLogs, showToast, onNavigate }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);

  const activeMembers = memberships.filter(m => m.status === 'active').length;
  const pendingMembers = memberships.filter(m => m.status === 'pending').length;

  const filtered = memberships.filter(m => {
    const matchSearch = !search || m.user_id?.toLowerCase().includes(search.toLowerCase()) || m.referral_code_used?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || m.status === filter;
    return matchSearch && matchFilter;
  });

  const approveMember = async (m) => {
    await base44.entities.UserGymMembership.update(m.id, { status: 'active', approved_at: new Date().toISOString().split('T')[0] });
    setMemberships(prev => prev.map(x => x.id === m.id ? { ...x, status: 'active', approved_at: new Date().toISOString().split('T')[0] } : x));
    showToast('Member approved!', 'success');
  };

  const rejectMember = async (m) => {
    await base44.entities.UserGymMembership.update(m.id, { status: 'rejected' });
    setMemberships(prev => prev.map(x => x.id === m.id ? { ...x, status: 'rejected' } : x));
    showToast('Member rejected', 'success');
  };

  const markInactive = async (m) => {
    await base44.entities.UserGymMembership.update(m.id, { status: 'inactive' });
    setMemberships(prev => prev.map(x => x.id === m.id ? { ...x, status: 'inactive' } : x));
    showToast('Member marked inactive', 'success');
  };

  const manualCheckin = async (m) => {
    const today = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().slice(0, 5);
    const existing = attendanceLogs.find(a => a.user_id === m.user_id && a.date === today && a.status === 'checked_in');
    if (existing) { showToast('Already checked in today', 'error'); return; }
    await base44.entities.GymAttendanceLog.create({
      user_id: m.user_id, gym_id: owner.id, owner_id: owner.user_id,
      date: today, check_in_time: timeStr, check_in_method: 'owner_manual', status: 'checked_in',
    });
    showToast('Member checked in!', 'success');
  };

  if (selectedMember) {
    const memberLogs = attendanceLogs.filter(a => a.user_id === selectedMember.user_id);
    const thisMonthLogs = memberLogs.filter(a => a.date?.startsWith(new Date().toISOString().slice(0, 7)));
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedMember(null)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-sm">←</span>
          </button>
          <p className="font-heading font-bold text-lg">Member Profile</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="font-black text-accent text-xl">{(selectedMember.user_id || 'U')[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="font-bold text-base">Member #{selectedMember.user_id?.slice(-6)}</p>
              <p className="text-xs text-muted-foreground">Joined {selectedMember.joined_at || 'Recently'}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${statusColors[selectedMember.status] || 'bg-muted text-muted-foreground'}`}>
                {selectedMember.status}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total Visits', value: memberLogs.length },
              { label: 'This Month', value: thisMonthLogs.length },
              { label: 'Referral Code', value: selectedMember.referral_code_used || 'N/A' },
            ].map(s => (
              <div key={s.label} className="bg-muted/40 rounded-xl p-2.5 text-center">
                <p className="font-black text-base">{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedMember.status === 'pending' && (
              <>
                <button onClick={() => { approveMember(selectedMember); setSelectedMember({ ...selectedMember, status: 'active' }); }}
                  className="flex-1 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold">Approve</button>
                <button onClick={() => { rejectMember(selectedMember); setSelectedMember({ ...selectedMember, status: 'rejected' }); }}
                  className="flex-1 h-9 rounded-xl bg-red-500/15 text-red-400 text-xs font-semibold">Reject</button>
              </>
            )}
            {selectedMember.status === 'active' && (
              <>
                <button onClick={() => manualCheckin(selectedMember)}
                  className="flex-1 h-9 rounded-xl bg-accent/15 text-accent text-xs font-semibold">Check In Now</button>
                <button onClick={() => { markInactive(selectedMember); setSelectedMember({ ...selectedMember, status: 'inactive' }); }}
                  className="flex-1 h-9 rounded-xl bg-muted text-muted-foreground text-xs font-semibold">Mark Inactive</button>
              </>
            )}
          </div>
        </div>
        {memberLogs.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold text-sm">Attendance History</p>
            {memberLogs.slice(0, 10).map(a => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{a.date}</p>
                  <p className="text-xs text-muted-foreground">In: {a.check_in_time}{a.check_out_time ? ` • Out: ${a.check_out_time}` : ''}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === 'checked_out' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {a.status === 'checked_out' ? 'Completed' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-lg">Members</p>
          <p className="text-xs text-muted-foreground">{memberships.length} total • {activeMembers} active</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active', count: activeMembers, color: 'text-emerald-400', bg: 'bg-emerald-400/10', f: 'active' },
          { label: 'Pending', count: pendingMembers, color: 'text-amber-400', bg: 'bg-amber-400/10', f: 'pending' },
          { label: 'Inactive', count: memberships.filter(m => m.status === 'rejected' || m.status === 'inactive').length, color: 'text-red-400', bg: 'bg-red-400/10', f: 'rejected' },
        ].map(s => (
          <button key={s.label} onClick={() => setFilter(filter === s.f ? 'all' : s.f)}
            className={`${s.bg} rounded-2xl p-3 text-center transition-all ${filter === s.f ? 'ring-2 ring-accent/40' : ''}`}>
            <p className={`font-black text-xl ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID or code..."
          className="pl-8 h-9 rounded-xl text-sm" />
      </div>

      {memberships.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-2xl p-8 text-center">
          <Users size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold">No members yet</p>
          <p className="text-xs text-muted-foreground mt-1">Approve leads or invite users with your referral code</p>
          {owner.referral_code && (
            <div className="mt-3 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">Your referral code</p>
              <p className="font-mono font-bold text-accent text-lg">{owner.referral_code}</p>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">No members match your filter</p>
        </div>
      ) : (
        filtered.map((m) => (
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
                <div className="flex gap-1">
                  <button onClick={() => setSelectedMember(m)} className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Eye size={11} className="text-accent" />
                  </button>
                  {m.status === 'pending' && (
                    <>
                      <button onClick={() => approveMember(m)} className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                        <Check size={11} className="text-emerald-400" />
                      </button>
                      <button onClick={() => rejectMember(m)} className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                        <X size={11} className="text-red-400" />
                      </button>
                    </>
                  )}
                  {m.status === 'active' && (
                    <button onClick={() => manualCheckin(m)} className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center" title="Manual Check-in">
                      <UserCheck size={11} className="text-accent" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}