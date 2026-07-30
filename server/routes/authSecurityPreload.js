import crypto from 'crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const MAILJET_FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;
const MAILJET_FROM_NAME = process.env.MAILJET_FROM_NAME || 'SE7EN FIT';
const OTP_TTL_MINUTES = Math.min(15, Math.max(5, Number(process.env.OTP_TTL_MINUTES || 10)));
const PASSWORD_RESET_TTL_MINUTES = Math.min(60, Math.max(10, Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30)));
const AUTH_SECRET = process.env.AUTH_SECURITY_SECRET || process.env.OTP_HASH_SECRET || SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD_RESET_URL = process.env.PASSWORD_RESET_URL || 'https://se7en-fit-web.onrender.com/reset-password';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !AUTH_SECRET) {
  throw new Error('Missing Supabase or authentication security environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const cleanEmail = (value) => String(value || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();

function normalizeRole(value) {
  const role = String(value || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gymowner', 'gym_owner'].includes(role)) return 'gym_owner';
  if (['superadmin', 'super_admin'].includes(role)) return 'super_admin';
  if (['admin', 'staff', 'gym_staff'].includes(role)) return role;
  return 'user';
}

function normalizePublicRole(value) {
  return normalizeRole(value) === 'gym_owner' ? 'gym_owner' : 'user';
}

function cleanMessage(error, fallback) {
  const message = String(error?.message || error?.error_description || error?.error || '').trim();
  return message && message !== '{}' && message !== '[object Object]' ? message : fallback;
}

function publicUser(profile = {}, authUser = {}) {
  const metadata = authUser.user_metadata || {};
  return {
    id: authUser.id || profile.user_id,
    email: profile.email || authUser.email,
    full_name: profile.full_name || metadata.full_name || metadata.name || metadata.owner_name || authUser.email?.split('@')?.[0] || 'SE7EN FIT User',
    name: profile.full_name || metadata.name,
    phone: profile.phone || metadata.phone || metadata.mobile,
    mobile: profile.phone || metadata.mobile || metadata.phone,
    role: normalizeRole(profile.role || metadata.role),
    status: profile.status || 'active',
    avatar_url: profile.avatar_url || metadata.avatar_url || metadata.picture,
  };
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function hmac(value, context = 'generic') {
  return crypto.createHmac('sha256', AUTH_SECRET).update(`${context}:${String(value || '')}`).digest('hex');
}

function tokenHash(token, context) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(`${context}:${String(token || '').trim()}`).digest('hex');
}

function encryptionKey() {
  return crypto.createHash('sha256').update(String(AUTH_SECRET)).digest();
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: encrypted.toString('base64url'),
  };
}

function decryptJson(payload) {
  if (!payload || payload.version !== 1 || payload.algorithm !== 'aes-256-gcm') {
    // Read old unencrypted challenges during a safe rollout, but every new challenge is encrypted.
    return payload || {};
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(payload.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

function decodeJwtClaims(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function rateLimit(req, scope, options = {}) {
  const email = cleanEmail(req.body?.email);
  const identity = `${clientIp(req)}:${email || 'anonymous'}`;
  const { data, error } = await db.rpc('consume_auth_rate_limit', {
    p_key_hash: hmac(identity, `rate:${scope}`),
    p_scope: scope,
    p_limit: options.limit || 10,
    p_window_seconds: options.windowSeconds || 900,
    p_block_seconds: options.blockSeconds || 900,
  });
  if (error) throw fail('Authentication protection is temporarily unavailable.', 503);
  if (data !== true) throw fail('Too many attempts. Please wait and try again.', 429);
}

async function audit(req, eventType, success, details = {}) {
  const email = cleanEmail(details.email || req.body?.email);
  await db.from('auth_security_events').insert({
    user_id: details.userId || null,
    email_hash: email ? hmac(email, 'email') : null,
    ip_hash: hmac(clientIp(req), 'ip'),
    event_type: eventType,
    success: Boolean(success),
    metadata: {
      role: details.role || undefined,
      scope: details.scope || undefined,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
    },
  }).catch(() => null);
}

async function getProfile(userId) {
  const { data, error } = await db.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw fail(error.message, 500);
  return data;
}

async function upsertProfile(authUser, overrides = {}) {
  const existing = await getProfile(authUser.id).catch(() => null);
  const metadata = authUser.user_metadata || {};
  const requestedRole = normalizePublicRole(overrides.role || metadata.role);
  const role = existing?.role ? normalizeRole(existing.role) : requestedRole;
  const status = existing?.status || (role === 'gym_owner' ? 'pending' : 'active');
  const row = {
    user_id: authUser.id,
    email: cleanEmail(authUser.email || overrides.email),
    role,
    status,
    source: existing?.source || (role === 'gym_owner' ? 'gym_owner' : 'app'),
    full_name: overrides.full_name || overrides.name || overrides.owner_name || existing?.full_name || metadata.full_name || metadata.name || metadata.owner_name || null,
    phone: overrides.phone || overrides.mobile || existing?.phone || metadata.phone || metadata.mobile || null,
    avatar_url: overrides.avatar_url || existing?.avatar_url || metadata.avatar_url || metadata.picture || null,
    metadata: {
      ...(existing?.metadata || {}),
      referral_code: overrides.referral_code || existing?.metadata?.referral_code || undefined,
    },
    updated_at: nowIso(),
  };
  const { data, error } = await db.from('profiles').upsert(row, { onConflict: 'user_id' }).select('*').single();
  if (error) throw fail(error.message, 500);
  await db.from('user_roles').upsert({ user_id: authUser.id, role }, { onConflict: 'user_id,role' }).catch(() => null);
  return data;
}

async function findAuthUserByEmail(email) {
  const target = cleanEmail(email);
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw fail('Could not access account directory.', 503);
    const found = (data?.users || []).find((user) => cleanEmail(user.email) === target);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 1000) break;
  }
  return null;
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) throw fail('Password must be at least 8 characters.', 400);
  if (value.length > 128) throw fail('Password is too long.', 400);
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    throw fail('Password must include an uppercase letter, a lowercase letter and a number.', 400);
  }
  return value;
}

async function sendMailjetMessage({ email, subject, text, html }) {
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY || !MAILJET_FROM_EMAIL) {
    throw fail('Email verification is temporarily unavailable.', 503);
  }
  const authorization = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Messages: [{
        From: { Email: MAILJET_FROM_EMAIL, Name: MAILJET_FROM_NAME },
        To: [{ Email: cleanEmail(email) }],
        Subject: subject,
        TextPart: text,
        HTMLPart: html,
      }],
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw fail(cleanMessage(data?.Messages?.[0]?.Errors?.[0], 'Could not send verification email.'), 503);
  }
}

async function createOtpChallenge({ email, session, profile, authUser, purpose, role }) {
  const clean = cleanEmail(email);
  const otp = String(crypto.randomInt(100000, 1000000));
  const safePurpose = purpose === 'register' ? 'register' : 'login';
  await sendMailjetMessage({
    email: clean,
    subject: safePurpose === 'register' ? 'Verify your SE7EN FIT account' : 'Your SE7EN FIT login code',
    text: `Your SE7EN FIT verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>SE7EN FIT verification code</h2><p>Use this code to continue:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</div><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p></div>`,
  });

  const row = {
    email: clean,
    purpose: safePurpose,
    role: normalizeRole(role || profile?.role),
    otp_hash: tokenHash(`${clean}:${safePurpose}:${otp}`, 'otp'),
    session_payload: encryptJson(session || {}),
    auth_user_payload: { id: authUser?.id, email: authUser?.email },
    profile_payload: profile || {},
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
    consumed_at: null,
    attempts: 0,
    updated_at: nowIso(),
  };
  const { error } = await db.from('auth_otp_challenges').upsert(row, { onConflict: 'email,purpose' });
  if (error) throw fail(error.message, 500);
  return {
    requires_otp: true,
    purpose: safePurpose,
    email: clean,
    role: row.role,
    message: 'Verification code sent to your email.',
  };
}

async function consumeOtpChallenge(email, otp, purpose) {
  const clean = cleanEmail(email);
  const safePurpose = purpose === 'register' ? 'register' : 'login';
  const { data, error } = await db.from('auth_otp_challenges').select('*').eq('email', clean).eq('purpose', safePurpose).maybeSingle();
  if (error) throw fail('Could not verify code. Please try again.', 503);
  if (!data || data.consumed_at) throw fail('No pending verification code. Please start again.', 400);
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await db.from('auth_otp_challenges').delete().eq('challenge_id', data.challenge_id);
    throw fail('Verification code expired. Please resend code.', 400);
  }
  if (Number(data.attempts || 0) >= 5) throw fail('Too many OTP attempts. Please request a new code.', 429);

  const suppliedHash = tokenHash(`${clean}:${safePurpose}:${String(otp || '').trim()}`, 'otp');
  if (!crypto.timingSafeEqual(Buffer.from(data.otp_hash), Buffer.from(suppliedHash))) {
    await db.from('auth_otp_challenges').update({ attempts: Number(data.attempts || 0) + 1, updated_at: nowIso() }).eq('challenge_id', data.challenge_id);
    throw fail('Invalid verification code.', 400);
  }

  const deleted = await db.from('auth_otp_challenges').delete().eq('challenge_id', data.challenge_id).eq('otp_hash', suppliedHash).select('*').maybeSingle();
  if (deleted.error || !deleted.data) throw fail('This verification code was already used. Please start again.', 409);
  return deleted.data;
}

async function ensureSessionActive(token, authUser) {
  const claims = decodeJwtClaims(token);
  const sessionId = claims?.session_id;
  if (!sessionId || claims?.sub !== authUser.id) throw fail('Invalid authentication session.', 401);
  const { data, error } = await db.rpc('is_auth_session_active', {
    p_session_id: sessionId,
    p_user_id: authUser.id,
  });
  if (error || data !== true) throw fail('Your session has ended. Please log in again.', 401);
}

async function sessionGuard(req, _res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) throw fail('Invalid or expired token.', 401);
    await ensureSessionActive(token, data.user);
    req.authToken = token;
    req.securityAuthUser = data.user;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function register(req, res) {
  await rateLimit(req, 'register', { limit: 5, windowSeconds: 3600, blockSeconds: 3600 });
  const body = req.body || {};
  const email = cleanEmail(body.email);
  const password = validatePassword(body.password);
  const role = normalizePublicRole(body.role);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw fail('A valid email address is required.', 400);

  const metadata = {
    role,
    full_name: String(body.full_name || body.name || body.owner_name || '').trim().slice(0, 120) || undefined,
    name: String(body.name || body.full_name || body.owner_name || '').trim().slice(0, 120) || undefined,
    owner_name: String(body.owner_name || '').trim().slice(0, 120) || undefined,
    phone: String(body.phone || body.mobile || '').trim().slice(0, 30) || undefined,
    mobile: String(body.mobile || body.phone || '').trim().slice(0, 30) || undefined,
  };

  const existing = await findAuthUserByEmail(email);
  if (existing?.email_confirmed_at || existing?.confirmed_at) {
    await audit(req, 'register.duplicate', false, { email });
    throw fail('Account already exists. Please log in instead.', 409);
  }

  let authUser = existing;
  if (existing?.id) {
    const currentProfile = await getProfile(existing.id).catch(() => null);
    const safeRole = currentProfile?.role ? normalizeRole(currentProfile.role) : role;
    const updated = await db.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata || {}), ...metadata, role: safeRole },
    });
    if (updated.error) throw fail(cleanMessage(updated.error, 'Could not update account.'), 400);
    authUser = updated.data.user;
  } else {
    const created = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
    if (created.error) throw fail(cleanMessage(created.error, 'Could not create account.'), 400);
    authUser = created.data.user;
  }

  const login = await supabase.auth.signInWithPassword({ email, password });
  if (login.error || !login.data?.session) throw fail(cleanMessage(login.error, 'Could not create login session.'), 400);
  const profile = await upsertProfile(login.data.user || authUser, { ...metadata, referral_code: body.referral_code, role });
  const challenge = await createOtpChallenge({
    email,
    session: login.data.session,
    profile,
    authUser: login.data.user || authUser,
    purpose: 'register',
    role: profile.role,
  });
  await audit(req, 'register.started', true, { email, userId: authUser.id, role: profile.role });
  return res.status(201).json(challenge);
}

async function login(req, res) {
  await rateLimit(req, 'login', { limit: 10, windowSeconds: 900, blockSeconds: 1800 });
  const email = cleanEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const requestedRole = normalizeRole(req.body?.role || 'user');
  if (!email || !password) throw fail('Email and password are required.', 400);

  let result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error && /email not confirmed/i.test(cleanMessage(result.error, ''))) {
    const existing = await findAuthUserByEmail(email).catch(() => null);
    const profile = existing?.id ? await getProfile(existing.id).catch(() => null) : null;
    if (existing?.id && profile) {
      await db.auth.admin.updateUserById(existing.id, { email_confirm: true });
      result = await supabase.auth.signInWithPassword({ email, password });
    }
  }

  if (result.error || !result.data?.session || !result.data?.user) {
    await audit(req, 'login.password', false, { email, role: requestedRole });
    throw fail('Invalid email or password.', 401);
  }

  const profile = await upsertProfile(result.data.user);
  const actualRole = normalizeRole(profile.role || result.data.user.user_metadata?.role);
  if (['blocked', 'deactivated'].includes(String(profile.status || '').toLowerCase())) {
    await db.auth.admin.signOut(result.data.session.access_token, 'global').catch(() => null);
    await audit(req, 'login.account_disabled', false, { email, userId: result.data.user.id, role: actualRole });
    throw fail('This account is not active. Contact SE7EN FIT support.', 403);
  }

  const roleAllowed = requestedRole === actualRole || (requestedRole === 'admin' && ['admin', 'super_admin'].includes(actualRole));
  if (!roleAllowed) {
    await db.auth.admin.signOut(result.data.session.access_token, 'local').catch(() => null);
    throw fail(actualRole === 'gym_owner' ? 'Use the gym owner login for this account.' : 'Use the correct login for this account.', 403);
  }

  const challenge = await createOtpChallenge({
    email,
    session: result.data.session,
    profile,
    authUser: result.data.user,
    purpose: 'login',
    role: actualRole,
  });
  await audit(req, 'login.password', true, { email, userId: result.data.user.id, role: actualRole });
  return res.json(challenge);
}

async function verifyOtp(req, res) {
  await rateLimit(req, 'otp_verify', { limit: 8, windowSeconds: 900, blockSeconds: 1800 });
  const email = cleanEmail(req.body?.email);
  const otp = req.body?.otp_code || req.body?.otpCode || req.body?.otp;
  const purpose = req.body?.purpose === 'register' ? 'register' : 'login';
  if (!email || !/^\d{6}$/.test(String(otp || '').trim())) throw fail('Email and a six-digit code are required.', 400);

  try {
    const challenge = await consumeOtpChallenge(email, otp, purpose);
    const session = decryptJson(challenge.session_payload);
    if (!session?.access_token || !session?.refresh_token) throw fail('Login session expired. Please log in again.', 400);
    const verified = await db.auth.getUser(session.access_token);
    if (verified.error || !verified.data?.user) throw fail('Login session expired. Please log in again.', 401);
    await ensureSessionActive(session.access_token, verified.data.user);
    const profile = await getProfile(verified.data.user.id);
    if (!profile || ['blocked', 'deactivated'].includes(String(profile.status || '').toLowerCase())) {
      await db.auth.admin.signOut(session.access_token, 'global').catch(() => null);
      throw fail('This account is not active. Contact SE7EN FIT support.', 403);
    }
    await audit(req, 'otp.verify', true, { email, userId: verified.data.user.id, role: profile.role });
    return res.json({
      access_token: session.access_token,
      token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: publicUser(profile, verified.data.user),
    });
  } catch (error) {
    await audit(req, 'otp.verify', false, { email });
    throw error;
  }
}

async function resendOtp(req, res) {
  await rateLimit(req, 'otp_resend', { limit: 5, windowSeconds: 900, blockSeconds: 1800 });
  const email = cleanEmail(req.body?.email);
  const purpose = req.body?.purpose === 'register' ? 'register' : 'login';
  if (!email) throw fail('Email is required.', 400);
  const { data, error } = await db.from('auth_otp_challenges').select('*').eq('email', email).eq('purpose', purpose).maybeSingle();
  if (error) throw fail('Could not resend code. Please try again.', 503);
  if (!data) throw fail('No pending verification code. Please start again.', 400);
  if (Date.now() - new Date(data.updated_at || data.created_at).getTime() < 55_000) {
    throw fail('Please wait before requesting another code.', 429);
  }
  const session = decryptJson(data.session_payload);
  const challenge = await createOtpChallenge({
    email,
    session,
    profile: data.profile_payload,
    authUser: data.auth_user_payload,
    purpose,
    role: data.role,
  });
  await audit(req, 'otp.resend', true, { email, role: data.role });
  return res.json(challenge);
}

async function googleLogin(req, res) {
  await rateLimit(req, 'google_login', { limit: 15, windowSeconds: 900, blockSeconds: 900 });
  const idToken = String(req.body?.idToken || '');
  if (!idToken) throw fail('Google ID token is required.', 400);
  const requestedRole = normalizePublicRole(req.body?.role);
  const result = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (result.error || !result.data?.user || !result.data?.session) throw fail(cleanMessage(result.error, 'Google login failed.'), 401);
  const profile = await upsertProfile(result.data.user, { role: requestedRole });
  if (['blocked', 'deactivated'].includes(String(profile.status || '').toLowerCase())) {
    await db.auth.admin.signOut(result.data.session.access_token, 'global').catch(() => null);
    throw fail('This account is not active. Contact SE7EN FIT support.', 403);
  }
  await audit(req, 'login.google', true, { email: result.data.user.email, userId: result.data.user.id, role: profile.role });
  return res.json({
    access_token: result.data.session.access_token,
    token: result.data.session.access_token,
    refresh_token: result.data.session.refresh_token,
    expires_at: result.data.session.expires_at,
    user: publicUser(profile, result.data.user),
  });
}

async function refreshSession(req, res) {
  await rateLimit(req, 'session_refresh', { limit: 30, windowSeconds: 900, blockSeconds: 900 });
  const refreshToken = String(req.body?.refresh_token || req.body?.refreshToken || '');
  if (!refreshToken) throw fail('Refresh token is required.', 400);
  const result = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (result.error || !result.data?.session || !result.data?.user) throw fail('Session expired. Please log in again.', 401);
  const profile = await getProfile(result.data.user.id) || await upsertProfile(result.data.user);
  if (['blocked', 'deactivated'].includes(String(profile.status || '').toLowerCase())) {
    await db.auth.admin.signOut(result.data.session.access_token, 'global').catch(() => null);
    throw fail('This account is not active. Contact SE7EN FIT support.', 403);
  }
  await audit(req, 'session.refresh', true, { email: result.data.user.email, userId: result.data.user.id, role: profile.role });
  return res.json({
    access_token: result.data.session.access_token,
    token: result.data.session.access_token,
    refresh_token: result.data.session.refresh_token,
    expires_at: result.data.session.expires_at,
    user: publicUser(profile, result.data.user),
  });
}

async function logout(req, res) {
  const token = req.authToken || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !req.securityAuthUser) throw fail('Authentication required.', 401);
  const scope = req.body?.scope === 'global' ? 'global' : 'local';
  const result = await db.auth.admin.signOut(token, scope);
  if (result.error) throw fail('Could not end the session. Please try again.', 503);
  await audit(req, 'session.logout', true, {
    email: req.securityAuthUser.email,
    userId: req.securityAuthUser.id,
    scope,
  });
  return res.json({ success: true, scope });
}

async function requestPasswordReset(req, res) {
  await rateLimit(req, 'password_reset_request', { limit: 5, windowSeconds: 3600, blockSeconds: 3600 });
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY || !MAILJET_FROM_EMAIL) {
    throw fail('Password recovery is temporarily unavailable.', 503);
  }
  const email = cleanEmail(req.body?.email);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw fail('A valid email address is required.', 400);
  const user = await findAuthUserByEmail(email);
  if (user?.id) {
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = tokenHash(token, 'password-reset');
    await db.from('password_reset_tokens').delete().eq('user_id', user.id).is('used_at', null);
    const insert = await db.from('password_reset_tokens').insert({
      user_id: user.id,
      email,
      token_hash: hash,
      expires_at: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000).toISOString(),
      requested_ip_hash: hmac(clientIp(req), 'ip'),
    });
    if (insert.error) throw fail('Password recovery is temporarily unavailable.', 503);
    const separator = PASSWORD_RESET_URL.includes('?') ? '&' : '?';
    const link = `${PASSWORD_RESET_URL}${separator}token=${encodeURIComponent(token)}`;
    await sendMailjetMessage({
      email,
      subject: 'Reset your SE7EN FIT password',
      text: `Reset your SE7EN FIT password using this secure link: ${link}. The link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Reset your SE7EN FIT password</h2><p>This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes and can be used once.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#16a34a;color:#fff;text-decoration:none;border-radius:10px">Reset password</a></p><p>If you did not request this, ignore this email.</p></div>`,
    });
    await audit(req, 'password_reset.request', true, { email, userId: user.id });
  } else {
    await audit(req, 'password_reset.request_unknown', true, { email });
  }
  return res.status(202).json({ success: true, message: 'If an account exists, a reset link will be sent.' });
}

async function confirmPasswordReset(req, res) {
  await rateLimit(req, 'password_reset_confirm', { limit: 8, windowSeconds: 1800, blockSeconds: 3600 });
  const token = String(req.body?.reset_token || req.body?.resetToken || req.body?.token || '').trim();
  const password = validatePassword(req.body?.new_password || req.body?.newPassword);
  if (token.length < 32 || token.length > 200) throw fail('Reset link is invalid or expired.', 400);
  const hash = tokenHash(token, 'password-reset');
  const { data, error } = await db.from('password_reset_tokens').select('*').eq('token_hash', hash).maybeSingle();
  if (error || !data || data.used_at || new Date(data.expires_at).getTime() <= Date.now()) {
    throw fail('Reset link is invalid or expired.', 400);
  }
  const updated = await db.auth.admin.updateUserById(data.user_id, {
    password,
    app_metadata: { password_changed_at: nowIso() },
  });
  if (updated.error) throw fail(cleanMessage(updated.error, 'Could not update password.'), 400);
  const used = await db.from('password_reset_tokens').update({ used_at: nowIso() }).eq('token_id', data.token_id).is('used_at', null).select('token_id').maybeSingle();
  if (used.error || !used.data) throw fail('Reset link was already used.', 409);
  await db.rpc('revoke_user_auth_sessions', { p_user_id: data.user_id }).catch(() => null);
  await db.from('password_reset_tokens').delete().eq('user_id', data.user_id).is('used_at', null).catch(() => null);
  await audit(req, 'password_reset.completed', true, { email: data.email, userId: data.user_id });
  return res.json({ success: true, message: 'Password updated. Please log in again.' });
}

const secureAuthHandlers = new Map([
  ['/api/auth/register', register],
  ['/api/auth/login', login],
  ['/api/auth/verify-otp', verifyOtp],
  ['/api/auth/resend-otp', resendOtp],
  ['/api/auth/google', googleLogin],
  ['/api/auth/refresh', refreshSession],
  ['/api/auth/logout', logout],
  ['/api/auth/password-reset/request', requestPasswordReset],
  ['/api/auth/password-reset/confirm', confirmPasswordReset],
]);

const publicAuthPaths = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/google',
  '/api/auth/refresh',
  '/api/auth/password-reset/request',
  '/api/auth/password-reset/confirm',
]);

function patchRouteMethod(method) {
  const previous = express.application[method];
  express.application[method] = function secureRouteRegistration(path, ...handlers) {
    const secureHandler = method === 'post' ? secureAuthHandlers.get(path) : null;
    if (secureHandler) {
      const routeHandlers = publicAuthPaths.has(path)
        ? [wrap(secureHandler)]
        : [sessionGuard, wrap(secureHandler)];
      return previous.call(this, path, ...routeHandlers);
    }
    if (typeof path === 'string' && path.startsWith('/api/')) {
      return previous.call(this, path, sessionGuard, ...handlers);
    }
    return previous.call(this, path, ...handlers);
  };
}

for (const method of ['get', 'post', 'put', 'patch', 'delete']) patchRouteMethod(method);
