import crypto from 'crypto';
import express from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const GENERAL_WINDOW_MS = 5 * 60 * 1000;
const GENERAL_LIMIT = Number(process.env.API_RATE_LIMIT || 600);
const AUTH_LIMIT = Number(process.env.AUTH_EDGE_RATE_LIMIT || 120);
const UPLOAD_LIMIT = Number(process.env.UPLOAD_RATE_LIMIT || 30);
const GENERAL_MAX_BYTES = Number(process.env.API_MAX_REQUEST_BYTES || 10 * 1024 * 1024);
const AUTH_MAX_BYTES = Number(process.env.AUTH_MAX_REQUEST_BYTES || 1024 * 1024);
const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_REQUEST_BYTES || 30 * 1024 * 1024);

const buckets = new Map();
const initializedApps = new WeakSet();
const originalUse = express.application.use;

function requestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return req.ip || forwarded || req.socket?.remoteAddress || 'unknown';
}

function requestGroup(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (path.startsWith('/api/auth/')) return { name: 'auth', limit: AUTH_LIMIT };
  if (path.startsWith('/api/uploads/') || path.includes('/upload')) return { name: 'upload', limit: UPLOAD_LIMIT };
  return { name: 'general', limit: GENERAL_LIMIT };
}

function requestByteLimit(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (path.startsWith('/api/auth/')) return AUTH_MAX_BYTES;
  if (path.startsWith('/api/uploads/') || path.includes('/upload')) return UPLOAD_MAX_BYTES;
  return GENERAL_MAX_BYTES;
}

function consumeRateLimit(req, res) {
  const group = requestGroup(req);
  const key = `${group.name}:${requestIp(req)}`;
  const now = Date.now();
  const existing = buckets.get(key);
  const state = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + GENERAL_WINDOW_MS }
    : existing;

  state.count += 1;
  buckets.set(key, state);

  const remaining = Math.max(0, group.limit - state.count);
  res.setHeader('RateLimit-Limit', String(group.limit));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(state.resetAt / 1000)));

  if (state.count <= group.limit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((state.resetAt - now) / 1000))));
  return false;
}

function hardenRequest(req, res, next) {
  const requestId = /^[A-Za-z0-9._:-]{8,128}$/.test(String(req.headers['x-request-id'] || ''))
    ? String(req.headers['x-request-id'])
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), usb=()');
  if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (path.startsWith('/api/auth/') || path.startsWith('/api/admin/')) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
  }

  if (req.method === 'TRACE' || req.method === 'CONNECT') {
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed', request_id: requestId });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  const byteLimit = requestByteLimit(req);
  if (Number.isFinite(contentLength) && contentLength > byteLimit) {
    return res.status(413).json({ error: 'Request payload is too large.', code: 'payload_too_large', request_id: requestId });
  }

  if (!consumeRateLimit(req, res)) {
    return res.status(429).json({ error: 'Too many requests. Please try again shortly.', code: 'rate_limited', request_id: requestId });
  }

  return next();
}

function initializeApp(app) {
  if (initializedApps.has(app)) return;
  initializedApps.add(app);
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  originalUse.call(app, hardenRequest);
}

express.application.use = function useWithRuntimeSecurity(...args) {
  initializeApp(this);
  return originalUse.apply(this, args);
};

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, state] of buckets.entries()) {
    if (state.resetAt <= now) buckets.delete(key);
  }
}, GENERAL_WINDOW_MS);
cleanupTimer.unref?.();
