import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import UnifiedLiveTracker from '@/components/se7enfit/tracking/UnifiedLiveTracker';
import { Button } from '@/components/ui/button';
import { LocateFixed, RefreshCw, ShieldCheck } from 'lucide-react';

const safeArray = (value) => Array.isArray(value) ? value : [];

export default function LiveTracking() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      const profiles = safeArray(await base44.entities.UserProfile.filter({ user_id: user.id }));
      setProfile(profiles[0] || null);
    } catch (err) {
      console.error('[LiveTracking] Failed to load profile:', err);
      setError('Your profile could not be loaded. Tracking can still use safe default estimates, or you can try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Live tracking" showBack backTo="/tracking" rightElement={<span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">RECORDER</span>} />

      <main className="space-y-4 px-4 pb-28 pt-4">
        <section className="rounded-[24px] border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent"><LocateFixed size={20} /></span>
            <div>
              <h1 className="font-heading text-lg font-black text-foreground">One focused activity recorder</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Choose an activity, start once, then pause, resume, finish, review and save.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-background/60 px-3 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck size={15} className="shrink-0 text-accent" />
            GPS and motion data stay connected only to your account.
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
            <p>{error}</p>
            <Button onClick={loadProfile} variant="outline" size="sm" className="mt-3 h-9 rounded-xl"><RefreshCw size={14} className="mr-2" /> Try again</Button>
          </div>
        )}

        <UnifiedLiveTracker profile={profile} />
      </main>
    </>
  );
}
