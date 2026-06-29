import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Battery, Clock, Gauge, MapPin, Pause, Play, RefreshCw, Route, Save, ShieldCheck, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'se7enfit_live_tracking_session';
const toRad = (value) => (Number(value) * Math.PI) / 180;
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
};
const distanceKm = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
const estimateCalories = (km, seconds) => {
  const hours = Math.max(seconds / 3600, 0.01);
  const speed = km / hours;
  const factor = speed > 8 ? 68 : speed > 5 ? 58 : 45;
  return Math.round(km * factor);
};

function readSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
}
function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function LiveTrackingPanel() {
  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const [supported] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.geolocation));
  const [permission, setPermission] = useState('unknown');
  const [status, setStatus] = useState('idle');
  const [points, setPoints] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastError, setLastError] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const stored = readSession();
    if (stored?.status && stored.status !== 'stopped') {
      setStatus(stored.status);
      setPoints(stored.points || []);
      setStartedAt(stored.startedAt || Date.now());
      setElapsed(stored.elapsed || 0);
    }
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermission(result.state);
        result.onchange = () => setPermission(result.state);
      }).catch(() => setPermission('prompt'));
    }
  }, []);

  useEffect(() => {
    if (status !== 'active') {
      window.clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timerRef.current);
  }, [status]);

  useEffect(() => {
    if (status === 'active' && watchRef.current === null) startWatch();
    if (status !== 'active' && watchRef.current !== null) stopWatchOnly();
    return () => stopWatchOnly();
  }, [status]);

  useEffect(() => {
    if (status !== 'idle') saveSession({ status, points, startedAt, elapsed, updatedAt: Date.now() });
  }, [status, points, startedAt, elapsed]);

  const summary = useMemo(() => {
    let km = 0;
    for (let i = 1; i < points.length; i += 1) km += distanceKm(points[i - 1], points[i]);
    const current = points[points.length - 1] || null;
    const speed = current?.speed && current.speed > 0 ? current.speed * 3.6 : (elapsed > 0 ? (km / (elapsed / 3600)) : 0);
    return { km, current, speed, calories: estimateCalories(km, elapsed) };
  }, [points, elapsed]);

  const addPoint = (position) => {
    const point = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      heading: position.coords.heading,
      captured_at: new Date().toISOString(),
    };
    setPoints((prev) => [...prev, point]);
    setLastError('');
  };

  const startWatch = () => {
    if (!supported || watchRef.current !== null) return;
    watchRef.current = navigator.geolocation.watchPosition(addPoint, (err) => setLastError(err.message || 'Location permission failed'), {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 15000,
    });
  };

  const stopWatchOnly = () => {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  };

  const start = () => {
    if (!supported) { setLastError('Location tracking is not supported on this device/browser.'); return; }
    const now = Date.now();
    setStartedAt(now);
    setElapsed(0);
    setPoints([]);
    setStatus('active');
  };
  const pause = () => setStatus('paused');
  const resume = () => setStatus('active');
  const stop = () => { setStatus('stopped'); stopWatchOnly(); };
  const reset = () => { stopWatchOnly(); clearSession(); setStatus('idle'); setPoints([]); setStartedAt(null); setElapsed(0); setLastError(''); };

  const save = async () => {
    setSyncing(true);
    try {
      await base44.entities.CardioLog.create({
        activity: 'Live Tracking',
        date: new Date().toISOString().slice(0, 10),
        duration_minutes: Math.round(elapsed / 60),
        distance_km: Number(summary.km.toFixed(2)),
        calories_burned: summary.calories,
        route_points: points,
        source: 'live_tracking',
      });
      reset();
    } catch (error) {
      setLastError(error.message || 'Could not save tracking session. It is still saved locally.');
    } finally { setSyncing(false); }
  };

  return (
    <div className="mb-4 rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Activity size={17} className="text-accent" /><h2 className="font-heading font-bold text-base">Advanced Live Tracking</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">GPS route, distance, speed, duration, calories, accuracy and local offline session save.</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status === 'active' ? 'bg-green-400/10 text-green-400' : status === 'paused' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>{status}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Metric icon={Route} label="Distance" value={`${summary.km.toFixed(2)} km`} />
        <Metric icon={Clock} label="Duration" value={formatDuration(elapsed)} />
        <Metric icon={Gauge} label="Speed" value={`${summary.speed.toFixed(1)} km/h`} />
        <Metric icon={Activity} label="Calories" value={`${summary.calories} kcal`} />
      </div>

      <div className="mt-3 rounded-2xl border border-border/70 bg-background/50 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><MapPin size={14} className="text-accent" /> Live Map Data</div>
        {summary.current ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Lat/Lng: {summary.current.latitude.toFixed(5)}, {summary.current.longitude.toFixed(5)}</p>
            <p>Accuracy: ±{Math.round(summary.current.accuracy || 0)}m • Points: {points.length}</p>
          </div>
        ) : <p className="text-xs text-muted-foreground">Start tracking to capture your route points.</p>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-accent" /> Permission: {permission}</div>
        <div className="flex items-center gap-1.5"><Battery size={13} className="text-accent" /> Battery saver: use pause when resting</div>
      </div>

      {lastError && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{lastError}</div>}

      <div className="mt-4 flex flex-wrap gap-2">
        {status === 'idle' || status === 'stopped' ? <Button onClick={start} className="h-9 rounded-xl bg-accent text-accent-foreground"><Play size={14} className="mr-1" /> Start</Button> : null}
        {status === 'active' ? <Button onClick={pause} variant="outline" className="h-9 rounded-xl"><Pause size={14} className="mr-1" /> Pause</Button> : null}
        {status === 'paused' ? <Button onClick={resume} className="h-9 rounded-xl bg-accent text-accent-foreground"><Play size={14} className="mr-1" /> Resume</Button> : null}
        {['active', 'paused'].includes(status) ? <Button onClick={stop} variant="outline" className="h-9 rounded-xl"><Square size={14} className="mr-1" /> Stop</Button> : null}
        {status === 'stopped' && points.length > 0 ? <Button onClick={save} disabled={syncing} className="h-9 rounded-xl bg-accent text-accent-foreground"><Save size={14} className="mr-1" /> {syncing ? 'Saving...' : 'Save'}</Button> : null}
        {points.length > 0 ? <Button onClick={reset} variant="ghost" className="h-9 rounded-xl"><RefreshCw size={14} className="mr-1" /> Reset</Button> : null}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-border/70 bg-background/50 p-3"><Icon size={15} className="mb-1.5 text-accent" /><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-heading text-sm font-bold">{value}</p></div>;
}
