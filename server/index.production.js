import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
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
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const app = express();
const allowedOrigins = FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGIN === '*' || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

function cleanEmail(email) { return String(email || '').trim().toLowerCase(); }
function cleanText(value) { return String(value || '').trim(); }
function nowIso() { return new Date().toISOString(); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function cleanMessage(value, fallback = 'Request failed') {
  const message = String(value || '').trim();
  if (!message || message === '{}' || message === '[object Object]') return fallback;
  return message;
}
function authErrorMessage(error, fallback) { return cleanMessage(error?.message || error?.error_description || error?.error, fallback); }
function normalizeRole(role) {
  const value = String(role || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gymowner', 'gym_owner'].includes(value)) return 'gym_owner';
  if (['superadmin', 'super_admin'].includes(value)) return 'super_admin';
  if (['admin'].includes(value)) return 'admin';
  if (['staff'].includes(value)) return 'staff';
  if (['gym_staff', 'gymstaff'].includes(value)) return 'gym_staff';
  return 'user';
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
    status: profile?.status || 'active',
    avatar_url: profile?.avatar_url || metadata.avatar_url || metadata.picture,
  };
}
function otpHash(email, otp, purpose) {
  return crypto.createHmac('sha256', OTP_HASH_SECRET).update(`${cleanEmail(email)}:${purpose}:${String(otp).trim()}`).digest('hex');
}
function generateOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
function generateReferralCode(name = 'GYM') {
  const base = String(name || 'GYM').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6) || 'GYM';
  return `${base}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}
function toPublicUrl(bucket, path) {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl;
}
function singleItem(res, item) { return res.json({ item }); }
function listItems(res, items, extra = {}) { return res.json({ items: items || [], ...extra }); }
function requireBodyId(id, label = 'id') {
  if (!id) throw Object.assign(new Error(`${label} is required`), { status: 400 });
}
function isAdminProfile(profile) { return ['super_admin', 'admin'].includes(normalizeRole(profile?.role)); }

async function dbSelectSingle(table, queryBuilder) {
  const query = queryBuilder(supabaseAdmin.from(table).select('*'));
  const { data, error } = await query.maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}
async function getProfile(userId) {
  return dbSelectSingle('profiles', (q) => q.eq('user_id', userId));
}
async function upsertProfile(authUser, overrides = {}) {
  const metadata = authUser?.user_metadata || {};
  const existing = await getProfile(authUser.id).catch(() => null);
  const role = normalizeRole(overrides.role || existing?.role || metadata.role);
  const row = {
    user_id: authUser.id,
    email: cleanEmail(authUser.email || overrides.email),
    role,
    status: overrides.status || existing?.status || 'active',
    source: overrides.source || existing?.source || 'app',
    full_name: overrides.full_name || overrides.name || overrides.owner_name || existing?.full_name || metadata.full_name || metadata.name || metadata.owner_name || null,
    phone: overrides.phone || overrides.mobile || existing?.phone || metadata.phone || metadata.mobile || null,
    avatar_url: overrides.avatar_url || existing?.avatar_url || metadata.avatar_url || metadata.picture || null,
    metadata: { ...(existing?.metadata || {}), ...metadata, ...overrides },
    updated_at: nowIso(),
  };
  const { data, error } = await supabaseAdmin.from('profiles').upsert(row, { onConflict: 'user_id' }).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  await supabaseAdmin.from('user_roles').upsert({ user_id: authUser.id, role }, { onConflict: 'user_id,role' }).catch(() => null);
  return data;
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
async function sendMailjetOtp(email, otp, purpose = 'login') {
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY || !MAILJET_FROM_EMAIL) {
    throw Object.assign(new Error('Mailjet is not configured on the backend.'), { status: 500 });
  }
  const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Messages: [{
        From: { Email: MAILJET_FROM_EMAIL, Name: MAILJET_FROM_NAME },
        To: [{ Email: cleanEmail(email) }],
        Subject: purpose === 'register' ? 'Verify your SE7EN FIT account' : 'Your SE7EN FIT login code',
        TextPart: `Your SE7EN FIT verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
        HTMLPart: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>SE7EN FIT verification code</h2><p>Use this code to continue:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</div><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p></div>`,
      }],
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(cleanMessage(data?.Messages?.[0]?.Errors?.[0]?.ErrorMessage, 'Could not send verification code.')), { status: 400 });
}
async function createOtpChallenge({ email, session, profile, authUser, purpose = 'login', role }) {
  const clean = cleanEmail(email);
  const otp = generateOtp();
  await sendMailjetOtp(clean, otp, purpose);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const row = {
    email: clean,
    purpose,
    role: normalizeRole(role || profile?.role || authUser?.user_metadata?.role),
    otp_hash: otpHash(clean, otp, purpose),
    session_payload: session || {},
    auth_user_payload: authUser || {},
    profile_payload: profile || {},
    expires_at: expiresAt,
    consumed_at: null,
    attempts: 0,
  };
  const { error } = await supabaseAdmin.from('auth_otp_challenges').upsert(row, { onConflict: 'email,purpose' });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { requires_otp: true, purpose, email: clean, role: row.role, message: 'Verification code sent to your email.' };
}
async function consumeOtpChallenge(email, token, purpose) {
  const clean = cleanEmail(email);
  const { data, error } = await supabaseAdmin
    .from('auth_otp_challenges')
    .select('*')
    .eq('email', clean)
    .eq('purpose', purpose)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data || data.consumed_at) throw Object.assign(new Error('No pending verification code. Please start login or signup again.'), { status: 400 });
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('auth_otp_challenges').delete().eq('challenge_id', data.challenge_id);
    throw Object.assign(new Error('Verification code expired. Please resend code.'), { status: 400 });
  }
  if (data.attempts >= 5) throw Object.assign(new Error('Too many OTP attempts. Please request a new code.'), { status: 429 });
  const valid = data.otp_hash === otpHash(clean, token, purpose);
  if (!valid) {
    await supabaseAdmin.from('auth_otp_challenges').update({ attempts: Number(data.attempts || 0) + 1 }).eq('challenge_id', data.challenge_id);
    throw Object.assign(new Error('Invalid verification code'), { status: 400 });
  }
  await supabaseAdmin.from('auth_otp_challenges').delete().eq('challenge_id', data.challenge_id);
  return data;
}
async function requireAuth(req, _res, next) {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) throw Object.assign(new Error('Missing bearer token'), { status: 401 });
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
    let profile = await getProfile(data.user.id);
    if (!profile) profile = await upsertProfile(data.user);
    if (profile.status === 'blocked') throw Object.assign(new Error('Account is blocked'), { status: 403 });
    req.authToken = token;
    req.authUser = data.user;
    req.userProfile = profile;
    req.user = publicUser(profile, data.user);
    next();
  } catch (error) { next(error); }
}
function requireAdmin(req, _res, next) {
  if (!isAdminProfile(req.userProfile)) return next(Object.assign(new Error('Admin access required'), { status: 403 }));
  next();
}
function requireSuperAdmin(req, _res, next) {
  if (normalizeRole(req.userProfile?.role) !== 'super_admin') return next(Object.assign(new Error('Super admin access required'), { status: 403 }));
  next();
}
async function getManagedGym(req) {
  if (isAdminProfile(req.userProfile) && req.query.gym_id) {
    return dbSelectSingle('gyms', (q) => q.eq('gym_id', req.query.gym_id));
  }
  const ownerGym = await dbSelectSingle('gyms', (q) => q.eq('owner_user_id', req.user.id).limit(1));
  if (ownerGym) return ownerGym;
  const { data, error } = await supabaseAdmin
    .from('gym_staff')
    .select('gym_id, gyms(*)')
    .eq('user_id', req.user.id)
    .eq('status', 'active')
    .limit(1);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data?.[0]?.gyms || null;
}
async function requireManagedGym(req) {
  const gym = await getManagedGym(req);
  if (!gym) throw Object.assign(new Error('Gym owner or gym staff access required'), { status: 403 });
  return gym;
}
async function audit(req, action, entity, entityId, details = {}) {
  await supabaseAdmin.from('admin_logs').insert({ actor_id: req.user?.id || null, action, entity, entity_id: entityId ? String(entityId) : null, details }).catch(() => null);
}
async function selectByUserDate(table, userId, date) {
  const { data, error } = await supabaseAdmin.from(table).select('*').eq('user_id', userId).eq('date', date);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data || [];
}
async function getUserActiveMembership(userId) {
  const { data, error } = await supabaseAdmin
    .from('gym_memberships')
    .select('*, gyms(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data?.[0] || null;
}

app.get('/', (_req, res) => res.json({ ok: true, service: 'se7enfit-api', mode: 'production', health: '/health' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'se7enfit-api', mode: 'production' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'se7enfit-api', mode: 'production' }));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = cleanEmail(body.email);
  const password = body.password;
  const role = normalizeRole(body.role);
  if (!email || !password) throw Object.assign(new Error('Email and password are required'), { status: 400 });
  if (String(password).length < 6) throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  const metadata = { role, full_name: body.full_name || body.name || body.owner_name, name: body.name || body.full_name || body.owner_name, owner_name: body.owner_name, phone: body.phone || body.mobile, mobile: body.mobile || body.phone };
  const existing = await findAuthUserByEmail(email).catch(() => null);
  if (existing?.email_confirmed_at || existing?.confirmed_at) throw Object.assign(new Error('Account already exists. Please log in instead.'), { status: 409 });
  let authUser = existing;
  if (existing?.id) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { ...(existing.user_metadata || {}), ...metadata } });
    if (error) throw Object.assign(new Error(authErrorMessage(error, 'Could not update account. Please try again.')), { status: 400 });
    authUser = data.user;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
    if (error) throw Object.assign(new Error(authErrorMessage(error, 'Could not create account. Please try again.')), { status: 400 });
    authUser = data.user;
  }
  const login = await supabase.auth.signInWithPassword({ email, password });
  if (login.error) throw Object.assign(new Error(authErrorMessage(login.error, 'Could not create login session. Please try again.')), { status: 400 });
  const profile = await upsertProfile(login.data.user || authUser, { ...metadata, email, source: role === 'gym_owner' ? 'gym_owner' : 'app' });
  return res.status(201).json(await createOtpChallenge({ email, session: login.data.session, profile, authUser: login.data.user || authUser, purpose: 'register', role: profile.role }));
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
  const allowed = requestedRole === actualRole || (requestedRole === 'admin' && ['admin', 'super_admin'].includes(actualRole));
  if (!allowed) throw Object.assign(new Error(actualRole === 'gym_owner' ? 'Use the gym owner login for this account.' : 'Use the user login for this account.'), { status: 403 });
  return res.json(await createOtpChallenge({ email, session: login.data.session, profile, authUser: login.data.user, purpose: 'login', role: actualRole }));
}));

app.post('/api/auth/verify-otp', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const token = req.body?.otp_code || req.body?.otpCode || req.body?.otp;
  const purpose = req.body?.purpose === 'register' ? 'register' : 'login';
  if (!email || !token) throw Object.assign(new Error('Email and OTP code are required'), { status: 400 });
  const challenge = await consumeOtpChallenge(email, token, purpose);
  const session = challenge.session_payload;
  if (!session?.access_token) throw Object.assign(new Error('OTP verified, but login session was not created. Please login again.'), { status: 400 });
  const profile = challenge.profile_payload || await getProfile(challenge.auth_user_payload?.id);
  return res.json({ access_token: session.access_token, token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at, user: publicUser(profile, challenge.auth_user_payload) });
}));

app.post('/api/auth/resend-otp', asyncHandler(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const purpose = req.body?.purpose === 'register' ? 'register' : 'login';
  if (!email) throw Object.assign(new Error('Email is required'), { status: 400 });
  const { data, error } = await supabaseAdmin.from('auth_otp_challenges').select('*').eq('email', email).eq('purpose', purpose).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error('No pending verification code. Please start login or signup again.'), { status: 400 });
  return res.json(await createOtpChallenge({ email, session: data.session_payload, profile: data.profile_payload, authUser: data.auth_user_payload, purpose, role: data.role }));
}));

app.post('/api/auth/google', asyncHandler(async (req, res) => {
  const idToken = req.body?.idToken;
  if (!idToken) throw Object.assign(new Error('Google ID token is required'), { status: 400 });
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw Object.assign(new Error(authErrorMessage(error, 'Google login failed')), { status: 401 });
  const profile = await upsertProfile(data.user, { role: req.body?.role || data.user?.user_metadata?.role });
  return res.json({ access_token: data.session.access_token, token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at, user: publicUser(profile, data.user) });
}));

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => res.json({ user: req.user, profile: req.userProfile })));
app.post('/api/auth/logout', requireAuth, asyncHandler(async (req, res) => { await audit(req, 'auth.logout', 'profiles', req.user.id); res.json({ success: true }); }));

app.get('/api/profiles/me', requireAuth, asyncHandler(async (req, res) => singleItem(res, req.userProfile)));
app.put('/api/profiles/me', requireAuth, asyncHandler(async (req, res) => {
  const allowed = ['full_name', 'phone', 'avatar_url', 'metadata', 'last_seen_at'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  const { data, error } = await supabaseAdmin.from('profiles').update({ ...patch, updated_at: nowIso() }).eq('user_id', req.user.id).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, data);
}));

app.get('/api/users/me/dashboard', requireAuth, asyncHandler(async (req, res) => {
  const date = req.query.date || todayIso();
  const [water, steps, nutrition, workouts, sleep, membership] = await Promise.all([
    selectByUserDate('water_logs', req.user.id, date), selectByUserDate('step_logs', req.user.id, date), selectByUserDate('nutrition_logs', req.user.id, date), selectByUserDate('workout_logs', req.user.id, date), selectByUserDate('sleep_logs', req.user.id, date), getUserActiveMembership(req.user.id),
  ]);
  singleItem(res, {
    date,
    profile: req.userProfile,
    tracking: {
      water_ml: water.reduce((s, r) => s + Number(r.amount_ml || 0), 0),
      steps: steps.reduce((s, r) => s + Number(r.steps || 0), 0),
      calories: nutrition.reduce((s, r) => s + Number(r.calories || 0), 0),
      protein_g: nutrition.reduce((s, r) => s + Number(r.protein_g || 0), 0),
      workout_done: workouts.some((w) => w.completed !== false),
      sleep_hours: Number(sleep[0]?.hours || 0),
    },
    membership,
  });
}));

app.get('/api/gym-owners/me', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('gym_owners').select('*, gyms(*)').eq('user_id', req.user.id);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, { owner: data?.[0] || null, gyms: (data || []).map((row) => row.gyms).filter(Boolean) });
}));
app.put('/api/gym-owners/me', requireAuth, asyncHandler(async (req, res) => {
  const gym = await requireManagedGym(req);
  const gymPatch = { name: req.body?.gym_name || req.body?.name || gym.name, phone: req.body?.phone || gym.phone, email: req.body?.email || gym.email, address: req.body?.address || gym.address, city: req.body?.city || gym.city, state: req.body?.state || gym.state, pincode: req.body?.pincode || gym.pincode, opening_hours: req.body?.opening_hours || gym.opening_hours, amenities: req.body?.amenities || gym.amenities, pricing: req.body?.pricing || gym.pricing };
  const { data, error } = await supabaseAdmin.from('gyms').update(gymPatch).eq('gym_id', gym.gym_id).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, data);
}));
app.post('/api/gym-owners/onboarding', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const gymName = cleanText(body.gym_name || body.name);
  if (!gymName) throw Object.assign(new Error('Gym name is required'), { status: 400 });
  const existing = await getManagedGym(req).catch(() => null);
  const referralCode = existing?.referral_code || body.referral_code || generateReferralCode(gymName);
  let gym;
  if (existing?.gym_id) {
    const { data, error } = await supabaseAdmin.from('gyms').update({ name: gymName, phone: body.phone || existing.phone, email: body.email || existing.email || req.user.email, address: body.address || existing.address, city: body.city || existing.city, state: body.state || existing.state, pincode: body.pincode || existing.pincode, opening_hours: body.opening_hours || existing.opening_hours, amenities: body.amenities || existing.amenities, pricing: body.pricing || existing.pricing }).eq('gym_id', existing.gym_id).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    gym = data;
  } else {
    const { data, error } = await supabaseAdmin.from('gyms').insert({ owner_user_id: req.user.id, name: gymName, slug: `${gymName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomBytes(2).toString('hex')}`, referral_code: referralCode, phone: body.phone, email: body.email || req.user.email, address: body.address, city: body.city, state: body.state, pincode: body.pincode, opening_hours: body.opening_hours || {}, amenities: body.amenities || [], pricing: body.pricing || {}, status: 'pending' }).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    gym = data;
  }
  const ownerRow = { user_id: req.user.id, gym_id: gym.gym_id, owner_name: body.owner_name || req.user.full_name, email: body.email || req.user.email, phone: body.phone || req.user.phone, onboarding_complete: true };
  const { data: owner, error: ownerError } = await supabaseAdmin.from('gym_owners').upsert(ownerRow, { onConflict: 'user_id,gym_id' }).select('*').single();
  if (ownerError) throw Object.assign(new Error(ownerError.message), { status: 500 });
  await upsertProfile(req.authUser, { role: 'gym_owner', source: 'gym_owner', full_name: body.owner_name || req.user.full_name, phone: body.phone || req.user.phone });
  singleItem(res, { owner, gym });
}));
app.get('/api/gyms/me', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('gyms').select('*').eq('owner_user_id', req.user.id).order('created_at', { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  listItems(res, data || []);
}));
app.get('/api/gyms/:gymId', requireAuth, asyncHandler(async (req, res) => {
  const gym = await dbSelectSingle('gyms', (q) => q.eq('gym_id', req.params.gymId));
  if (!gym) throw Object.assign(new Error('Gym not found'), { status: 404 });
  singleItem(res, gym);
}));

app.post('/api/gym-memberships/join', requireAuth, asyncHandler(async (req, res) => {
  const referral = cleanText(req.body?.referral_code).toUpperCase();
  if (!referral) throw Object.assign(new Error('Referral code is required'), { status: 400 });
  const gym = await dbSelectSingle('gyms', (q) => q.eq('referral_code', referral));
  if (!gym) throw Object.assign(new Error('Invalid referral code'), { status: 404 });
  const status = gym.metadata?.auto_approve_members === false ? 'pending' : 'active';
  const { data, error } = await supabaseAdmin.from('gym_memberships').upsert({ gym_id: gym.gym_id, user_id: req.user.id, referred_by_code: referral, status, approved_at: status === 'active' ? nowIso() : null }, { onConflict: 'gym_id,user_id' }).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, { ...data, gym });
}));
app.get('/api/gym-memberships/me', requireAuth, asyncHandler(async (req, res) => singleItem(res, await getUserActiveMembership(req.user.id))));
app.get('/api/gym-owner/members', requireAuth, asyncHandler(async (req, res) => {
  const gym = await requireManagedGym(req);
  const { data, error } = await supabaseAdmin.from('gym_memberships').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  const userIds = [...new Set((data || []).map((m) => m.user_id))];
  const { data: profiles } = userIds.length ? await supabaseAdmin.from('profiles').select('*').in('user_id', userIds) : { data: [] };
  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
  listItems(res, (data || []).map((m) => ({ ...m, profile: profileMap.get(m.user_id) || null })));
}));
app.patch('/api/gym-owner/members/:membershipId', requireAuth, asyncHandler(async (req, res) => {
  const gym = await requireManagedGym(req);
  const patch = { status: req.body?.status, notes: req.body?.notes };
  if (patch.status === 'active') patch.approved_at = nowIso();
  const { data, error } = await supabaseAdmin.from('gym_memberships').update(patch).eq('membership_id', req.params.membershipId).eq('gym_id', gym.gym_id).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, data);
}));

app.post('/api/gym-leads', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const gym = body.gym_id ? await dbSelectSingle('gyms', (q) => q.eq('gym_id', body.gym_id)) : body.referral_code ? await dbSelectSingle('gyms', (q) => q.eq('referral_code', cleanText(body.referral_code).toUpperCase())) : null;
  const { data, error } = await supabaseAdmin.from('gym_leads').insert({ gym_id: gym?.gym_id || null, owner_user_id: gym?.owner_user_id || null, source: body.source || 'website', name: body.name, phone: body.phone, email: body.email, city: body.city, message: body.message }).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, data);
}));
app.get('/api/gym-owner/leads', requireAuth, asyncHandler(async (req, res) => {
  const gym = await requireManagedGym(req);
  const { data, error } = await supabaseAdmin.from('gym_leads').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  listItems(res, data || []);
}));
app.patch('/api/gym-owner/leads/:leadId', requireAuth, asyncHandler(async (req, res) => {
  const gym = await requireManagedGym(req);
  const { data, error } = await supabaseAdmin.from('gym_leads').update({ status: req.body?.status, assigned_to: req.body?.assigned_to || null }).eq('lead_id', req.params.leadId).eq('gym_id', gym.gym_id).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, data);
}));

app.post('/api/gym-attendance/check-in', requireAuth, asyncHandler(async (req, res) => {
  const membership = await getUserActiveMembership(req.user.id);
  if (!membership?.gym_id || membership.status !== 'active') throw Object.assign(new Error('Active gym membership required'), { status: 403 });
  const { data, error } = await supabaseAdmin.from('gym_attendance_logs').insert({ gym_id: membership.gym_id, user_id: req.user.id, membership_id: membership.membership_id, date: todayIso(), check_in_at: nowIso(), status: 'checked_in' }).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, data);
}));
app.post('/api/gym-attendance/check-out', requireAuth, asyncHandler(async (req, res) => {
  const membership = await getUserActiveMembership(req.user.id);
  if (!membership?.gym_id) throw Object.assign(new Error('Gym membership required'), { status: 403 });
  const log = await dbSelectSingle('gym_attendance_logs', (q) => q.eq('user_id', req.user.id).eq('gym_id', membership.gym_id).eq('date', todayIso()).eq('status', 'checked_in').order('created_at', { ascending: false }).limit(1));
  if (!log) throw Object.assign(new Error('No active check-in found'), { status: 404 });
  const duration = Math.max(1, Math.round((Date.now() - new Date(log.check_in_at || log.created_at).getTime()) / 60000));
  const { data, error } = await supabaseAdmin.from('gym_attendance_logs').update({ check_out_at: nowIso(), duration_minutes: duration, status: 'checked_out' }).eq('log_id', log.log_id).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  singleItem(res, data);
}));
app.get('/api/gym-attendance/me', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('gym_attendance_logs').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(Number(req.query.limit || 100));
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  listItems(res, data || []);
}));
app.get('/api/gym-owner/attendance', requireAuth, asyncHandler(async (req, res) => {
  const gym = await requireManagedGym(req);
  const { data, error } = await supabaseAdmin.from('gym_attendance_logs').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false }).limit(Number(req.query.limit || 200));
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  listItems(res, data || []);
}));

app.get('/api/tracking/today', requireAuth, asyncHandler(async (req, res) => {
  const date = req.query.date || todayIso();
  const [water, steps, sleep, weight, body, cardio] = await Promise.all(['water_logs', 'step_logs', 'sleep_logs', 'weight_logs', 'body_measurements', 'cardio_logs'].map((table) => selectByUserDate(table, req.user.id, date)));
  singleItem(res, { date, water, steps, sleep, weight, body_measurements: body, cardio });
}));
function createLogRoute(path, table, mapBody) {
  app.post(path, requireAuth, asyncHandler(async (req, res) => {
    const row = { user_id: req.user.id, date: req.body?.date || todayIso(), ...mapBody(req.body || {}) };
    const { data, error } = await supabaseAdmin.from(table).insert(row).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    singleItem(res, data);
  }));
}
createLogRoute('/api/tracking/water', 'water_logs', (b) => ({ amount_ml: Number(b.amount_ml || b.amount || 250), source: 'app' }));
createLogRoute('/api/tracking/steps', 'step_logs', (b) => ({ steps: Number(b.steps || 0), distance_km: b.distance_km, calories: b.calories, source: 'app' }));
createLogRoute('/api/tracking/sleep', 'sleep_logs', (b) => ({ hours: Number(b.hours || 0), quality: b.quality, source: 'app' }));
createLogRoute('/api/tracking/weight', 'weight_logs', (b) => ({ weight_kg: Number(b.weight_kg || b.weight || 0), source: 'app' }));
createLogRoute('/api/tracking/body-measurement', 'body_measurements', (b) => ({ chest_cm: b.chest_cm, waist_cm: b.waist_cm, hip_cm: b.hip_cm, biceps_cm: b.biceps_cm, thighs_cm: b.thighs_cm, notes: b.notes, source: 'app' }));
createLogRoute('/api/tracking/cardio', 'cardio_logs', (b) => ({ activity: b.activity, duration_minutes: b.duration_minutes, distance_km: b.distance_km, calories_burned: b.calories_burned, source: 'app' }));
app.get('/api/tracking/history', requireAuth, asyncHandler(async (req, res) => {
  const table = req.query.type || 'weight_logs';
  const allowed = new Set(['workout_logs', 'nutrition_logs', 'water_logs', 'step_logs', 'sleep_logs', 'weight_logs', 'body_measurements', 'cardio_logs']);
  if (!allowed.has(table)) throw Object.assign(new Error('Invalid history type'), { status: 400 });
  const { data, error } = await supabaseAdmin.from(table).select('*').eq('user_id', req.user.id).order('date', { ascending: false }).limit(Number(req.query.limit || 100));
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  listItems(res, data || []);
}));

app.get('/api/workouts/logs', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('workout_logs').select('*').eq('user_id', req.user.id).order('date', { ascending: false }).limit(Number(req.query.limit || 100));
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  listItems(res, data || []);
}));
createLogRoute('/api/workouts/logs', 'workout_logs', (b) => ({ gym_id: b.gym_id || null, workout_name: b.workout_name || b.name, workout_type: b.workout_type || b.type, duration_minutes: b.duration_minutes, calories_burned: b.calories_burned, exercises: b.exercises || [], completed: b.completed !== false, source: 'app' }));
app.get('/api/nutrition/logs', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('nutrition_logs').select('*').eq('user_id', req.user.id).order('date', { ascending: false }).limit(Number(req.query.limit || 100));
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  listItems(res, data || []);
}));
createLogRoute('/api/nutrition/logs', 'nutrition_logs', (b) => ({ meal_type: b.meal_type, food_name: b.food_name || b.name, calories: Number(b.calories || 0), protein_g: Number(b.protein_g || b.protein || 0), carbs_g: Number(b.carbs_g || b.carbs || 0), fat_g: Number(b.fat_g || b.fat || 0), image_url: b.image_url, source: 'app' }));

app.get('/api/gym-owner/equipment', requireAuth, asyncHandler(async (req, res) => { const gym = await requireManagedGym(req); const { data, error } = await supabaseAdmin.from('gym_equipment').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false }); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.post('/api/gym-owner/equipment', requireAuth, asyncHandler(async (req, res) => { const gym = await requireManagedGym(req); const { data, error } = await supabaseAdmin.from('gym_equipment').insert({ gym_id: gym.gym_id, name: req.body?.name, category: req.body?.category, quantity: req.body?.quantity || 1, available: req.body?.available !== false, image_url: req.body?.image_url, metadata: req.body?.metadata || {} }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.patch('/api/gym-owner/equipment/:id', requireAuth, asyncHandler(async (req, res) => { const gym = await requireManagedGym(req); const { data, error } = await supabaseAdmin.from('gym_equipment').update(req.body || {}).eq('equipment_id', req.params.id).eq('gym_id', gym.gym_id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.delete('/api/gym-owner/equipment/:id', requireAuth, asyncHandler(async (req, res) => { const gym = await requireManagedGym(req); const { error } = await supabaseAdmin.from('gym_equipment').delete().eq('equipment_id', req.params.id).eq('gym_id', gym.gym_id); if (error) throw Object.assign(new Error(error.message), { status: 500 }); res.json({ success: true }); }));
app.get('/api/users/my-gym/equipment', requireAuth, asyncHandler(async (req, res) => { const membership = await getUserActiveMembership(req.user.id); if (!membership?.gym_id) return listItems(res, []); const { data, error } = await supabaseAdmin.from('gym_equipment').select('*').eq('gym_id', membership.gym_id).eq('available', true); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));

app.post('/api/uploads/media', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw Object.assign(new Error('File is required'), { status: 400 });
  const purpose = req.body?.purpose || 'community';
  const bucketMap = { avatar: 'profile-avatars', progress: 'progress-photos', community: 'community-media', ad: 'ad-media', gym: 'gym-assets', support: 'support-attachments', food_scan: 'food-scan-images' };
  const bucket = bucketMap[purpose] || 'community-media';
  const mediaType = file.mimetype.startsWith('video/') ? 'video' : file.mimetype.startsWith('image/') ? 'image' : 'document';
  const ext = file.originalname?.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
  const gymId = req.body?.gym_id || null;
  if (['ad', 'gym'].includes(purpose) && !isAdminProfile(req.userProfile)) {
    const gym = await requireManagedGym(req);
    if (gymId && gymId !== gym.gym_id) throw Object.assign(new Error('Cannot upload media for another gym'), { status: 403 });
  }
  const path = `${req.user.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (uploadError) throw Object.assign(new Error(uploadError.message), { status: 500 });
  const publicUrl = toPublicUrl(bucket, path);
  const { data, error } = await supabaseAdmin.from('media_assets').insert({ owner_user_id: req.user.id, gym_id: gymId, bucket, path, public_url: publicUrl, media_type: mediaType, mime_type: file.mimetype, size_bytes: file.size, crop_position: req.body?.crop_position || 'center center', quality_label: req.body?.quality_label || null }).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  res.status(201).json({ asset: data });
}));

app.get('/api/advertisements/feed', requireAuth, asyncHandler(async (req, res) => {
  const membership = await getUserActiveMembership(req.user.id);
  let query = supabaseAdmin.from('advertisements').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(50);
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  const items = (data || []).filter((ad) => ad.target_scope === 'all' || (membership?.gym_id && ad.gym_id === membership.gym_id));
  listItems(res, items);
}));
async function createAd(req, gym = null, admin = false) {
  const b = req.body || {};
  const row = { created_by: req.user.id, gym_id: gym?.gym_id || b.gym_id || null, source_type: admin ? 'admin' : 'gym_owner', source_name: admin ? 'SE7EN FIT' : gym?.name, title: b.title, description: b.description, offer_text: b.offer_text, cta_label: b.cta_label || 'View Offer', cta_url: b.cta_url, media_asset_id: b.media_asset_id || null, media_url: b.media_url, media_type: b.media_type || null, media_crop: b.media_crop || 'center center', target_scope: admin ? 'all' : (b.target_scope || 'referred_users'), status: b.status || 'active', start_at: b.start_at || null, end_at: b.end_at || null };
  const { data, error } = await supabaseAdmin.from('advertisements').insert(row).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}
app.get('/api/gym-owner/advertisements', requireAuth, asyncHandler(async (req, res) => { const gym = await requireManagedGym(req); const { data, error } = await supabaseAdmin.from('advertisements').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false }); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.post('/api/gym-owner/advertisements', requireAuth, asyncHandler(async (req, res) => singleItem(res, await createAd(req, await requireManagedGym(req), false))));
app.patch('/api/gym-owner/advertisements/:id', requireAuth, asyncHandler(async (req, res) => { const gym = await requireManagedGym(req); const { data, error } = await supabaseAdmin.from('advertisements').update(req.body || {}).eq('ad_id', req.params.id).eq('gym_id', gym.gym_id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.delete('/api/gym-owner/advertisements/:id', requireAuth, asyncHandler(async (req, res) => { const gym = await requireManagedGym(req); const { error } = await supabaseAdmin.from('advertisements').update({ status: 'deleted' }).eq('ad_id', req.params.id).eq('gym_id', gym.gym_id); if (error) throw Object.assign(new Error(error.message), { status: 500 }); res.json({ success: true }); }));
app.post('/api/advertisements/:id/impression', requireAuth, asyncHandler(async (req, res) => { await supabaseAdmin.from('ad_impressions').insert({ ad_id: req.params.id, user_id: req.user.id, source: req.body?.source || 'app' }); res.json({ success: true }); }));
app.post('/api/advertisements/:id/click', requireAuth, asyncHandler(async (req, res) => { await supabaseAdmin.from('ad_clicks').insert({ ad_id: req.params.id, user_id: req.user.id, source: req.body?.source || 'app' }); res.json({ success: true }); }));

app.get('/api/community/posts', requireAuth, asyncHandler(async (_req, res) => { const { data, error } = await supabaseAdmin.from('community_posts').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(100); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.post('/api/community/posts', requireAuth, asyncHandler(async (req, res) => { const b = req.body || {}; const { data, error } = await supabaseAdmin.from('community_posts').insert({ user_id: req.user.id, gym_id: b.gym_id || null, type: b.type || 'general', content: b.content, media_asset_id: b.media_asset_id || null, media_url: b.media_url, media_type: b.media_type || null, media_crop: b.media_crop || 'center center' }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.patch('/api/community/posts/:id', requireAuth, asyncHandler(async (req, res) => { const post = await dbSelectSingle('community_posts', (q) => q.eq('post_id', req.params.id)); if (!post || (post.user_id !== req.user.id && !isAdminProfile(req.userProfile))) throw Object.assign(new Error('Post not found'), { status: 404 }); const patch = isAdminProfile(req.userProfile) ? req.body : { content: req.body?.content }; const { data, error } = await supabaseAdmin.from('community_posts').update(patch).eq('post_id', req.params.id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.delete('/api/community/posts/:id', requireAuth, asyncHandler(async (req, res) => { const post = await dbSelectSingle('community_posts', (q) => q.eq('post_id', req.params.id)); if (!post || (post.user_id !== req.user.id && !isAdminProfile(req.userProfile))) throw Object.assign(new Error('Post not found'), { status: 404 }); await supabaseAdmin.from('community_posts').update({ status: 'deleted' }).eq('post_id', req.params.id); res.json({ success: true }); }));
app.post('/api/community/posts/:id/like', requireAuth, asyncHandler(async (req, res) => { const exists = await dbSelectSingle('community_likes', (q) => q.eq('post_id', req.params.id).eq('user_id', req.user.id)); if (exists) { await supabaseAdmin.from('community_likes').delete().eq('post_id', req.params.id).eq('user_id', req.user.id); } else { await supabaseAdmin.from('community_likes').insert({ post_id: req.params.id, user_id: req.user.id }); } res.json({ success: true, liked: !exists }); }));
app.get('/api/community/posts/:id/comments', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('community_comments').select('*').eq('post_id', req.params.id).eq('status', 'active').order('created_at'); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.post('/api/community/posts/:id/comments', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('community_comments').insert({ post_id: req.params.id, user_id: req.user.id, body: req.body?.body || req.body?.content }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));

app.post('/api/ai/trainer', requireAuth, asyncHandler(async (req, res) => {
  if (!GEMINI_API_KEY) throw Object.assign(new Error('AI provider is not configured on the backend.'), { status: 503 });
  const message = cleanText(req.body?.message);
  if (!message) throw Object.assign(new Error('Message is required'), { status: 400 });
  const conversationId = req.body?.conversation_id || 'ai_trainer_default';
  await supabaseAdmin.from('ai_chat_messages').insert({ user_id: req.user.id, conversation_id: conversationId, role: 'user', content: message, source: 'ai_trainer' });
  const prompt = `You are SE7EN FIT AI Trainer. Give safe, practical fitness guidance. User context: ${JSON.stringify(req.body?.context || {})}\n\nUser: ${message}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(cleanMessage(json?.error?.message, 'AI provider request failed')), { status: 502 });
  const reply = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || 'I could not generate a response.';
  const { data, error } = await supabaseAdmin.from('ai_chat_messages').insert({ user_id: req.user.id, conversation_id: conversationId, role: 'assistant', content: reply, source: 'ai_trainer' }).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  await supabaseAdmin.from('ai_usage_logs').insert({ user_id: req.user.id, feature: 'ai_trainer', date: todayIso(), success: true }).catch(() => null);
  res.json({ reply, message: data });
}));
app.get('/api/ai/trainer/history', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('ai_chat_messages').select('*').eq('user_id', req.user.id).eq('conversation_id', req.query.conversation_id || 'ai_trainer_default').order('created_at'); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.delete('/api/ai/trainer/history', requireAuth, asyncHandler(async (req, res) => { const { error } = await supabaseAdmin.from('ai_chat_messages').delete().eq('user_id', req.user.id).eq('conversation_id', req.query.conversation_id || 'ai_trainer_default'); if (error) throw Object.assign(new Error(error.message), { status: 500 }); res.json({ success: true }); }));
app.patch('/api/ai/trainer/messages/:id', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('ai_chat_messages').update({ content: req.body?.content, edited_at: nowIso() }).eq('message_id', req.params.id).eq('user_id', req.user.id).eq('role', 'user').select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.delete('/api/ai/trainer/messages/:id', requireAuth, asyncHandler(async (req, res) => { const { error } = await supabaseAdmin.from('ai_chat_messages').delete().eq('message_id', req.params.id).eq('user_id', req.user.id).eq('role', 'user'); if (error) throw Object.assign(new Error(error.message), { status: 500 }); res.json({ success: true }); }));
app.post('/api/ai/food-scan', requireAuth, asyncHandler(async (_req, _res) => { throw Object.assign(new Error('Food scan AI provider is not configured on the backend.'), { status: 503 }); }));

app.post('/api/support/tickets', requireAuth, asyncHandler(async (req, res) => { const b = req.body || {}; const membership = await getUserActiveMembership(req.user.id).catch(() => null); const { data, error } = await supabaseAdmin.from('support_tickets').insert({ user_id: req.user.id, gym_id: b.gym_id || membership?.gym_id || null, user_name: req.user.full_name, user_email: req.user.email, user_phone: req.user.phone, source: b.source || 'app', subject: b.subject, message: b.message, priority: b.priority || 'normal' }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.get('/api/support/tickets/me', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('support_tickets').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.post('/api/support/tickets/:id/messages', requireAuth, asyncHandler(async (req, res) => { const ticket = await dbSelectSingle('support_tickets', (q) => q.eq('id', req.params.id)); if (!ticket || (ticket.user_id !== req.user.id && !isAdminProfile(req.userProfile))) throw Object.assign(new Error('Ticket not found'), { status: 404 }); const { data, error } = await supabaseAdmin.from('ticket_messages').insert({ ticket_id: req.params.id, author_id: req.user.id, body: req.body?.body || req.body?.message, is_internal: Boolean(req.body?.is_internal && isAdminProfile(req.userProfile)) }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));

app.post('/api/notifications/push-token', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('push_tokens').upsert({ user_id: req.user.id, platform: req.body?.platform, token: req.body?.token, device_info: req.body?.device_info || {}, active: true }, { onConflict: 'token' }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));
app.get('/api/notifications/me', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('user_notifications').select('*, notifications(*)').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(100); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.patch('/api/notifications/:id/read', requireAuth, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('user_notifications').update({ read_at: nowIso() }).eq('id', req.params.id).eq('user_id', req.user.id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); singleItem(res, data); }));

app.get('/api/admin/dashboard', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const tables = ['profiles', 'gyms', 'gym_memberships', 'gym_leads', 'support_tickets', 'advertisements', 'community_posts'];
  const metrics = {};
  for (const table of tables) {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (!error) metrics[table] = count || 0;
  }
  singleItem(res, metrics);
}));
app.get('/api/admin/users', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }).limit(Number(req.query.limit || 200)); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.get('/api/admin/users/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => singleItem(res, await getProfile(req.params.id))));
app.patch('/api/admin/users/:id/status', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('profiles').update({ status: req.body?.status }).eq('user_id', req.params.id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await audit(req, 'user.status.update', 'profiles', req.params.id, { status: req.body?.status }); singleItem(res, data); }));
app.patch('/api/admin/users/:id/role', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => { const role = normalizeRole(req.body?.role); const { data, error } = await supabaseAdmin.from('profiles').update({ role }).eq('user_id', req.params.id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await supabaseAdmin.from('user_roles').upsert({ user_id: req.params.id, role }, { onConflict: 'user_id,role' }); await audit(req, 'user.role.update', 'profiles', req.params.id, { role }); singleItem(res, data); }));
app.get('/api/admin/gyms', requireAuth, requireAdmin, asyncHandler(async (_req, res) => { const { data, error } = await supabaseAdmin.from('gyms').select('*').order('created_at', { ascending: false }); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.patch('/api/admin/gyms/:gymId/status', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('gyms').update({ status: req.body?.status }).eq('gym_id', req.params.gymId).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await audit(req, 'gym.status.update', 'gyms', req.params.gymId, { status: req.body?.status }); singleItem(res, data); }));
app.get('/api/admin/advertisements', requireAuth, requireAdmin, asyncHandler(async (_req, res) => { const { data, error } = await supabaseAdmin.from('advertisements').select('*').order('created_at', { ascending: false }); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.post('/api/admin/advertisements', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const ad = await createAd(req, null, true); await audit(req, 'ad.create', 'advertisements', ad.ad_id, ad); singleItem(res, ad); }));
app.patch('/api/admin/advertisements/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('advertisements').update(req.body || {}).eq('ad_id', req.params.id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await audit(req, 'ad.update', 'advertisements', req.params.id, req.body); singleItem(res, data); }));
app.delete('/api/admin/advertisements/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { error } = await supabaseAdmin.from('advertisements').update({ status: 'deleted' }).eq('ad_id', req.params.id); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await audit(req, 'ad.delete', 'advertisements', req.params.id); res.json({ success: true }); }));
app.get('/api/admin/support/tickets', requireAuth, requireAdmin, asyncHandler(async (_req, res) => { const { data, error } = await supabaseAdmin.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(300); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.patch('/api/admin/support/tickets/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('support_tickets').update(req.body || {}).eq('id', req.params.id).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await audit(req, 'support.update', 'support_tickets', req.params.id, req.body); singleItem(res, data); }));
app.post('/api/admin/notifications', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('notifications').insert({ title: req.body?.title, body: req.body?.body, target: req.body?.target || 'app', audience: req.body?.audience || { type: 'all_users' }, channel: req.body?.channel || 'in_app', status: req.body?.status || 'sent', scheduled_at: req.body?.scheduled_at || null, sent_at: req.body?.status === 'draft' ? null : nowIso(), created_by: req.user.id }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await audit(req, 'notification.create', 'notifications', data.notification_id, data); singleItem(res, data); }));
app.get('/api/admin/notifications', requireAuth, requireAdmin, asyncHandler(async (_req, res) => { const { data, error } = await supabaseAdmin.from('notifications').select('*').order('created_at', { ascending: false }); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.get('/api/admin/settings', requireAuth, requireAdmin, asyncHandler(async (_req, res) => { const { data, error } = await supabaseAdmin.from('app_settings').select('*').order('key'); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));
app.patch('/api/admin/settings/:key', requireAuth, requireAdmin, asyncHandler(async (req, res) => { const { data, error } = await supabaseAdmin.from('app_settings').upsert({ key: req.params.key, scope: req.body?.scope || 'admin', value: req.body?.value || {}, description: req.body?.description, updated_by: req.user.id, updated_at: nowIso() }, { onConflict: 'key' }).select('*').single(); if (error) throw Object.assign(new Error(error.message), { status: 500 }); await audit(req, 'setting.update', 'app_settings', req.params.key, req.body?.value); singleItem(res, data); }));
app.get('/api/admin/logs', requireAuth, requireAdmin, asyncHandler(async (_req, res) => { const { data, error } = await supabaseAdmin.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(300); if (error) throw Object.assign(new Error(error.message), { status: 500 }); listItems(res, data || []); }));

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = cleanMessage(error.message, 'Internal server error');
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => console.log(`SE7EN FIT production API running on port ${PORT}`));
