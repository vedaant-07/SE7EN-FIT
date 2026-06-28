import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase backend env vars');
}

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const app = express();
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const allowedOrigins = FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGIN === '*' || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

export const nowIso = () => new Date().toISOString();
export const todayIso = () => nowIso().slice(0, 10);
export const cleanEmail = (email) => String(email || '').trim().toLowerCase();
export const cleanText = (value) => String(value || '').trim();
export const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export const one = (res, item) => res.json({ item });
export const many = (res, items, extra = {}) => res.json({ items: items || [], ...extra });
export function cleanMessage(value, fallback = 'Request failed') {
  const message = String(value?.message || value?.error_description || value?.error || value || '').trim();
  if (!message || message === '{}' || message === '[object Object]') return fallback;
  return message;
}

export function normalizeRole(role) {
  const value = String(role || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gymowner', 'gym_owner'].includes(value)) return 'gym_owner';
  if (['superadmin', 'super_admin'].includes(value)) return 'super_admin';
  if (['admin', 'staff', 'gym_staff'].includes(value)) return value;
  return 'user';
}

export const isAdminProfile = (profile) => ['super_admin', 'admin'].includes(normalizeRole(profile?.role));
export function publicUser(profile = {}, authUser = {}) {
  const meta = authUser.user_metadata || {};
  return {
    id: authUser.id || profile.user_id,
    email: profile.email || authUser.email,
    full_name: profile.full_name || meta.full_name || meta.name || meta.owner_name || authUser.email?.split('@')?.[0] || 'SE7EN FIT User',
    phone: profile.phone || meta.phone || meta.mobile,
    role: normalizeRole(profile.role || meta.role),
    status: profile.status || 'active',
    avatar_url: profile.avatar_url || meta.avatar_url || meta.picture,
  };
}

export async function getSingle(table, buildQuery) {
  const { data, error } = await buildQuery(supabaseAdmin.from(table).select('*')).maybeSingle();
  if (error) throw fail(error.message, 500);
  return data;
}
export async function listRows(table, buildQuery) {
  const { data, error } = await buildQuery(supabaseAdmin.from(table).select('*'));
  if (error) throw fail(error.message, 500);
  return data || [];
}
export async function insertRow(table, payload) {
  const { data, error } = await supabaseAdmin.from(table).insert(payload).select('*').single();
  if (error) throw fail(error.message, 500);
  return data;
}
export async function updateRow(table, payload, key, value) {
  const { data, error } = await supabaseAdmin.from(table).update(payload).eq(key, value).select('*').single();
  if (error) throw fail(error.message, 500);
  return data;
}
