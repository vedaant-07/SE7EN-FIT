import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ChevronRight, ChevronLeft, Loader2, MapPin, Clock, Camera, Check } from 'lucide-react';

const FACILITIES = ['Cardio Zone', 'Free Weights', 'Machines', 'CrossFit Box', 'Yoga Studio', 'Swimming Pool', 'Steam/Sauna', 'Locker Rooms', 'Parking', 'Cafeteria', 'Personal Training', 'Group Classes'];
const OWNER_CACHE_KEY = 'se7enfit_gym_owner_profile_cache';
const DASHBOARD_CACHE_KEY = 'se7enfit_gym_owner_dashboard_data';

const makeReferralCode = (gymName) => (
  gymName
    ? `${gymName.replace(/\s+/g, '').toUpperCase().slice(0, 6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    : `GYM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
);

const readJson = (key, fallback = {}) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  return value;
};

const cacheOwnerSetup = (user = {}, form = {}, referralCode) => {
  const cached = readJson(OWNER_CACHE_KEY, {});
  const owner = {
    ...cached,
    id: cached.id || user.id || 'owner-local',
    gym_id: cached.gym_id || cached.id || user.id || 'gym-local',
    user_id: user.id || cached.user_id,
    owner_name: user.full_name || user.name || cached.owner_name || 'Gym Owner',
    email: user.email || cached.email || '',
    phone: user.phone || user.mobile || cached.phone || '',
    ...form,
    gym_name: form.gym_name || cached.gym_name || 'SE7EN FIT',
    monthly_fee: Number(form.monthly_fee || cached.monthly_fee || 1199),
    quarterly_fee: Number(form.quarterly_fee || cached.quarterly_fee || 2666),
    yearly_fee: Number(form.yearly_fee || cached.yearly_fee || 5656),
    referral_code: referralCode || cached.referral_code || makeReferralCode(form.gym_name),
    onboarding_complete: true,
  };

  writeJson(OWNER_CACHE_KEY, owner);
  const dashboard = readJson(DASHBOARD_CACHE_KEY, {});
  writeJson(DASHBOARD_CACHE_KEY, {
    equipment: Array.isArray(dashboard.equipment) ? dashboard.equipment : [
      { id: '1', category: 'Strength Machine', name: 'Bench Press' },
      { id: '2', category: 'Strength Machine', name: 'Leg Curl' },
      { id: '3', category: 'Free Weights', name: 'Dumbbells' },
      { id: '4', category: 'Free Weights', name: 'Barbells' },
      { id: '5', category: 'Bodyweight', name: 'Pull-up Bar' },
    ],
    challenges: Array.isArray(dashboard.challenges) ? dashboard.challenges : [],
    rewards: Array.isArray(dashboard.rewards) ? dashboard.rewards : [],
    announcements: Array.isArray(dashboard.announcements) ? dashboard.announcements : [],
    attendance: Array.isArray(dashboard.attendance) ? dashboard.attendance : [],
    bank: dashboard.bank && typeof dashboard.bank === 'object' ? dashboard.bank : {},
    referral_code: owner.referral_code,
  });
  return owner;
};

export default function GymOwnerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gymOwnerId, setGymOwnerId] = useState(null);
  const [existingReferralCode, setExistingReferralCode] = useState(null);
  const [form, setForm] = useState({
    gym_name: '', city: '', address: '', description: '',
    opening_time: '06:00', closing_time: '22:00',
    monthly_fee: '', quarterly_fee: '', yearly_fee: '',
    facilities: [], gst_number: '', business_reg: '',
  });

  useEffect(() => {
    base44.auth.me().then(user => {
      base44.entities.GymOwner.filter({ user_id: user.id }).then(owners => {
        if (owners[0]) {
          setGymOwnerId(owners[0].id);
          setExistingReferralCode(owners[0].referral_code || null);
          const o = owners[0];
          setForm(f => ({
            ...f,
            gym_name: o.gym_name || f.gym_name,
            city: o.city || f.city,
            address: o.address || f.address,
            description: o.description || f.description,
            opening_time: o.opening_time || f.opening_time,
            closing_time: o.closing_time || f.closing_time,
            monthly_fee: o.monthly_fee || f.monthly_fee,
            quarterly_fee: o.quarterly_fee || f.quarterly_fee,
            yearly_fee: o.yearly_fee || f.yearly_fee,
          }));
        }
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleFacility = (f) => setForm(prev => ({
    ...prev,
    facilities: prev.facilities.includes(f) ? prev.facilities.filter(x => x !== f) : [...prev.facilities, f]
  }));

  const handleFinish = async () => {
    setLoading(true);
    const cachedUser = base44.auth.getCachedUser?.() || {};
    const referralCode = existingReferralCode || makeReferralCode(form.gym_name);
    const localOwner = cacheOwnerSetup(cachedUser, form, referralCode);

    navigate('/gym-owner/dashboard', { replace: true });

    try {
      const user = await base44.auth.me().catch(() => cachedUser);
      let ownerId = gymOwnerId;
      let existingCode = existingReferralCode;
      if (!ownerId && user?.id) {
        const owners = await base44.entities.GymOwner.filter({ user_id: user.id }).catch(() => []);
        if (owners[0]) { ownerId = owners[0].id; existingCode = owners[0].referral_code; }
      }
      const finalCode = existingCode || referralCode;
      const payload = {
        ...form,
        onboarding_complete: true,
        owner_name: user?.full_name || user?.name || localOwner.owner_name || 'Gym Owner',
        email: user?.email || localOwner.email,
        referral_code: finalCode,
      };
      if (ownerId) await base44.entities.GymOwner.update(ownerId, payload);
      else await base44.entities.GymOwner.create({ user_id: user?.id || localOwner.user_id, ...payload });
      cacheOwnerSetup(user, form, finalCode);
    } catch (err) {
      console.warn('[SE7EN FIT] Dashboard launched with local setup while backend saves:', err?.message || err);
    }
  };

  const STEPS = [
    { label: 'Gym Info', icon: Building2 },
    { label: 'Location', icon: MapPin },
    { label: 'Timings & Fees', icon: Clock },
    { label: 'Facilities', icon: Check },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col px-5 overflow-y-auto">
      <div className="pt-14 pb-6">
        <div className="font-display font-bold text-xl mb-6">SE<span className="text-accent">7</span>EN FIT</div>
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`flex flex-col items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i + 1 <= step ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1 < step ? <Check size={14} /> : i + 1}
                </div>
                <span className="text-[9px] text-muted-foreground mt-1 text-center">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mb-4 mx-1 ${i + 1 < step ? 'bg-accent' : 'bg-border'}`} />}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div><h2 className="font-heading font-bold text-xl">Gym Information</h2><p className="text-muted-foreground text-sm mt-1">Tell us about your gym</p></div>
            <div className="space-y-2"><Label>Gym Name *</Label><Input placeholder="Iron Paradise Fitness" value={form.gym_name} onChange={set('gym_name')} className="h-12 rounded-xl" required /></div>
            <div className="space-y-2"><Label>Gym Description</Label><textarea placeholder="Describe your gym, specialties, USP..." value={form.description} onChange={set('description')} className="w-full h-24 px-3 py-2 rounded-xl border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
            <Button onClick={() => form.gym_name && setStep(2)} className="w-full h-12 rounded-xl bg-accent text-accent-foreground">Next <ChevronRight size={16} /></Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div><h2 className="font-heading font-bold text-xl">Location</h2><p className="text-muted-foreground text-sm mt-1">Where is your gym?</p></div>
            <div className="space-y-2"><Label>City *</Label><Input placeholder="Mumbai" value={form.city} onChange={set('city')} className="h-12 rounded-xl" /></div>
            <div className="space-y-2"><Label>Full Address</Label><textarea placeholder="Shop No. 5, Building Name, Area, City - Pincode" value={form.address} onChange={set('address')} className="w-full h-20 px-3 py-2 rounded-xl border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
            <div className="bg-muted/40 border border-border rounded-xl p-3 flex items-center gap-2"><MapPin size={16} className="text-accent" /><p className="text-xs text-muted-foreground">Google Maps integration coming soon</p></div>
            <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(1)} className="h-12 rounded-xl flex-1"><ChevronLeft size={16} /> Back</Button><Button onClick={() => setStep(3)} className="h-12 rounded-xl flex-1 bg-accent text-accent-foreground">Next <ChevronRight size={16} /></Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div><h2 className="font-heading font-bold text-xl">Timings & Pricing</h2><p className="text-muted-foreground text-sm mt-1">Set your schedule & membership rates</p></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Opening Time</Label><Input type="time" value={form.opening_time} onChange={set('opening_time')} className="h-12 rounded-xl" /></div><div className="space-y-2"><Label>Closing Time</Label><Input type="time" value={form.closing_time} onChange={set('closing_time')} className="h-12 rounded-xl" /></div></div>
            <div className="space-y-3"><Label className="text-sm font-semibold">Membership Pricing (₹)</Label><div className="grid grid-cols-3 gap-2"><div className="space-y-1"><Label className="text-xs">Monthly</Label><Input type="number" placeholder="999" value={form.monthly_fee} onChange={set('monthly_fee')} className="h-10 rounded-xl text-sm" /></div><div className="space-y-1"><Label className="text-xs">Quarterly</Label><Input type="number" placeholder="2499" value={form.quarterly_fee} onChange={set('quarterly_fee')} className="h-10 rounded-xl text-sm" /></div><div className="space-y-1"><Label className="text-xs">Annual</Label><Input type="number" placeholder="7999" value={form.yearly_fee} onChange={set('yearly_fee')} className="h-10 rounded-xl text-sm" /></div></div></div>
            <div className="space-y-2"><Label>GST Number (Optional)</Label><Input placeholder="22AAAAA0000A1Z5" value={form.gst_number} onChange={set('gst_number')} className="h-12 rounded-xl" /></div>
            <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(2)} className="h-12 rounded-xl flex-1"><ChevronLeft size={16} /> Back</Button><Button onClick={() => setStep(4)} className="h-12 rounded-xl flex-1 bg-accent text-accent-foreground">Next <ChevronRight size={16} /></Button></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div><h2 className="font-heading font-bold text-xl">Facilities</h2><p className="text-muted-foreground text-sm mt-1">What does your gym offer?</p></div>
            <div className="flex flex-wrap gap-2">{FACILITIES.map(f => <button key={f} onClick={() => toggleFacility(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.facilities.includes(f) ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'}`}>{f}</button>)}</div>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center gap-2"><Camera size={16} className="text-accent" /><p className="text-xs text-muted-foreground">Photo upload available in dashboard after setup</p></div>
            {existingReferralCode && <div className="bg-accent/5 border border-accent/25 rounded-xl p-3"><p className="text-[10px] text-muted-foreground mb-1">Your current referral code (will be preserved)</p><p className="font-mono font-black text-accent tracking-wider">{existingReferralCode}</p></div>}
            <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(3)} className="h-12 rounded-xl flex-1"><ChevronLeft size={16} /> Back</Button><Button onClick={handleFinish} className="h-12 rounded-xl flex-1 bg-accent text-accent-foreground" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Launching...</> : 'Launch Dashboard 🚀'}</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}
