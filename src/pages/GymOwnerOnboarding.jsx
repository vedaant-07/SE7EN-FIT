import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, ChevronRight, ChevronLeft, Loader2, MapPin, Clock, Camera, Check } from 'lucide-react';

const FACILITIES = ['Cardio Zone', 'Free Weights', 'Machines', 'CrossFit Box', 'Yoga Studio', 'Swimming Pool', 'Steam/Sauna', 'Locker Rooms', 'Parking', 'Cafeteria', 'Personal Training', 'Group Classes'];

export default function GymOwnerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gymOwnerId, setGymOwnerId] = useState(null);
  const [form, setForm] = useState({
    gym_name: '', city: '', address: '', description: '',
    opening_time: '06:00', closing_time: '22:00',
    monthly_fee: '', quarterly_fee: '', yearly_fee: '',
    facilities: [], gst_number: '', business_reg: '',
  });

  useEffect(() => {
    base44.auth.me().then(user => {
      base44.entities.GymOwner.filter({ user_id: user.id }).then(owners => {
        if (owners[0]) setGymOwnerId(owners[0].id);
      });
    });
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleFacility = (f) => setForm(prev => ({
    ...prev,
    facilities: prev.facilities.includes(f) ? prev.facilities.filter(x => x !== f) : [...prev.facilities, f]
  }));

  const handleFinish = async () => {
    setLoading(true);
    try {
      let ownerId = gymOwnerId;
      if (!ownerId) {
        const user = await base44.auth.me();
        const owners = await base44.entities.GymOwner.filter({ user_id: user.id });
        if (owners[0]) ownerId = owners[0].id;
      }
      if (ownerId) {
        await base44.entities.GymOwner.update(ownerId, { ...form, onboarding_complete: true });
      }
      window.location.href = '/gym-owner/dashboard';
    } catch (err) {
      console.error(err);
      setLoading(false);
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
        <div className="font-display font-bold text-xl mb-6">SE<span className="text-accent">7</span>ENFIT</div>
        
        {/* Progress steps */}
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
            <div className="bg-muted/40 border border-border rounded-xl p-3 flex items-center gap-2">
              <MapPin size={16} className="text-accent" />
              <p className="text-xs text-muted-foreground">Google Maps integration coming soon</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="h-12 rounded-xl flex-1"><ChevronLeft size={16} /> Back</Button>
              <Button onClick={() => setStep(3)} className="h-12 rounded-xl flex-1 bg-accent text-accent-foreground">Next <ChevronRight size={16} /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div><h2 className="font-heading font-bold text-xl">Timings & Pricing</h2><p className="text-muted-foreground text-sm mt-1">Set your schedule & membership rates</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Opening Time</Label><Input type="time" value={form.opening_time} onChange={set('opening_time')} className="h-12 rounded-xl" /></div>
              <div className="space-y-2"><Label>Closing Time</Label><Input type="time" value={form.closing_time} onChange={set('closing_time')} className="h-12 rounded-xl" /></div>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Membership Pricing (₹)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">Monthly</Label><Input type="number" placeholder="999" value={form.monthly_fee} onChange={set('monthly_fee')} className="h-10 rounded-xl text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Quarterly</Label><Input type="number" placeholder="2499" value={form.quarterly_fee} onChange={set('quarterly_fee')} className="h-10 rounded-xl text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Annual</Label><Input type="number" placeholder="7999" value={form.yearly_fee} onChange={set('yearly_fee')} className="h-10 rounded-xl text-sm" /></div>
              </div>
            </div>
            <div className="space-y-2"><Label>GST Number (Optional)</Label><Input placeholder="22AAAAA0000A1Z5" value={form.gst_number} onChange={set('gst_number')} className="h-12 rounded-xl" /></div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="h-12 rounded-xl flex-1"><ChevronLeft size={16} /> Back</Button>
              <Button onClick={() => setStep(4)} className="h-12 rounded-xl flex-1 bg-accent text-accent-foreground">Next <ChevronRight size={16} /></Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div><h2 className="font-heading font-bold text-xl">Facilities</h2><p className="text-muted-foreground text-sm mt-1">What does your gym offer?</p></div>
            <div className="flex flex-wrap gap-2">
              {FACILITIES.map(f => (
                <button key={f} onClick={() => toggleFacility(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.facilities.includes(f) ? 'bg-accent text-accent-foreground border-accent' : 'bg-card border-border text-muted-foreground'}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center gap-2">
              <Camera size={16} className="text-accent" />
              <p className="text-xs text-muted-foreground">Photo upload available in dashboard after setup</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="h-12 rounded-xl flex-1"><ChevronLeft size={16} /> Back</Button>
              <Button onClick={handleFinish} className="h-12 rounded-xl flex-1 bg-accent text-accent-foreground" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up...</> : 'Launch Dashboard 🚀'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}