import React, { useState } from 'react';

const API = (import.meta.env.VITE_API_BASE_URL || 'https://se7en-fit-api.onrender.com/api').replace(/\/+$/, '');
const FACILITIES = ['Cardio Zone', 'Free Weights', 'Machines', 'CrossFit Box', 'Yoga Studio', 'Swimming Pool', 'Steam/Sauna', 'Locker Rooms', 'Parking', 'Cafeteria', 'Personal Training', 'Group Classes'];
const token = () => localStorage.getItem('se7enfit_auth_token') || '';
const cached = () => { try { return JSON.parse(localStorage.getItem('se7enfit_user') || 'null'); } catch { return null; } };

async function api(path, body) {
  const t = token();
  if (!t) throw new Error('Login session missing. Please login again.');
  const response = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || payload?.message || `Request failed ${response.status}`);
  return payload?.item || payload?.data || payload;
}

export default function GymOwnerOnboardingStandalone() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ gym_name: '', city: '', address: '', opening_time: '06:00', closing_time: '22:00', monthly_fee: '', quarterly_fee: '', yearly_fee: '', facilities: [] });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const toggle = (item) => setForm({ ...form, facilities: form.facilities.includes(item) ? form.facilities.filter((x) => x !== item) : [...form.facilities, item] });
  const user = cached();

  const launch = async () => {
    if (!form.gym_name.trim()) { setError('Gym name is required.'); setStep(1); return; }
    setLoading(true); setError('');
    try {
      await api('/gym-owners/onboarding', {
        gym_name: form.gym_name,
        name: form.gym_name,
        city: form.city,
        address: form.address,
        opening_time: form.opening_time,
        closing_time: form.closing_time,
        monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : undefined,
        quarterly_fee: form.quarterly_fee ? Number(form.quarterly_fee) : undefined,
        yearly_fee: form.yearly_fee ? Number(form.yearly_fee) : undefined,
        amenities: form.facilities,
        facilities: form.facilities,
        owner_name: user?.full_name || user?.name || 'Gym Owner',
        email: user?.email,
      });
      window.location.replace('/gym-owner/dashboard');
    } catch (err) { setError(err.message || 'Could not launch dashboard.'); }
    finally { setLoading(false); }
  };

  const input = 'w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none';
  const label = 'mb-2 block text-sm font-bold text-white';
  return <div className="min-h-screen bg-black px-5 py-8 text-white"><div className="mx-auto max-w-3xl">
    <div className="mb-8"><div className="text-2xl font-black">SE<span className="text-emerald-400">7</span>EN <span className="text-emerald-400">FIT</span></div><p className="mt-1 text-xs text-zinc-500">Set up your gym in minutes</p></div>
    <div className="mb-6 grid grid-cols-4 gap-2">{['Gym Info','Location','Timings','Facilities'].map((x,i)=><div key={x} className="text-center"><div className={i+1<=step?'mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-black text-black':'mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 font-black text-zinc-500'}>{i+1<step?'✓':i+1}</div><p className="text-[10px] text-zinc-500">{x}</p></div>)}</div>
    {error && <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      {step===1 && <div className="space-y-4"><h1 className="text-2xl font-black">Gym Information</h1><div><label className={label}>Gym Name *</label><input value={form.gym_name} onChange={set('gym_name')} className={input} placeholder="SE7EN FIT Gym" /></div><button onClick={()=>form.gym_name.trim()?setStep(2):setError('Gym name is required.')} className="h-12 w-full rounded-xl bg-emerald-500 font-black text-black">Next</button></div>}
      {step===2 && <div className="space-y-4"><h1 className="text-2xl font-black">Location</h1><div><label className={label}>City</label><input value={form.city} onChange={set('city')} className={input} /></div><div><label className={label}>Address</label><textarea value={form.address} onChange={set('address')} className={input} rows={4} /></div><div className="grid grid-cols-2 gap-3"><button onClick={()=>setStep(1)} className="h-12 rounded-xl border border-zinc-800 font-black">Back</button><button onClick={()=>setStep(3)} className="h-12 rounded-xl bg-emerald-500 font-black text-black">Next</button></div></div>}
      {step===3 && <div className="space-y-4"><h1 className="text-2xl font-black">Timings and Fees</h1><div className="grid grid-cols-2 gap-3"><div><label className={label}>Opening</label><input type="time" value={form.opening_time} onChange={set('opening_time')} className={input} /></div><div><label className={label}>Closing</label><input type="time" value={form.closing_time} onChange={set('closing_time')} className={input} /></div></div><div className="grid grid-cols-3 gap-3"><input type="number" value={form.monthly_fee} onChange={set('monthly_fee')} className={input} placeholder="Monthly" /><input type="number" value={form.quarterly_fee} onChange={set('quarterly_fee')} className={input} placeholder="Quarterly" /><input type="number" value={form.yearly_fee} onChange={set('yearly_fee')} className={input} placeholder="Yearly" /></div><div className="grid grid-cols-2 gap-3"><button onClick={()=>setStep(2)} className="h-12 rounded-xl border border-zinc-800 font-black">Back</button><button onClick={()=>setStep(4)} className="h-12 rounded-xl bg-emerald-500 font-black text-black">Next</button></div></div>}
      {step===4 && <div className="space-y-4"><h1 className="text-2xl font-black">Facilities</h1><div className="flex flex-wrap gap-2">{FACILITIES.map((f)=><button key={f} onClick={()=>toggle(f)} className={form.facilities.includes(f)?'rounded-full bg-emerald-500 px-3 py-2 text-xs font-black text-black':'rounded-full border border-zinc-800 bg-black px-3 py-2 text-xs font-bold text-zinc-400'}>{f}</button>)}</div><div className="grid grid-cols-2 gap-3"><button onClick={()=>setStep(3)} className="h-12 rounded-xl border border-zinc-800 font-black">Back</button><button disabled={loading} onClick={launch} className="h-12 rounded-xl bg-white font-black text-black disabled:opacity-60">{loading?'Setting up...':'Launch Dashboard'}</button></div></div>}
    </div>
  </div></div>;
}
