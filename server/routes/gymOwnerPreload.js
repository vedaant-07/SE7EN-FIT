import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const authDb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const reply = (res, item) => res.json({ item });
const list = (res, items) => res.json({ items: items || [] });
const error = (res, err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => error(res, err));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const cleanEmail = (email) => String(email || '').trim().toLowerCase();
const roleOf = (role) => ['owner', 'gymowner', 'gym_owner'].includes(String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')) ? 'gym_owner' : String(role || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');

async function findAuthUserByEmail(email) {
  const target = cleanEmail(email);
  for (let page = 1; page <= 10; page += 1) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const found = (data?.users || []).find((u) => cleanEmail(u.email) === target);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 1000) return null;
  }
  return null;
}

async function saveGymOwnerRole(authUserId) {
  try {
    const result = await db.from('user_roles').upsert({ user_id: authUserId, role: 'gym_owner' }, { onConflict: 'user_id,role' });
    if (result?.error) console.warn('user_roles upsert skipped:', result.error.message);
  } catch (err) {
    console.warn('user_roles upsert skipped:', err?.message || err);
  }
}

async function upsertGymOwnerProfile(authUser, meta) {
  const profilePayload = {
    user_id: authUser.id,
    email: cleanEmail(authUser.email || meta.email),
    role: 'gym_owner',
    status: 'active',
    source: 'website',
    full_name: meta.full_name || meta.owner_name || meta.name || null,
    phone: meta.phone || meta.mobile || null,
    metadata: { ...meta, role: 'gym_owner', source_detail: 'gym_owner' },
    updated_at: new Date().toISOString(),
  };
  const saved = await db.from('profiles').upsert(profilePayload, { onConflict: 'user_id' }).select('*').single();
  if (saved.error) throw fail(saved.error.message, 500);
  await saveGymOwnerRole(authUser.id);
  return saved.data;
}

function authResponse(session, user, profile) {
  return {
    access_token: session.access_token,
    token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: user.id,
      email: user.email,
      full_name: profile.full_name,
      name: profile.full_name,
      phone: profile.phone,
      mobile: profile.phone,
      role: 'gym_owner',
      status: profile.status || 'active',
    },
  };
}

async function fixedGymOwnerRegister(req, res, next) {
  try {
    if (roleOf(req.body?.role) !== 'gym_owner') return next();
    const body = req.body || {};
    const email = cleanEmail(body.email);
    const password = body.password;
    if (!email || !password) throw fail('Email and password are required', 400);
    if (String(password).length < 6) throw fail('Password must be at least 6 characters', 400);
    const meta = { role: 'gym_owner', email, full_name: body.full_name || body.name || body.owner_name, name: body.name || body.full_name || body.owner_name, owner_name: body.owner_name || body.name || body.full_name, phone: body.phone || body.mobile, mobile: body.mobile || body.phone, gym_name: body.gym_name || body.gymName };
    const existing = await findAuthUserByEmail(email).catch(() => null);
    if (existing?.id) {
      const currentProfile = await db.from('profiles').select('user_id,role').eq('user_id', existing.id).maybeSingle();
      if (currentProfile.data?.user_id) throw fail('Account already exists. Please log in instead.', 409);
      const updated = await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { ...(existing.user_metadata || {}), ...meta } });
      if (updated.error) throw fail(updated.error.message || 'Could not update account.', 400);
    } else {
      const created = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
      if (created.error) throw fail(created.error.message || 'Could not create account.', 400);
    }
    const login = await authDb.auth.signInWithPassword({ email, password });
    if (login.error) throw fail(login.error.message || 'Could not create login session.', 400);
    const profile = await upsertGymOwnerProfile(login.data.user, meta);
    return res.status(201).json(authResponse(login.data.session, login.data.user, profile));
  } catch (err) {
    return error(res, err);
  }
}

async function fixedGymOwnerLogin(req, res, next) {
  try {
    if (roleOf(req.body?.role) !== 'gym_owner') return next();
    const email = cleanEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || !password) throw fail('Email and password are required', 400);
    const login = await authDb.auth.signInWithPassword({ email, password });
    if (login.error) throw fail(login.error.message || 'Invalid email or password', 401);
    const meta = login.data.user?.user_metadata || {};
    const profile = await upsertGymOwnerProfile(login.data.user, { ...meta, email, role: 'gym_owner' });
    if (profile.status === 'blocked') throw fail('Account is blocked', 403);
    return res.json(authResponse(login.data.session, login.data.user, profile));
  } catch (err) {
    return error(res, err);
  }
}

const originalPost = express.application.post;
express.application.post = function patchedPost(path, ...handlers) {
  if (path === '/api/auth/register' && !this.__se7enfitGymOwnerRegisterFixed) {
    this.__se7enfitGymOwnerRegisterFixed = true;
    originalPost.call(this, path, fixedGymOwnerRegister);
  }
  if (path === '/api/auth/login' && !this.__se7enfitGymOwnerLoginFixed) {
    this.__se7enfitGymOwnerLoginFixed = true;
    originalPost.call(this, path, fixedGymOwnerLogin);
  }
  return originalPost.call(this, path, ...handlers);
};

async function user(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Missing bearer token', 401);
  const { data, error: authError } = await db.auth.getUser(token);
  if (authError || !data?.user) throw fail('Invalid or expired token', 401);
  return data.user;
}
async function gym(req) {
  const authUser = await user(req);
  req.user = { id: authUser.id, email: authUser.email };
  const owned = await db.from('gyms').select('*').eq('owner_user_id', authUser.id).limit(1);
  if (owned.error) throw fail(owned.error.message, 500);
  if (owned.data?.[0]) return owned.data[0];
  const staff = await db.from('gym_staff').select('gyms(*)').eq('user_id', authUser.id).eq('status', 'active').limit(1);
  if (staff.error) throw fail(staff.error.message, 500);
  if (staff.data?.[0]?.gyms) return staff.data[0].gyms;
  throw fail('Gym owner or staff access required', 403);
}
function addCrud(app, base, table, key, defaults = {}) {
  app.get(`/api/gym-owner/${base}`, wrap(async (req, res) => {
    const g = await gym(req);
    const rows = await db.from(table).select('*').eq('gym_id', g.gym_id).order('created_at', { ascending: false });
    if (rows.error) throw fail(rows.error.message, 500);
    list(res, rows.data || []);
  }));
  app.post(`/api/gym-owner/${base}`, wrap(async (req, res) => {
    const g = await gym(req);
    const saved = await db.from(table).insert({ gym_id: g.gym_id, created_by: req.user.id, ...(req.body || {}), ...defaults }).select('*').single();
    if (saved.error) throw fail(saved.error.message, 500);
    reply(res, saved.data);
  }));
  app.patch(`/api/gym-owner/${base}/:id`, wrap(async (req, res) => {
    const g = await gym(req);
    const saved = await db.from(table).update(req.body || {}).eq(key, req.params.id).eq('gym_id', g.gym_id).select('*').single();
    if (saved.error) throw fail(saved.error.message, 500);
    reply(res, saved.data);
  }));
  app.delete(`/api/gym-owner/${base}/:id`, wrap(async (req, res) => {
    const g = await gym(req);
    const removed = await db.from(table).delete().eq(key, req.params.id).eq('gym_id', g.gym_id);
    if (removed.error) throw fail(removed.error.message, 500);
    res.json({ success: true });
  }));
}
function register(app) {
  if (app.__se7enfitOwnerExtraRoutes) return;
  app.__se7enfitOwnerExtraRoutes = true;

  app.get('/api/public/download-links', wrap(async (_req, res) => {
    const { data } = await db.from('app_settings').select('value').eq('key', 'download_links').maybeSingle();
    reply(res, {
      play_store_url: data?.value?.play_store_url || process.env.PLAY_STORE_URL || '',
      app_store_url: data?.value?.app_store_url || process.env.APP_STORE_URL || '',
      apk_url: data?.value?.apk_url || process.env.APK_URL || '',
    });
  }));

  addCrud(app, 'plans', 'gym_plans', 'plan_id', { active: true });
  addCrud(app, 'classes', 'gym_classes', 'class_id', { status: 'active' });
  addCrud(app, 'reviews', 'gym_reviews', 'review_id', { status: 'published', source: 'website' });
  addCrud(app, 'workout-plans', 'workout_plans', 'plan_id', { visibility: 'gym' });
  addCrud(app, 'diet-plans', 'diet_plans', 'plan_id', { visibility: 'gym' });
  app.get('/api/gym-owner/reports', wrap(async (req, res) => {
    const g = await gym(req);
    const metrics = {};
    for (const [name, table] of Object.entries({ members: 'gym_memberships', leads: 'gym_leads', attendance: 'gym_attendance_logs', ads: 'advertisements', plans: 'gym_plans' })) {
      const { count } = await db.from(table).select('*', { count: 'exact', head: true }).eq('gym_id', g.gym_id);
      metrics[name] = count || 0;
    }
    reply(res, { gym_id: g.gym_id, metrics });
  }));
}
const originalListen = express.application.listen;
express.application.listen = function listenWithGymOwnerRoutes(...args) {
  register(this);
  return originalListen.apply(this, args);
};
