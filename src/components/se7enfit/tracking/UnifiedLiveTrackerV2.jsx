import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bike,
  Flame,
  Footprints,
  Gauge,
  LocateFixed,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Save,
  ShieldCheck,
  Signal,
  SkipForward,
  Square,
  TimerReset,
  Trash2,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { base44 } from '@/api/base44Client';
import ConfirmModal from '@/components/se7enfit/ConfirmModal';
import { useToast } from '@/components/ui/use-toast';
import { getToday } from '@/lib/fitnessUtils';
import { nativeTap } from '@/lib/nativeBridge';

const STORAGE_KEY = 'se7enfit_active_live_session_v3';
const LEGACY_STORAGE_KEY = 'se7enfit_active_live_session_v2';
const MAX_STORED_POINTS = 3600;
const RECENT_POINTS_TO_KEEP = 1200;
const MAX_SESSION_AGE_MS = 14 * 60 * 60 * 1000;
const MAX_ACCEPTED_ACCURACY_METERS = 50;

const ACTIVITIES = [
  { key: 'walking', label: 'Walk', icon: Footprints, outdoor: true, countsSteps: true, met: 3.5, maxSpeedMps: 4.5, maxAcceleration: 4.5, minStepMs: 280, motionThreshold: 1.1 },
  { key: 'running', label: 'Run', icon: Activity, outdoor: true, countsSteps: true, met: 8.3, maxSpeedMps: 10, maxAcceleration: 7, minStepMs: 170, motionThreshold: 1.5 },
  { key: 'cycling', label: 'Cycle', icon: Bike, outdoor: true, countsSteps: false, met: 7.5, maxSpeedMps: 28, maxAcceleration: 9, minStepMs: 0, motionThreshold: 0 },
  { key: 'treadmill', label: 'Treadmill', icon: Gauge, outdoor: false, countsSteps: true, met: 6, maxSpeedMps: 0, maxAcceleration: 0, minStepMs: 220, motionThreshold: 1.25 },
  { key: 'elliptical', label: 'Elliptical', icon: RotateCcw, outdoor: false, countsSteps: false, met: 5, maxSpeedMps: 0, maxAcceleration: 0, minStepMs: 0, motionThreshold: 0 },
  { key: 'skipping', label: 'Skipping', icon: SkipForward, outdoor: false, countsSteps: true, met: 11.8, maxSpeedMps: 0, maxAcceleration: 0, minStepMs: 130, motionThreshold: 2.35 },
];

const activityConfig = (key) => ACTIVITIES.find((item) => item.key === key) || ACTIVITIES[0];
const toRad = (value) => Number(value) * Math.PI / 180;

function haversineKm(a, b) {
  if (!a || !b) return 0;
  const radius = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

function routeDistance(points = []) {
  return points.reduce((total, point, index) => index && !point.segment_start ? total + haversineKm(points[index - 1], point) : total, 0);
}

function compactRoute(points) {
  if (points.length <= MAX_STORED_POINTS) return points;
  const recent = points.slice(-RECENT_POINTS_TO_KEEP);
  const older = points.slice(0, -RECENT_POINTS_TO_KEEP);
  const sampled = older.filter((_, index) => index === 0 || index % 2 === 0);
  return [...sampled.slice(-(MAX_STORED_POINTS - RECENT_POINTS_TO_KEEP)), ...recent];
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function makeSession(activity = 'walking') {
  return {
    sessionId: '',
    activity,
    status: 'idle',
    startedAt: null,
    endedAt: null,
    activeStartedAt: null,
    accumulatedMs: 0,
    steps: 0,
    points: [],
    gpsDistanceKm: 0,
    lastAccuracy: null,
  };
}

function normalizeStored(value) {
  if (!value?.sessionId || !['active', 'paused', 'review'].includes(value.status)) return makeSession(value?.activity);
  if (Date.now() - Number(value.startedAt || 0) > MAX_SESSION_AGE_MS) return makeSession(value.activity);
  const points = Array.isArray(value.points) ? compactRoute(value.points) : [];
  return {
    ...makeSession(value.activity),
    ...value,
    points,
    gpsDistanceKm: Number.isFinite(Number(value.gpsDistanceKm)) ? Number(value.gpsDistanceKm) : routeDistance(points),
  };
}

function readStoredSession() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const normalized = normalizeStored(JSON.parse(current || legacy || 'null'));
    if (legacy && normalized.status !== 'idle') localStorage.removeItem(LEGACY_STORAGE_KEY);
    return normalized;
  } catch {
    return makeSession();
  }
}

function elapsedMs(session, now = Date.now()) {
  const activeSegment = session.status === 'active' && session.activeStartedAt
    ? Math.max(0, now - Number(session.activeStartedAt))
    : 0;
  return Math.max(0, Number(session.accumulatedMs || 0) + activeSegment);
}

function makeSessionId() {
  return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function Metric({ icon: Icon, label, value, unit, tone = 'green' }) {
  const tones = {
    green: 'bg-accent/10 text-accent',
    purple: 'bg-purple-500/10 text-purple-300',
    blue: 'bg-blue-500/10 text-blue-300',
    orange: 'bg-orange-500/10 text-orange-300',
  };
  return (
    <div className="rounded-2xl border border-border/70 bg-background/65 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={13} /></span>
      </div>
      <p className="font-heading text-xl font-black leading-none text-foreground">{value}<span className="ml-1 text-[11px] font-medium text-muted-foreground">{unit}</span></p>
    </div>
  );
}

export default function UnifiedLiveTrackerV2({ profile, onSaved }) {
  const { toast } = useToast();
  const [session, setSession] = useState(readStoredSession);
  const [clock, setClock] = useState(Date.now());
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [motionStatus, setMotionStatus] = useState('idle');
  const [lastError, setLastError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const watchRef = useRef(null);
  const locationProviderRef = useRef(null);
  const locationStartingRef = useRef(false);
  const locationGenerationRef = useRef(0);
  const motionAttachedRef = useRef(false);
  const trackerRef = useRef(null);
  const sessionRef = useRef(session);
  const lastAcceptedPointRef = useRef(null);
  const lastImpliedSpeedRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const aboveThresholdRef = useRef(false);
  const motionBaselineRef = useRef(0);

  const config = activityConfig(session.activity);
  const durationSeconds = Math.round(elapsedMs(session, clock) / 1000);
  const strideMeters = Math.max(0.45, Math.min(1.2, Number(profile?.height_cm || 170) * (session.activity === 'running' ? 0.0065 : 0.00413)));
  const stepDistanceKm = session.steps * strideMeters / 1000;
  const distanceKm = config.outdoor
    ? (session.gpsDistanceKm >= 0.02 ? session.gpsDistanceKm : stepDistanceKm)
    : (config.countsSteps ? stepDistanceKm : 0);
  const calories = Math.max(0, Math.round(config.met * 3.5 * Number(profile?.weight_kg || 70) / 200 * (durationSeconds / 60)));
  const pace = distanceKm > 0.02 ? (durationSeconds / 60 / distanceKm).toFixed(1) : '—';

  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (session.status === 'idle') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, points: compactRoute(session.points) }));
  }, [session]);

  useEffect(() => {
    if (session.status !== 'active') return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [session.status]);

  const handleMotion = useCallback((event) => {
    const current = sessionRef.current;
    const currentConfig = activityConfig(current.activity);
    if (current.status !== 'active' || !currentConfig.countsSteps) return;

    const acceleration = event.acceleration;
    const gravity = event.accelerationIncludingGravity;
    let signal = 0;
    if (acceleration && [acceleration.x, acceleration.y, acceleration.z].some(Number.isFinite)) {
      signal = Math.sqrt((acceleration.x || 0) ** 2 + (acceleration.y || 0) ** 2 + (acceleration.z || 0) ** 2);
    } else if (gravity) {
      const magnitude = Math.sqrt((gravity.x || 0) ** 2 + (gravity.y || 0) ** 2 + (gravity.z || 0) ** 2);
      signal = Math.abs(magnitude - 9.81);
    }

    motionBaselineRef.current = motionBaselineRef.current * 0.92 + signal * 0.08;
    const adjusted = Math.max(0, signal - motionBaselineRef.current * 0.35);
    const above = adjusted >= currentConfig.motionThreshold;
    const now = Date.now();
    if (above && !aboveThresholdRef.current && now - lastStepAtRef.current >= currentConfig.minStepMs) {
      lastStepAtRef.current = now;
      setSession((previous) => previous.status === 'active'
        ? { ...previous, steps: Math.min(200000, Number(previous.steps || 0) + 1) }
        : previous);
    }
    aboveThresholdRef.current = above;
  }, []);

  const stopMotion = useCallback(() => {
    if (motionAttachedRef.current) window.removeEventListener('devicemotion', handleMotion);
    motionAttachedRef.current = false;
    aboveThresholdRef.current = false;
    motionBaselineRef.current = 0;
  }, [handleMotion]);

  const startMotion = useCallback(async (activity) => {
    if (!activityConfig(activity).countsSteps) {
      setMotionStatus('not-needed');
      return;
    }
    if (typeof window.DeviceMotionEvent === 'undefined') {
      setMotionStatus('unavailable');
      return;
    }
    try {
      const deviceMotion = /** @type {typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }} */ (window.DeviceMotionEvent);
      if (typeof deviceMotion.requestPermission === 'function') {
        const result = await deviceMotion.requestPermission();
        if (result !== 'granted') {
          setMotionStatus('denied');
          return;
        }
      }
      if (!motionAttachedRef.current) window.addEventListener('devicemotion', handleMotion, { passive: true });
      motionAttachedRef.current = true;
      setMotionStatus('active');
    } catch {
      setMotionStatus('denied');
    }
  }, [handleMotion]);

  const stopLocation = useCallback(() => {
    locationGenerationRef.current += 1;
    locationStartingRef.current = false;
    if (watchRef.current !== null && locationProviderRef.current === 'native') {
      Geolocation.clearWatch({ id: String(watchRef.current) }).catch(() => null);
    } else if (watchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    locationProviderRef.current = null;
    lastAcceptedPointRef.current = null;
    lastImpliedSpeedRef.current = 0;
  }, []);

  const addPosition = useCallback((position) => {
    const capturedMs = Number(position?.timestamp || Date.now());
    const accuracy = Number(position?.coords?.accuracy ?? 999);
    const rawPoint = {
      latitude: Number(position?.coords?.latitude),
      longitude: Number(position?.coords?.longitude),
      accuracy,
      speed: Number.isFinite(Number(position?.coords?.speed)) ? Math.max(0, Number(position.coords.speed)) : null,
      captured_at: new Date(capturedMs).toISOString(),
      captured_ms: capturedMs,
    };

    if (!Number.isFinite(rawPoint.latitude) || !Number.isFinite(rawPoint.longitude)) return;
    if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
      setGpsStatus('weak');
      return;
    }

    setSession((previous) => {
      if (previous.status !== 'active') return previous;
      const currentConfig = activityConfig(previous.activity);
      const last = lastAcceptedPointRef.current || previous.points[previous.points.length - 1];
      const point = { ...rawPoint, segment_start: !lastAcceptedPointRef.current && previous.points.length > 0 };

      if (!last || point.segment_start) {
        lastAcceptedPointRef.current = point;
        return { ...previous, points: compactRoute([...previous.points, point]), lastAccuracy: accuracy };
      }

      const elapsedSeconds = (point.captured_ms - Number(last.captured_ms || 0)) / 1000;
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0.8 || elapsedSeconds > 90) return previous;

      const segmentKm = haversineKm(last, point);
      const segmentMeters = segmentKm * 1000;
      const impliedSpeed = segmentMeters / elapsedSeconds;
      const uncertainty = Math.max(Number(last.accuracy || accuracy), accuracy);
      const minimumMovement = Math.max(1.2, Math.min(4, uncertainty * 0.08));
      const reportedSpeed = point.speed ?? impliedSpeed;

      if (segmentMeters < minimumMovement) return previous;
      if (reportedSpeed < 0.45 && segmentMeters < Math.max(4, uncertainty * 0.28)) return previous;
      if (currentConfig.maxSpeedMps && impliedSpeed > currentConfig.maxSpeedMps + 1.5) return previous;
      const acceleration = Math.abs(impliedSpeed - lastImpliedSpeedRef.current) / elapsedSeconds;
      if (lastImpliedSpeedRef.current > 0 && currentConfig.maxAcceleration && acceleration > currentConfig.maxAcceleration && segmentMeters > uncertainty) return previous;

      lastAcceptedPointRef.current = point;
      lastImpliedSpeedRef.current = impliedSpeed;
      const nextDistance = Math.max(0, Number(previous.gpsDistanceKm || 0) + segmentKm);
      return {
        ...previous,
        gpsDistanceKm: nextDistance,
        points: compactRoute([...previous.points, point]),
        lastAccuracy: accuracy,
      };
    });

    setGpsStatus(accuracy <= 15 ? 'excellent' : accuracy <= 30 ? 'active' : 'fair');
    setLastError('');
  }, []);

  const startLocation = useCallback(async (activity) => {
    if (!activityConfig(activity).outdoor) {
      setGpsStatus('not-needed');
      return;
    }
    if (watchRef.current !== null || locationStartingRef.current) return;
    locationStartingRef.current = true;
    const generation = ++locationGenerationRef.current;
    setGpsStatus('requesting');
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (generation !== locationGenerationRef.current) return;
        if (permission.location !== 'granted') {
          setGpsStatus('denied');
          setLastError('Location access is off. Timer and motion estimates can continue, but GPS distance is unavailable.');
          return;
        }
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000, minimumUpdateInterval: 1500 },
          (position, error) => {
            if (error || !position) {
              setGpsStatus(String(error?.message || '').toLowerCase().includes('permission') ? 'denied' : 'weak');
              setLastError('GPS signal is unavailable. Keep the app open outdoors while SE7EN FIT reconnects.');
              return;
            }
            addPosition(position);
          },
        );
        if (generation !== locationGenerationRef.current) {
          await Geolocation.clearWatch({ id });
          return;
        }
        watchRef.current = id;
        locationProviderRef.current = 'native';
        return;
      }

      if (!navigator.geolocation) {
        setGpsStatus('unavailable');
        setLastError('This browser does not provide location tracking.');
        return;
      }
      watchRef.current = navigator.geolocation.watchPosition(
        addPosition,
        (error) => {
          setGpsStatus(error.code === 1 ? 'denied' : 'weak');
          setLastError(error.code === 1
            ? 'Location access is off. Timer and motion estimates can continue, but GPS distance is unavailable.'
            : 'GPS signal is weak. Keep the screen open and move outdoors for better accuracy.');
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
      );
      locationProviderRef.current = 'web';
    } catch (error) {
      if (generation !== locationGenerationRef.current) return;
      const denied = String(error?.message || '').toLowerCase().includes('permission');
      setGpsStatus(denied ? 'denied' : 'unavailable');
      setLastError(denied ? 'Location access is off.' : 'Location services are unavailable.');
    } finally {
      if (generation === locationGenerationRef.current) locationStartingRef.current = false;
    }
  }, [addPosition]);

  const stopSensors = useCallback(() => {
    stopLocation();
    stopMotion();
  }, [stopLocation, stopMotion]);

  useEffect(() => {
    if (session.status === 'active') {
      void startLocation(session.activity);
      void startMotion(session.activity);
    } else stopSensors();
    return stopSensors;
  }, [session.status, session.activity, startLocation, startMotion, stopSensors]);

  const startSession = async () => {
    const now = Date.now();
    setLastError('');
    lastAcceptedPointRef.current = null;
    lastImpliedSpeedRef.current = 0;
    const next = { ...makeSession(session.activity), sessionId: makeSessionId(), status: 'active', startedAt: now, activeStartedAt: now };
    sessionRef.current = next;
    setSession(next);
    setClock(now);
    await nativeTap();
    window.requestAnimationFrame(() => trackerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const pauseSession = async () => {
    const now = Date.now();
    setSession((previous) => ({ ...previous, status: 'paused', accumulatedMs: elapsedMs(previous, now), activeStartedAt: null }));
    await nativeTap();
  };

  const resumeSession = async () => {
    const now = Date.now();
    lastAcceptedPointRef.current = null;
    lastImpliedSpeedRef.current = 0;
    setSession((previous) => ({ ...previous, status: 'active', activeStartedAt: now }));
    setClock(now);
    await nativeTap();
  };

  const stopSession = async () => {
    const now = Date.now();
    setSession((previous) => ({ ...previous, status: 'review', endedAt: now, accumulatedMs: elapsedMs(previous, now), activeStartedAt: null }));
    await nativeTap();
  };

  const resetSession = () => {
    stopSensors();
    setSession(makeSession(session.activity));
    setGpsStatus('idle');
    setMotionStatus('idle');
    setLastError('');
    setConfirmDiscard(false);
  };

  const saveSession = async () => {
    if (durationSeconds < 5) {
      setLastError('Record at least 5 seconds before saving this activity.');
      return;
    }
    setSaving(true);
    setLastError('');
    try {
      const result = await base44.tracking.saveLiveSession({
        session_id: session.sessionId,
        date: getToday(),
        activity: session.activity,
        duration_seconds: durationSeconds,
        steps: config.countsSteps ? session.steps : 0,
        distance_km: Number(distanceKm.toFixed(3)),
        calories_burned: calories,
        started_at: new Date(session.startedAt).toISOString(),
        ended_at: new Date(session.endedAt || Date.now()).toISOString(),
        route_points: compactRoute(session.points),
        sensor: [config.outdoor && session.points.length ? 'gps_filtered' : null, config.countsSteps && motionStatus === 'active' ? 'motion_estimate' : null].filter(Boolean).join('+') || 'timer',
        sensor_metadata: {
          accepted_points: session.points.length,
          last_accuracy_m: session.lastAccuracy,
          gps_distance_km: Number(session.gpsDistanceKm.toFixed(3)),
          foreground_only: true,
          algorithm_version: 3,
        },
      });
      toast({ title: 'Activity saved', description: `${config.label} · ${formatClock(durationSeconds)} · ${distanceKm.toFixed(2)} km` });
      resetSession();
      onSaved?.(result);
    } catch (error) {
      setLastError(error?.message || 'Could not save this activity. Your session is still safe on this device.');
    } finally {
      setSaving(false);
    }
  };

  const sensorLabel = config.outdoor
    ? gpsStatus === 'excellent' ? 'GPS excellent'
      : gpsStatus === 'active' ? 'GPS good'
        : gpsStatus === 'fair' ? 'GPS fair'
          : gpsStatus === 'denied' ? 'GPS off'
            : gpsStatus === 'weak' ? 'Weak GPS'
              : 'Finding GPS'
    : config.countsSteps
      ? motionStatus === 'active' ? 'Motion estimate' : 'Timer mode'
      : 'Indoor timer';

  const qualityClass = ['excellent', 'active'].includes(gpsStatus) || motionStatus === 'active'
    ? 'border-accent/25 bg-accent/10 text-accent'
    : gpsStatus === 'fair'
      ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
      : 'border-border bg-background/60 text-muted-foreground';

  return (
    <section ref={trackerRef} className="scroll-mt-16 overflow-hidden rounded-[28px] border border-border bg-gradient-to-b from-card to-card/70 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-4 border-b border-border/60 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent"><LocateFixed size={17} /></span>
          <div><h2 className="font-heading text-sm font-bold">Live activity</h2><p className="text-[11px] text-muted-foreground">Filtered GPS and motion estimates</p></div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          session.status === 'active' ? 'border-accent/30 bg-accent/10 text-accent'
            : session.status === 'paused' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              : session.status === 'review' ? 'border-blue-400/30 bg-blue-400/10 text-blue-300'
                : 'border-border bg-background/60 text-muted-foreground'
        }`}><span className={`h-1.5 w-1.5 rounded-full ${session.status === 'active' ? 'animate-pulse bg-accent' : 'bg-current'}`} />{session.status === 'review' ? 'Review' : session.status}</span>
      </div>

      {session.status === 'idle' ? (
        <div className="p-4">
          <p className="mb-3 text-xs font-semibold">Choose activity</p>
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITIES.map(({ key, label, icon: Icon }) => {
              const selected = session.activity === key;
              return <button key={key} type="button" onClick={() => setSession(makeSession(key))} aria-pressed={selected} className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-[11px] font-semibold transition-all active:scale-[0.97] ${selected ? 'border-accent/45 bg-accent/10 text-accent' : 'border-border bg-background/55 text-muted-foreground'}`}><Icon size={18} /><span>{label}</span></button>;
            })}
          </div>
          <button type="button" onClick={startSession} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-black text-accent-foreground active:scale-[0.99]"><Play size={16} fill="currentColor" /> Start {config.label}</button>
          <div className="mt-3 rounded-2xl border border-border bg-background/50 p-3 text-[10px] leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-2"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" /><span>Route data is private. For reliable GPS, keep the app open in the foreground; closed-screen background recording is not enabled yet.</span></div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-4 rounded-3xl border border-border/70 bg-background/55 px-4 py-5 text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"><TimerReset size={12} /> {config.label}</div>
            <p className="font-heading text-5xl font-black tracking-tight tabular-nums">{formatClock(durationSeconds)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{session.status === 'active' ? 'Recording now' : session.status === 'paused' ? 'Paused' : 'Review before saving'}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Metric icon={MapPin} label="Distance" value={distanceKm.toFixed(2)} unit="km" tone="blue" />
            <Metric icon={Flame} label="Burn" value={calories} unit="kcal est." tone="orange" />
            <Metric icon={Footprints} label="Steps" value={config.countsSteps ? session.steps.toLocaleString() : '—'} unit={config.countsSteps ? 'est.' : ''} tone="purple" />
            <Metric icon={Gauge} label="Pace" value={pace} unit={pace === '—' ? '' : 'min/km'} tone="green" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${qualityClass}`}><Signal size={12} /> {sensorLabel}</span>
            {session.lastAccuracy && config.outdoor && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-[10px] text-muted-foreground">±{Math.round(session.lastAccuracy)} m</span>}
            {config.outdoor && <span className="rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-[10px] text-muted-foreground">{session.points.length} accepted points</span>}
          </div>

          {lastError && <div role="alert" className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">{lastError}</div>}

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {session.status === 'active' && <><button type="button" onClick={pauseSession} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background font-bold"><Pause size={16} /> Pause</button><button type="button" onClick={stopSession} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground font-bold text-background"><Square size={15} fill="currentColor" /> Finish</button></>}
            {session.status === 'paused' && <><button type="button" onClick={resumeSession} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-bold text-accent-foreground"><Play size={16} fill="currentColor" /> Resume</button><button type="button" onClick={stopSession} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground font-bold text-background"><Square size={15} fill="currentColor" /> Finish</button></>}
            {session.status === 'review' && <><button type="button" onClick={() => setConfirmDiscard(true)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 font-bold text-destructive"><Trash2 size={15} /> Discard</button><button type="button" onClick={saveSession} disabled={saving} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-black text-accent-foreground disabled:opacity-60">{saving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />} Save</button></>}
          </div>
        </div>
      )}

      <ConfirmModal open={confirmDiscard} title="Discard this activity?" description="The unsaved timer, route and motion estimates will be removed from this device." confirmLabel="Discard" destructive onConfirm={resetSession} onCancel={() => setConfirmDiscard(false)} />
    </section>
  );
}
