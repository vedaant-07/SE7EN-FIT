import { Capacitor } from '@capacitor/core';
import { getToday } from '@/lib/fitnessUtils';

function pluginRef() {
  const plugins = Capacitor?.Plugins || {};
  return plugins.SE7ENHealth || plugins.HealthKit || plugins.HealthConnect || plugins.Health || null;
}
function providerName() {
  const platform = Capacitor.getPlatform?.();
  if (platform === 'ios') return 'healthkit';
  if (platform === 'android') return 'health_connect';
  return 'native_health';
}
function n(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
async function call(plugin, names, payload) {
  for (const name of names) {
    if (typeof plugin?.[name] === 'function') return plugin[name](payload);
  }
  return null;
}
export function isNativeHealthAvailable() {
  return Boolean(Capacitor?.isNativePlatform?.() && pluginRef());
}
export async function requestNativeHealthPermissions() {
  const plugin = pluginRef();
  if (!Capacitor?.isNativePlatform?.() || !plugin) return { available: false, granted: false };
  const result = await call(plugin, ['requestPermissions', 'requestAuthorization'], { read: ['steps', 'distance', 'calories', 'workouts'] });
  return { available: true, granted: result?.granted !== false && result?.authorized !== false, provider: providerName() };
}
export async function readNativeHealthDay(date = getToday()) {
  const plugin = pluginRef();
  if (!Capacitor?.isNativePlatform?.() || !plugin) return { available: false, date, provider: 'web', steps: 0, distanceKm: 0, calories: 0, workouts: [] };
  await requestNativeHealthPermissions();
  const payload = { date, startDate: `${date}T00:00:00.000`, endDate: `${date}T23:59:59.999` };
  const summary = await call(plugin, ['getDailySummary', 'readDailySummary', 'getDailyStats'], payload) || {};
  const workoutData = await call(plugin, ['getWorkouts', 'readWorkouts'], payload) || {};
  const rawWorkouts = Array.isArray(workoutData) ? workoutData : workoutData.workouts || [];
  const workouts = rawWorkouts.map((w, index) => ({
    external_id: String(w.id || w.uuid || `${date}-${index}`),
    activity: String(w.activity || w.type || 'running').toLowerCase().replace(/\s+/g, '_'),
    date,
    duration_minutes: Math.round(n(w.duration_minutes ?? w.durationMinutes ?? w.durationSeconds) / (w.durationSeconds ? 60 : 1)),
    distance_km: Number((n(w.distance_km ?? w.distanceKm ?? w.distanceMeters) / (w.distanceMeters ? 1000 : 1)).toFixed(2)),
    calories_burned: Math.round(n(w.calories_burned ?? w.calories)),
    avg_heart_rate: w.avg_heart_rate || w.averageHeartRate || undefined,
    start_at: w.start_at || w.startDate || undefined,
    end_at: w.end_at || w.endDate || undefined,
  })).filter((w) => w.duration_minutes > 0 || w.distance_km > 0 || w.calories_burned > 0);
  const hasMeters = summary.distanceMeters || summary.distance_m;
  return {
    available: true,
    provider: providerName(),
    date,
    steps: Math.round(n(summary.steps ?? summary.stepCount)),
    distanceKm: Number((n(summary.distanceKm ?? summary.distance_km ?? summary.distanceMeters ?? summary.distance_m) / (hasMeters ? 1000 : 1)).toFixed(2)),
    calories: Math.round(n(summary.calories ?? summary.activeEnergyBurned)),
    workouts,
  };
}
export async function syncNativeHealthDay(base44, profile, date = getToday()) {
  const health = await readNativeHealthDay(date);
  if (!health.available) return { synced: false, reason: 'native_health_not_available' };
  const user = await base44.auth.me();
  const existingSteps = await base44.entities.StepLog.filter({ user_id: user.id, date }, '-date', 1);
  const stepPayload = { user_id: user.id, date, steps: health.steps, distance_km: health.distanceKm, calories_burned: health.calories, source: health.provider, health_provider: health.provider, synced_at: new Date().toISOString() };
  if (health.steps > 0 || health.distanceKm > 0 || health.calories > 0) {
    if (existingSteps?.[0]?.id) await base44.entities.StepLog.update(existingSteps[0].id, stepPayload);
    else await base44.entities.StepLog.create(stepPayload);
  }
  const existingCardio = await base44.entities.CardioLog.filter({ user_id: user.id, date }, '-date', 60);
  const externalIds = new Set((existingCardio || []).map((row) => row.external_id).filter(Boolean));
  for (const workout of health.workouts || []) {
    if (workout.external_id && externalIds.has(workout.external_id)) continue;
    await base44.entities.CardioLog.create({ user_id: user.id, ...workout, source: health.provider, health_provider: health.provider, metadata: { synced_from: health.provider, weight_kg: profile?.weight_kg || null } });
  }
  return { synced: true, provider: health.provider, steps: health.steps, workouts: health.workouts?.length || 0 };
}
