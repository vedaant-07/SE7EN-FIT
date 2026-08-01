import crypto from 'node:crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_quarterly', 'premium_annual']);
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const PROTECTED_ENTITIES = ['RewardWallet', 'RewardTransaction', 'LeaderboardScore', 'ChallengeParticipant'];
const BATTLE_METRICS = {
  steps: { label: 'Step showdown', unit: 'steps', target: 50000, min: 5000, max: 500000, duration: 7, emoji: '👟' },
  workouts: { label: 'Workout face-off', unit: 'workouts', target: 5, min: 1, max: 30, duration: 7, emoji: '💪' },
  cardio: { label: 'Cardio clash', unit: 'minutes', target: 150, min: 10, max: 1500, duration: 7, emoji: '⚡' },
  gym_visits: { label: 'Gym attendance duel', unit: 'visits', target: 5, min: 1, max: 14, duration: 7, emoji: '🏋️' },
};

const safeArray = (value) => Array.isArray(value) ? value : [];
const fail = (message, status = 400, code = 'request_failed', details = null) => Object.assign(new Error(message), { status, code, details });
const cleanText = (value, max = 500) => String(value || '').trim().slice(0, max);
const dateOnly = (value) => value ? String(value).slice(0, 10) : null;
const nowIso = () => new Date().toISOString();
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status >= 500) console.error('[engagement-phase6]', error);
    res.status(status).json({
      error: status >= 500 ? 'Competition services are temporarily unavailable. Please try again.' : error.message,
      code: error?.code || (status >= 500 ? 'competition_unavailable' : 'request_failed'),
      ...(error?.details ? { details: error.details } : {}),
    });
  }
};

function normalizeRole(value) {
  const role = cleanText(value, 80).toLowerCase().replace(/[\s-]+/g, '_');
  if (role === 'superadmin') return 'super_admin';
  if (role === 'gymowner' || role === 'owner') return 'gym_owner';
  if (role === 'gymstaff') return 'gym_staff';
  return role || 'user';
}

async function authContext(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Login required.', 401, 'auth_required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Your session expired. Please log in again.', 401, 'auth_expired');
  const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('user_id', data.user.id).maybeSingle();
  if (profileError) throw fail(profileError.message, 500);
  if (profile?.status && profile.status !== 'active') throw fail('This account is not active.', 403, 'account_inactive');
  return { user: data.user, profile: profile || {}, role: normalizeRole(profile?.role || data.user.user_metadata?.role) };
}

async function requireAdmin(req) {
  const context = await authContext(req);
  if (!ADMIN_ROLES.has(context.role)) throw fail('Administrator access required.', 403, 'admin_required');
  return context;
}

async function activeSubscription(userId) {
  const { data, error } = await db.from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw fail(error.message, 500);
  const row = data?.[0] || null;
  return row ? { ...row, id: row.subscription_id, plan: row.plan_code } : null;
}

async function activeMembership(userId) {
  const { data, error } = await db.from('gym_memberships')
    .select('*, gyms(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw fail(error.message, 500);
  const row = data?.[0] || null;
  if (!row) return null;
  const gym = Array.isArray(row.gyms) ? row.gyms[0] : row.gyms;
  return { ...row, id: row.membership_id, gym: gym || null };
}

function parseRules(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return typeof parsed === 'object' && parsed && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function localDateKey(req, date = new Date()) {
  const timezone = cleanText(req.headers['x-client-timezone'] || 'UTC', 80);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function monthWindow(periodKey = null) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(periodKey || ''));
  const source = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : new Date();
  const start = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), 1));
  const end = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 1));
  return {
    periodKey: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: new Date(end.getTime() - 86400000).toISOString().slice(0, 10),
  };
}

function publicName(fullName, isCurrentUser = false) {
  if (isCurrentUser) return 'You';
  const parts = cleanText(fullName || 'SE7EN Member', 120).split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : (parts[0] || 'SE7EN Member');
}

async function recordIntegrityFlag({ userId, sourceType = 'activity', sourceId = null, metric = null, eventDate, severity = 'medium', reasonCode, evidence = {}, scoreImpact = 0 }) {
  if (!userId || !reasonCode) return null;
  const payload = {
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId ? String(sourceId) : null,
    metric,
    event_date: eventDate || new Date().toISOString().slice(0, 10),
    severity,
    reason_code: reasonCode,
    score_impact: Number(scoreImpact || 0),
    evidence,
    status: 'open',
  };
  const { data, error } = await db.from('engagement_integrity_flags').insert(payload).select('*').single();
  if (!error) return data;
  if (error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate')) {
    const { data: existing } = await db.from('engagement_integrity_flags')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', sourceType)
      .eq('reason_code', reasonCode)
      .eq('event_date', payload.event_date)
      .eq('status', 'open')
      .maybeSingle();
    return existing || null;
  }
  console.error('[engagement-phase6] integrity flag insert failed', error);
  return null;
}

function classifyStepRows(rows) {
  const byDate = new Map();
  for (const row of safeArray(rows)) {
    const date = dateOnly(row.date);
    if (!isDateKey(date)) continue;
    if (!byDate.has(date)) byDate.set(date, { health: [], sessions: [], manual: [], suspicious: [] });
    const group = byDate.get(date);
    const steps = Math.max(0, Number(row.steps || 0));
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const hasHealthEvidence = Boolean(row.health_provider && row.external_id);
    const hasSessionEvidence = Boolean(
      row.external_id && (
        Number(metadata.gps_points_accepted || 0) > 0
        || ['device', 'accelerometer', 'gps', 'health_connect', 'google_fit'].includes(String(metadata.sensor || '').toLowerCase())
        || metadata.activity
      )
    );
    if (steps > 100000) group.suspicious.push({ id: row.log_id, steps, reason: 'impossible_daily_steps' });
    if (hasHealthEvidence) group.health.push({ ...row, steps });
    else if (hasSessionEvidence) group.sessions.push({ ...row, steps });
    else group.manual.push({ ...row, steps });
  }

  const daily = [];
  for (const [date, group] of byDate.entries()) {
    const healthByProvider = new Map();
    for (const row of group.health) {
      const key = String(row.health_provider || 'health');
      healthByProvider.set(key, Math.max(healthByProvider.get(key) || 0, row.steps));
    }
    const healthValue = healthByProvider.size ? Math.max(...healthByProvider.values()) : 0;
    const sessionValue = group.sessions.reduce((sum, row) => sum + row.steps, 0);
    const verified = Math.max(healthValue, sessionValue);
    const manual = group.manual.reduce((sum, row) => sum + row.steps, 0);
    const suspicious = group.suspicious.length > 0 || verified > 60000;
    daily.push({
      date,
      value: suspicious ? 0 : Math.min(60000, verified),
      raw_verified: verified,
      manual_excluded: manual,
      verified_records: group.health.length + group.sessions.length,
      excluded_records: group.manual.length,
      suspicious,
      reasons: group.suspicious,
    });
  }
  return daily.sort((left, right) => left.date.localeCompare(right.date));
}

async function trustedSteps(userId, startDate, endDate, sourceType = 'activity', sourceId = null) {
  const { data, error } = await db.from('step_logs')
    .select('log_id,date,steps,external_id,health_provider,metadata,created_at')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(5000);
  if (error) throw fail(error.message, 500);
  const daily = classifyStepRows(data);
  const suspiciousDays = daily.filter((row) => row.suspicious);
  for (const day of suspiciousDays) {
    await recordIntegrityFlag({
      userId,
      sourceType,
      sourceId,
      metric: 'steps',
      eventDate: day.date,
      severity: day.raw_verified > 100000 ? 'high' : 'medium',
      reasonCode: day.raw_verified > 100000 ? 'impossible_daily_steps' : 'extreme_daily_steps',
      evidence: day,
      scoreImpact: -day.raw_verified,
    });
  }
  return {
    value: daily.reduce((sum, row) => sum + Number(row.value || 0), 0),
    daily,
    integrity_status: suspiciousDays.length ? 'review' : 'verified',
    excluded_records: daily.reduce((sum, row) => sum + Number(row.excluded_records || 0), 0),
  };
}

async function trustedCardio(userId, startDate, endDate, sourceType = 'activity', sourceId = null) {
  const { data, error } = await db.from('cardio_logs')
    .select('log_id,date,activity,duration_minutes,distance_km,external_id,health_provider,route_summary,metadata')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(3000);
  if (error) throw fail(error.message, 500);

  const accepted = [];
  const excluded = [];
  for (const row of safeArray(data)) {
    const minutes = Math.max(0, Number(row.duration_minutes || 0));
    const distance = Math.max(0, Number(row.distance_km || 0));
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const routeSummary = row.route_summary && typeof row.route_summary === 'object' ? row.route_summary : {};
    const activity = String(row.activity || metadata.activity || '').toLowerCase();
    const evidenced = Boolean(
      row.external_id && (
        row.health_provider
        || Number(routeSummary.point_count || 0) >= 3
        || ['device', 'gps', 'accelerometer', 'health_connect', 'google_fit'].includes(String(metadata.sensor || '').toLowerCase())
        || ['treadmill', 'elliptical', 'skipping'].includes(activity)
      )
    );
    const speed = minutes > 0 ? distance / (minutes / 60) : 0;
    const speedLimit = activity === 'cycling' ? 80 : activity === 'running' ? 30 : activity === 'walking' ? 12 : 60;
    const plausible = minutes >= 1 && minutes <= 720 && speed <= speedLimit;
    if (evidenced && plausible) accepted.push({ ...row, minutes, speed });
    else excluded.push({ id: row.log_id, date: row.date, minutes, speed, evidenced, plausible });
  }

  const byDate = new Map();
  accepted.forEach((row) => byDate.set(dateOnly(row.date), (byDate.get(dateOnly(row.date)) || 0) + row.minutes));
  const extreme = [...byDate.entries()].filter(([, minutes]) => minutes > 300);
  for (const [date, minutes] of extreme) {
    await recordIntegrityFlag({
      userId,
      sourceType,
      sourceId,
      metric: 'cardio',
      eventDate: date,
      severity: minutes > 600 ? 'high' : 'medium',
      reasonCode: 'extreme_cardio_duration',
      evidence: { minutes },
      scoreImpact: -minutes,
    });
  }
  const value = [...byDate.entries()].reduce((sum, [, minutes]) => sum + Math.min(300, minutes), 0);
  return { value, accepted_count: accepted.length, excluded_count: excluded.length, excluded, integrity_status: extreme.length ? 'review' : 'verified' };
}

async function trustedWorkouts(userId, startDate, endDate) {
  const { data, error } = await db.from('workout_logs')
    .select('log_id,date,completed,duration_minutes,workout_plan_id,workout_session_id,external_id,metadata')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(2000);
  if (error) throw fail(error.message, 500);
  const accepted = safeArray(data).filter((row) => {
    const duration = Number(row.duration_minutes || 0);
    return duration >= 5 && duration <= 300 && Boolean(row.workout_session_id || (row.workout_plan_id && row.external_id));
  });
  const unique = new Set(accepted.map((row) => row.workout_session_id || row.external_id || row.log_id));
  return { value: unique.size, accepted_count: unique.size, excluded_count: safeArray(data).length - unique.size, integrity_status: 'verified' };
}

async function trustedGymVisits(userId, gymId, startDate, endDate) {
  if (!gymId) return { value: 0, accepted_count: 0, excluded_count: 0, integrity_status: 'verified' };
  const { data, error } = await db.from('gym_attendance_logs')
    .select('log_id,date,gym_id,status,duration_minutes,check_in_at,check_out_at,method')
    .eq('user_id', userId)
    .eq('gym_id', gymId)
    .gte('date', startDate)
    .lte('date', endDate)
    .limit(1000);
  if (error) throw fail(error.message, 500);
  const trustedMethods = new Set(['qr', 'staff', 'owner', 'biometric', 'nfc']);
  const acceptedDates = new Set();
  let excluded = 0;
  for (const row of safeArray(data)) {
    const duration = Number(row.duration_minutes || 0);
    const completed = ['checked_out', 'completed'].includes(String(row.status || '').toLowerCase());
    const method = String(row.method || '').toLowerCase();
    if (completed && duration >= 10 && duration <= 360 && trustedMethods.has(method)) acceptedDates.add(dateOnly(row.date));
    else excluded += 1;
  }
  return { value: acceptedDates.size, accepted_count: acceptedDates.size, excluded_count: excluded, integrity_status: 'verified' };
}

async function plausibleManualMetric(userId, metric, date) {
  if (metric === 'water') {
    const { data, error } = await db.from('water_logs').select('amount_ml').eq('user_id', userId).eq('date', date);
    if (error) throw fail(error.message, 500);
    const value = safeArray(data).reduce((sum, row) => sum + Math.max(0, Number(row.amount_ml || 0)), 0);
    return { value: value <= 10000 ? value : 0, raw_value: value, integrity_status: value > 10000 ? 'review' : 'verified', cap: 10000 };
  }
  if (metric === 'protein') {
    const { data, error } = await db.from('nutrition_logs').select('protein_g').eq('user_id', userId).eq('date', date);
    if (error) throw fail(error.message, 500);
    const value = safeArray(data).reduce((sum, row) => sum + Math.max(0, Number(row.protein_g || 0)), 0);
    return { value: value <= 400 ? value : 0, raw_value: value, integrity_status: value > 400 ? 'review' : 'verified', cap: 400 };
  }
  if (metric === 'sleep') {
    const { data, error } = await db.from('sleep_logs').select('hours').eq('user_id', userId).eq('date', date);
    if (error) throw fail(error.message, 500);
    const value = safeArray(data).reduce((max, row) => Math.max(max, Number(row.hours || 0)), 0);
    return { value: value <= 16 ? value : 0, raw_value: value, integrity_status: value > 16 ? 'review' : 'verified', cap: 16 };
  }
  return { value: 0, raw_value: 0, integrity_status: 'verified' };
}

async function challengeQualification(userId, challenge, date, membership) {
  const rules = parseRules(challenge.rules);
  const metric = String(rules.metric || rules.type || 'workout');
  const threshold = Math.max(1, Number(rules.threshold || 1));
  let result;

  if (metric === 'steps') result = await trustedSteps(userId, date, date, 'challenge', challenge.challenge_id);
  else if (metric === 'cardio') result = await trustedCardio(userId, date, date, 'challenge', challenge.challenge_id);
  else if (metric === 'gym_visit') result = await trustedGymVisits(userId, membership?.gym_id, date, date);
  else if (metric === 'workout') {
    const [workouts, cardio] = await Promise.all([trustedWorkouts(userId, date, date), trustedCardio(userId, date, date, 'challenge', challenge.challenge_id)]);
    result = { value: workouts.value + (cardio.value >= 20 ? 1 : 0), integrity_status: cardio.integrity_status, workouts, cardio };
  } else if (metric === 'active_day') {
    const [steps, workouts, cardio] = await Promise.all([
      trustedSteps(userId, date, date, 'challenge', challenge.challenge_id),
      trustedWorkouts(userId, date, date),
      trustedCardio(userId, date, date, 'challenge', challenge.challenge_id),
    ]);
    const active = steps.value >= 5000 || workouts.value >= 1 || cardio.value >= 20;
    result = { value: active ? 1 : 0, integrity_status: [steps.integrity_status, cardio.integrity_status].includes('review') ? 'review' : 'verified', steps, workouts, cardio };
  } else result = await plausibleManualMetric(userId, metric, date);

  if (result.integrity_status !== 'verified') {
    await recordIntegrityFlag({
      userId,
      sourceType: 'challenge',
      sourceId: challenge.challenge_id,
      metric,
      eventDate: date,
      severity: 'medium',
      reasonCode: `${metric}_requires_review`,
      evidence: result,
      scoreImpact: -Number(result.raw_value || result.value || 0),
    });
  }

  const messages = {
    steps: `Record ${threshold.toLocaleString()} verified steps today.`,
    cardio: `Complete ${threshold} verified cardio minutes today.`,
    gym_visit: 'Complete a staff, QR, NFC or biometric verified gym visit today.',
    workout: 'Complete a personalized workout session or at least 20 verified cardio minutes today.',
    active_day: 'Complete a verified workout, 20 cardio minutes, or 5,000 verified steps today.',
    water: `Log ${threshold.toLocaleString()} ml of water today.`,
    protein: `Log ${threshold} g of protein today.`,
    sleep: `Log at least ${threshold} hours of sleep.`,
  };
  return {
    eligible: result.integrity_status === 'verified' && Number(result.value || 0) >= threshold,
    current: Number(result.value || 0),
    threshold,
    metric,
    unit: rules.unit || metric,
    integrity_status: result.integrity_status,
    message: result.integrity_status === 'review' ? 'This activity needs a fairness review before it can count.' : (messages[metric] || 'Complete the verified target first.'),
    evidence: result,
  };
}

async function challengeScopeAllowed(challenge, membership) {
  if (challenge.gym_id && String(challenge.gym_id) !== String(membership?.gym_id || '')) return false;
  if (challenge.target_scope === 'city') {
    const city = cleanText(parseRules(challenge.rules).city, 120).toLowerCase();
    return Boolean(city && city === cleanText(membership?.gym?.city, 120).toLowerCase());
  }
  return true;
}

function normalizeChallenge(row, participant, checkins, participantCount, premium) {
  const rules = parseRules(row.rules);
  const target = Math.max(1, Number(rules.target_days || row.duration_days || 1));
  const progress = Math.min(target, Number(participant?.progress || 0));
  const completed = participant?.status === 'completed' || progress >= target;
  const lastCheckin = safeArray(checkins).map((item) => dateOnly(item.checkin_date)).sort().at(-1) || null;
  return {
    id: row.challenge_id,
    title: row.title || 'Challenge',
    description: row.description || 'Complete verified targets to earn rewards.',
    difficulty: row.difficulty || 'Medium',
    days: target,
    target,
    coins: Number(row.reward_coins || 0),
    premium: Boolean(row.premium_required),
    locked: Boolean(row.premium_required && !premium),
    scope: row.gym_id ? 'gym' : (row.target_scope || 'all'),
    gym_id: row.gym_id || null,
    emoji: rules.emoji || (row.gym_id ? '🏋️' : '🏆'),
    type: rules.metric || rules.type || 'workout',
    threshold: Number(rules.threshold || 1),
    unit: rules.unit || 'day',
    action_path: rules.action_path || '/tracking',
    joined: Boolean(participant),
    completed,
    progress,
    progress_percent: Math.min(100, Math.round((progress / target) * 100)),
    last_checkin: lastCheckin,
    participants: Number(participantCount || 0),
    integrity_status: participant?.integrity_status || 'verified',
  };
}

async function trustedScoreData(userIds, window) {
  const uniqueIds = [...new Set(safeArray(userIds).filter(Boolean))];
  if (!uniqueIds.length) return new Map();
  const [{ data: transactions, error: txError }, { data: participants, error: participantError }, { data: battleMembers, error: battleMemberError }, { data: awards, error: awardError }] = await Promise.all([
    db.from('reward_transactions').select('*').in('user_id', uniqueIds).eq('type', 'earn').eq('integrity_status', 'verified').gte('created_at', window.start).lt('created_at', window.end).limit(10000),
    db.from('challenge_participants').select('user_id,challenge_id,status').in('user_id', uniqueIds).eq('status', 'completed').limit(5000),
    db.from('gym_battle_members').select('user_id,battle_id,invite_status,reward_coins').in('user_id', uniqueIds).eq('invite_status', 'accepted').limit(5000),
    db.from('leaderboard_awards').select('award_id,user_id,coins,status').in('user_id', uniqueIds).in('status', ['awarded', 'claimed']).limit(5000),
  ]);
  if (txError) throw fail(txError.message, 500);
  if (participantError) throw fail(participantError.message, 500);
  if (battleMemberError) throw fail(battleMemberError.message, 500);
  if (awardError) throw fail(awardError.message, 500);

  const battleIds = [...new Set(safeArray(battleMembers).map((row) => row.battle_id).filter(Boolean))];
  const { data: battles, error: battleError } = battleIds.length
    ? await db.from('gym_battles').select('battle_id,status,integrity_status').in('battle_id', battleIds)
    : { data: [], error: null };
  if (battleError) throw fail(battleError.message, 500);

  const completedChallenges = new Set(safeArray(participants).map((row) => `${row.user_id}:${row.challenge_id}`));
  const verifiedBattles = new Set(safeArray(battles).filter((row) => row.status === 'completed' && row.integrity_status === 'verified').map((row) => row.battle_id));
  const validBattleRewards = new Set(safeArray(battleMembers).filter((row) => verifiedBattles.has(row.battle_id)).map((row) => `${row.user_id}:${row.battle_id}`));
  const validAwards = new Set(safeArray(awards).map((row) => `${row.user_id}:${row.award_id}`));
  const result = new Map(uniqueIds.map((id) => [id, { score: 0, challenge_coins: 0, battle_coins: 0, prize_coins: 0, completed_challenges: 0 }]));
  for (const participant of safeArray(participants)) {
    const item = result.get(participant.user_id);
    if (item) item.completed_challenges += 1;
  }
  for (const tx of safeArray(transactions)) {
    const item = result.get(tx.user_id);
    if (!item || Number(tx.amount || 0) <= 0) continue;
    const source = String(tx.source || '');
    let valid = false;
    if (source.startsWith('challenge_reward:') && tx.reference_id) {
      valid = completedChallenges.has(`${tx.user_id}:${tx.reference_id}`);
      if (valid) item.challenge_coins += Number(tx.amount || 0);
    } else if (source.startsWith('gym_battle_reward:') && tx.reference_id) {
      valid = validBattleRewards.has(`${tx.user_id}:${tx.reference_id}`);
      if (valid) item.battle_coins += Number(tx.amount || 0);
    } else if (source.startsWith('leaderboard_prize:') && tx.reference_id) {
      valid = validAwards.has(`${tx.user_id}:${tx.reference_id}`);
      if (valid) item.prize_coins += Number(tx.amount || 0);
    }
    if (valid) item.score += Number(tx.amount || 0);
  }
  return result;
}

async function candidateIdsForScope(scope, membership, override = {}) {
  if (scope === 'gym') {
    const gymId = override.gymId || membership?.gym_id;
    if (!gymId) return { ids: [], scopeKey: 'none', label: 'My Gym', unavailable: 'Connect to a gym to unlock this leaderboard.', gymId: null, city: null };
    const { data: gym, error: gymError } = await db.from('gyms').select('*').eq('gym_id', gymId).maybeSingle();
    if (gymError) throw fail(gymError.message, 500);
    const { data, error } = await db.from('gym_memberships').select('user_id').eq('gym_id', gymId).eq('status', 'active').limit(2000);
    if (error) throw fail(error.message, 500);
    return { ids: safeArray(data).map((row) => row.user_id).filter(Boolean), scopeKey: String(gymId), label: gym?.name || gym?.gym_name || 'My Gym', gymId, city: gym?.city || null };
  }
  if (scope === 'city') {
    const city = cleanText(override.city || membership?.gym?.city, 120);
    if (!city) return { ids: [], scopeKey: 'none', label: 'My City', unavailable: 'Connect to a gym with a city to unlock this leaderboard.', gymId: null, city: null };
    const { data: gyms, error: gymError } = await db.from('gyms').select('gym_id').ilike('city', city).in('status', ['verified', 'active']).limit(500);
    if (gymError) throw fail(gymError.message, 500);
    const gymIds = safeArray(gyms).map((row) => row.gym_id);
    if (!gymIds.length) return { ids: [], scopeKey: city.toLowerCase(), label: city, gymId: null, city };
    const { data, error } = await db.from('gym_memberships').select('user_id').in('gym_id', gymIds).eq('status', 'active').limit(5000);
    if (error) throw fail(error.message, 500);
    return { ids: safeArray(data).map((row) => row.user_id).filter(Boolean), scopeKey: city.toLowerCase(), label: city, gymId: null, city };
  }
  const { data, error } = await db.from('reward_transactions').select('user_id').eq('type', 'earn').eq('integrity_status', 'verified').order('created_at', { ascending: false }).limit(5000);
  if (error) throw fail(error.message, 500);
  return { ids: safeArray(data).map((row) => row.user_id).filter(Boolean), scopeKey: 'global', label: 'Whole App', gymId: null, city: null };
}

async function prizesForScope(scope, context, window) {
  let query = db.from('leaderboard_prizes').select('*').eq('active', true).eq('scope', scope).order('rank', { ascending: true }).order('created_at', { ascending: false }).limit(100);
  if (scope === 'gym') query = query.eq('gym_id', context.gymId);
  else if (scope === 'city') query = query.ilike('city', context.city || '');
  else query = query.is('gym_id', null);
  const { data, error } = await query;
  if (error) throw fail(error.message, 500);
  const now = Date.now();
  const byRank = new Map();
  for (const row of safeArray(data)) {
    if (row.starts_at && new Date(row.starts_at).getTime() > now) continue;
    if (row.ends_at && new Date(row.ends_at).getTime() <= now) continue;
    if (!byRank.has(Number(row.rank))) byRank.set(Number(row.rank), row);
  }
  return [...byRank.values()].sort((a, b) => Number(a.rank) - Number(b.rank)).slice(0, 10).map((row) => ({
    id: row.prize_id,
    rank: Number(row.rank),
    title: row.title,
    reward: row.description,
    coins: Number(row.coins || 0),
    period_key: window.periodKey,
  }));
}

async function ensureLeaderboardCycle(scope, context, window) {
  const row = {
    scope,
    scope_key: context.scopeKey,
    period_key: window.periodKey,
    starts_at: window.start,
    ends_at: window.end,
    status: 'open',
    metadata: { label: context.label, gym_id: context.gymId, city: context.city },
  };
  const { data, error } = await db.from('leaderboard_cycles').upsert(row, { onConflict: 'scope,scope_key,period_key', ignoreDuplicates: true }).select('*').maybeSingle();
  if (error) throw fail(error.message, 500);
  if (data) return data;
  const { data: existing, error: existingError } = await db.from('leaderboard_cycles').select('*').eq('scope', scope).eq('scope_key', context.scopeKey).eq('period_key', window.periodKey).single();
  if (existingError) throw fail(existingError.message, 500);
  return existing;
}

async function buildLeaderboard({ scope = 'global', currentUserId, membership = null, periodKey = null, override = {} }) {
  const normalizedScope = ['gym', 'city', 'global'].includes(scope) ? scope : 'global';
  const window = monthWindow(periodKey);
  const context = await candidateIdsForScope(normalizedScope, membership, override);
  if (context.unavailable) return { scope: normalizedScope, scope_label: context.label, entries: [], user_rank: null, prizes: [], unavailable_reason: context.unavailable, period_key: window.periodKey };
  const ids = [...new Set([...context.ids, currentUserId].filter(Boolean))].slice(0, 5000);
  const cycle = await ensureLeaderboardCycle(normalizedScope, context, window);
  if (!ids.length) return { scope: normalizedScope, scope_label: context.label, entries: [], user_rank: null, prizes: await prizesForScope(normalizedScope, context, window), period_key: window.periodKey, cycle_id: cycle.cycle_id };

  const [{ data: profiles, error: profileError }, { data: wallets, error: walletError }, { data: flags, error: flagError }, scores] = await Promise.all([
    db.from('profiles').select('user_id,full_name,avatar_url,status').in('user_id', ids),
    db.from('reward_wallets').select('user_id,coins').in('user_id', ids),
    db.from('engagement_integrity_flags').select('user_id,severity,status').in('user_id', ids).eq('status', 'open').in('severity', ['high', 'critical']),
    trustedScoreData(ids, window),
  ]);
  if (profileError) throw fail(profileError.message, 500);
  if (walletError) throw fail(walletError.message, 500);
  if (flagError) throw fail(flagError.message, 500);

  const profileMap = new Map(safeArray(profiles).map((row) => [row.user_id, row]));
  const walletMap = new Map(safeArray(wallets).map((row) => [row.user_id, row]));
  const flagged = new Set(safeArray(flags).map((row) => row.user_id));
  const ranked = ids.map((id) => {
    const profile = profileMap.get(id) || {};
    const score = scores.get(id) || { score: 0, completed_challenges: 0, challenge_coins: 0, battle_coins: 0, prize_coins: 0 };
    const underReview = flagged.has(id) || (profile.status && profile.status !== 'active');
    return {
      user_id: id,
      name: publicName(profile.full_name, id === currentUserId),
      avatar_url: profile.avatar_url || null,
      score: underReview ? 0 : Number(score.score || 0),
      coins: Number(walletMap.get(id)?.coins || 0),
      completed_challenges: Number(score.completed_challenges || 0),
      breakdown: score,
      is_current_user: id === currentUserId,
      integrity_status: underReview ? 'review' : 'verified',
    };
  }).filter((row) => row.integrity_status === 'verified' || row.is_current_user)
    .sort((a, b) => b.score - a.score || b.completed_challenges - a.completed_challenges || a.user_id.localeCompare(b.user_id));

  let visibleRank = 0;
  const entries = ranked.slice(0, 100).map((row) => {
    const rank = row.integrity_status === 'verified' ? ++visibleRank : null;
    return { ...row, rank };
  });
  const current = entries.find((row) => row.user_id === currentUserId);

  const snapshotRows = entries.filter((row) => row.rank).map((row) => ({
    cycle_id: cycle.cycle_id,
    user_id: row.user_id,
    gym_id: context.gymId,
    score: row.score,
    rank: row.rank,
    breakdown: row.breakdown,
    integrity_status: row.integrity_status,
    calculated_at: nowIso(),
  }));
  if (snapshotRows.length) {
    const { error: snapshotError } = await db.from('leaderboard_score_snapshots').upsert(snapshotRows, { onConflict: 'cycle_id,user_id' });
    if (snapshotError) console.error('[engagement-phase6] snapshot upsert failed', snapshotError);
  }

  const { data: awards, error: awardError } = currentUserId
    ? await db.from('leaderboard_awards').select('*').eq('user_id', currentUserId).order('awarded_at', { ascending: false }).limit(20)
    : { data: [], error: null };
  if (awardError) throw fail(awardError.message, 500);

  return {
    scope: normalizedScope,
    scope_label: context.label,
    period_key: window.periodKey,
    period_label: new Date(`${window.startDate}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    cycle_id: cycle.cycle_id,
    cycle_status: cycle.status,
    entries,
    user_rank: current?.rank || null,
    user_integrity_status: current?.integrity_status || 'verified',
    prizes: await prizesForScope(normalizedScope, context, window),
    award_history: safeArray(awards).map((row) => ({ id: row.award_id, rank: row.rank, title: row.title, reward: row.description, coins: Number(row.coins || 0), status: row.status, awarded_at: row.awarded_at })),
    integrity_message: 'Rankings use verified server-issued rewards from completed challenges, settled gym battles and awarded prizes.',
  };
}

async function walletFor(userId) {
  const { data, error } = await db.from('reward_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw fail(error.message, 500);
  return { user_id: userId, coins_balance: Number(data?.coins || 0), total_earned: Number(data?.lifetime_earned || 0) };
}

async function engagementOverview(req, userId) {
  const date = localDateKey(req);
  const [subscription, membership, wallet] = await Promise.all([activeSubscription(userId), activeMembership(userId), walletFor(userId)]);
  const premium = PREMIUM_PLANS.has(subscription?.plan);
  const [{ data: challenges, error: challengeError }, { data: participants, error: participantError }, { data: counts, error: countError }, { data: checkins, error: checkinError }, { data: transactions, error: transactionError }, { count: openFlagCount, error: flagError }] = await Promise.all([
    db.from('challenges').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    db.from('challenge_participants').select('*').eq('user_id', userId),
    db.from('challenge_participants').select('challenge_id').limit(10000),
    db.from('challenge_checkins').select('*').eq('user_id', userId).eq('integrity_status', 'verified').order('checkin_date', { ascending: false }).limit(1000),
    db.from('reward_transactions').select('*').eq('user_id', userId).eq('integrity_status', 'verified').order('created_at', { ascending: false }).limit(50),
    db.from('engagement_integrity_flags').select('flag_id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open'),
  ]);
  if (challengeError) throw fail(challengeError.message, 500);
  if (participantError) throw fail(participantError.message, 500);
  if (countError) throw fail(countError.message, 500);
  if (checkinError) throw fail(checkinError.message, 500);
  if (transactionError) throw fail(transactionError.message, 500);
  if (flagError) throw fail(flagError.message, 500);

  const visible = [];
  for (const challenge of safeArray(challenges)) {
    if (await challengeScopeAllowed(challenge, membership)) visible.push(challenge);
  }
  const participantMap = new Map(safeArray(participants).map((row) => [String(row.challenge_id), row]));
  const countMap = safeArray(counts).reduce((map, row) => map.set(String(row.challenge_id), (map.get(String(row.challenge_id)) || 0) + 1), new Map());
  const checkinMap = safeArray(checkins).reduce((map, row) => {
    const key = String(row.challenge_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
  const normalized = visible.map((row) => normalizeChallenge(row, participantMap.get(String(row.challenge_id)), checkinMap.get(String(row.challenge_id)), countMap.get(String(row.challenge_id)), premium));
  const uniqueCheckinDates = [...new Set(safeArray(checkins).map((row) => dateOnly(row.checkin_date)).filter(isDateKey))].sort().reverse();
  let streak = 0;
  let cursor = new Date(`${date}T12:00:00.000Z`);
  if (!uniqueCheckinDates.includes(date)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  const checkinDateSet = new Set(uniqueCheckinDates);
  while (checkinDateSet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const spotlight = await buildLeaderboard({ scope: 'global', currentUserId: userId, membership }).catch(() => ({ entries: [] }));
  return {
    date,
    subscription,
    premium,
    membership,
    wallet,
    challenges: normalized,
    transactions: safeArray(transactions).filter((row) => ['challenge_reward:', 'gym_battle_reward:', 'leaderboard_prize:'].some((prefix) => String(row.source || '').startsWith(prefix))).map((row) => ({
      id: row.transaction_id,
      type: row.type,
      coins: Number(row.amount || 0),
      reason: String(row.source || '').startsWith('challenge_reward:') ? 'Challenge completed' : String(row.source || '').startsWith('gym_battle_reward:') ? 'Gym battle reward' : 'Leaderboard prize',
      source: row.source,
      date: dateOnly(row.created_at),
    })),
    stats: {
      joined: normalized.filter((item) => item.joined).length,
      completed: normalized.filter((item) => item.completed).length,
      active: normalized.filter((item) => item.joined && !item.completed).length,
      streak,
    },
    spotlight: safeArray(spotlight.entries).filter((row) => row.rank).slice(0, 3),
    fairness: {
      open_review_count: Number(openFlagCount || 0),
      message: 'Only verified activity can advance competitive challenges or earn leaderboard score.',
    },
  };
}

async function gymMemberDirectory(gymId, currentUserId) {
  const { data: memberships, error } = await db.from('gym_memberships').select('user_id').eq('gym_id', gymId).eq('status', 'active').limit(500);
  if (error) throw fail(error.message, 500);
  const ids = safeArray(memberships).map((row) => row.user_id).filter((id) => id && id !== currentUserId);
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await db.from('profiles').select('user_id,full_name,avatar_url,status').in('user_id', ids).eq('status', 'active');
  if (profileError) throw fail(profileError.message, 500);
  return safeArray(profiles).map((profile) => ({ user_id: profile.user_id, name: profile.full_name || `Gym member ${String(profile.user_id).slice(-4)}`, avatar_url: profile.avatar_url || null })).sort((a, b) => a.name.localeCompare(b.name));
}

async function battleMetricProgress(metric, userId, gymId, startsAt, endsAt, battleId) {
  const startDate = dateOnly(startsAt);
  const endDate = dateOnly(endsAt || nowIso());
  if (metric === 'steps') return trustedSteps(userId, startDate, endDate, 'gym_battle', battleId);
  if (metric === 'workouts') return trustedWorkouts(userId, startDate, endDate);
  if (metric === 'cardio') return trustedCardio(userId, startDate, endDate, 'gym_battle', battleId);
  if (metric === 'gym_visits') return trustedGymVisits(userId, gymId, startDate, endDate);
  return { value: 0, integrity_status: 'verified' };
}

function publicBattle(battle, members, profileMap, currentUserId) {
  const metric = BATTLE_METRICS[battle.metric] || BATTLE_METRICS.steps;
  const sorted = [...members].sort((a, b) => Number(b.verified_progress ?? b.progress ?? 0) - Number(a.verified_progress ?? a.progress ?? 0));
  return {
    id: battle.battle_id,
    gym_id: battle.gym_id,
    title: battle.title,
    metric: battle.metric,
    metric_label: metric.label,
    unit: metric.unit,
    emoji: metric.emoji,
    target: Number(battle.target_value || metric.target),
    duration_days: Number(battle.duration_days || metric.duration),
    status: battle.status,
    starts_at: battle.starts_at,
    ends_at: battle.ends_at,
    completed_at: battle.completed_at,
    winner_user_id: battle.winner_user_id,
    created_by: battle.created_by,
    is_creator: battle.created_by === currentUserId,
    integrity_status: battle.integrity_status || 'verified',
    under_review: battle.integrity_status === 'review',
    members: sorted.map((member, index) => ({
      user_id: member.user_id,
      name: profileMap.get(member.user_id)?.full_name || (member.user_id === currentUserId ? 'You' : `Gym member ${String(member.user_id).slice(-4)}`),
      avatar_url: profileMap.get(member.user_id)?.avatar_url || null,
      invite_status: member.invite_status,
      progress: Number(member.verified_progress ?? member.progress ?? 0),
      progress_percent: Math.min(100, Math.round((Number(member.verified_progress ?? member.progress ?? 0) / Math.max(1, Number(battle.target_value || 1))) * 100)),
      rank: index + 1,
      is_current_user: member.user_id === currentUserId,
      is_winner: battle.winner_user_id === member.user_id,
      integrity_status: member.integrity_status || 'verified',
      reward_coins: Number(member.reward_coins || 0),
    })),
  };
}

async function refreshBattle(battle, members) {
  if (!battle || battle.status !== 'active' || !battle.starts_at || !battle.ends_at) return { battle, members };
  const progress = [];
  let needsReview = false;
  for (const member of members.filter((row) => row.invite_status === 'accepted')) {
    const result = await battleMetricProgress(battle.metric, member.user_id, battle.gym_id, battle.starts_at, battle.ends_at, battle.battle_id);
    if (result.integrity_status !== 'verified') needsReview = true;
    progress.push({ user_id: member.user_id, progress: Number(result.value || 0), integrity_status: result.integrity_status, evidence: result });
    await db.from('gym_battle_members').update({
      progress: Number(result.value || 0),
      verified_progress: Number(result.value || 0),
      integrity_status: result.integrity_status,
      evidence: result,
      updated_at: nowIso(),
    }).eq('id', member.id);
  }
  if (needsReview) {
    const { data: updated } = await db.from('gym_battles').update({ integrity_status: 'review', updated_at: nowIso() }).eq('battle_id', battle.battle_id).select('*').single();
    return { battle: updated || { ...battle, integrity_status: 'review' }, members: members.map((member) => ({ ...member, ...(progress.find((row) => row.user_id === member.user_id) ? { verified_progress: progress.find((row) => row.user_id === member.user_id).progress, integrity_status: progress.find((row) => row.user_id === member.user_id).integrity_status } : {}) })) };
  }
  const reachedTarget = progress.some((row) => row.progress >= Number(battle.target_value || 0));
  const expired = Date.now() >= new Date(battle.ends_at).getTime();
  if (!reachedTarget && !expired) return { battle: { ...battle, integrity_status: 'verified' }, members: members.map((member) => ({ ...member, ...(progress.find((row) => row.user_id === member.user_id) ? { verified_progress: progress.find((row) => row.user_id === member.user_id).progress, integrity_status: 'verified' } : {}) })) };
  const { data, error } = await db.rpc('settle_gym_battle_v2', { p_battle_id: battle.battle_id, p_progress: progress, p_result_metadata: { settled_by: 'engagement_phase6' } });
  if (error) throw fail(error.message, 500);
  const settledBattle = data?.battle || battle;
  const { data: refreshedMembers, error: memberError } = await db.from('gym_battle_members').select('*').eq('battle_id', battle.battle_id);
  if (memberError) throw fail(memberError.message, 500);
  return { battle: settledBattle, members: refreshedMembers || members };
}

async function battleOverview(userId) {
  const membership = await activeMembership(userId);
  const templates = Object.entries(BATTLE_METRICS).map(([key, value]) => ({ key, ...value }));
  if (!membership) return { connected: false, gym: null, members: [], incoming: [], sent: [], active: [], completed: [], templates, fairness: 'Only verified activity records count.' };
  const { data: myRows, error: rowError } = await db.from('gym_battle_members').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(150);
  if (rowError) throw fail(rowError.message, 500);
  const ids = [...new Set(safeArray(myRows).map((row) => row.battle_id))];
  if (!ids.length) return { connected: true, gym: { id: membership.gym_id, name: membership.gym?.name || membership.gym?.gym_name || 'Your gym' }, members: await gymMemberDirectory(membership.gym_id, userId), incoming: [], sent: [], active: [], completed: [], templates, fairness: 'Only verified activity records count.' };
  const [{ data: battles, error: battleError }, { data: allMembers, error: memberError }] = await Promise.all([
    db.from('gym_battles').select('*').in('battle_id', ids).eq('gym_id', membership.gym_id).order('created_at', { ascending: false }),
    db.from('gym_battle_members').select('*').in('battle_id', ids),
  ]);
  if (battleError) throw fail(battleError.message, 500);
  if (memberError) throw fail(memberError.message, 500);
  const userIds = [...new Set(safeArray(allMembers).map((row) => row.user_id))];
  const { data: profiles, error: profileError } = userIds.length ? await db.from('profiles').select('user_id,full_name,avatar_url').in('user_id', userIds) : { data: [], error: null };
  if (profileError) throw fail(profileError.message, 500);
  const profileMap = new Map(safeArray(profiles).map((row) => [row.user_id, row]));
  const groups = new Map();
  safeArray(allMembers).forEach((row) => {
    if (!groups.has(row.battle_id)) groups.set(row.battle_id, []);
    groups.get(row.battle_id).push(row);
  });
  const hydrated = [];
  for (const battle of safeArray(battles)) {
    const refreshed = await refreshBattle(battle, groups.get(battle.battle_id) || []);
    hydrated.push(publicBattle(refreshed.battle, refreshed.members, profileMap, userId));
  }
  const statusMap = new Map(safeArray(myRows).map((row) => [row.battle_id, row.invite_status]));
  return {
    connected: true,
    gym: { id: membership.gym_id, name: membership.gym?.name || membership.gym?.gym_name || 'Your gym' },
    members: await gymMemberDirectory(membership.gym_id, userId),
    incoming: hydrated.filter((battle) => battle.status === 'pending' && !battle.is_creator && statusMap.get(battle.id) === 'pending'),
    sent: hydrated.filter((battle) => battle.status === 'pending' && battle.is_creator),
    active: hydrated.filter((battle) => battle.status === 'active'),
    completed: hydrated.filter((battle) => ['completed', 'cancelled', 'expired'].includes(battle.status)).slice(0, 40),
    templates,
    fairness: 'Manual steps, self-attendance and implausible activity are excluded from battle scoring.',
  };
}

async function createBattle(userId, body) {
  const membership = await activeMembership(userId);
  if (!membership) throw fail('Connect an active gym membership before challenging another member.', 409, 'gym_required');
  const opponentUserId = cleanText(body?.opponent_user_id, 80);
  const metricKey = cleanText(body?.metric, 40);
  const metric = BATTLE_METRICS[metricKey];
  if (!isUuid(opponentUserId) || opponentUserId === userId) throw fail('Choose another active gym member.', 400, 'invalid_opponent');
  if (!metric) throw fail('Choose a valid battle type.', 400, 'invalid_metric');
  const { data: opponent, error: opponentError } = await db.from('gym_memberships').select('membership_id').eq('gym_id', membership.gym_id).eq('user_id', opponentUserId).eq('status', 'active').maybeSingle();
  if (opponentError) throw fail(opponentError.message, 500);
  if (!opponent) throw fail('This member is not active in your gym.', 403, 'opponent_not_active');

  const month = monthWindow();
  const { data: recentBattles, error: recentError } = await db.from('gym_battles').select('battle_id,status,created_at').eq('gym_id', membership.gym_id).gte('created_at', month.start).lt('created_at', month.end).in('status', ['pending', 'active', 'completed']).limit(200);
  if (recentError) throw fail(recentError.message, 500);
  const recentIds = safeArray(recentBattles).map((row) => row.battle_id);
  if (recentIds.length) {
    const { data: pairRows, error: pairError } = await db.from('gym_battle_members').select('battle_id,user_id').in('battle_id', recentIds).in('user_id', [userId, opponentUserId]);
    if (pairError) throw fail(pairError.message, 500);
    const pairCount = [...new Set(safeArray(pairRows).filter((row) => [userId, opponentUserId].includes(row.user_id)).map((row) => row.battle_id))].filter((battleId) => safeArray(pairRows).filter((row) => row.battle_id === battleId).length >= 2).length;
    if (pairCount >= 3) throw fail('This pair has reached the monthly battle limit. Challenge another member.', 429, 'pair_monthly_limit');
  }
  const { count: pendingCount, error: pendingError } = await db.from('gym_battles').select('battle_id', { count: 'exact', head: true }).eq('created_by', userId).eq('status', 'pending').gte('created_at', new Date(Date.now() - 86400000).toISOString());
  if (pendingError) throw fail(pendingError.message, 500);
  if (Number(pendingCount || 0) >= 5) throw fail('You have reached today’s invitation limit.', 429, 'daily_invite_limit');

  const durationDays = [3, 7, 14].includes(Number(body?.duration_days)) ? Number(body.duration_days) : metric.duration;
  const requestedTarget = Number(body?.target_value || metric.target);
  const targetValue = Math.max(metric.min, Math.min(metric.max, Number.isFinite(requestedTarget) ? requestedTarget : metric.target));
  const title = cleanText(body?.title || metric.label, 80) || metric.label;
  const { data: battle, error: battleError } = await db.from('gym_battles').insert({
    gym_id: membership.gym_id,
    created_by: userId,
    title,
    metric: metricKey,
    target_value: targetValue,
    duration_days: durationDays,
    status: 'pending',
    integrity_status: 'verified',
    rules: { unit: metric.unit, emoji: metric.emoji, minimum_reward_progress: Math.ceil(targetValue * 0.1) },
  }).select('*').single();
  if (battleError) throw fail(battleError.message, 500);
  const { error: memberError } = await db.from('gym_battle_members').insert([
    { battle_id: battle.battle_id, user_id: userId, invite_status: 'accepted' },
    { battle_id: battle.battle_id, user_id: opponentUserId, invite_status: 'pending' },
  ]);
  if (memberError) {
    await db.from('gym_battles').delete().eq('battle_id', battle.battle_id);
    throw fail(memberError.message, 500);
  }
  return battleOverview(userId);
}

async function respondToBattle(userId, battleId, response) {
  const normalized = cleanText(response, 20).toLowerCase();
  if (!['accepted', 'declined'].includes(normalized)) throw fail('Choose accept or decline.', 400, 'invalid_response');
  const membership = await activeMembership(userId);
  const [{ data: member, error: memberError }, { data: battle, error: battleError }] = await Promise.all([
    db.from('gym_battle_members').select('*').eq('battle_id', battleId).eq('user_id', userId).maybeSingle(),
    db.from('gym_battles').select('*').eq('battle_id', battleId).maybeSingle(),
  ]);
  if (memberError) throw fail(memberError.message, 500);
  if (battleError) throw fail(battleError.message, 500);
  if (!battle || !member || battle.gym_id !== membership?.gym_id) throw fail('Battle invitation not found.', 404, 'battle_not_found');
  if (battle.status !== 'pending' || member.invite_status !== 'pending') throw fail('This invitation is no longer available.', 409, 'invite_closed');
  const { data: updatedMember, error: updateMemberError } = await db.from('gym_battle_members').update({ invite_status: normalized, updated_at: nowIso() }).eq('id', member.id).eq('invite_status', 'pending').select('*').maybeSingle();
  if (updateMemberError) throw fail(updateMemberError.message, 500);
  if (!updatedMember) throw fail('This invitation was already answered.', 409, 'invite_closed');
  if (normalized === 'declined') {
    const { error } = await db.from('gym_battles').update({ status: 'cancelled', cancelled_reason: 'declined', updated_at: nowIso() }).eq('battle_id', battleId).eq('status', 'pending');
    if (error) throw fail(error.message, 500);
  } else {
    const start = new Date();
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + Number(battle.duration_days || 7));
    const { error } = await db.from('gym_battles').update({ status: 'active', starts_at: start.toISOString(), ends_at: end.toISOString(), integrity_status: 'verified', updated_at: nowIso() }).eq('battle_id', battleId).eq('status', 'pending');
    if (error) throw fail(error.message, 500);
  }
  return battleOverview(userId);
}

function register(app) {
  if (app.__se7enfitEngagementPhase6Routes) return;
  app.__se7enfitEngagementPhase6Routes = true;

  for (const entity of PROTECTED_ENTITIES) {
    app.post(`/api/entities/${entity}`, wrap(async (req) => {
      await authContext(req);
      throw fail('Competitive progress and rewards can only be changed by verified SE7EN FIT workflows.', 403, 'server_managed_entity');
    }));
    app.put(`/api/entities/${entity}/:id`, wrap(async (req) => {
      await authContext(req);
      throw fail('Competitive progress and rewards can only be changed by verified SE7EN FIT workflows.', 403, 'server_managed_entity');
    }));
    app.delete(`/api/entities/${entity}/:id`, wrap(async (req) => {
      await authContext(req);
      throw fail('Competitive progress and rewards can only be changed by verified SE7EN FIT workflows.', 403, 'server_managed_entity');
    }));
  }

  app.get('/api/engagement/overview', wrap(async (req, res) => {
    const { user } = await authContext(req);
    res.json({ item: await engagementOverview(req, user.id) });
  }));

  app.post('/api/engagement/challenges/:id/join', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const [subscription, membership] = await Promise.all([activeSubscription(user.id), activeMembership(user.id)]);
    const { data: challenge, error } = await db.from('challenges').select('*').eq('challenge_id', req.params.id).eq('status', 'active').maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!challenge) throw fail('Challenge not found.', 404, 'challenge_not_found');
    if (!(await challengeScopeAllowed(challenge, membership))) throw fail('This challenge is not available for your gym or city.', 403, 'challenge_scope_denied');
    if (challenge.premium_required && !PREMIUM_PLANS.has(subscription?.plan)) throw fail('Premium is required for this challenge.', 402, 'premium_required');
    const { data, error: rpcError } = await db.rpc('join_challenge_v2', { p_user_id: user.id, p_challenge_id: challenge.challenge_id, p_gym_id: membership?.gym_id || null });
    if (rpcError) throw fail(rpcError.message, 500);
    res.status(201).json({ item: data?.participant || data });
  }));

  app.post('/api/engagement/challenges/:id/check-in', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const date = localDateKey(req);
    const [subscription, membership] = await Promise.all([activeSubscription(user.id), activeMembership(user.id)]);
    const [{ data: challenge, error: challengeError }, { data: participant, error: participantError }] = await Promise.all([
      db.from('challenges').select('*').eq('challenge_id', req.params.id).eq('status', 'active').maybeSingle(),
      db.from('challenge_participants').select('*').eq('challenge_id', req.params.id).eq('user_id', user.id).maybeSingle(),
    ]);
    if (challengeError) throw fail(challengeError.message, 500);
    if (participantError) throw fail(participantError.message, 500);
    if (!challenge) throw fail('Challenge not found.', 404, 'challenge_not_found');
    if (!participant) throw fail('Join this challenge before checking in.', 409, 'challenge_not_joined');
    if (dateOnly(participant.joined_at) > date) throw fail('Check-in date is before the challenge join date.', 409, 'invalid_checkin_date');
    if (!(await challengeScopeAllowed(challenge, membership))) throw fail('This challenge is not available for your gym or city.', 403, 'challenge_scope_denied');
    const premium = PREMIUM_PLANS.has(subscription?.plan);
    if (challenge.premium_required && !premium) throw fail('Premium is required for this challenge.', 402, 'premium_required');
    const verification = await challengeQualification(user.id, challenge, date, membership);
    if (!verification.eligible) {
      return res.status(422).json({ error: verification.message, code: verification.integrity_status === 'review' ? 'activity_under_review' : 'target_not_met', item: { eligible: false, verification, progress: Number(participant.progress || 0) } });
    }
    const { data, error: rpcError } = await db.rpc('record_challenge_checkin_v2', {
      p_user_id: user.id,
      p_challenge_id: challenge.challenge_id,
      p_checkin_date: date,
      p_metric: verification.metric,
      p_verified_value: verification.current,
      p_threshold: verification.threshold,
      p_evidence: verification.evidence,
      p_reward_multiplier: premium ? 2 : 1,
    });
    if (rpcError) throw fail(rpcError.message, rpcError.code === '22023' ? 422 : 500);
    res.json({ item: {
      already_logged: Boolean(data?.idempotent),
      completed: Boolean(data?.completed),
      participant: data?.participant,
      progress: Number(data?.participant?.progress || participant.progress || 0),
      target: Math.max(1, Number(parseRules(challenge.rules).target_days || challenge.duration_days || 1)),
      reward_coins: Number(data?.reward_coins || 0),
      verification,
    } });
  }));

  app.get('/api/engagement/leaderboard', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const membership = await activeMembership(user.id);
    res.json({ item: await buildLeaderboard({ scope: req.query.scope, currentUserId: user.id, membership, periodKey: req.query.period }) });
  }));

  app.get('/api/engagement/awards', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const { data, error } = await db.from('leaderboard_awards').select('*').eq('user_id', user.id).order('awarded_at', { ascending: false }).limit(100);
    if (error) throw fail(error.message, 500);
    res.json({ items: data || [] });
  }));

  app.post('/api/engagement/reports', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const body = req.body || {};
    const sourceType = cleanText(body.source_type, 40);
    const reasonCode = cleanText(body.reason_code, 60);
    if (!['challenge', 'gym_battle', 'leaderboard', 'profile'].includes(sourceType)) throw fail('Choose a valid report type.', 400, 'invalid_report_type');
    if (!['impossible_activity', 'duplicate_account', 'harassment', 'fake_result', 'inappropriate_content', 'other'].includes(reasonCode)) throw fail('Choose a valid report reason.', 400, 'invalid_report_reason');
    if (body.reported_user_id && (!isUuid(body.reported_user_id) || body.reported_user_id === user.id)) throw fail('Choose another member to report.', 400, 'invalid_reported_user');
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count, error: countError } = await db.from('engagement_abuse_reports').select('report_id', { count: 'exact', head: true }).eq('reporter_user_id', user.id).gte('created_at', since);
    if (countError) throw fail(countError.message, 500);
    if (Number(count || 0) >= 5) throw fail('You have reached today’s report limit.', 429, 'report_rate_limit');
    const { data, error } = await db.from('engagement_abuse_reports').insert({
      reporter_user_id: user.id,
      reported_user_id: body.reported_user_id || null,
      source_type: sourceType,
      source_id: cleanText(body.source_id, 160) || null,
      reason_code: reasonCode,
      details: cleanText(body.details, 1200) || null,
      metadata: { client_timezone: cleanText(req.headers['x-client-timezone'], 80) || null },
    }).select('*').single();
    if (error) throw fail(error.message, 500);
    res.status(201).json({ item: data });
  }));

  app.get('/api/gym-battles/overview', wrap(async (req, res) => {
    const { user } = await authContext(req);
    res.json({ item: await battleOverview(user.id) });
  }));

  app.post('/api/gym-battles', wrap(async (req, res) => {
    const { user } = await authContext(req);
    res.status(201).json({ item: await createBattle(user.id, req.body || {}) });
  }));

  app.post('/api/gym-battles/:id/respond', wrap(async (req, res) => {
    const { user } = await authContext(req);
    res.json({ item: await respondToBattle(user.id, req.params.id, req.body?.response) });
  }));

  app.post('/api/gym-battles/:id/refresh', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const { data: member, error } = await db.from('gym_battle_members').select('id').eq('battle_id', req.params.id).eq('user_id', user.id).maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!member) throw fail('Battle not found.', 404, 'battle_not_found');
    res.json({ item: await battleOverview(user.id) });
  }));

  app.get('/api/admin/engagement/integrity-flags', wrap(async (req, res) => {
    await requireAdmin(req);
    let query = db.from('engagement_integrity_flags').select('*, profiles!engagement_integrity_flags_user_id_fkey(full_name,email)').order('created_at', { ascending: false }).limit(Math.min(500, Number(req.query.limit || 200)));
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.severity) query = query.eq('severity', req.query.severity);
    const { data, error } = await query;
    if (error) throw fail(error.message, 500);
    res.json({ items: data || [] });
  }));

  app.patch('/api/admin/engagement/integrity-flags/:id', wrap(async (req, res) => {
    const { user } = await requireAdmin(req);
    const status = cleanText(req.body?.status, 20);
    if (!['reviewed', 'dismissed', 'confirmed'].includes(status)) throw fail('Choose a valid review status.', 400, 'invalid_status');
    const { data, error } = await db.from('engagement_integrity_flags').update({ status, reviewed_by: user.id, review_notes: cleanText(req.body?.review_notes, 1200) || null, reviewed_at: nowIso(), updated_at: nowIso() }).eq('flag_id', req.params.id).select('*').single();
    if (error) throw fail(error.message, 500);
    res.json({ item: data });
  }));

  app.get('/api/admin/engagement/reports', wrap(async (req, res) => {
    await requireAdmin(req);
    let query = db.from('engagement_abuse_reports').select('*').order('created_at', { ascending: false }).limit(Math.min(500, Number(req.query.limit || 200)));
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error } = await query;
    if (error) throw fail(error.message, 500);
    res.json({ items: data || [] });
  }));

  app.patch('/api/admin/engagement/reports/:id', wrap(async (req, res) => {
    const { user } = await requireAdmin(req);
    const status = cleanText(req.body?.status, 20);
    if (!['reviewing', 'resolved', 'dismissed'].includes(status)) throw fail('Choose a valid report status.', 400, 'invalid_status');
    const { data, error } = await db.from('engagement_abuse_reports').update({ status, reviewed_by: user.id, reviewed_at: nowIso(), resolution_notes: cleanText(req.body?.resolution_notes, 1200) || null, updated_at: nowIso() }).eq('report_id', req.params.id).select('*').single();
    if (error) throw fail(error.message, 500);
    res.json({ item: data });
  }));

  app.post('/api/admin/engagement/leaderboards/award', wrap(async (req, res) => {
    const { user, role } = await requireAdmin(req);
    const body = req.body || {};
    const scope = ['global', 'city', 'gym'].includes(body.scope) ? body.scope : 'global';
    const window = monthWindow(body.period_key);
    if (Date.now() < new Date(window.end).getTime() && !(body.force === true && role === 'super_admin')) throw fail('The leaderboard period must end before prizes are awarded.', 409, 'period_open');
    const result = await buildLeaderboard({
      scope,
      currentUserId: user.id,
      periodKey: window.periodKey,
      override: { gymId: body.gym_id || null, city: body.city || null },
    });
    if (!result.cycle_id) throw fail('Leaderboard cycle is unavailable.', 409, 'cycle_unavailable');
    const awarded = [];
    for (const prize of safeArray(result.prizes)) {
      const winner = safeArray(result.entries).find((entry) => Number(entry.rank) === Number(prize.rank));
      if (!winner) continue;
      const { data, error } = await db.rpc('award_leaderboard_prize_v2', {
        p_cycle_id: result.cycle_id,
        p_prize_id: prize.id,
        p_user_id: winner.user_id,
        p_rank: Number(prize.rank),
        p_score: Number(winner.score || 0),
        p_awarded_by: user.id,
        p_metadata: { scope, scope_label: result.scope_label },
      });
      if (error) throw fail(error.message, 500);
      awarded.push(data?.award || data);
    }
    const { error: cycleError } = await db.from('leaderboard_cycles').update({ status: 'awarded', updated_at: nowIso() }).eq('cycle_id', result.cycle_id);
    if (cycleError) throw fail(cycleError.message, 500);
    res.json({ item: { cycle_id: result.cycle_id, period_key: window.periodKey, awarded } });
  }));
}

const originalListen = express.application.listen;
express.application.listen = function listenWithEngagementPhase6(...args) {
  register(this);
  return originalListen.apply(this, args);
};
