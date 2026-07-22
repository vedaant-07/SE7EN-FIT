import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((error) => {
  const status = Number(error?.status || 500);
  if (status >= 500) console.error('[engagement]', error);
  res.status(status).json({ error: error?.message || 'Request failed' });
});
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const safeArray = (value) => Array.isArray(value) ? value : [];
const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const todayKey = (req) => {
  const candidate = req.body?.date || req.query?.date || req.headers['x-client-date'];
  return isDateKey(candidate) ? String(candidate) : new Date().toISOString().slice(0, 10);
};
const dateOnly = (value) => value ? String(value).slice(0, 10) : null;

const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_quarterly', 'premium_annual']);

const BUILTIN_CHALLENGES = [
  {
    challenge_id: '00000000-0000-4000-8000-000000000101',
    title: '7-Day Momentum',
    description: 'Reach 5,000 steps on seven different days and build a realistic movement routine.',
    difficulty: 'Easy', duration_days: 7, reward_coins: 200, target_scope: 'all', premium_required: false, status: 'active',
    rules: { metric: 'steps', threshold: 5000, unit: 'steps', emoji: '🌟', category: 'movement', action_path: '/tracking?metric=steps' },
  },
  {
    challenge_id: '00000000-0000-4000-8000-000000000102',
    title: '10K Club',
    description: 'Complete 10,000 steps on fourteen different days.',
    difficulty: 'Medium', duration_days: 14, reward_coins: 400, target_scope: 'all', premium_required: false, status: 'active',
    rules: { metric: 'steps', threshold: 10000, unit: 'steps', emoji: '👟', category: 'movement', action_path: '/tracking?metric=steps' },
  },
  {
    challenge_id: '00000000-0000-4000-8000-000000000103',
    title: '21-Day Consistency',
    description: 'Record meaningful movement or training on twenty-one different days.',
    difficulty: 'Hard', duration_days: 21, reward_coins: 650, target_scope: 'all', premium_required: true, status: 'active',
    rules: { metric: 'active_day', threshold: 1, unit: 'active day', emoji: '🔥', category: 'consistency', action_path: '/tracking/live' },
  },
  {
    challenge_id: '00000000-0000-4000-8000-000000000104',
    title: 'Strength Streak',
    description: 'Complete a logged workout on thirty different days.',
    difficulty: 'Hard', duration_days: 30, reward_coins: 900, target_scope: 'all', premium_required: true, status: 'active',
    rules: { metric: 'workout', threshold: 1, unit: 'workout', emoji: '💪', category: 'training', action_path: '/workout' },
  },
  {
    challenge_id: '00000000-0000-4000-8000-000000000105',
    title: 'Hydration Reset',
    description: 'Log at least 2.5 litres of water on seven different days.',
    difficulty: 'Easy', duration_days: 7, reward_coins: 180, target_scope: 'all', premium_required: false, status: 'active',
    rules: { metric: 'water', threshold: 2500, unit: 'ml', emoji: '💧', category: 'recovery', action_path: '/tracking?metric=water' },
  },
  {
    challenge_id: '00000000-0000-4000-8000-000000000106',
    title: 'Gym Visit Sprint',
    description: 'Check in at your connected gym on twelve different days.',
    difficulty: 'Medium', duration_days: 12, reward_coins: 500, target_scope: 'all', premium_required: true, status: 'active',
    rules: { metric: 'gym_visit', threshold: 1, unit: 'visit', emoji: '🏋️', category: 'gym', action_path: '/my-gym' },
  },
  {
    challenge_id: '00000000-0000-4000-8000-000000000107',
    title: 'Protein Target',
    description: 'Reach at least 100 grams of logged protein on fourteen different days.',
    difficulty: 'Medium', duration_days: 14, reward_coins: 420, target_scope: 'all', premium_required: false, status: 'active',
    rules: { metric: 'protein', threshold: 100, unit: 'g', emoji: '⚡', category: 'nutrition', action_path: '/nutrition/log' },
  },
  {
    challenge_id: '00000000-0000-4000-8000-000000000108',
    title: '60-Day Transformation',
    description: 'Build sixty verified active days with training, cardio, or meaningful movement.',
    difficulty: 'Expert', duration_days: 60, reward_coins: 2200, target_scope: 'all', premium_required: true, status: 'active',
    rules: { metric: 'active_day', threshold: 1, unit: 'active day', emoji: '⚡', category: 'transformation', action_path: '/tracking/live' },
  },
];

let builtinSeedPromise = null;
let builtinSeededAt = 0;
async function ensureBuiltins() {
  if (builtinSeedPromise && Date.now() - builtinSeededAt < 5 * 60 * 1000) return builtinSeedPromise;
  builtinSeededAt = Date.now();
  builtinSeedPromise = db.from('challenges').upsert(BUILTIN_CHALLENGES, { onConflict: 'challenge_id' }).then(({ error }) => {
    if (error) throw fail(error.message, 500);
    return true;
  }).catch((error) => {
    builtinSeedPromise = null;
    throw error;
  });
  return builtinSeedPromise;
}

async function authContext(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Please log in again.', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Your session expired. Please log in again.', 401);
  const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('user_id', data.user.id).maybeSingle();
  if (profileError) throw fail(profileError.message, 500);
  if (profile?.status === 'blocked') throw fail('This account is blocked.', 403);
  return { user: data.user, profile: profile || {} };
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
  return row ? {
    ...row,
    id: row.subscription_id,
    plan: row.plan_code,
    start_date: dateOnly(row.current_period_start),
    end_date: dateOnly(row.current_period_end),
  } : null;
}

async function activeMembership(userId) {
  const { data, error } = await db.from('gym_memberships')
    .select('*, gyms(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
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
    return typeof parsed === 'object' && parsed ? parsed : { text: String(value) };
  } catch {
    return { text: String(value) };
  }
}

function humanReason(source = '') {
  if (source.startsWith('challenge_reward:')) return 'Challenge completed';
  if (source.startsWith('reward_redeem:')) return 'Reward redeemed';
  if (source === 'workout') return 'Workout completed';
  return String(source || 'Reward activity').replace(/[_:]+/g, ' ');
}

function checkinMap(transactions) {
  const map = new Map();
  safeArray(transactions).forEach((row) => {
    const match = String(row.source || '').match(/^challenge_checkin:([0-9a-f-]+):(\d{4}-\d{2}-\d{2})$/i);
    if (!match) return;
    const [, challengeId, date] = match;
    if (!map.has(challengeId) || date > map.get(challengeId)) map.set(challengeId, date);
  });
  return map;
}

function calculateStreak(dates, today) {
  const unique = new Set(safeArray(dates).filter(isDateKey));
  let cursor = new Date(`${today}T12:00:00.000Z`);
  const todayExists = unique.has(today);
  if (!todayExists) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (unique.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function normalizeChallenge(row, participant, lastCheckin, participantCount, premium) {
  const rules = parseRules(row.rules);
  const target = Math.max(1, Number(rules.target_days || row.duration_days || 1));
  const progress = Math.min(target, Number(participant?.progress || 0));
  const completed = participant?.status === 'completed' || progress >= target;
  return {
    id: row.challenge_id,
    title: row.title || 'Challenge',
    description: row.description || rules.text || 'Complete the target to earn rewards.',
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
    last_checkin: lastCheckin || null,
    participants: Number(participantCount || 0),
  };
}

async function challengeRowsForUser(userId, membership) {
  await ensureBuiltins();
  const [{ data: challenges, error: challengeError }, { data: participants, error: participantError }, { data: counts, error: countError }, { data: checkins, error: checkinError }] = await Promise.all([
    db.from('challenges').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    db.from('challenge_participants').select('*').eq('user_id', userId),
    db.from('challenge_participants').select('challenge_id'),
    db.from('reward_transactions').select('*').eq('user_id', userId).eq('type', 'checkin').order('created_at', { ascending: false }).limit(250),
  ]);
  if (challengeError) throw fail(challengeError.message, 500);
  if (participantError) throw fail(participantError.message, 500);
  if (countError) throw fail(countError.message, 500);
  if (checkinError) throw fail(checkinError.message, 500);

  const gymId = membership?.gym_id || null;
  const city = String(membership?.gym?.city || '').trim().toLowerCase();
  const visible = safeArray(challenges).filter((row) => {
    if (row.gym_id) return gymId && String(row.gym_id) === String(gymId);
    if (row.target_scope === 'city') {
      const rules = parseRules(row.rules);
      return city && String(rules.city || '').trim().toLowerCase() === city;
    }
    return true;
  });

  const participantById = new Map(safeArray(participants).map((row) => [String(row.challenge_id), row]));
  const countById = safeArray(counts).reduce((map, row) => map.set(String(row.challenge_id), (map.get(String(row.challenge_id)) || 0) + 1), new Map());
  return { visible, participantById, countById, checkins: safeArray(checkins) };
}

async function walletFor(userId) {
  const { data, error } = await db.from('reward_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw fail(error.message, 500);
  return {
    user_id: userId,
    coins_balance: Number(data?.coins || 0),
    total_earned: Number(data?.lifetime_earned || 0),
  };
}

async function qualification(userId, challenge, date, membership) {
  const rules = parseRules(challenge.rules);
  const metric = rules.metric || rules.type || 'workout';
  const threshold = Math.max(1, Number(rules.threshold || 1));

  if (metric === 'steps') {
    const { data, error } = await db.from('step_logs').select('steps').eq('user_id', userId).eq('date', date);
    if (error) throw fail(error.message, 500);
    const current = safeArray(data).reduce((sum, row) => sum + Number(row.steps || 0), 0);
    return { eligible: current >= threshold, current, threshold, unit: rules.unit || 'steps', message: `Reach ${threshold.toLocaleString()} steps today to check in.` };
  }

  if (metric === 'water') {
    const { data, error } = await db.from('water_logs').select('amount_ml').eq('user_id', userId).eq('date', date);
    if (error) throw fail(error.message, 500);
    const current = safeArray(data).reduce((sum, row) => sum + Number(row.amount_ml || 0), 0);
    return { eligible: current >= threshold, current, threshold, unit: rules.unit || 'ml', message: `Log ${threshold.toLocaleString()} ml of water today to check in.` };
  }

  if (metric === 'protein') {
    const { data, error } = await db.from('nutrition_logs').select('protein_g').eq('user_id', userId).eq('date', date);
    if (error) throw fail(error.message, 500);
    const current = safeArray(data).reduce((sum, row) => sum + Number(row.protein_g || 0), 0);
    return { eligible: current >= threshold, current, threshold, unit: rules.unit || 'g', message: `Log ${threshold} g of protein today to check in.` };
  }

  if (metric === 'sleep') {
    const { data, error } = await db.from('sleep_logs').select('hours').eq('user_id', userId).eq('date', date);
    if (error) throw fail(error.message, 500);
    const current = safeArray(data).reduce((max, row) => Math.max(max, Number(row.hours || 0)), 0);
    return { eligible: current >= threshold, current, threshold, unit: rules.unit || 'hours', message: `Log at least ${threshold} hours of sleep to check in.` };
  }

  if (metric === 'gym_visit') {
    if (!membership?.gym_id) return { eligible: false, current: 0, threshold: 1, unit: 'visit', message: 'Connect to a gym and check in there first.' };
    const { data, error } = await db.from('gym_attendance_logs').select('log_id').eq('user_id', userId).eq('gym_id', membership.gym_id).eq('date', date).limit(1);
    if (error) throw fail(error.message, 500);
    const current = safeArray(data).length;
    return { eligible: current >= 1, current, threshold: 1, unit: 'visit', message: 'Check in at your connected gym today.' };
  }

  if (metric === 'workout') {
    const [{ data: workouts, error: workoutError }, { data: cardio, error: cardioError }] = await Promise.all([
      db.from('workout_logs').select('log_id, completed').eq('user_id', userId).eq('date', date),
      db.from('cardio_logs').select('duration_minutes').eq('user_id', userId).eq('date', date),
    ]);
    if (workoutError) throw fail(workoutError.message, 500);
    if (cardioError) throw fail(cardioError.message, 500);
    const current = safeArray(workouts).filter((row) => row.completed !== false).length + (safeArray(cardio).some((row) => Number(row.duration_minutes || 0) >= 20) ? 1 : 0);
    return { eligible: current >= threshold, current, threshold, unit: 'workout', message: 'Complete a workout or at least 20 minutes of cardio today.' };
  }

  const [{ data: steps, error: stepError }, { data: workouts, error: workoutError }, { data: cardio, error: cardioError }] = await Promise.all([
    db.from('step_logs').select('steps').eq('user_id', userId).eq('date', date),
    db.from('workout_logs').select('log_id, completed').eq('user_id', userId).eq('date', date),
    db.from('cardio_logs').select('duration_minutes').eq('user_id', userId).eq('date', date),
  ]);
  if (stepError) throw fail(stepError.message, 500);
  if (workoutError) throw fail(workoutError.message, 500);
  if (cardioError) throw fail(cardioError.message, 500);
  const totalSteps = safeArray(steps).reduce((sum, row) => sum + Number(row.steps || 0), 0);
  const active = totalSteps >= 5000 || safeArray(workouts).some((row) => row.completed !== false) || safeArray(cardio).some((row) => Number(row.duration_minutes || 0) >= 20);
  return { eligible: active, current: active ? 1 : 0, threshold: 1, unit: 'active day', message: 'Complete a workout, 20 minutes of cardio, or 5,000 steps today.' };
}

async function scopeAllowed(challenge, membership) {
  if (challenge.gym_id && String(challenge.gym_id) !== String(membership?.gym_id || '')) return false;
  if (challenge.target_scope === 'city') {
    const rules = parseRules(challenge.rules);
    return String(rules.city || '').trim().toLowerCase() === String(membership?.gym?.city || '').trim().toLowerCase();
  }
  return true;
}

async function buildLeaderboard(scope, userId, membership) {
  const normalizedScope = ['gym', 'city', 'global'].includes(scope) ? scope : 'global';
  let candidateIds = [];
  let scopeLabel = 'Whole App';
  let prizeRows = [];

  if (normalizedScope === 'gym') {
    if (!membership?.gym_id) return { scope: 'gym', scope_label: 'My Gym', entries: [], user_rank: null, prizes: [], unavailable_reason: 'Connect to a gym to unlock this leaderboard.' };
    scopeLabel = membership.gym?.name || 'My Gym';
    const { data, error } = await db.from('gym_memberships').select('user_id').eq('gym_id', membership.gym_id).eq('status', 'active').limit(1000);
    if (error) throw fail(error.message, 500);
    candidateIds = safeArray(data).map((row) => row.user_id).filter(Boolean);
    const { data: prizes, error: prizeError } = await db.from('leaderboard_prizes').select('*').eq('gym_id', membership.gym_id).eq('active', true).order('rank', { ascending: true }).limit(3);
    if (prizeError) throw fail(prizeError.message, 500);
    prizeRows = safeArray(prizes);
  } else if (normalizedScope === 'city') {
    const city = String(membership?.gym?.city || '').trim();
    if (!city) return { scope: 'city', scope_label: 'My City', entries: [], user_rank: null, prizes: [], unavailable_reason: 'Connect to a gym with a city to unlock this leaderboard.' };
    scopeLabel = city;
    const { data: gyms, error: gymError } = await db.from('gyms').select('gym_id').ilike('city', city).eq('status', 'verified').limit(500);
    if (gymError) throw fail(gymError.message, 500);
    const gymIds = safeArray(gyms).map((row) => row.gym_id);
    if (gymIds.length) {
      const { data, error } = await db.from('gym_memberships').select('user_id').in('gym_id', gymIds).eq('status', 'active').limit(3000);
      if (error) throw fail(error.message, 500);
      candidateIds = safeArray(data).map((row) => row.user_id).filter(Boolean);
    }
  } else {
    const { data, error } = await db.from('reward_wallets').select('user_id').order('lifetime_earned', { ascending: false }).limit(300);
    if (error) throw fail(error.message, 500);
    candidateIds = safeArray(data).map((row) => row.user_id).filter(Boolean);
  }

  if (!candidateIds.includes(userId)) candidateIds.push(userId);
  candidateIds = [...new Set(candidateIds)].slice(0, 1000);
  if (!candidateIds.length) return { scope: normalizedScope, scope_label: scopeLabel, entries: [], user_rank: null, prizes: prizeRows };

  const [{ data: wallets, error: walletError }, { data: profiles, error: profileError }, { data: completions, error: completionError }] = await Promise.all([
    db.from('reward_wallets').select('*').in('user_id', candidateIds),
    db.from('profiles').select('user_id, full_name, avatar_url').in('user_id', candidateIds),
    db.from('challenge_participants').select('user_id, status').in('user_id', candidateIds).eq('status', 'completed'),
  ]);
  if (walletError) throw fail(walletError.message, 500);
  if (profileError) throw fail(profileError.message, 500);
  if (completionError) throw fail(completionError.message, 500);

  const profileMap = new Map(safeArray(profiles).map((row) => [String(row.user_id), row]));
  const completionMap = safeArray(completions).reduce((map, row) => map.set(String(row.user_id), (map.get(String(row.user_id)) || 0) + 1), new Map());
  const walletMap = new Map(safeArray(wallets).map((row) => [String(row.user_id), row]));

  const ranked = candidateIds.map((id) => {
    const profile = profileMap.get(String(id)) || {};
    const wallet = walletMap.get(String(id)) || {};
    const nameParts = String(profile.full_name || 'SE7EN Member').trim().split(/\s+/).filter(Boolean);
    const publicName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` : (nameParts[0] || 'SE7EN Member');
    return {
      user_id: id,
      name: id === userId ? 'You' : publicName,
      avatar_url: profile.avatar_url || null,
      score: Number(wallet.lifetime_earned || 0),
      coins: Number(wallet.coins || 0),
      completed_challenges: Number(completionMap.get(String(id)) || 0),
      is_current_user: id === userId,
    };
  }).sort((a, b) => b.score - a.score || b.completed_challenges - a.completed_challenges);

  const entries = ranked.slice(0, 100).map((row, index) => ({ ...row, rank: index + 1 }));
  const userIndex = ranked.findIndex((row) => row.user_id === userId);
  return {
    scope: normalizedScope,
    scope_label: scopeLabel,
    entries,
    user_rank: userIndex >= 0 ? userIndex + 1 : null,
    prizes: prizeRows.map((row) => ({ rank: row.rank, title: row.title, reward: row.description, coins: Number(row.coins || 0) })),
  };
}

function register(app) {
  if (app.__se7enfitEngagementRoutes) return;
  app.__se7enfitEngagementRoutes = true;

  app.get('/api/engagement/overview', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const date = todayKey(req);
    const [subscription, membership, wallet, challengeData, transactions] = await Promise.all([
      activeSubscription(user.id),
      activeMembership(user.id),
      walletFor(user.id),
      activeMembership(user.id).then((member) => challengeRowsForUser(user.id, member)),
      db.from('reward_transactions').select('*').eq('user_id', user.id).neq('type', 'checkin').order('created_at', { ascending: false }).limit(30),
    ]);
    if (transactions.error) throw fail(transactions.error.message, 500);
    const premium = PREMIUM_PLANS.has(subscription?.plan);
    const lastByChallenge = checkinMap(challengeData.checkins);
    const challenges = challengeData.visible.map((row) => normalizeChallenge(
      row,
      challengeData.participantById.get(String(row.challenge_id)),
      lastByChallenge.get(String(row.challenge_id)),
      challengeData.countById.get(String(row.challenge_id)),
      premium,
    ));
    const checkinDates = challengeData.checkins.map((row) => String(row.source || '').split(':').pop()).filter(isDateKey);
    const globalSpotlight = await buildLeaderboard('global', user.id, membership).catch(() => ({ entries: [] }));
    res.json({
      item: {
        date,
        subscription,
        premium,
        membership,
        wallet,
        challenges,
        transactions: safeArray(transactions.data).map((row) => ({
          id: row.transaction_id,
          type: row.type,
          coins: Number(row.amount || 0),
          reason: humanReason(row.source),
          source: row.source,
          date: dateOnly(row.created_at),
        })),
        stats: {
          joined: challenges.filter((item) => item.joined).length,
          completed: challenges.filter((item) => item.completed).length,
          active: challenges.filter((item) => item.joined && !item.completed).length,
          streak: calculateStreak(checkinDates, date),
        },
        spotlight: safeArray(globalSpotlight.entries).slice(0, 3),
      },
    });
  }));

  app.post('/api/engagement/challenges/:id/join', wrap(async (req, res) => {
    const { user } = await authContext(req);
    await ensureBuiltins();
    const [subscription, membership] = await Promise.all([activeSubscription(user.id), activeMembership(user.id)]);
    const { data: challenge, error } = await db.from('challenges').select('*').eq('challenge_id', req.params.id).eq('status', 'active').maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!challenge) throw fail('Challenge not found.', 404);
    if (!(await scopeAllowed(challenge, membership))) throw fail('This challenge is not available for your gym or city.', 403);
    if (challenge.premium_required && !PREMIUM_PLANS.has(subscription?.plan)) throw fail('Premium is required for this challenge.', 402);
    const { data, error: joinError } = await db.from('challenge_participants').upsert({
      challenge_id: challenge.challenge_id,
      user_id: user.id,
      gym_id: challenge.gym_id || membership?.gym_id || null,
      progress: 0,
      status: 'active',
    }, { onConflict: 'challenge_id,user_id', ignoreDuplicates: true }).select('*').maybeSingle();
    if (joinError) throw fail(joinError.message, 500);
    res.status(201).json({ item: data || { challenge_id: challenge.challenge_id, user_id: user.id, progress: 0, status: 'active' } });
  }));

  app.post('/api/engagement/challenges/:id/check-in', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const date = todayKey(req);
    await ensureBuiltins();
    const [subscription, membership] = await Promise.all([activeSubscription(user.id), activeMembership(user.id)]);
    const premium = PREMIUM_PLANS.has(subscription?.plan);
    const [{ data: challenge, error: challengeError }, { data: participant, error: participantError }] = await Promise.all([
      db.from('challenges').select('*').eq('challenge_id', req.params.id).eq('status', 'active').maybeSingle(),
      db.from('challenge_participants').select('*').eq('challenge_id', req.params.id).eq('user_id', user.id).maybeSingle(),
    ]);
    if (challengeError) throw fail(challengeError.message, 500);
    if (participantError) throw fail(participantError.message, 500);
    if (!challenge) throw fail('Challenge not found.', 404);
    if (!participant) throw fail('Join this challenge before checking in.', 409);
    if (participant.status === 'completed') return res.json({ item: { completed: true, already_completed: true } });
    if (!(await scopeAllowed(challenge, membership))) throw fail('This challenge is not available for your gym or city.', 403);
    if (challenge.premium_required && !premium) throw fail('Premium is required for this challenge.', 402);

    const checkinSource = `challenge_checkin:${challenge.challenge_id}:${date}`;
    const { data: existingCheckin, error: existingError } = await db.from('reward_transactions')
      .select('transaction_id')
      .eq('user_id', user.id)
      .eq('type', 'checkin')
      .eq('source', checkinSource)
      .maybeSingle();
    if (existingError) throw fail(existingError.message, 500);
    if (existingCheckin) return res.json({ item: { already_logged: true, progress: Number(participant.progress || 0), completed: false } });

    const verified = await qualification(user.id, challenge, date, membership);
    if (!verified.eligible) {
      return res.status(422).json({ error: verified.message, item: { eligible: false, verification: verified, progress: Number(participant.progress || 0) } });
    }

    const target = Math.max(1, Number(parseRules(challenge.rules).target_days || challenge.duration_days || 1));
    const progress = Math.min(target, Number(participant.progress || 0) + 1);
    const completed = progress >= target;
    const { data: updated, error: updateError } = await db.from('challenge_participants').update({
      progress,
      status: completed ? 'completed' : 'active',
      completed_at: completed ? new Date().toISOString() : null,
    }).eq('id', participant.id).eq('user_id', user.id).select('*').single();
    if (updateError) throw fail(updateError.message, 500);

    const { error: checkinInsertError } = await db.from('reward_transactions').insert({
      user_id: user.id,
      amount: 0,
      type: 'checkin',
      source: checkinSource,
      reference_id: challenge.challenge_id,
    });
    if (checkinInsertError) throw fail(checkinInsertError.message, 500);

    let rewardCoins = 0;
    if (completed) {
      const rewardSource = `challenge_reward:${challenge.challenge_id}`;
      const { data: existingReward, error: rewardLookupError } = await db.from('reward_transactions')
        .select('transaction_id, amount')
        .eq('user_id', user.id)
        .eq('type', 'earn')
        .eq('source', rewardSource)
        .maybeSingle();
      if (rewardLookupError) throw fail(rewardLookupError.message, 500);
      if (!existingReward) {
        rewardCoins = Math.max(0, Number(challenge.reward_coins || 0)) * (premium ? 2 : 1);
        const { data: wallet, error: walletError } = await db.from('reward_wallets').select('*').eq('user_id', user.id).maybeSingle();
        if (walletError) throw fail(walletError.message, 500);
        const { error: walletUpsertError } = await db.from('reward_wallets').upsert({
          user_id: user.id,
          coins: Number(wallet?.coins || 0) + rewardCoins,
          lifetime_earned: Number(wallet?.lifetime_earned || 0) + rewardCoins,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (walletUpsertError) throw fail(walletUpsertError.message, 500);
        const { error: rewardError } = await db.from('reward_transactions').insert({
          user_id: user.id,
          amount: rewardCoins,
          type: 'earn',
          source: rewardSource,
          reference_id: challenge.challenge_id,
        });
        if (rewardError) throw fail(rewardError.message, 500);
      } else {
        rewardCoins = Number(existingReward.amount || 0);
      }
    }

    res.json({ item: { participant: updated, eligible: true, verification: verified, progress, target, completed, reward_coins: rewardCoins, premium_multiplier: premium ? 2 : 1 } });
  }));

  app.get('/api/engagement/leaderboard', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const membership = await activeMembership(user.id);
    const result = await buildLeaderboard(req.query.scope, user.id, membership);
    res.json({ item: result });
  }));
}

const originalListen = express.application.listen;
express.application.listen = function listenWithEngagement(...args) {
  register(this);
  return originalListen.apply(this, args);
};
