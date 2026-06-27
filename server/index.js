import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
const allowedOrigins = FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGIN === '*' || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

const SHARED_READ_ENTITIES = new Set([
  'GymOwner', 'Challenge', 'Reward', 'Announcement', 'GymAnnouncement', 'GymEquipment',
]);

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function normalizeRole(role) {
  const value = String(role || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gym_owner', 'gymowner'].includes(value)) return 'gym_owner';
  if (['admin', 'super_admin', 'superadmin'].includes(value)) return 'super_admin';
  if (['nagarsevak', 'nagar_sevak', 'nagar_sewak'].includes(value)) return 'nagarsevak';
  return 'user';
}

function cleanEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(profile, authUser = {}) {
  const metadata = authUser.user_metadata || {};
  return {
    id: authUser.id || profile?.user_id,
    email: profile?.email || authUser.email,
    full_name: profile?.full_name || metadata.full_name || metadata.name || metadata.owner_name || authUser.email?.split('@')?.[0] || 'SE7EN FIT User',
    name: profile?.full_name || metadata.name,
    phone: profile?.phone || metadata.phone || metadata.mobile,
    mobile: profile?.phone || metadata.mobile || metadata.phone,
    role: normalizeRole(profile?.role || metadata.role),
    dbRole: profile?.role || metadata.role || 'user',
    avatar_url: profile?.avatar_url || metadata.avatar_url || metadata.picture,
  };
}

async function upsertProfile(authUser, overrides = {}) {
  const metadata = authUser.user_metadata || {};
  const row = {
    user_id: authUser.id,
    email: cleanEmail(authUser.email || overrides.email),
    role: normalizeRole(overrides.role || metadata.role),
    full_name: overrides.full_name || overrides.name || overrides.owner_name || metadata.full_name || metadata.name || metadata.owner_name || null,
    phone: overrides.phone || overrides.mobile || metadata.phone || metadata.mobile || null,
    avatar_url: overrides.avatar_url || metadata.avatar_url || metadata.picture || null,
    metadata: { ...metadata, ...overrides },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

function formatSession(session, profile, authUser) {
  return {
    access_token: session?.access_token,
    token: session?.access_token,
    refresh_token: session?.refresh_token,
    expires_at: session?.expires_at,
    user: publicUser(profile, authUser),
  };
}

async function requireAuth(req, _res, next) {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) throw Object.assign(new Error('Missing bearer token'), { status: 401 });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });

    let profile = await getProfile(data.user.id);
    if (!profile) profile = await upsertProfile(data.user);

    req.authToken = token;
    req.authUser = data.user;
    req.userProfile = profile;
    req.user = publicUser(profile, data.user);
    next();
  } catch (error) {
    next(error);
  }
}

function recordToEntity(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function canReadEntity(row, user) {
  if (user.role === 'super_admin') return true;
  if (SHARED_READ_ENTITIES.has(row.entity_type)) return true;
  if (row.owner_user_id === user.id) return true;
  const data = row.data || {};
  return data.user_id === user.id || data.owner_id === user.id || data.created_by === user.id;
}

function canWriteEntity(row, user) {
  if (user.role === 'super_admin') return true;
  if (row.owner_user_id === user.id) return true;
  const data = row.data || {};
  return data.user_id === user.id || data.owner_id === user.id || data.created_by === user.id;
}

function matchesFilter(entity, filter) {
  return Object.entries(filter || {}).every(([key, value]) => entity?.[key] === value);
}

function sortEntities(rows, sortBy = '-created_date') {
  const desc = String(sortBy).startsWith('-');
  const key = desc ? String(sortBy).slice(1) : String(sortBy);
  return [...rows].sort((a, b) => {
    const av = a?.[key] ?? '';
    const bv = b?.[key] ?? '';
    return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });
}

async function listEntityRows(entityType) {
  const { data, error } = await supabaseAdmin
    .from('entity_records')
    .select('*')
    .eq('entity_type', entityType);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data || [];
}

async function findGymOwnerForUser(userId) {
  const rows = await listEntityRows('GymOwner');
  return rows.map(recordToEntity).find((row) => row.user_id === userId || row.owner_user_id === userId) || null;
}

async function upsertGymOwnerForUser(user, payload = {}) {
  const existing = await findGymOwnerForUser(user.id);
  const nowData = {
    ...existing,
    ...payload,
    user_id: user.id,
    owner_name: payload.owner_name || user.full_name || existing?.owner_name || 'Gym Owner',
    email: payload.email || user.email || existing?.email,
  };

  delete nowData.id;
  delete nowData.created_date;
  delete nowData.updated_date;

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('entity_records')
      .update({ data: nowData, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return recordToEntity(data);
  }

  const { data, error } = await supabaseAdmin
    .from('entity_records')
    .insert({ entity_type: 'GymOwner', owner_user_id: user.id, data: nowData })
    .select('*')
    .single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return recordToEntity(data);
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'se7enfit-api' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'se7enfit-api' }));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = cleanEmail(body.email);
  const password = body.password;
  if (!email || !password) throw Object.assign(new Error('Email and password are required'), { status: 400 });

  const metadata = {
    role: normalizeRole(body.role),
    full_name: body.full_name || body.name || body.owner_name,
    name: body.name || body.full_name || body.owner_name,
    owner_name: body.owner_name,
    phone: body.phone || body.mobile,
    mobile: body.mobile || body.phone,
  };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) throw Object.assign(new Error(error.message), { status: 400 });

  let profile = null;
  if (data.user) profile = await upsertProfile(data.user, { ...metadata, email });

  if (!data.session) {
    return res.status(201).json({ requires_otp: true, user: data.user ? publicUser(profile, data.user) : null });
  }

  return res.status(201).json(formatSession(data.session, profile, data.user));
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || !password) throw Object.assign(new Error('Email and password are required'), { status: 400 });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw Object.assign(new Error(error.message), { status: 401 });

  const profile = await upsertProfile(data.user, { role: req.body?.role || data.user?.user_metadata?.role });
  return res.json(formatSession(data.session, profile, data.user));
}));

app.post('/api/auth/verify-otp', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const token = req.body?.otp_code || req.body?.otpCode;
  if (!email || !token) throw Object.assign(new Error('Email and OTP code are required'), { status: 400 });

  let result = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (result.error) result = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (result.error) throw Object.assign(new Error(result.error.message), { status: 400 });

  const profile = await upsertProfile(result.data.user);
  return res.json(formatSession(result.data.session, profile, result.data.user));
}));

app.post('/api/auth/resend-otp', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  if (!email) throw Object.assign(new Error('Email is required'), { status: 400 });
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return res.json({ success: true });
}));

app.post('/api/auth/google', asyncHandler(async (req, res) => {
  const idToken = req.body?.idToken;
  if (!idToken) throw Object.assign(new Error('Google ID token is required'), { status: 400 });

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw Object.assign(new Error(error.message), { status: 401 });

  const profile = await upsertProfile(data.user, { role: req.body?.role || data.user?.user_metadata?.role });
  return res.json(formatSession(data.session, profile, data.user));
}));

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
  return res.json({ user: req.user });
}));

app.get('/api/gym-owners/me', requireAuth, asyncHandler(async (req, res) => {
  return res.json(await findGymOwnerForUser(req.user.id));
}));

app.put('/api/gym-owners/me', requireAuth, asyncHandler(async (req, res) => {
  return res.json(await upsertGymOwnerForUser(req.user, req.body || {}));
}));

app.post('/api/gym-owners/onboarding', requireAuth, asyncHandler(async (req, res) => {
  const payload = { ...(req.body || {}), onboarding_complete: true };
  if (!payload.referral_code) {
    const base = payload.gym_name ? payload.gym_name.replace(/\s+/g, '').toUpperCase().slice(0, 6) : 'GYM';
    payload.referral_code = `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
  return res.json(await upsertGymOwnerForUser(req.user, payload));
}));

app.get('/api/entities/:entity', requireAuth, asyncHandler(async (req, res) => {
  const rows = await listEntityRows(req.params.entity);
  const rawFilter = req.query.filter ? JSON.parse(String(req.query.filter)) : {};
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const filtered = rows
    .filter((row) => canReadEntity(row, req.user))
    .map(recordToEntity)
    .filter((entity) => matchesFilter(entity, rawFilter));
  const sorted = sortEntities(filtered, req.query.sortBy || '-created_date');
  return res.json(Number.isFinite(limit) ? sorted.slice(0, limit) : sorted);
}));

app.get('/api/entities/:entity/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('entity_records')
    .select('*')
    .eq('entity_type', req.params.entity)
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data || !canReadEntity(data, req.user)) throw Object.assign(new Error('Not found'), { status: 404 });
  return res.json(recordToEntity(data));
}));

app.post('/api/entities/:entity', requireAuth, asyncHandler(async (req, res) => {
  const data = { ...(req.body || {}) };
  delete data.id;
  delete data.created_date;
  delete data.updated_date;
  if (!data.user_id) data.user_id = req.user.id;
  if (req.params.entity === 'GymOwner') data.user_id = req.user.id;

  const { data: row, error } = await supabaseAdmin
    .from('entity_records')
    .insert({ entity_type: req.params.entity, owner_user_id: req.user.id, data })
    .select('*')
    .single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return res.status(201).json(recordToEntity(row));
}));

app.put('/api/entities/:entity/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('entity_records')
    .select('*')
    .eq('entity_type', req.params.entity)
    .eq('id', req.params.id)
    .maybeSingle();
  if (findError) throw Object.assign(new Error(findError.message), { status: 500 });
  if (!existing || !canWriteEntity(existing, req.user)) throw Object.assign(new Error('Not found'), { status: 404 });

  const nextData = { ...(existing.data || {}), ...(req.body || {}) };
  delete nextData.id;
  delete nextData.created_date;
  delete nextData.updated_date;

  const { data: row, error } = await supabaseAdmin
    .from('entity_records')
    .update({ data: nextData, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return res.json(recordToEntity(row));
}));

app.delete('/api/entities/:entity/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('entity_records')
    .select('*')
    .eq('entity_type', req.params.entity)
    .eq('id', req.params.id)
    .maybeSingle();
  if (findError) throw Object.assign(new Error(findError.message), { status: 500 });
  if (!existing || !canWriteEntity(existing, req.user)) throw Object.assign(new Error('Not found'), { status: 404 });

  const { error } = await supabaseAdmin.from('entity_records').delete().eq('id', req.params.id);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return res.json({ success: true });
}));

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SE7EN FIT API running on port ${PORT}`);
});
