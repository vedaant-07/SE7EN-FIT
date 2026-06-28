import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' }));
const today = () => new Date().toISOString().slice(0, 10);

async function user(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Missing bearer token', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Invalid or expired token', 401);
  return data.user;
}
function parseFilter(raw) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function normalizeStep(row) { return row ? { ...row, id: row.log_id, calories_burned: row.calories_burned ?? row.calories ?? 0, created_date: row.created_at } : row; }
function normalizeCardio(row) { return row ? { ...row, id: row.log_id, created_date: row.created_at, updated_date: row.updated_at } : row; }
function cleanStep(body, authUser) {
  const out = { ...body, user_id: authUser.id, date: body.date || today(), source: body.source || 'app' };
  delete out.id; delete out.created_date; delete out.updated_date;
  if (out.calories_burned != null && out.calories == null) out.calories = out.calories_burned;
  return out;
}
function cleanCardio(body, authUser) {
  const out = { ...body, user_id: authUser.id, date: body.date || today(), source: body.source || 'app' };
  delete out.id; delete out.created_date; delete out.updated_date;
  if (out.calories != null && out.calories_burned == null) out.calories_burned = out.calories;
  return out;
}
function register(app) {
  if (app.__se7enfitHealthEntityRoutes) return;
  app.__se7enfitHealthEntityRoutes = true;

  app.get('/api/entities/StepLog', wrap(async (req, res) => {
    const authUser = await user(req); const filter = parseFilter(req.query.filter);
    let q = db.from('step_logs').select('*').eq('user_id', authUser.id);
    if (filter.date) q = q.eq('date', filter.date);
    const { data, error } = await q.order('date', { ascending: false }).limit(Number(req.query.limit || 60));
    if (error) throw fail(error.message, 500);
    res.json((data || []).map(normalizeStep));
  }));
  app.post('/api/entities/StepLog', wrap(async (req, res) => {
    const authUser = await user(req); const payload = cleanStep(req.body || {}, authUser);
    const { data, error } = await db.from('step_logs').insert(payload).select('*').single();
    if (error) throw fail(error.message, 500);
    res.status(201).json(normalizeStep(data));
  }));
  app.put('/api/entities/StepLog/:id', wrap(async (req, res) => {
    const authUser = await user(req); const payload = cleanStep(req.body || {}, authUser);
    const { data, error } = await db.from('step_logs').update(payload).eq('log_id', req.params.id).eq('user_id', authUser.id).select('*').single();
    if (error) throw fail(error.message, 500);
    res.json(normalizeStep(data));
  }));

  app.get('/api/entities/CardioLog', wrap(async (req, res) => {
    const authUser = await user(req); const filter = parseFilter(req.query.filter);
    let q = db.from('cardio_logs').select('*').eq('user_id', authUser.id);
    if (filter.date) q = q.eq('date', filter.date);
    const { data, error } = await q.order('date', { ascending: false }).limit(Number(req.query.limit || 60));
    if (error) throw fail(error.message, 500);
    res.json((data || []).map(normalizeCardio));
  }));
  app.post('/api/entities/CardioLog', wrap(async (req, res) => {
    const authUser = await user(req); const payload = cleanCardio(req.body || {}, authUser);
    const { data, error } = await db.from('cardio_logs').insert(payload).select('*').single();
    if (error) throw fail(error.message, 500);
    res.status(201).json(normalizeCardio(data));
  }));
}
const originalListen = express.application.listen;
express.application.listen = function listenWithHealthEntityRoutes(...args) { register(this); return originalListen.apply(this, args); };
