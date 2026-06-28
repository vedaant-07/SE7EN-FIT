import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const reply = (res, item) => res.json({ item });
const list = (res, items) => res.json({ items: items || [] });
const error = (res, err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => error(res, err));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

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
  addCrud(app, 'plans', 'gym_plans', 'plan_id', { active: true });
  addCrud(app, 'classes', 'gym_classes', 'class_id', { status: 'active' });
  addCrud(app, 'reviews', 'gym_reviews', 'review_id', { status: 'published', source: 'gym_owner' });
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
