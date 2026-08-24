import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import CoreActivityTracker from '@/components/se7enfit/tracking/CoreActivityTracker';
import { Button } from '@/components/ui/button';

const safeArray = (value) => Array.isArray(value) ? value : [];

export default function Tracking() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      const profiles = safeArray(await base44.entities.UserProfile.filter({ user_id: user.id }));
      setProfile(profiles[0] || null);
    } catch (requestError) {
      console.error('[Track] Failed to load profile:', requestError);
      setError('Your profile could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <TopBar title="Track" />
      <main className="space-y-4 px-4 pb-28 pt-4">
        <section className="rounded-[26px] border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Activity size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Activity recorder</p>
              <h1 className="mt-1 font-heading text-xl font-black text-foreground">Track movement, not paperwork</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Walk, run, cycle or hike with one focused recorder. Health trends and older manual metrics live under Explore instead of cluttering Track.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-background/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" />
            <span>Android uses a native foreground service for screen-off route recording. GPS points remain private activity data and weak or implausible movement is filtered before saving.</span>
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button onClick={loadProfile} variant="outline" size="sm" className="mt-3 h-9 rounded-xl">
              <RefreshCw size={14} className="mr-2" /> Try again
            </Button>
          </div>
        )}

        <CoreActivityTracker
          key={savedCount}
          profile={profile}
          onSaved={() => setSavedCount((value) => value + 1)}
        />
      </main>
    </>
  );
}
