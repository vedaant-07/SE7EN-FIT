import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const METRICS = {
  steps: { label: 'Step showdown', unit: 'steps', target: 50000, duration: 7, emoji: '👟' },
  workouts: { label: 'Workout face-off', unit: 'workouts', target: 5, duration: 7, emoji: '💪' },
  cardio: { label: 'Cardio clash', unit: 'minutes', target: 150, duration: 7, emoji: '⚡' },
  gym_visits: { label: 'Gym attendance duel', unit: 'visits', target: 5, duration: 7, emoji: '🏋️' },
};

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const safeArray = (value) => Array.isArray(value) ? value : [];
const dateKey = (value) => String(value || '').slice(0, 10);
const nowIso = () => new Date().toISOString();

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status >= 500) console.error('[gym-battles]', error);
    res.status(status).json({ error: status >= 500 ? 'Gym battles are temporarily unavailable. Please try again.' : error.message });
  }
};

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
  return { ...row, gym: gym || null };
}

async function gymMemberDirectory(gymId, currentUserId) {
  const { data: memberships, error } = await db.from('gym_memberships')
    .select('user_id, joined_at, status')
    .eq('gym_id', gymId)
    .eq('status', 'active')
    .limit(300);
  if (error) throw fail(error.message, 500);
  const userIds = safeArray(memberships).map((row) => row.user_id).filter(Boolean);
  if (!userIds.length) return [];
  const { data: profiles, error: profileError } = await db.from('profiles')
    .select('user_id, full_name, avatar_url, status')
    .in('user_id', userIds)
    .eq('status', 'active');
  if (profileError) throw fail(profileError.message, 500);
  const profileMap = new Map(safeArray(profiles).map((profile) => [profile.user_id, profile]));
  return userIds
    .filter((userId) => userId !== currentUserId)
    .map((userId) => {
      const profile = profileMap.get(userId) || {};
      return {
        user_id: userId,
        name: profile.full_name || `Gym member ${String(userId).slice(-4)}`,
        avatar_url: profile.avatar_url || null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function metricProgress(metric, userId, start, end) {
  const startDate = dateKey(start);
  const endDate = dateKey(end || nowIso());

  if (metric === 'steps') {
    const { data, error } = await db.from('step_logs').select('steps').eq('user_id', userId).gte('date', startDate).lte('date', endDate);
    if (error) throw fail(error.message, 500);
    return safeArray(data).reduce((sum, row) => sum + Number(row.steps || 0), 0);
  }

  if (metric === 'workouts') {
    const { count, error } = await db.from('workout_logs').select('log_id', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true).gte('date', startDate).lte('date', endDate);
    if (error) throw fail(error.message, 500);
    return Number(count || 0);
  }

  if (metric === 'cardio') {
    const { data, error } = await db.from('cardio_logs').select('duration_minutes').eq('user_id', userId).gte('date', startDate).lte('date', endDate);
    if (error) throw fail(error.message, 500);
    return safeArray(data).reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
  }

  if (metric === 'gym_visits') {
    const { data, error } = await db.from('gym_attendance_logs').select('date').eq('user_id', userId).gte('date', startDate).lte('date', endDate).in('status', ['checked_in', 'checked_out', 'completed']);
    if (error) throw fail(error.message, 500);
    return new Set(safeArray(data).map((row) => row.date)).size;
  }

  return 0;
}

async function awardOnce(userId, battleId, amount) {
  if (!amount) return false;
  const source = `gym_battle_reward:${battleId}`;
  const { error: transactionError } = await db.from('reward_transactions').insert({
    user_id: userId,
    amount,
    type: 'earn',
    source,
    reference_id: battleId,
  });
  if (transactionError) {
    if (String(transactionError.message || '').toLowerCase().includes('duplicate')) return false;
    throw fail(transactionError.message, 500);
  }

  const { data: wallet, error: walletError } = await db.from('reward_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (walletError) throw fail(walletError.message, 500);
  const next = {
    user_id: userId,
    coins: Number(wallet?.coins || 0) + amount,
    lifetime_earned: Number(wallet?.lifetime_earned || 0) + amount,
    updated_at: nowIso(),
  };
  const { error: upsertError } = await db.from('reward_wallets').upsert(next, { onConflict: 'user_id' });
  if (upsertError) throw fail(upsertError.message, 500);
  return true;
}

async function refreshBattle(battle, members) {
  if (!battle || battle.status !== 'active' || !battle.starts_at || !battle.ends_at) return { battle, members };

  const refreshed = [];
  for (const member of members) {
    const progress = await metricProgress(battle.metric, member.user_id, battle.starts_at, battle.ends_at);
    refreshed.push({ ...member, progress });
    if (Number(member.progress || 0) !== Number(progress)) {
      await db.from('gym_battle_members').update({ progress, updated_at: nowIso() }).eq('id', member.id);
    }
  }

  const reachedTarget = refreshed.some((member) => Number(member.progress || 0) >= Number(battle.target_value || 0));
  const expired = Date.now() >= new Date(battle.ends_at).getTime();
  if (!reachedTarget && !expired) return { battle, members: refreshed };

  const highest = Math.max(...refreshed.map((member) => Number(member.progress || 0)), 0);
  const leaders = refreshed.filter((member) => Number(member.progress || 0) === highest);
  const winnerUserId = leaders.length === 1 ? leaders[0].user_id : null;
  const completedBattle = { ...battle, status: 'completed', winner_user_id: winnerUserId, updated_at: nowIso() };
  const { error: completeError } = await db.from('gym_battles').update({
    status: 'completed',
    winner_user_id: winnerUserId,
    updated_at: completedBattle.updated_at,
  }).eq('battle_id', battle.battle_id).eq('status', 'active');
  if (completeError) throw fail(completeError.message, 500);

  for (const member of refreshed) {
    const reward = winnerUserId ? (member.user_id === winnerUserId ? 120 : 30) : 70;
    await awardOnce(member.user_id, battle.battle_id, reward);
  }

  return { battle: completedBattle, members: refreshed };
}

function publicBattle(battle, members, profileMap, currentUserId) {
  const metric = METRICS[battle.metric] || METRICS.steps;
  const sorted = [...members].sort((left, right) => Number(right.progress || 0) - Number(left.progress || 0));
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
    winner_user_id: battle.winner_user_id,
    created_by: battle.created_by,
    is_creator: battle.created_by === currentUserId,
    members: sorted.map((member, index) => ({
      user_id: member.user_id,
      name: profileMap.get(member.user_id)?.full_name || (member.user_id === currentUserId ? 'You' : `Gym member ${String(member.user_id).slice(-4)}`),
      avatar_url: profileMap.get(member.user_id)?.avatar_url || null,
      invite_status: member.invite_status,
      progress: Number(member.progress || 0),
      progress_percent: Math.min(100, Math.round((Number(member.progress || 0) / Math.max(1, Number(battle.target_value || 1))) * 100)),
      rank: index + 1,
      is_current_user: member.user_id === currentUserId,
      is_winner: battle.winner_user_id === member.user_id,
    })),
  };
}

async function loadOverview(userId) {
  const membership = await activeMembership(userId);
  if (!membership) {
    return {
      connected: false,
      gym: null,
      members: [],
      incoming: [],
      sent: [],
      active: [],
      completed: [],
      templates: Object.entries(METRICS).map(([key, value]) => ({ key, ...value })),
    };
  }

  const { data: myRows, error: myRowsError } = await db.from('gym_battle_members').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(100);
  if (myRowsError) throw fail(myRowsError.message, 500);
  const battleIds = safeArray(myRows).map((row) => row.battle_id);
  if (!battleIds.length) {
    return {
      connected: true,
      gym: { id: membership.gym_id, name: membership.gym?.name || membership.gym?.gym_name || 'Your gym' },
      members: await gymMemberDirectory(membership.gym_id, userId),
      incoming: [], sent: [], active: [], completed: [],
      templates: Object.entries(METRICS).map(([key, value]) => ({ key, ...value })),
    };
  }

  const [{ data: battles, error: battleError }, { data: allMembers, error: memberError }] = await Promise.all([
    db.from('gym_battles').select('*').in('battle_id', battleIds).eq('gym_id', membership.gym_id).order('created_at', { ascending: false }),
    db.from('gym_battle_members').select('*').in('battle_id', battleIds),
  ]);
  if (battleError) throw fail(battleError.message, 500);
  if (memberError) throw fail(memberError.message, 500);

  const userIds = [...new Set(safeArray(allMembers).map((row) => row.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await db.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds)
    : { data: [], error: null };
  if (profileError) throw fail(profileError.message, 500);
  const profileMap = new Map(safeArray(profiles).map((profile) => [profile.user_id, profile]));
  const memberGroups = new Map();
  safeArray(allMembers).forEach((member) => {
    if (!memberGroups.has(member.battle_id)) memberGroups.set(member.battle_id, []);
    memberGroups.get(member.battle_id).push(member);
  });

  const hydrated = [];
  for (const battle of safeArray(battles)) {
    const currentMembers = memberGroups.get(battle.battle_id) || [];
    const refreshed = await refreshBattle(battle, currentMembers);
    hydrated.push(publicBattle(refreshed.battle, refreshed.members, profileMap, userId));
  }

  const myStatus = new Map(safeArray(myRows).map((row) => [row.battle_id, row.invite_status]));
  return {
    connected: true,
    gym: { id: membership.gym_id, name: membership.gym?.name || membership.gym?.gym_name || 'Your gym' },
    members: await gymMemberDirectory(membership.gym_id, userId),
    incoming: hydrated.filter((battle) => battle.status === 'pending' && !battle.is_creator && myStatus.get(battle.id) === 'pending'),
    sent: hydrated.filter((battle) => battle.status === 'pending' && battle.is_creator),
    active: hydrated.filter((battle) => battle.status === 'active'),
    completed: hydrated.filter((battle) => battle.status === 'completed').slice(0, 30),
    templates: Object.entries(METRICS).map(([key, value]) => ({ key, ...value })),
  };
}

function register(app) {
  if (app.__se7enfitGymBattleRoutes) return;
  app.__se7enfitGymBattleRoutes = true;

  app.get('/api/gym-battles/overview', wrap(async (req, res) => {
    const { user } = await authContext(req);
    res.json({ item: await loadOverview(user.id) });
  }));

  app.post('/api/gym-battles', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const membership = await activeMembership(user.id);
    if (!membership) throw fail('Connect an active gym membership before challenging another member.', 409);

    const opponentUserId = String(req.body?.opponent_user_id || '').trim();
    const metricKey = String(req.body?.metric || '').trim();
    const metric = METRICS[metricKey];
    if (!opponentUserId || opponentUserId === user.id) throw fail('Choose another gym member.');
    if (!metric) throw fail('Choose a valid battle type.');

    const { data: opponentMembership, error: opponentError } = await db.from('gym_memberships')
      .select('membership_id')
      .eq('gym_id', membership.gym_id)
      .eq('user_id', opponentUserId)
      .eq('status', 'active')
      .maybeSingle();
    if (opponentError) throw fail(opponentError.message, 500);
    if (!opponentMembership) throw fail('This member is not active in your gym.', 403);

    const durationDays = [3, 7, 14].includes(Number(req.body?.duration_days)) ? Number(req.body.duration_days) : metric.duration;
    const requestedTarget = Number(req.body?.target_value || metric.target);
    const targetValue = Math.max(1, Math.min(requestedTarget, metricKey === 'steps' ? 500000 : 10000));
    const title = String(req.body?.title || metric.label).trim().slice(0, 80) || metric.label;

    const { data: battle, error: battleError } = await db.from('gym_battles').insert({
      gym_id: membership.gym_id,
      created_by: user.id,
      title,
      metric: metricKey,
      target_value: targetValue,
      duration_days: durationDays,
      status: 'pending',
      rules: { unit: metric.unit, emoji: metric.emoji },
    }).select('*').single();
    if (battleError) throw fail(battleError.message, 500);

    const { error: memberError } = await db.from('gym_battle_members').insert([
      { battle_id: battle.battle_id, user_id: user.id, invite_status: 'accepted' },
      { battle_id: battle.battle_id, user_id: opponentUserId, invite_status: 'pending' },
    ]);
    if (memberError) {
      await db.from('gym_battles').delete().eq('battle_id', battle.battle_id);
      throw fail(memberError.message, 500);
    }

    res.status(201).json({ item: await loadOverview(user.id) });
  }));

  app.post('/api/gym-battles/:id/respond', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const response = String(req.body?.response || '').toLowerCase();
    if (!['accepted', 'declined'].includes(response)) throw fail('Choose accept or decline.');

    const { data: member, error: memberError } = await db.from('gym_battle_members')
      .select('*')
      .eq('battle_id', req.params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (memberError) throw fail(memberError.message, 500);
    if (!member || member.invite_status !== 'pending') throw fail('This invitation is no longer available.', 409);

    const { data: battle, error: battleError } = await db.from('gym_battles').select('*').eq('battle_id', req.params.id).maybeSingle();
    if (battleError) throw fail(battleError.message, 500);
    if (!battle || battle.status !== 'pending') throw fail('This battle is no longer pending.', 409);

    await db.from('gym_battle_members').update({ invite_status: response, updated_at: nowIso() }).eq('id', member.id);
    if (response === 'declined') {
      await db.from('gym_battles').update({ status: 'cancelled', updated_at: nowIso() }).eq('battle_id', battle.battle_id);
    } else {
      const start = new Date();
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + Number(battle.duration_days || 7));
      await db.from('gym_battles').update({ status: 'active', starts_at: start.toISOString(), ends_at: end.toISOString(), updated_at: nowIso() }).eq('battle_id', battle.battle_id);
    }

    res.json({ item: await loadOverview(user.id) });
  }));

  app.post('/api/gym-battles/:id/refresh', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const { data: member, error } = await db.from('gym_battle_members').select('id').eq('battle_id', req.params.id).eq('user_id', user.id).maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!member) throw fail('Battle not found.', 404);
    res.json({ item: await loadOverview(user.id) });
  }));
}

const originalListen = express.application.listen;
express.application.listen = function listenWithGymBattles(...args) {
  register(this);
  return originalListen.apply(this, args);
};
