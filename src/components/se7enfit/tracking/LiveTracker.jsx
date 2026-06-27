import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Flame, Footprints, Gauge, MapPin, Pause, Play, RotateCcw, Square, TimerReset } from 'lucide-react';

const STEP_THRESHOLD = 12;
const STEP_COOLDOWN = 300;

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calcDistanceKm(steps) {
  return Math.round(steps * 0.0008 * 100) / 100;
}

function calcCalories(steps, weightKg = 70) {
  const weightFactor = Math.max(0.75, Math.min(1.4, weightKg / 70));
  return Math.round(steps * 0.04 * weightFactor);
}

function getPace(elapsed, distanceKm) {
  if (!elapsed || !distanceKm) return '—';
  return Math.round(((elapsed / 60) / distanceKm) * 10) / 10;
}

function StatCard({ icon: Icon, label, value, unit, tone }) {
  const tones = {
    purple: 'bg-purple-500/10 text-purple-400',
    blue: 'bg-blue-500/10 text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    green: 'bg-accent/10 text-accent',
  };

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone] || tones.green}`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className="font-heading text-2xl font-bold leading-none text-foreground">{value}</span>
        {unit && <span className="mb-0.5 text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    idle: 'Ready',
    running: 'Live',
    paused: 'Paused',
    done: 'Saved',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
      status === 'running'
        ? 'border-accent/30 bg-accent/10 text-accent'
        : status === 'paused'
          ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
          : status === 'done'
            ? 'border-blue-400/30 bg-blue-400/10 text-blue-300'
            : 'border-border bg-background/70 text-muted-foreground'
    }`}>
      <span className={`h-2 w-2 rounded-full ${status === 'running' ? 'bg-accent animate-pulse' : status === 'paused' ? 'bg-amber-300' : status === 'done' ? 'bg-blue-300' : 'bg-muted-foreground/50'}`} />
      {map[status] || 'Ready'}
    </div>
  );
}

export default function LiveTracker({ activity = 'walking', weightKg = 70, onSessionEnd }) {
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [motionStatus, setMotionStatus] = useState('idle');

  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const stepsRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const lastPeakRef = useRef(false);

  const distanceKm = calcDistanceKm(steps);
  const calories = calcCalories(steps, weightKg);
  const pace = getPace(elapsed, distanceKm);

  const stopTimer = () => clearInterval(timerRef.current);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  };

  const handleMotion = useCallback((event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const now = Date.now();
    const isPeak = mag > STEP_THRESHOLD;

    if (isPeak && !lastPeakRef.current && now - lastStepTimeRef.current > STEP_COOLDOWN) {
      lastStepTimeRef.current = now;
      stepsRef.current += 1;
      setSteps(stepsRef.current);
    }

    lastPeakRef.current = isPeak;
  }, []);

  const requestMotion = async () => {
    if (!window.DeviceMotionEvent) {
      setMotionStatus('unsupported');
      return;
    }

    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        if (res !== 'granted') {
          setMotionStatus('denied');
          return;
        }
      } catch {
        setMotionStatus('denied');
        return;
      }
    }

    window.addEventListener('devicemotion', handleMotion);
    setMotionStatus('active');
  };

  const stopMotion = () => {
    window.removeEventListener('devicemotion', handleMotion);
  };

  const handleStart = async () => {
    setStatus('running');
    startTimer();
    await requestMotion();
  };

  const handlePause = () => {
    setStatus('paused');
    stopTimer();
    stopMotion();
  };

  const handleResume = async () => {
    setStatus('running');
    startTimer();
    await requestMotion();
  };

  const handleStop = () => {
    stopTimer();
    stopMotion();
    setStatus('done');

    const session = {
      steps: stepsRef.current,
      distanceKm: calcDistanceKm(stepsRef.current),
      durationSec: elapsedRef.current,
      calories: calcCalories(stepsRef.current, weightKg),
      activity,
      coords: [],
    };

    if (onSessionEnd) onSessionEnd(session);
  };

  const resetSession = () => {
    stopTimer();
    stopMotion();
    elapsedRef.current = 0;
    stepsRef.current = 0;
    lastStepTimeRef.current = 0;
    lastPeakRef.current = false;
    setElapsed(0);
    setSteps(0);
    setMotionStatus('idle');
    setStatus('idle');
  };

  useEffect(() => () => { stopTimer(); stopMotion(); }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card to-background shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="border-b border-border/60 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Live Session</p>
            <h3 className="mt-1 font-heading text-lg font-bold capitalize text-foreground">{activity}</h3>
            <p className="mt-1 text-xs text-muted-foreground">A clean session tracker for steps, distance and calories.</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          <Activity size={13} className={motionStatus === 'active' ? 'text-accent' : ''} />
          {motionStatus === 'active' ? 'Motion tracking active' : motionStatus === 'unsupported' ? 'Motion sensor unavailable' : motionStatus === 'denied' ? 'Motion permission denied' : 'Motion tracking ready'}
        </div>
      </div>

      <div className="px-5 py-6 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          <TimerReset size={13} /> Session Time
        </div>
        <div className="font-heading text-5xl font-black tracking-tight text-foreground">{formatTime(elapsed)}</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === 'running' ? 'Session in progress' : status === 'paused' ? 'Paused. Resume when ready.' : status === 'done' ? 'Session saved to your steps.' : 'Press start when you begin walking.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pb-5">
        <StatCard icon={Footprints} label="Steps" value={steps.toLocaleString()} unit="" tone="purple" />
        <StatCard icon={MapPin} label="Distance" value={distanceKm.toFixed(2)} unit="km" tone="blue" />
        <StatCard icon={Flame} label="Calories" value={calories} unit="kcal" tone="orange" />
        <StatCard icon={Gauge} label="Pace" value={pace} unit={pace === '—' ? '' : 'min/km'} tone="green" />
      </div>

      <div className="px-5 pb-5">
        {status === 'idle' && (
          <button onClick={handleStart} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-bold text-accent-foreground shadow-[0_10px_28px_rgba(34,197,94,0.18)] transition-all hover:bg-accent/90 active:scale-[0.99]">
            <Play size={16} fill="currentColor" /> Start Tracking
          </button>
        )}

        {status === 'running' && (
          <div className="flex gap-3">
            <button onClick={handlePause} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-sm font-bold text-amber-300 transition-all active:scale-[0.99]">
              <Pause size={16} /> Pause
            </button>
            <button onClick={handleStop} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-bold text-white transition-all hover:bg-red-500/90 active:scale-[0.99]">
              <Square size={15} fill="currentColor" /> Stop & Save
            </button>
          </div>
        )}

        {status === 'paused' && (
          <div className="flex gap-3">
            <button onClick={handleResume} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-bold text-accent-foreground transition-all active:scale-[0.99]">
              <Play size={16} fill="currentColor" /> Resume
            </button>
            <button onClick={handleStop} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 text-sm font-bold text-white transition-all active:scale-[0.99]">
              <Square size={15} fill="currentColor" /> Stop & Save
            </button>
          </div>
        )}

        {status === 'done' && (
          <button onClick={resetSession} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/70 text-sm font-bold text-foreground transition-all hover:border-accent/40 active:scale-[0.99]">
            <RotateCcw size={15} /> Start Another Session
          </button>
        )}
      </div>

      {(motionStatus === 'unsupported' || motionStatus === 'denied') && status !== 'idle' && (
        <div className="border-t border-border/60 px-5 py-3">
          <p className="text-center text-[11px] text-amber-300">
            {motionStatus === 'unsupported' ? 'Motion sensor is not available on this device.' : 'Motion permission was denied. Enable it to count steps live.'}
          </p>
        </div>
      )}
    </div>
  );
}
