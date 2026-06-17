import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { UserPlus, Search, Eye, Check, X, Phone, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';

const STATUSES = ['new', 'contacted', 'converted', 'lost'];
const statusColors = {
  new: 'bg-blue-500/15 text-blue-400',
  contacted: 'bg-purple-500/15 text-purple-400',
  converted: 'bg-emerald-500/15 text-emerald-400',
  lost: 'bg-muted text-muted-foreground',
};

export default function LeadsTab({ owner, leads, setLeads, memberships, setMemberships, showToast }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);

  const newLeads = leads.filter(l => l.status === 'new').length;

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.mobile?.includes(search) || l.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || l.status === filter;
    return matchSearch && matchFilter;
  });

  const updateStatus = async (leadId, status) => {
    await base44.entities.GymLead.update(leadId, { status });
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    if (selectedLead?.id === leadId) setSelectedLead(prev => ({ ...prev, status }));
    showToast(`Lead marked as ${status}`, 'success');
  };

  const approveAsMember = async (lead) => {
    // Create membership
    const existing = memberships.find(m => m.user_id === lead.user_id);
    if (!existing && lead.user_id) {
      const newM = await base44.entities.UserGymMembership.create({
        user_id: lead.user_id,
        gym_id: owner.id,
        owner_id: owner.user_id,
        status: 'active',
        joined_at: new Date().toISOString().split('T')[0],
        approved_at: new Date().toISOString().split('T')[0],
        referral_code_used: lead.referral_code_used,
      });
      setMemberships(prev => [newM, ...prev]);
    }
    await updateStatus(lead.id, 'converted');
    showToast('Lead approved as member!', 'success');
  };

  if (selectedLead) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedLead(null)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-sm">←</span>
          </button>
          <p className="font-heading font-bold text-lg">Lead Details</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-base">{selectedLead.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColors[selectedLead.status] || 'bg-muted text-muted-foreground'}`}>
                {selectedLead.status}
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            {selectedLead.mobile && (
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-muted-foreground flex-shrink-0" />
                <p className="text-sm">{selectedLead.mobile}</p>
              </div>
            )}
            {selectedLead.email && (
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                <p className="text-sm">{selectedLead.email}</p>
              </div>
            )}
            {selectedLead.city && <p className="text-xs text-muted-foreground">📍 {selectedLead.city}</p>}
            {selectedLead.interest && <p className="text-xs text-muted-foreground">Interested in: {selectedLead.interest} plan</p>}
            {selectedLead.source && <p className="text-xs text-muted-foreground">Source: {selectedLead.source}</p>}
            {selectedLead.notes && <p className="text-xs text-muted-foreground italic">"{selectedLead.notes}"</p>}
            <p className="text-xs text-muted-foreground">Added: {selectedLead.created_date ? new Date(selectedLead.created_date).toLocaleDateString('en-IN') : 'Unknown'}</p>
          </div>
          <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
            {selectedLead.status !== 'converted' && (
              <button onClick={() => approveAsMember(selectedLead)}
                className="flex-1 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                Approve as Member
              </button>
            )}
            {selectedLead.status !== 'contacted' && (
              <button onClick={() => updateStatus(selectedLead.id, 'contacted')}
                className="flex-1 h-9 rounded-xl bg-purple-500/15 text-purple-400 text-xs font-semibold">
                Mark Contacted
              </button>
            )}
            {selectedLead.status !== 'lost' && (
              <button onClick={() => updateStatus(selectedLead.id, 'lost')}
                className="flex-1 h-9 rounded-xl bg-muted text-muted-foreground text-xs font-semibold">
                Mark Lost
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-lg">Leads</p>
          <p className="text-xs text-muted-foreground">{leads.length} total • {newLeads} new</p>
        </div>
        {newLeads > 0 && <span className="bg-blue-500/15 text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-xl">{newLeads} New</span>}
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-4 gap-2">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`bg-card border rounded-xl p-2.5 text-center transition-all ${filter === s ? 'border-accent/40' : 'border-border'}`}>
            <p className="font-black text-lg">{leads.filter(l => l.status === s).length}</p>
            <p className="text-[9px] text-muted-foreground capitalize mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, mobile, email..."
          className="pl-8 h-9 rounded-xl text-sm" />
      </div>

      {leads.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-2xl p-10 text-center">
          <UserPlus size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold">No leads yet</p>
          <p className="text-xs text-muted-foreground mt-1">Share your gym referral code to start getting members</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">No leads match your search</div>
      ) : (
        filtered.map(lead => (
          <div key={lead.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{lead.name}</p>
                <p className="text-xs text-muted-foreground">{lead.mobile}{lead.city ? ` • ${lead.city}` : ''}</p>
                {lead.interest && <p className="text-[10px] text-muted-foreground">Interested: {lead.interest}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${statusColors[lead.status] || 'bg-muted text-muted-foreground'}`}>
                  {lead.status}
                </span>
                <button onClick={() => setSelectedLead(lead)} className="text-[10px] text-accent font-semibold">
                  View
                </button>
              </div>
            </div>
            {lead.notes && <p className="text-xs text-muted-foreground mb-2 italic">"{lead.notes}"</p>}
            <div className="flex gap-1.5 flex-wrap">
              {lead.status !== 'converted' && (
                <button onClick={() => approveAsMember(lead)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                  <Check size={9} /> Approve
                </button>
              )}
              {STATUSES.filter(s => s !== lead.status && s !== 'converted').map(s => (
                <button key={s} onClick={() => updateStatus(lead.id, s)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-muted hover:bg-muted/60 transition-all capitalize">
                  → {s}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}