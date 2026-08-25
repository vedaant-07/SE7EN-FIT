import { Capacitor, registerPlugin } from '@capacitor/core';
import { getToday } from '@/lib/fitnessUtils';

const SE7ENHealth = registerPlugin('SE7ENHealth');

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function platformProvider() {
  if (Capacitor.getPlatform?.() === 'android') return 'android_step_counter';
  return 'unsupported';
}

export function isNativeHealthAvailable() {
  return Boolean(Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android');
}

export async function requestNativeHealthPermissions() {
  if (!isNativeHealthAvailable()) return { available: false, granted: false, provider: platformProvider() };
  try {
    const result = await SE7ENHealth.requestPermissions({ permissions: ['activity'] });
    return {
      available: result?.available !== false,
      granted: result?.granted !== false,
      provider: result?.provider || platformProvider(),
    };
  } catch (error) {
    console.warn('[healthSync] Android activity permission unavailable:', error);
    return { available: false, granted: false, provider: platformProvider() };
  }
}

export async function readNativeHealthDay(date = getToday()) {
  if (!isNativeHealthAvailable()) {
    return { available: false, date, provider: 'web', steps: 0, distanceKm: 0, calories: 0, workouts: [] };
  }

  const permission = await requestNativeHealthPermissions();
  if (!permission.available || !permission.granted) {
    return { available: permission.available, granted: false, date, provider: permission.provider, steps: 0, distanceKm: 0, calories: 0, workouts: [] };
  }

  try {
    const [summary, workoutData] = await Promise.all([
      SE7ENHealth.getDailySummary({ date, startDate: `${date}T00:00:00.000`, endDate: `${date}T23:59:59.999` }),
      SE7ENHealth.getWorkouts({ date, startDate: `${date}T00:00:00.000`, endDate: `${date}T23:59:59.999` }).catch(() => ({ workouts: [] })),
    ]);

    const rawWorkouts = Array.isArray(workoutData) ? workoutData : workoutData?.workouts || [];
    const workouts = rawWorkouts.map((workout, index) => ({
      external_id: String(workout.id || workout.uuid || `${date}-${index}`),
      activity: String(workout.activity || workout.type || 'activity').toLowerCase().replace(/\s+/g, '_'),
      date,
      duration_minutes: Math.round(n(workout.duration_minutes ?? workout.durationMinutes ?? workout.durationSeconds) / (workout.durationSeconds ? 60 : 1)),
      distance_km: Number((n(workout.distance_km ?? workout.distanceKm ?? workout.distanceMeters) / (workout.distanceMeters ? 1000 : 1)).toFixed(2)),
      calories_burned: Math.round(n(workout.calories_burned ?? workout.calories)),
      avg_heart_rate: workout.avg_heart_rate || workout.averageHeartRate || undefined,
      start_at: workout.start_at || workout.startDate || undefined,
      end_at: workout.end_at || workout.endDate || undefined,
    })).filter((workout) => workout.duration_minutes > 0 || workout.distance_km > 0 || workout.calories_burned > 0);

    return {
      available: summary?.available !== false,
      granted: true,
      provider: summary?.provider || permission.provider,
      date,
      steps: Math.max(0, Math.round(n(summary?.steps ?? summary?.stepCount))),
      distanceKm: Math.max(0, Number(n(summary?.distanceKm ?? summary?.distance_km).toFixed(2))),
      calories: Math.max(0, Math.round(n(summary?.calories ?? summary?.activeEnergyBurned))),
      workouts,
      metadata: {
        raw_step_counter: summary?.rawStepCounter ?? null,
        historical_unavailable: Boolean(summary?.historicalUnavailable),
      },
    };
  } catch (error) {
    console.warn('[healthSync] Native Android health read failed:', error);
    return { available: false, granted: true, date, provider: permission.provider, steps: 0, distanceKm: 0, calories: 0, workouts: [] };
  }
}

export async function syncNativeHealthDay(base44, profile, date = getToday()) {
  const health = await readNativeHealthDay(date);
  if (!health.available) return { synced: false, reason: 'native_health_not_available' };
  if (health.granted === false) return { synced: false, reason: 'native_health_permission_denied' };

  const user = await base44.auth.me();
  const existingSteps = await base44.entities.StepLog.filter({ user_id: user.id, date }, '-date', 100);
  const providerStepLog = existingSteps.find((row) =>
    row.health_provider === health.provider || row.source === health.provider
  );

  const stepPayload = {
    user_id: user.id,
    date,
    steps: health.steps,
    distance_km: health.distanceKm,
    calories_burned: health.calories,
    source: health.provider,
    health_provider: health.provider,
    synced_at: new Date().toISOString(),
    metadata: health.metadata || {},
  };

  if (health.steps > 0 || health.distanceKm > 0 || health.calories > 0) {
    if (providerStepLog?.id) await base44.entities.StepLog.update(providerStepLog.id, stepPayload);
    else await base44.entities.StepLog.create(stepPayload);
  }

  const existingCardio = await base44.entities.CardioLog.filter({ user_id: user.id, date }, '-date', 60);
  const externalIds = new Set((existingCardio || []).map((row) => row.external_id).filter(Boolean));
  for (const workout of health.workouts || []) {
    if (workout.external_id && externalIds.has(workout.external_id)) continue;
    await base44.entities.CardioLog.create({
      user_id: user.id,
      ...workout,
      source: health.provider,
      health_provider: health.provider,
      metadata: { synced_from: health.provider, weight_kg: profile?.weight_kg || null },
    });
  }

  return { synced: true, provider: health.provider, steps: health.steps, workouts: health.workouts?.length || 0 };
}
