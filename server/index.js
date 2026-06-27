import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const MAILJET_FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;
const MAILJET_FROM_NAME = process.env.MAILJET_FROM_NAME || 'SE7EN FIT';
const OTP_TTL_MS = 10 * 60 * 1000;

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
const SHARED_READ_ENTITIES = new Set(['GymOwner', 'Challenge', 'Reward', 'Announcement', 'GymAnnouncement', 'GymEquipment']);
const pendingOtpChallenges = new Map();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

function cleanMessage(value, fallback = 'Request failed') {
  const message = String(value || '').trim();
  if (!message || message === '{}' || message === '[object Object]') return fallback;
  return message;
}

function authErrorMessage(error, fallback) {
  return cleanMessage(error?.message || error?.error_description || error?.error, fallback);
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

async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function upsertProfile(authUser, overrides = {}) {
  const metadata = authUser.user_metadata || {};
  const existing = await getProfile(authUser.id).catch(() => null);
  const row = {
    user_id: authUser.id,
    email: cleanEmail(authUser.email || overrides.email),
    role: normalizeRole(overrides.role || existing?.role || metadata.role),
    full_name: overrides.full_name || overrides.name || overrides.owner_name || existing?.full_name || metadata.full_name || metadata.name || metadata.owner_name || null,
    phone: overrides.phone || overrides.mobile || existing?.phone || metadata.phone || metadata.mobile || null,
    avatar_url: overrides.avatar_url || existing?.avatar_url || metadata.avatar_url || metadata.picture || null,
    metadata: { ...(existing?.metadata || {}), ...metadata, ...overrides },
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

function formatSession(session, profile, authUser) {
  if (!session?.access_token) throw Object.assign(new Error('OTP verified, but login session was not created. Please try login again.'), { status: 400 });
  return {
    access_token: session.access_token,
    token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: publicUser(profile, authUser),
  };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function mailjetErrorText(data) {
  const messages = data?.Messages;
  const firstError = Array.isArray(messages?.[0]?.Errors) ? messages[0].Errors[0] : null;
  return firstError?.ErrorMessage || firstError?.ErrorIdentifier || data?.ErrorMessage || data?.message;
}

async function sendMailjetOtp(email, otp, purpose = 'login') {
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY || !MAILJET_FROM_EMAIL) {
    throw Object.assign(new Error('Mailjet is not configured. Add MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL on Render.'), { status: 500 });
  }

  const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
  const subject = purpose === 'register' ? 'Verify your SE7EN FIT account' : 'Your SE7EN FIT login code';
  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [{
        From: { Email: MAILJET_FROM_EMAIL, Name: MAILJET_FROM_NAME },
        To: [{ Email: email }],
        Subject: subject,
        TextPart: `Your SE7EN FIT verification code is ${otp}. It expires in 10 minutes.`,
        HTMLPart: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>SE7EN FIT verification code</h2><p>Use this code to continue:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</div><p>This code expires in 10 minutes.</p></div>`,
      }],
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(cleanMessage(mailjetErrorText(data), 'Could not send verification code from Mailjet. Check sender verification and Mailjet keys.')), { status: 400 });
  }
}

async function createOtpChallenge({ email, session, profile, authUser, purpose = 'login', role }) {
  const clean = cleanEmail(email);
  const otp = generateOtp();
  await sendMailjetOtp(clean, otp, purpose);
  pendingOtpChallenges.set(clean, {
    otp,
    session,
    profile,
    authUser,
    purpose,
    role: normalizeRole(role || profile?.role || authUser?.user_metadata?.role),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  return {
    requires_otp: true,
    purpose,
    email: clean,
    role: normalizeRole(role || profile?.role || authUser?.user_metadata?.role),
    message: 'Verification code sent to your email.',
  };
}

function consumeOtpChallenge(email, token) {
  const clean = cleanEmail(email);
  const challenge = pendingOtpChallenges.get(clean);
  if (!challenge) throw Object.assign(new Error('No pending verification code. Please start login or signup again.'), { status: 400 });
  if (Date.now() > challenge.expiresAt) {
    pendingOtpChallenges.delete(clean);
    throw Object.assign(new Error('Verification code expired. Please resend code.'), { status: 400 });
  }
  if (String(token || '').trim() !== challenge.otp) {
    throw Object.assign(new Error('Invalid verification code'), { status: 400 });
  }
  pendingOtpChallenges.delete(clean);
  return challenge;
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

async function findAuthUserByEmail(email) {
  const target = cleanEmail(email);
  let page = 1;
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const found = (data?.users || []).find((user) => cleanEmail(user.email) === target);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 1000) return null;
    page += 1;
  }
  return null;
}

function recordToEntity(row) {
  return { ...(row.data || {}), id: row.id, created_date: row.created_at, updated_date: row.updated_at };
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
  const { data, error } = await supabaseAdmin.from('entity_records').select('*').eq('entity_type', entityType);
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

app.get('/', (_req, res) => res.json({ ok: true, service: 'se7enfit-api', health: '/health' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'se7enfit-api' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'se7enfit-api' }));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = cleanEmail(body.email);
  const password = body.password;
  if (!email || !password) throw Object.assign(new Error('Email and password are required'), { status: 400 });
  if (String(password).length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });

  const metadata = {
    role: normalizeRole(body.role),
    full_name: body.full_name || body.name || body.owner_name,
    name: body.name || body.full_name || body.owner_name,
    owner_name: body.owner_name,
    phone: body.phone || body.mobile,
    mobile: body.mobile || body.phone,
  };

  const existing = await findAuthUserByEmail(email).catch(() => null);
  if (existing?.email_confirmed_at || existing?.confirmed_at) {
    throw Object.assign(new Error('Account already exists. Please log in instead.'), { status: 409 });
  }

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata || {}), ...metadata },
    });
    if (updateError) throw Object.assign(new Error(authErrorMessage(updateError, 'Could not update account. Please try again.')), { status: 400 });

    const login = await supabase.auth.signInWithPassword({ email, password });
    if (login.error) throw Object.assign(new Error(authErrorMessage(login.error, 'Could not create login session. Please try again.')), { status: 400 });
    const profile = await upsertProfile(login.data.user || updated.user, { ...metadata, email });
    return res.status(200).json(await createOtpChallenge({ email, session: login.data.session, profile, authUser: login.data.user || updated.user, purpose: 'register', role: profile.role }));
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (createError) {
    const message = authErrorMessage(createError, 'Could not create account. Please try again.');
    throw Object.assign(new Error(message), { status: 400 });
  }

  const login = await supabase.auth.signInWithPassword({ email, password });
  if (login.error) throw Object.assign(new Error(authErrorMessage(login.error, 'Could not create login session. Please try again.')), { status: 400 });
  const profile = await upsertProfile(login.data.user || created.user, { ...metadata, email });
  return res.status(201).json(await createOtpChallenge({ email, session: login.data.session, profile, authUser: login.data.user || created.user, purpose: 'register', role: profile.role }));
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const password = req.body?.password;
  const requestedRole = normalizeRole(req.body?.role || 'user');
  if (!email || !password) throw Object.assign(new Error('Email and password are required'), { status: 400 });

  let login = await supabase.auth.signInWithPassword({ email, password });
  if (login.error && /email not confirmed/i.test(authErrorMessage(login.error, ''))) {
    const existing = await findAuthUserByEmail(email).catch(() => null);
    if (existing?.id) await supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    login = await supabase.auth.signInWithPassword({ email, password });
  }
  if (login.error) throw Object.assign(new Error(authErrorMessage(login.error, 'Invalid email or password')), { status: 401 });

  const profile = await upsertProfile(login.data.user);
  const actualRole = normalizeRole(profile.role || login.data.user?.user_metadata?.role);
  if (requestedRole !== actualRole) {
    const message = actualRole === 'gym_owner' ? 'Use the gym owner login for this account.' : 'Use the user login for this account.';
    throw Object.assign(new Error(message), { status: 403 });
  }

  return res.json(await createOtpChallenge({ email, session: login.data.session, profile, authUser: login.data.user, purpose: 'login', role: actualRole }));
}));

app.post('/api/auth/verify-otp', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const token = req.body?.otp_code || req.body?.otpCode;
  if (!email || !token) throw Object.assign(new Error('Email and OTP code are required'), { status: 400 });

  const challenge = consumeOtpChallenge(email, token);
  const profile = challenge.profile || await upsertProfile(challenge.authUser);
  return res.json(formatSession(challenge.session, profile, challenge.authUser));
}));

app.post('/api/auth/resend-otp', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  if (!email) throw Object.assign(new Error('Email is required'), { status: 400 });
  const existing = pendingOtpChallenges.get(email);
  if (!existing) throw Object.assign(new Error('No pending verification code. Please start login or signup again.'), { status: 400 });
  return res.json(await createOtpChallenge({ email, session: existing.session, profile: existing.profile, authUser: existing.authUser, purpose: existing.purpose, role: existing.role }));
}));

app.post('/api/auth/google', asyncHandler(async (req, res) => {
  const idToken = req.body?.idToken;
  if (!idToken) throw Object.assign(new Error('Google ID token is required'), { status: 400 });

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw Object.assign(new Error(authErrorMessage(error, 'Google login failed')), { status: 401 });

  const profile = await upsertProfile(data.user, { role: req.body?.role || data.user?.user_metadata?.role });
  return res.json(formatSession(data.session, profile, data.user));
}));

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => res.json({ user: req.user })));

app.get('/api/gym-owners/me', requireAuth, asyncHandler(async (req, res) => res.json(await findGymOwnerForUser(req.user.id))));

app.put('/api/gym-owners/me', requireAuth, asyncHandler(async (req, res) => res.json(await upsertGymOwnerForUser(req.user, req.body || {}))));

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
  const message = cleanMessage(error.message, 'Internal server error');
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`SE7EN FIT API running on port ${PORT}`);
});
