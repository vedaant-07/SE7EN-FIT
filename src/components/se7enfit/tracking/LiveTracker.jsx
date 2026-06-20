/**
 * LiveTracker — Real browser-based live tracking
 *
 * Steps:     DeviceMotionEvent accelerometer → step detection algorithm
 * GPS:       Geolocation API → real distance, speed, pace
 * Timer:     High-res stopwatch → elapsed time, calorie estimation
 * Heart Rate: Web Bluetooth (if supported + paired wearable)
 *
 * NOTE: DeviceMotionEvent requires HTTPS + user permission (iOS 13+).
 * GPS requires location permission. All web-native, no native app needed.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, StopCircle, MapPin, Footprints, Flame, Heart, Timer, Wifi, WifiOff, Bluetooth } from 'lucide-react';

// ── Step detection via accelerometer ────────────────────────────────────────
// Uses a threshold-based peak detection on the magnitude of acceleration.
const STEP_THRESHOLD = 12; // m/s² — tune per device feel
const STEP_COOLDOWN = 300; // ms between valid steps

// ── Calorie burn (MET-based estimate) ───────────────────────────────────────
// MET ≈ 3.5 for walking, 8 for running; W = weight in kg
function calcCalories(steps, distanceKm, durationSec, weightKg = 70) {
  if (distanceKm > 0 && durationSec > 0) {
    const speedKmh = (distanceKm / durationSec) * 3600;
    const MET = speedKmh > 7 ? 9 : speedKmh > 5 ? 6 : 3.5;
    return Math.round((MET * weightKg * (durationSec / 3600)));
  }
  return Math.round(steps * 0.04);
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LiveTracker({ activity = 'walking', weightKg = 70, onSessionEnd }) {
  const [status, setStatus] = useState('idle'); // idle | running | paused | done
  const [elapsed, setElapsed] = useState(0);    // seconds
  const [steps, setSteps] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [calories, setCalories] = useState(0);
  const [heartRate, setHeartRate] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | active | denied
  const [motionStatus, setMotionStatus] = useState('idle'); // idle | active | denied | unsupported
  const [btStatus, setBtStatus] = useState('idle'); // idle | connecting | connected | unsupported
  const [speedKmh, setSpeedKmh] = useState(0);

  const timerRef = useRef(null);
  const lastStepTimeRef = useRef(0);
  const lastPeakRef = useRef(false);
  const coordsRef = useRef([]);
  const watchIdRef = useRef(null);
  const elapsedRef = useRef(0);
  const stepsRef = useRef(0);
  const distRef = useRef(0);
  const btCharRef = useRef(null);

  // ── Timer ────────────────────────────────────────────────────────────────
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(e => e + 1);
    }, 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  // ── Step detection ────────────────────────────────────────────────────────
  const handleMotion = useCallback((event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const now = Date.now();
    const isPeak = mag > STEP_THRESHOLD;
    if (isPeak && !lastPeakRef.current && now - lastStepTimeRef.current > STEP_COOLDOWN) {
      lastStepTimeRef.current = now;
      stepsRef.current += 1;
      setSteps(s => s + 1);
    }
    lastPeakRef.current = isPeak;
  }, []);

  const requestMotion = async () => {
    if (!window.DeviceMotionEvent) {
      setMotionStatus('unsupported');
      return;
    }
    // iOS 13+ requires explicit permission
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') { setMotionStatus('denied'); return; }
      } catch { setMotionStatus('denied'); return; }
    }
    window.addEventListener('devicemotion', handleMotion);
    setMotionStatus('active');
  };

  const stopMotion = () => {
    window.removeEventListener('devicemotion', handleMotion);
  };

  // ── GPS tracking ─────────────────────────────────────────────────────────
  const startGPS = () => {
    if (!navigator.geolocation) { setGpsStatus('denied'); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('active');
        const { latitude, longitude, speed } = pos.coords;
        const prev = coordsRef.current[coordsRef.current.length - 1];
        if (prev) {
          const d = haversineKm(prev.lat, prev.lng, latitude, longitude);
          if (d < 0.1) { // ignore GPS jitter > 100m jumps
            distRef.current = Math.round((distRef.current + d) * 1000) / 1000;
            setDistanceKm(distRef.current);
          }
        }
        coordsRef.current.push({ lat: latitude, lng: longitude });
        if (speed !== null) setSpeedKmh(Math.round(speed * 3.6 * 10) / 10);
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  };

  const stopGPS = () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
  };

  // ── Web Bluetooth Heart Rate ──────────────────────────────────────────────
  const connectBluetooth = async () => {
    if (!navigator.bluetooth) { setBtStatus('unsupported'); return; }
    try {
      setBtStatus('connecting');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['heart_rate'],
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      const char = await service.getCharacteristic('heart_rate_measurement');
      btCharRef.current = char;
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', (e) => {
        const flags = e.target.value.getUint8(0);
        const hr = flags & 0x1 ? e.target.value.getUint16(1, true) : e.target.value.getUint8(1);
        setHeartRate(hr);
      });
      setBtStatus('connected');
    } catch {
      setBtStatus('idle');
    }
  };

  // ── Calorie sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'running') {
      setCalories(calcCalories(stepsRef.current, distRef.current, elapsedRef.current, weightKg));
    }
  }, [elapsed]);

  // ── Session controls ──────────────────────────────────────────────────────
  const handleStart = async () => {
    setStatus('running');
    startTimer();
    await requestMotion();
    startGPS();
  };

  const handlePause = () => {
    setStatus('paused');
    stopTimer();
    stopMotion();
    stopGPS();
  };

  const handleResume = () => {
    setStatus('running');
    startTimer();
    requestMotion();
    startGPS();
  };

  const handleStop = () => {
    stopTimer();
    stopMotion();
    stopGPS();
    setStatus('done');
    const session = {
      steps: stepsRef.current,
      distanceKm: distRef.current,
      durationSec: elapsedRef.current,
      calories: calcCalories(stepsRef.current, distRef.current, elapsedRef.current, weightKg),
      heartRate,
      activity,
      coords: coordsRef.current,
    };
    if (onSessionEnd) onSessionEnd(session);
  };

  useEffect(() => () => { stopTimer(); stopMotion(); stopGPS(); }, []);

  const paceMin = distRef.current > 0 && elapsed > 0
    ? Math.round((elapsed / 60) / distRef.current * 10) / 10
    : null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Status bar */}
      <div className="bg-muted/40 px-4 py-2 flex items-center gap-3 text-[10px] border-b border-border/50">
        <span className={`flex items-center gap-1 ${gpsStatus === 'active' ? 'text-green-400' : gpsStatus === 'denied' ? 'text-red-400' : 'text-muted-foreground'}`}>
          {gpsStatus === 'active' ? <Wifi size={10} /> : <WifiOff size={10} />} GPS
        </span>
        <span className={`flex items-center gap-1 ${motionStatus === 'active' ? 'text-green-400' : motionStatus === 'denied' || motionStatus === 'unsupported' ? 'text-red-400' : 'text-muted-foreground'}`}>
          <Footprints size={10} />
          {motionStatus === 'active' ? 'Motion ✓' : motionStatus === 'unsupported' ? 'No Sensor' : motionStatus === 'denied' ? 'Denied' : 'Motion'}
        </span>
        <button onClick={connectBluetooth} disabled={btStatus === 'connected' || btStatus === 'connecting'}
          className={`flex items-center gap-1 ${btStatus === 'connected' ? 'text-blue-400' : btStatus === 'unsupported' ? 'text-muted-foreground' : 'text-muted-foreground hover:text-blue-400'} transition-colors`}>
          <Bluetooth size={10} />
          {btStatus === 'connected' ? 'HR ✓' : btStatus === 'connecting' ? 'Pairing…' : btStatus === 'unsupported' ? 'No BT' : 'Pair HR'}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Big timer */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold mb-3 ${
            status === 'running' ? 'bg-green-400/15 text-green-400' :
            status === 'paused' ? 'bg-amber-400/15 text-amber-400' :
            status === 'done' ? 'bg-accent/15 text-accent' :
            'bg-muted text-muted-foreground'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-green-400 animate-pulse' : status === 'paused' ? 'bg-amber-400' : status === 'done' ? 'bg-accent' : 'bg-muted-foreground'}`} />
            {status === 'running' ? 'LIVE' : status === 'paused' ? 'PAUSED' : status === 'done' ? 'COMPLETE' : 'READY'}
          </div>
          <p className="font-mono font-black text-5xl tracking-tight">{formatTime(elapsed)}</p>
          <p className="text-xs text-muted-foreground mt-1 capitalize">{activity}</p>
        </div>

        {/* Live stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox icon={Footprints} label="Steps" value={steps.toLocaleString()} unit="" color="text-purple-400" bg="bg-purple-400/10" />
          <StatBox icon={MapPin} label="Distance" value={distRef.current.toFixed(2)} unit="km" color="text-blue-400" bg="bg-blue-400/10" />
          <StatBox icon={Flame} label="Calories" value={calories} unit="kcal" color="text-orange-400" bg="bg-orange-400/10" />
          {heartRate ? (
            <StatBox icon={Heart} label="Heart Rate" value={heartRate} unit="bpm" color="text-red-400" bg="bg-red-400/10" pulse />
          ) : (
            <StatBox icon={Timer} label="Pace" value={paceMin ? `${paceMin}` : '—'} unit={paceMin ? 'min/km' : ''} color="text-accent" bg="bg-accent/10" />
          )}
        </div>

        {speedKmh > 0 && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Current Speed</p>
            <p className="font-heading font-bold text-xl">{speedKmh} <span className="text-sm font-normal text-muted-foreground">km/h</span></p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {status === 'idle' && (
            <button onClick={handleStart}
              className="flex-1 h-14 rounded-2xl bg-accent text-accent-foreground font-heading font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              <Play size={20} fill="currentColor" /> Start
            </button>
          )}
          {status === 'running' && (
            <>
              <button onClick={handlePause}
                className="flex-1 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <Pause size={18} /> Pause
              </button>
              <button onClick={handleStop}
                className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center active:scale-[0.98] transition-all">
                <StopCircle size={20} />
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button onClick={handleResume}
                className="flex-1 h-14 rounded-2xl bg-accent text-accent-foreground font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <Play size={18} fill="currentColor" /> Resume
              </button>
              <button onClick={handleStop}
                className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center active:scale-[0.98] transition-all">
                <StopCircle size={20} />
              </button>
            </>
          )}
          {status === 'done' && (
            <div className="flex-1 h-14 rounded-2xl bg-green-400/15 border border-green-400/30 text-green-400 font-bold flex items-center justify-center gap-2">
              ✓ Session Saved
            </div>
          )}
        </div>

        {/* Sensor warnings */}
        {motionStatus === 'unsupported' && status !== 'idle' && (
          <p className="text-[10px] text-amber-400 text-center bg-amber-400/10 rounded-xl px-3 py-2">
            ⚠️ Accelerometer not available on this device. Step count will be 0 — use GPS distance instead.
          </p>
        )}
        {motionStatus === 'denied' && (
          <p className="text-[10px] text-amber-400 text-center bg-amber-400/10 rounded-xl px-3 py-2">
            ⚠️ Motion permission denied. Enable in your browser/device settings for step counting.
          </p>
        )}
        {gpsStatus === 'denied' && (
          <p className="text-[10px] text-red-400 text-center bg-red-400/10 rounded-xl px-3 py-2">
            ⚠️ Location permission denied. Enable for real distance tracking.
          </p>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon: IconComp, label, value, unit, color, bg, pulse }) {
  return (
    <div className={`rounded-xl p-3 ${bg} flex items-center gap-3`}>
      <IconComp size={16} className={`${color} flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`font-heading font-bold text-lg leading-tight ${color}`}>
          {value}<span className="text-[11px] font-normal text-muted-foreground ml-0.5">{unit}</span>
        </p>
      </div>
    </div>
  );
}