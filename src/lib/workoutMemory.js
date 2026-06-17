// SE7ENFIT Workout Memory System
// Tracks recent muscle groups trained and suggests next workout to prevent overtraining.

import { base44 } from '@/api/base44Client';

const MUSCLE_ROTATION = {
  push: 'pull',
  chest: 'pull',
  shoulders: 'pull',
  triceps: 'pull',
  pull: 'legs',
  back: 'legs',
  biceps: 'legs',
  lats: 'legs',
  legs: 'push',
  quads: 'push',
  hamstrings: 'push',
  glutes: 'push',
  calves: 'push',
};

const FOCUS_LABELS = {
  push: 'Push Day (Chest, Shoulders, Triceps)',
  pull: 'Pull Day (Back, Biceps)',
  legs: 'Leg Day (Quads, Hamstrings, Glutes)',
  cardio: 'Cardio & Core',
  rest: 'Active Recovery / Rest',
};

function normalizeMuscle(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const key of Object.keys(MUSCLE_ROTATION)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

export async function getLastWorkout(userId) {
  const logs = await base44.entities.WorkoutLog.filter({ user_id: userId, completed: true }, '-date', 1);
  return logs[0] || null;
}

export async function getLastTrainedMuscleGroups(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const logs = await base44.entities.ExerciseLog.filter({ user_id: userId }, '-date', 100);
  return logs
    .filter(l => l.date >= sinceStr)
    .map(l => normalizeMuscle(l.muscle_group))
    .filter(Boolean);
}

export async function getNextWorkoutSuggestion(userId) {
  const lastWorkout = await getLastWorkout(userId);
  if (!lastWorkout) {
    return {
      focus: 'push',
      label: FOCUS_LABELS['push'],
      reason: "Let's get started! We recommend a Push Day to kick off your training.",
      lastDate: null,
    };
  }

  const lastDate = lastWorkout.date;
  const today = new Date().toISOString().slice(0, 10);
  const daysSince = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);

  // Determine last muscle group trained
  const exerciseLogs = await base44.entities.ExerciseLog.filter({ user_id: userId, workout_log_id: lastWorkout.id }, '-date', 20);
  const lastMuscles = exerciseLogs.map(l => normalizeMuscle(l.muscle_group)).filter(Boolean);

  // Use workout_type as fallback
  const workoutType = lastWorkout.workout_type?.toLowerCase() || '';
  let lastFocus = lastMuscles[0] || normalizeMuscle(workoutType) || normalizeMuscle(lastWorkout.day_name);

  const nextFocus = MUSCLE_ROTATION[lastFocus] || 'push';
  const nextLabel = FOCUS_LABELS[nextFocus] || nextFocus;

  let reason = '';
  if (daysSince === 0) {
    reason = `You already trained today (${lastFocus || 'a session'}). Consider rest or light cardio.`;
  } else if (daysSince === 1) {
    reason = `Yesterday you completed ${lastFocus ? lastFocus.charAt(0).toUpperCase() + lastFocus.slice(1) : 'a workout'}. Today we recommend ${nextLabel} to balance recovery.`;
  } else if (daysSince >= 2) {
    reason = `You last worked out ${daysSince} days ago. Time to get back on track with ${nextLabel}!`;
  }

  return { focus: nextFocus, label: nextLabel, reason, lastDate, daysSince };
}

export async function checkDuplicateReward(userId, source, date) {
  const existing = await base44.entities.RewardTransaction.filter({ user_id: userId, source, date });
  return existing.length > 0;
}

export async function awardCoinsOnce(userId, source, date, coins, reason) {
  const already = await checkDuplicateReward(userId, source, date);
  if (already) return false;

  // Update wallet
  const wallets = await base44.entities.RewardWallet.filter({ user_id: userId });
  if (wallets[0]) {
    await base44.entities.RewardWallet.update(wallets[0].id, {
      coins_balance: (wallets[0].coins_balance || 0) + coins,
      total_earned: (wallets[0].total_earned || 0) + coins,
      last_reward_date: date,
    });
  } else {
    await base44.entities.RewardWallet.create({
      user_id: userId, coins_balance: coins, total_earned: coins, last_reward_date: date,
    });
  }

  await base44.entities.RewardTransaction.create({
    user_id: userId, type: 'earn', coins, reason, source, date,
  });
  return true;
}