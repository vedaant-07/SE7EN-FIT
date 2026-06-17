import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, MapPin, Clock, Mail, Phone, Edit3, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function GymProfileTab({ owner, setOwner, showToast, onEditFull }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...owner });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.gym_name?.trim()) { showToast('Gym name is required', 'error'); return; }
    setSaving(true);
    await base44.entities.GymOwner.update(owner.id, {
      gym_name: form.gym_name,
      owner_name: form.owner_name,
      mobile: form.mobile,
      email: form.email,
      city: form.city,
      address: form.address,
      description: form.description,
      opening_time: form.opening_time,
      closing_time: form.closing_time,
      monthly_fee: parseFloat(form.monthly_fee) || 0,
      quarterly_fee: parseFloat(form.quarterly_fee) || 0,
      yearly_fee: parseFloat(form.yearly_fee) || 0,
      gst_number: form.gst_number,
    });
    setOwner(prev => ({ ...prev, ...form }));
    setEditing(false);
    showToast('Gym profile saved!', 'success');
    setSaving(false);
  };

  const cancel = () => {
    setForm({ ...owner });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-heading font-bold text-lg">Edit Profile</p>
          <button onClick={cancel} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Gym Name *</p>
            <Input value={form.gym_name || ''} onChange={set('gym_name')} className="h-10 rounded-xl text-sm" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Owner Name</p>
            <Input value={form.owner_name || ''} onChange={set('owner_name')} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Mobile</p>
              <Input value={form.mobile || ''} onChange={set('mobile')} className="h-10 rounded-xl text-sm" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Email</p>
              <Input value={form.email || ''} onChange={set('email')} className="h-10 rounded-xl text-sm" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">City</p>
            <Input value={form.city || ''} onChange={set('city')} className="h-10 rounded-xl text-sm" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Full Address</p>
            <textarea value={form.address || ''} onChange={set('address')}
              className="w-full h-16 px-3 py-2 rounded-xl border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Description</p>
            <textarea value={form.description || ''} onChange={set('description')}
              className="w-full h-16 px-3 py-2 rounded-xl border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Opens</p>
              <Input type="time" value={form.opening_time || '06:00'} onChange={set('opening_time')} className="h-10 rounded-xl text-sm" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Closes</p>
              <Input type="time" value={form.closing_time || '22:00'} onChange={set('closing_time')} className="h-10 rounded-xl text-sm" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Membership Pricing (₹)</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'monthly_fee', l: 'Monthly' },
                { k: 'quarterly_fee', l: 'Quarterly' },
                { k: 'yearly_fee', l: 'Annual' },
              ].map(p => (
                <div key={p.k}>
                  <p className="text-[9px] text-muted-foreground mb-1">{p.l}</p>
                  <Input type="number" value={form[p.k] || ''} onChange={set(p.k)} className="h-9 rounded-xl text-sm" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">GST Number (Optional)</p>
            <Input value={form.gst_number || ''} onChange={set('gst_number')} className="h-10 rounded-xl text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={cancel} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 h-11 rounded-xl bg-accent text-accent-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            <Save size={14} />{saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-heading font-bold text-lg">Gym Profile</p>
        <button onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
          <Edit3 size={12} /> Edit
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        {[
          { label: 'Gym Name', value: owner.gym_name, icon: Building2 },
          { label: 'Owner', value: owner.owner_name, icon: Building2 },
          { label: 'City', value: owner.city, icon: MapPin },
          { label: 'Address', value: owner.address, icon: MapPin },
          { label: 'Timings', value: `${owner.opening_time || '6:00'} – ${owner.closing_time || '22:00'}`, icon: Clock },
          { label: 'Email', value: owner.email, icon: Mail },
          { label: 'Mobile', value: owner.mobile, icon: Phone },
        ].map(item => (
          <div key={item.label} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              <item.icon size={13} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{item.label}</p>
              <p className="text-sm font-medium mt-0.5">{item.value || <span className="text-muted-foreground italic text-xs">Not set</span>}</p>
            </div>
          </div>
        ))}
        {owner.description && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Description</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{owner.description}</p>
          </div>
        )}
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

      {owner.gst_number && (
        <div className="bg-muted/30 border border-border rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted-foreground">GST Number</p>
          <p className="text-sm font-mono font-medium mt-0.5">{owner.gst_number}</p>
        </div>
      )}

      <button onClick={onEditFull}
        className="w-full h-11 rounded-xl border border-accent/30 text-accent text-sm font-semibold flex items-center justify-center gap-2 hover:bg-accent/5 transition-all">
        <Edit3 size={14} /> Full Profile Editor (Onboarding)
      </button>
    </div>
  );
}