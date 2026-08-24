import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  Activity,
  Bike,
  Flame,
  Footprints,
  Gauge,
  MapPin,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Signal,
  Square,
  TimerReset,
  Trash2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getToday } from '@/lib/fitnessUtils';
import { nativeTap } from '@/lib/nativeBridge';
import { requestNativeHealthPermissions } from '@/lib/healthSync';
import { useToast } from '@/components/ui/use-toast';
import ConfirmModal from '@/components/se7enfit/ConfirmModal';
import UnifiedLiveTrackerV2 from '@/components/se7enfit/tracking/UnifiedLiveTrackerV2';

const NativeActivityTracker = registerPlugin('SE7ENActivityTracker');
const isNativeAndroid = () => Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android';

const ACTIVITIES = [
  { key: 'walking', label: 'Walk', icon: Footprints, met: 3.5, countsSteps: true },
  { key: 'running', label: 'Run', icon: Activity, met: 8.3, countsSteps: true },
  { key: 'cycling', label: 'Cycle', icon: Bike, met: 7.5, countsSteps: false },
  { key: 'hiking', label: 'Hike', icon: Mountain, met: 6.0, countsSteps: true },
];

const emptySnapshot = (activity = 'walking') => ({
  sessionId: '',
  activity,
  status: 'idle',
  startedAtMs: 0,
  endedAtMs: 0,
  elapsedMs: 0,
  distanceKm: 0,
  steps: 0,
  lastAccuracyM: 0,
  acceptedPoints: 0,
  routeJson: '[]',
  backgroundCapable: true,
});

const configFor = (key) => ACTIVITIES.find((item) => item.key === key) || ACTIVITIES[0];

function formatClock(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function safeRoute(routeJson) {
  try {
    const parsed = JSON.parse(routeJson || '[]');
    return Array.isArray(parsed) ? parsed.filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude))) : [];
  } catch {
    return [];
  }
}

function RouteTrace({ points }) {
  const path = useMemo(() => {
    if (points.length < 2) return '';
    const lats = points.map((point) => Number(point.latitude));
    const lngs = points.map((point) => Number(point.longitude));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latRange = Math.max(0.000001, maxLat - minLat);
    const lngRange = Math.max(0.000001, maxLng - minLng);
    return points.map((point, index) => {
      const x = 8 + ((Number(point.longitude) - minLng) / lngRange) * 84;
      const y = 92 - ((Number(point.latitude) - minLat) / latRange) * 84;
      return `${index === 0 || point.segment_start ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  }, [points]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background/55 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Route trace</p>
        <span className="text-[10px] text-muted-foreground">{points.length} GPS points</span>
      </div>
      <div className="flex h-36 items-center justify-center rounded-xl bg-card/60">
        {path ? (
          <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Recorded route trace">
            <path d={path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-accent" />
          </svg>
        ) : (
          <p className="px-4 text-center text-xs text-muted-foreground">Move outdoors to build your private GPS route.</p>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit = '' }) {
  return (
    <div className="rounded-2xl border border-border bg-background/55 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <Icon size={14} className="text-accent" />
      </div>
      <p className="font-heading text-xl font-black leading-none text-foreground">
        {value}<span className="ml-1 text-[10px] font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

export default function CoreActivityTracker({ profile, onSaved }) {
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState(emptySnapshot());
  const [selectedActivity, setSelectedActivity] = useState('walking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const native = isNativeAndroid();

  useEffect(() => {
    if (!native) return undefined;
    let alive = true;
    NativeActivityTracker.getSnapshot()
      .then((value) => {
        if (!alive || !value) return;
        const normalized = { ...emptySnapshot(value.activity || selectedActivity), ...value };
        setSnapshot(normalized);
        if (normalized.activity) setSelectedActivity(normalized.activity);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [native]);

  useEffect(() => {
    if (!native || !['active', 'paused'].includes(snapshot.status)) return undefined;
    const timer = window.setInterval(() => {
      NativeActivityTracker.getSnapshot()
        .then((value) => value && setSnapshot((previous) => ({ ...previous, ...value })))
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [native, snapshot.status]);

  if (!native) {
    return <UnifiedLiveTrackerV2 profile={profile} onSaved={onSaved} />;
  }

  const config = configFor(snapshot.status === 'idle' ? selectedActivity : snapshot.activity);
  const route = safeRoute(snapshot.routeJson);
  const durationSeconds = Math.max(0, Math.round(Number(snapshot.elapsedMs || 0) / 1000));
  const distanceKm = Math.max(0, Number(snapshot.distanceKm || 0));
  const steps = Math.max(0, Number(snapshot.steps || 0));
  const calories = Math.max(0, Math.round(config.met * 3.5 * Number(profile?.weight_kg || 70) / 200 * (durationSeconds / 60)));
  const pace = distanceKm > 0.02 ? durationSeconds / 60 / distanceKm : null;
  const averageSpeed = durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0;

  const refreshSnapshot = async () => {
    const value = await NativeActivityTracker.getSnapshot();
    if (value) setSnapshot((previous) => ({ ...previous, ...value }));
    return value;
  };

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const permissions = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (!['granted', 'limited'].includes(String(permissions?.location || permissions?.coarseLocation || '').toLowerCase())) {
        throw new Error('Location permission is required to record an outdoor activity.');
      }
      if (configFor(selectedActivity).countsSteps) await requestNativeHealthPermissions().catch(() => null);
      await LocalNotifications.requestPermissions().catch(() => null);
      const sessionId = globalThis.crypto?.randomUUID?.() || `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const value = await NativeActivityTracker.start({ sessionId, activity: selectedActivity });
      setSnapshot({ ...emptySnapshot(selectedActivity), ...value, activity: selectedActivity });
      await nativeTap();
    } catch (requestError) {
      setError(requestError?.message || 'Activity tracking could not start. Check permissions and try again.');
    } finally {
      setBusy(false);
    }
  };

  const runCommand = async (command) => {
    setBusy(true);
    setError('');
    try {
      const value = await NativeActivityTracker[command]();
      if (value) setSnapshot((previous) => ({ ...previous, ...value }));
      else await refreshSnapshot();
      await nativeTap();
    } catch (requestError) {
      setError(requestError?.message || `Could not ${command} this activity.`);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await NativeActivityTracker.discard();
      setSnapshot(emptySnapshot(selectedActivity));
      setConfirmDiscard(false);
      setError('');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (durationSeconds < 5) {
      setError('Record at least 5 seconds before saving this activity.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const routePoints = route.map((point) => ({
        ...point,
        captured_at: new Date(Number(point.captured_ms || Date.now())).toISOString(),
      }));
      const result = await base44.tracking.saveLiveSession({
        session_id: snapshot.sessionId,
        date: getToday(),
        activity: snapshot.activity,
        duration_seconds: durationSeconds,
        steps: config.countsSteps ? steps : 0,
        distance_km: Number(distanceKm.toFixed(3)),
        calories_burned: calories,
        started_at: new Date(Number(snapshot.startedAtMs || Date.now())).toISOString(),
        ended_at: new Date(Number(snapshot.endedAtMs || Date.now())).toISOString(),
        route_points: routePoints,
        sensor: config.countsSteps ? 'android_foreground_gps+hardware_step_counter' : 'android_foreground_gps',
        sensor_metadata: {
          accepted_points: Number(snapshot.acceptedPoints || routePoints.length),
          last_accuracy_m: Number(snapshot.lastAccuracyM || 0) || null,
          background_capable: true,
          foreground_only: false,
          algorithm_version: 4,
          platform: 'android',
        },
      });
      await NativeActivityTracker.discard();
      setSnapshot(emptySnapshot(selectedActivity));
      toast({ title: 'Activity saved', description: `${config.label} · ${formatClock(snapshot.elapsedMs)} · ${distanceKm.toFixed(2)} km` });
      onSaved?.(result);
    } catch (requestError) {
      setError(requestError?.message || 'Could not save this activity. The local review remains available.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-gradient-to-b from-card to-card/70 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
        <div>
          <p className="font-heading text-sm font-black text-foreground">Native activity tracking</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Foreground service · filtered GPS · hardware steps</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">
          <ShieldCheck size={12} /> SCREEN-OFF READY
        </span>
      </div>

      {snapshot.status === 'idle' ? (
        <div className="p-4">
          <p className="mb-3 text-xs font-semibold text-foreground">Choose activity</p>
          <div className="grid grid-cols-2 gap-2.5">
            {ACTIVITIES.map(({ key, label, icon: Icon }) => {
              const selected = selectedActivity === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedActivity(key)}
                  aria-pressed={selected}
                  className={`flex min-h-[72px] items-center gap-3 rounded-2xl border px-4 text-left transition-all active:scale-[0.98] ${selected ? 'border-accent/45 bg-accent/10 text-accent' : 'border-border bg-background/55 text-muted-foreground'}`}
                >
                  <Icon size={20} />
                  <span className="font-heading text-sm font-bold">{label}</span>
                </button>
              );
            })}
          </div>
          <button disabled={busy} type="button" onClick={start} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-black text-accent-foreground disabled:opacity-60">
            {busy ? <RotateCcw size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Start {configFor(selectedActivity).label}
          </button>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">A persistent Android notification keeps route recording active when the screen turns off. Location permission is required; step data is used only when the device exposes and permits a hardware step counter.</p>
          {error && <div role="alert" className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</div>}
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="rounded-3xl border border-border bg-background/55 px-4 py-5 text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              <TimerReset size={12} /> {config.label} · {snapshot.status === 'review' ? 'Review' : snapshot.status}
            </div>
            <p className="font-heading text-5xl font-black tracking-tight tabular-nums">{formatClock(snapshot.elapsedMs)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{snapshot.status === 'active' ? 'Recording continues with the screen off' : snapshot.status === 'paused' ? 'Paused — distance and steps are frozen' : 'Review before saving'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Metric icon={MapPin} label="Distance" value={distanceKm.toFixed(2)} unit="km" />
            <Metric icon={Flame} label="Energy" value={calories} unit="kcal est." />
            {config.countsSteps ? <Metric icon={Footprints} label="Steps" value={steps.toLocaleString()} /> : <Metric icon={Gauge} label="Avg speed" value={averageSpeed.toFixed(1)} unit="km/h" />}
            {config.key === 'cycling'
              ? <Metric icon={Gauge} label="Duration" value={formatClock(snapshot.elapsedMs)} />
              : <Metric icon={Gauge} label="Avg pace" value={pace ? pace.toFixed(1) : '—'} unit={pace ? 'min/km' : ''} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[10px] font-bold text-accent"><Signal size={12} /> Native GPS service</span>
            {Number(snapshot.lastAccuracyM) > 0 && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-[10px] text-muted-foreground">±{Math.round(Number(snapshot.lastAccuracyM))} m</span>}
            {config.countsSteps && !snapshot.activityPermission && <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[10px] text-amber-300">Step permission off</span>}
          </div>

          <RouteTrace points={route} />

          {error && <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-200">{error}</div>}

          <div className="grid grid-cols-2 gap-2.5">
            {snapshot.status === 'active' && (
              <>
                <button disabled={busy} type="button" onClick={() => runCommand('pause')} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background font-bold disabled:opacity-60"><Pause size={16} /> Pause</button>
                <button disabled={busy} type="button" onClick={() => runCommand('finish')} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground font-bold text-background disabled:opacity-60"><Square size={15} fill="currentColor" /> Finish</button>
              </>
            )}
            {snapshot.status === 'paused' && (
              <>
                <button disabled={busy} type="button" onClick={() => runCommand('resume')} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-bold text-accent-foreground disabled:opacity-60"><Play size={16} fill="currentColor" /> Resume</button>
                <button disabled={busy} type="button" onClick={() => runCommand('finish')} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground font-bold text-background disabled:opacity-60"><Square size={15} fill="currentColor" /> Finish</button>
              </>
            )}
            {snapshot.status === 'review' && (
              <>
                <button disabled={busy} type="button" onClick={() => setConfirmDiscard(true)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 font-bold text-destructive disabled:opacity-60"><Trash2 size={15} /> Discard</button>
                <button disabled={busy} type="button" onClick={save} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-black text-accent-foreground disabled:opacity-60">{busy ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDiscard}
        title="Discard this activity?"
        description="The unsaved native timer and route will be removed from this device."
        confirmLabel="Discard"
        destructive
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </section>
  );
}
