import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' }));
const list = (res, items) => res.json({ items: items || [] });
const one = (res, item) => res.json({ item });

async function requireAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Missing bearer token', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Invalid or expired token', 401);
  const profile = await db.from('profiles').select('*').eq('user_id', data.user.id).maybeSingle();
  if (profile.error) throw fail(profile.error.message, 500);
  const role = String(profile.data?.role || '').toLowerCase();
  if (!['admin', 'super_admin'].includes(role)) throw fail('Admin access required', 403);
  req.user = { id: data.user.id, email: data.user.email };
  req.userProfile = profile.data;
  return profile.data;
}
async function audit(req, action, entity, entityId, details = {}) {
  await db.from('admin_logs').insert({ actor_id: req.user?.id || null, action, entity, entity_id: entityId ? String(entityId) : null, details }).catch(() => null);
}

function register(app) {
  if (app.__se7enfitAdminExtraRoutes) return;
  app.__se7enfitAdminExtraRoutes = true;

  app.get('/api/admin/support/tickets/:id', wrap(async (req, res) => {
    await requireAdmin(req);
    const row = await db.from('support_tickets').select('*').eq('id', req.params.id).maybeSingle();
    if (row.error) throw fail(row.error.message, 500);
    if (!row.data) throw fail('Ticket not found', 404);
    await db.from('support_tickets').update({ is_read: true }).eq('id', req.params.id).catch(() => null);
    one(res, row.data);
  }));

  app.get('/api/admin/support/tickets/:id/messages', wrap(async (req, res) => {
    await requireAdmin(req);
    const rows = await db.from('ticket_messages').select('*').eq('ticket_id', req.params.id).order('created_at');
    if (rows.error) throw fail(rows.error.message, 500);
    list(res, rows.data || []);
  }));

  app.post('/api/admin/support/tickets/:id/messages', wrap(async (req, res) => {
    await requireAdmin(req);
    const body = String(req.body?.body || req.body?.message || '').trim();
    if (!body) throw fail('Message is required', 400);
    const saved = await db.from('ticket_messages').insert({ ticket_id: req.params.id, author_id: req.user.id, body, is_internal: Boolean(req.body?.is_internal) }).select('*').single();
    if (saved.error) throw fail(saved.error.message, 500);
    if (!req.body?.is_internal) await db.from('support_tickets').update({ status: 'open' }).eq('id', req.params.id).in('status', ['new', 'pending']);
    await audit(req, req.body?.is_internal ? 'ticket.note' : 'ticket.reply', 'support_tickets', req.params.id);
    one(res, saved.data);
  }));

  app.delete('/api/admin/support/tickets/:id', wrap(async (req, res) => {
    await requireAdmin(req);
    const deleted = await db.from('support_tickets').delete().eq('id', req.params.id);
    if (deleted.error) throw fail(deleted.error.message, 500);
    await audit(req, 'ticket.delete', 'support_tickets', req.params.id);
    res.json({ success: true });
  }));

  app.get('/api/admin/payments', wrap(async (req, res) => {
    await requireAdmin(req);
    const [memberships, gyms, profiles] = await Promise.all([
      db.from('gym_memberships').select('*').order('created_at', { ascending: false }).limit(500),
      db.from('gyms').select('gym_id,name,pricing,status'),
      db.from('profiles').select('user_id,email,full_name,phone'),
    ]);
    if (memberships.error) throw fail(memberships.error.message, 500);
    const gymMap = new Map((gyms.data || []).map((g) => [g.gym_id, g]));
    const profileMap = new Map((profiles.data || []).map((p) => [p.user_id, p]));
    const rows = (memberships.data || []).map((m) => ({ ...m, gym: gymMap.get(m.gym_id) || null, profile: profileMap.get(m.user_id) || null, amount: Number(m.amount || m.price || 0), currency: m.currency || 'INR', payment_status: m.payment_status || (m.status === 'active' ? 'paid' : 'pending') }));
    list(res, rows);
  }));
}

const originalListen = express.application.listen;
express.application.listen = function listenWithAdminExtraRoutes(...args) {
  register(this);
  return originalListen.apply(this, args);
};
