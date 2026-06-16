import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import { Button } from '@/components/ui/button';
import { Camera, TrendingUp, TrendingDown, Scale, Ruler, Activity } from 'lucide-react';
import { getToday } from '@/lib/fitnessUtils';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';

export default function Progress() {
  const [profile, setProfile] = useState(null);
  const [weightLogs, setWeightLogs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    const [profiles, weights, imgs, measures] = await Promise.all([
      base44.entities.UserProfile.filter({ user_id: user.id }),
      base44.entities.WeightLog.filter({ user_id: user.id }, '-date', 30),
      base44.entities.ProgressPhoto.filter({ user_id: user.id }, '-date', 10),
      base44.entities.BodyMeasurement.filter({ user_id: user.id }, '-date', 5),
    ]);
    if (profiles.length) setProfile(profiles[0]);
    setWeightLogs(weights);
    setPhotos(imgs);
    setMeasurements(measures);
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;

  const currentWeight = weightLogs[0]?.weight_kg || profile?.weight_kg || 0;
  const startWeight = profile?.weight_kg || currentWeight;
  const targetWeight = profile?.target_weight_kg || currentWeight;
  const totalLost = Math.round((startWeight - currentWeight) * 10) / 10;
  const remaining = Math.round((currentWeight - targetWeight) * 10) / 10;

  const chartData = [...weightLogs].reverse().map(l => ({
    date: new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    weight: l.weight_kg,
  }));

  const statRows = [
    { label: 'Starting Weight', value: `${startWeight} kg`, icon: Scale },
    { label: 'Current Weight', value: `${currentWeight} kg`, icon: Scale },
    { label: 'Target Weight', value: `${targetWeight} kg`, icon: Scale },
    { label: 'Total Change', value: `${totalLost > 0 ? '-' : '+'}${Math.abs(totalLost)} kg`, icon: TrendingDown },
    { label: 'Remaining', value: `${Math.abs(remaining)} kg`, icon: TrendingUp },
  ];

  return (
    <>
      <TopBar title="Progress" showBack />
      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Weight chart */}
        {chartData.length > 1 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-heading font-semibold text-sm mb-3">Weight Progress</h3>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="weight" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#wg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {statRows.map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-base font-bold font-heading mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Measurements */}
        {measurements.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-sm">Latest Measurements</h3>
              <Link to="/tracking/measurements" className="text-xs text-accent">Update</Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(measurements[0]).filter(([k, v]) => k.endsWith('_cm') && v).map(([k, v]) => (
                <div key={k} className="text-center">
                  <p className="text-sm font-bold">{v} cm</p>
                  <p className="text-[9px] text-muted-foreground">{k.replace('_cm', '')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-sm">Transformation Photos</h3>
          </div>
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map(photo => (
                <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-muted">
                  <img src={photo.photo_url} alt="progress" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
              <Camera size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No photos yet</p>
              <p className="text-xs text-muted-foreground mt-1">Take before/after photos to track visual progress</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}