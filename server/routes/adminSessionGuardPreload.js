import crypto from 'crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables for admin session guard');
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function decodeBase64Url(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyAdminSession(token) {
  if (ADMIN_SESSION_SECRET.length < 32) {
    throw fail('Admin billing security is not configured.', 503, 'admin_session_not_configured');
  }
  const [payloadPart, signaturePart, extra] = String(token || '').split('.');
  if (!payloadPart || !signaturePart || extra) return null;
  const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payloadPart).digest('base64url');
  if (!safeEqual(expected, signaturePart)) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart).toString('utf8'));
    if (payload?.k !== 'admin_session') return null;
    if (!Number.isFinite(payload?.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function adminSessionGuard(req, _res, next) {
  try {
    const identity = req.securityAuthUser || req.authUser;
    if (!identity?.id) throw fail('Authentication required.', 401, 'auth_required');
    const payload = verifyAdminSession(req.headers['x-admin-session']);
    if (!payload || payload.sub !== identity.id) {
      throw fail('Your admin verification session expired. Complete admin verification again.', 401, 'admin_session_required');
    }
    const { data, error } = await db.rpc('is_admin', { _user_id: identity.id });
    if (error || data !== true) throw fail('Administrator access required.', 403, 'admin_required');
    req.phase4AdminSession = payload;
    next();
  } catch (error) {
    next(error);
  }
}

function patchMethod(method) {
  const previous = express.application[method];
  express.application[method] = function registerAdminSessionGuard(path, ...handlers) {
    if (typeof path === 'string' && path.startsWith('/api/admin/billing')) {
      return previous.call(this, path, adminSessionGuard, ...handlers);
    }
    return previous.call(this, path, ...handlers);
  };
}

for (const method of ['get', 'post', 'patch', 'put', 'delete']) patchMethod(method);
