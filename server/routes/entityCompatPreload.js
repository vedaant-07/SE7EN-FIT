import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' }));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const nowDate = () => new Date().toISOString().slice(0, 10);

const entityMap = {
  UserProfile: { table: 'profiles', id: 'user_id', owner: 'user_id', defaults: () => ({}) },
  WorkoutLog: { table: 'workout_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  NutritionLog: { table: 'nutrition_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  WaterLog: { table: 'water_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  StepLog: { table: 'step_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  SleepLog: { table: 'sleep_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  WeightLog: { table: 'weight_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  BodyMeasurement: { table: 'body_measurements', id: 'measurement_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  CardioLog: { table: 'cardio_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), source: 'app' }) },
  HabitLog: { table: 'habit_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate() }) },
  MoodLog: { table: 'mood_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate() }) },
  GymMember: { table: 'gym_memberships', id: 'membership_id', owner: 'user_id', defaults: () => ({}) },
  Attendance: { table: 'gym_attendance_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), status: 'checked_in' }) },
  GymAttendance: { table: 'gym_attendance_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), status: 'checked_in' }) },
  GymLead: { table: 'gym_leads', id: 'lead_id', owner: null, manageRoles: ['super_admin', 'admin', 'gym_owner', 'gym_staff'], gymScopedManage: true, defaults: () => ({ source: 'app', status: 'new' }) },
  Lead: { table: 'gym_leads', id: 'lead_id', owner: null, manageRoles: ['super_admin', 'admin', 'gym_owner', 'gym_staff'], gymScopedManage: true, defaults: () => ({ source: 'app', status: 'new' }) },
  GymEquipment: { table: 'gym_equipment', id: 'equipment_id', owner: null, createRoles: ['super_admin', 'admin', 'gym_owner', 'gym_staff'], manageRoles: ['super_admin', 'admin', 'gym_owner', 'gym_staff'], gymScopedCreate: true, gymScopedManage: true, defaults: () => ({ available: true, quantity: 1 }) },
  WorkoutPlan: { table: 'workout_plans', id: 'plan_id', owner: 'created_by', defaults: () => ({ visibility: 'app', plan_data: {} }) },
  DietPlan: { table: 'diet_plans', id: 'plan_id', owner: 'created_by', defaults: () => ({ visibility: 'app', plan_data: {} }) },
  Advertisement: { table: 'advertisements', id: 'ad_id', owner: 'created_by', listPublic: true, createRoles: ['super_admin', 'admin', 'gym_owner'], manageRoles: ['super_admin', 'admin', 'gym_owner'], gymScopedCreate: true, gymScopedManage: true, defaults: () => ({ source_type: 'app', target_scope: 'all', status: 'active' }) },
  Campaign: { table: 'advertisements', id: 'ad_id', owner: 'created_by', listPublic: true, createRoles: ['super_admin', 'admin', 'gym_owner'], manageRoles: ['super_admin', 'admin', 'gym_owner'], gymScopedCreate: true, gymScopedManage: true, defaults: () => ({ source_type: 'app', target_scope: 'all', status: 'active' }) },
  CommunityPost: { table: 'community_posts', id: 'post_id', owner: 'user_id', listPublic: true, defaults: () => ({ type: 'general', status: 'active' }) },
  CommunityComment: { table: 'community_comments', id: 'comment_id', owner: 'user_id', defaults: () => ({ status: 'active' }) },
  Challenge: { table: 'challenges', id: 'challenge_id', owner: 'created_by', listPublic: true, createRoles: ['super_admin', 'admin', 'gym_owner'], manageRoles: ['super_admin', 'admin', 'gym_owner'], gymScopedCreate: true, gymScopedManage: true, defaults: () => ({ target_scope: 'all', status: 'active' }) },
  ChallengeParticipant: { table: 'challenge_participants', id: 'id', owner: 'user_id', defaults: () => ({ status: 'active' }) },
  LeaderboardScore: { table: 'leaderboard_scores', id: 'score_id', owner: 'user_id', defaults: () => ({ period: 'all_time', score: 0 }) },
  LeaderboardPrize: { table: 'leaderboard_prizes', id: 'prize_id', owner: 'created_by', listPublic: true, createRoles: ['super_admin', 'admin'], manageRoles: ['super_admin', 'admin'], defaults: () => ({ active: true }) },
  RewardWallet: { table: 'reward_wallets', id: 'user_id', owner: 'user_id', defaults: () => ({ coins: 0, lifetime_earned: 0 }) },
  RewardTransaction: { table: 'reward_transactions', id: 'transaction_id', owner: 'user_id', defaults: () => ({}) },
  AIChatMessage: { table: 'ai_chat_messages', id: 'message_id', owner: 'user_id', defaults: () => ({ conversation_id: 'ai_trainer_default', source: 'ai_trainer' }) },
  AIUsageLog: { table: 'ai_usage_logs', id: 'log_id', owner: 'user_id', defaults: () => ({ date: nowDate(), success: true }) },
  SupportTicket: { table: 'support_tickets', id: 'id', owner: 'user_id', defaults: () => ({ source: 'app', priority: 'normal', status: 'new' }) },
  Notification: { table: 'user_notifications', id: 'id', owner: 'user_id', defaults: () => ({}) },
};

async function authUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Missing bearer token', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Invalid or expired token', 401);
  return data.user;
}
function getConfig(name) {
  const config = entityMap[name];
  if (!config) throw fail(`Entity ${name} is not mapped to production storage yet.`, 404);
  return config;
}
function parseFilter(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}
function applyFilters(query, filter = {}) {
  Object.entries(filter).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) query = query.in(key, value);
    else query = query.eq(key, value);
  });
  return query;
}
function sortQuery(query, sortBy) {
  const raw = String(sortBy || '-created_at');
  const column = raw.replace(/^-/, '').replace('created_date', 'created_at').replace('updated_date', 'updated_at');
  return query.order(column, { ascending: !raw.startsWith('-') });
}
function normalizeRow(row, config) {
  if (!row) return row;
  return {
    ...row,
    id: row.id || row[config.id],
    created_date: row.created_date || row.created_at,
    updated_date: row.updated_date || row.updated_at,
  };
}
function sanitizePayload(body = {}, config, user) {
  const payload = { ...body };
  delete payload.id;
  delete payload.created_date;
  delete payload.updated_date;
  if (payload.name && !payload.title && ['workout_plans', 'diet_plans', 'challenges'].includes(config.table)) payload.title = payload.name;
  if (payload.body && !payload.message && config.table === 'support_tickets') payload.message = payload.body;
  if (payload.content && !payload.body && config.table === 'community_comments') payload.body = payload.content;
  // Ownership comes from the verified access token, never from request JSON.
  // These routes use a service-role database client, so trusting a supplied
  // user_id/created_by would bypass RLS and permit cross-account writes.
  if (config.owner) payload[config.owner] = user.id;
  return { ...config.defaults(user), ...payload };
}

function normalizeRole(value) {
  const role = String(value || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gymowner'].includes(role)) return 'gym_owner';
  if (role === 'superadmin') return 'super_admin';
  if (role === 'gymstaff') return 'gym_staff';
  return role;
}

async function userRole(user) {
  const { data, error } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  // user_metadata is editable by the signed-in user and must never grant an
  // administrative or gym-management capability.
  if (error || !data?.role) return 'user';
  return normalizeRole(data.role);
}

async function canManageGym(user, role, gymId) {
  if (!gymId) return role === 'super_admin' || role === 'admin';
  if (role === 'super_admin' || role === 'admin') return true;
  const { data: owned } = await db.from('gyms').select('gym_id').eq('gym_id', gymId).eq('owner_user_id', user.id).maybeSingle();
  if (owned) return true;
  const { data: staff } = await db.from('gym_staff').select('gym_id').eq('gym_id', gymId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  return Boolean(staff);
}

async function authorizeMutation({ user, config, action, payload, existing }) {
  const role = await userRole(user);
  const allowedRoles = action === 'create' ? config.createRoles : config.manageRoles;
  if (allowedRoles && !allowedRoles.includes(role)) throw fail('You do not have permission to change this item.', 403);

  const isAdmin = role === 'super_admin' || role === 'admin';
  if (action !== 'create' && config.owner && !isAdmin && existing?.[config.owner] !== user.id) {
    throw fail('You do not have permission to change this item.', 403);
  }

  const mustManageGym = action === 'create' ? config.gymScopedCreate : config.gymScopedManage;
  const gymId = payload?.gym_id || existing?.gym_id || null;
  if (mustManageGym && !isAdmin) {
    if (!gymId) throw fail('A gym is required for this item.', 400);
    if (!(await canManageGym(user, role, gymId))) {
      throw fail('You can only manage records for your own gym.', 403);
    }
  }
}

function register(app) {
  if (app.__se7enfitEntityCompatRoutes) return;
  app.__se7enfitEntityCompatRoutes = true;

  app.get('/api/entities/:entity', wrap(async (req, res) => {
    const user = await authUser(req);
    const config = getConfig(req.params.entity);
    let query = db.from(config.table).select('*');
    if (config.owner && !config.listPublic) query = query.eq(config.owner, user.id);
    if (config.listPublic && ['advertisements', 'community_posts', 'challenges'].includes(config.table)) query = query.eq('status', 'active');
    query = applyFilters(query, parseFilter(req.query.filter));
    query = sortQuery(query, req.query.sortBy);
    if (req.query.limit) query = query.limit(Number(req.query.limit));
    const { data, error } = await query;
    if (error) throw fail(error.message, 500);
    res.json((data || []).map((row) => normalizeRow(row, config)));
  }));

  app.get('/api/entities/:entity/:id', wrap(async (req, res) => {
    const user = await authUser(req);
    const config = getConfig(req.params.entity);
    let query = db.from(config.table).select('*').eq(config.id, req.params.id);
    if (config.owner && !config.listPublic) query = query.eq(config.owner, user.id);
    const { data, error } = await query.maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!data) throw fail('Not found', 404);
    res.json(normalizeRow(data, config));
  }));

  app.post('/api/entities/:entity', wrap(async (req, res) => {
    const user = await authUser(req);
    const config = getConfig(req.params.entity);
    const payload = sanitizePayload(req.body || {}, config, user);
    await authorizeMutation({ user, config, action: 'create', payload, existing: null });
    const { data, error } = await db.from(config.table).insert(payload).select('*').single();
    if (error) throw fail(error.message, 500);
    res.status(201).json(normalizeRow(data, config));
  }));

  app.put('/api/entities/:entity/:id', wrap(async (req, res) => {
    const user = await authUser(req);
    const config = getConfig(req.params.entity);
    const payload = sanitizePayload(req.body || {}, { ...config, defaults: () => ({}) }, user);
    const { data: existing, error: existingError } = await db.from(config.table).select('*').eq(config.id, req.params.id).maybeSingle();
    if (existingError) throw fail(existingError.message, 500);
    if (!existing) throw fail('Not found', 404);
    await authorizeMutation({ user, config, action: 'manage', payload, existing });
    // Updates may not transfer ownership, including when performed by an
    // administrator. Preserve the original owner and ignore request JSON.
    if (config.owner) payload[config.owner] = existing[config.owner];
    let query = db.from(config.table).update(payload).eq(config.id, req.params.id);
    const role = await userRole(user);
    if (config.owner && !['super_admin', 'admin'].includes(role)) query = query.eq(config.owner, user.id);
    const { data, error } = await query.select('*').single();
    if (error) throw fail(error.message, 500);
    res.json(normalizeRow(data, config));
  }));

  app.delete('/api/entities/:entity/:id', wrap(async (req, res) => {
    const user = await authUser(req);
    const config = getConfig(req.params.entity);
    const { data: existing, error: existingError } = await db.from(config.table).select('*').eq(config.id, req.params.id).maybeSingle();
    if (existingError) throw fail(existingError.message, 500);
    if (!existing) throw fail('Not found', 404);
    await authorizeMutation({ user, config, action: 'manage', payload: {}, existing });
    let query = db.from(config.table).delete().eq(config.id, req.params.id);
    const role = await userRole(user);
    if (config.owner && !['super_admin', 'admin'].includes(role)) query = query.eq(config.owner, user.id);
    const { error } = await query;
    if (error) throw fail(error.message, 500);
    res.json({ success: true });
  }));
}

const originalListen = express.application.listen;
express.application.listen = function listenWithEntityCompat(...args) {
  register(this);
  return originalListen.apply(this, args);
};
