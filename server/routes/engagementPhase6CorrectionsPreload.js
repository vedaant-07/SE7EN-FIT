import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (message, status = 400, code = 'request_failed') => Object.assign(new Error(message), { status, code });
const cleanText = (value, max = 500) => String(value || '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status >= 500) console.error('[engagement-phase6-corrections]', error);
    res.status(status).json({
      error: status >= 500 ? 'Competition review services are temporarily unavailable.' : error.message,
      code: error?.code || 'request_failed',
    });
  }
};

async function requireAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Login required.', 401, 'auth_required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Your session expired. Please log in again.', 401, 'auth_expired');
  const { data: profile, error: profileError } = await db.from('profiles').select('role,status').eq('user_id', data.user.id).maybeSingle();
  if (profileError) throw fail(profileError.message, 500);
  if (profile?.status && profile.status !== 'active') throw fail('This account is not active.', 403, 'account_inactive');
  if (!['admin', 'super_admin'].includes(String(profile?.role || data.user.user_metadata?.role || '').toLowerCase())) {
    throw fail('Administrator access required.', 403, 'admin_required');
  }
  return { user: data.user, profile: profile || {} };
}

async function attachProfiles(rows, fields) {
  const ids = [...new Set(rows.flatMap((row) => fields.map((field) => row[field])).filter(Boolean))];
  if (!ids.length) return rows;
  const { data, error } = await db.from('profiles').select('user_id,full_name,email,avatar_url,status').in('user_id', ids);
  if (error) throw fail(error.message, 500);
  const profileMap = new Map((data || []).map((profile) => [profile.user_id, profile]));
  return rows.map((row) => ({
    ...row,
    ...Object.fromEntries(fields.map((field) => [`${field.replace(/_user_id$/, '')}_profile`, profileMap.get(row[field]) || null])),
  }));
}

function normalizeLeaderboardPayload(payload) {
  const item = payload?.item;
  if (!item || !Array.isArray(item.entries)) return payload;
  const eligible = item.entries
    .filter((entry) => Number(entry.score || 0) > 0 && entry.integrity_status !== 'review')
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || Number(right.completed_challenges || 0) - Number(left.completed_challenges || 0));
  const ranked = eligible.map((entry, index) => ({ ...entry, rank: index + 1 }));
  const currentOriginal = item.entries.find((entry) => entry.is_current_user);
  const currentRanked = ranked.find((entry) => entry.is_current_user);
  const entries = currentOriginal && !currentRanked
    ? [...ranked, { ...currentOriginal, rank: null }]
    : ranked;
  return {
    ...payload,
    item: {
      ...item,
      entries,
      user_rank: currentRanked?.rank || null,
    },
  };
}

function register(app) {
  if (app.__se7enfitEngagementPhase6CorrectionRoutes) return;
  app.__se7enfitEngagementPhase6CorrectionRoutes = true;

  app.use('/api/engagement/leaderboard', (_req, res, next) => {
    const sendJson = res.json.bind(res);
    res.json = (payload) => sendJson(normalizeLeaderboardPayload(payload));
    next();
  });

  app.get('/api/admin/engagement/integrity-flags', wrap(async (req, res) => {
    await requireAdmin(req);
    let query = db.from('engagement_integrity_flags')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(500, Math.max(1, Number(req.query.limit || 200))));
    if (req.query.status) query = query.eq('status', cleanText(req.query.status, 30));
    if (req.query.severity) query = query.eq('severity', cleanText(req.query.severity, 30));
    const { data, error } = await query;
    if (error) throw fail(error.message, 500);
    res.json({ items: await attachProfiles(data || [], ['user_id', 'reviewed_by']) });
  }));

  app.patch('/api/admin/engagement/integrity-flags/:id', wrap(async (req, res) => {
    const { user } = await requireAdmin(req);
    const status = cleanText(req.body?.status, 20);
    if (!['reviewed', 'dismissed', 'confirmed'].includes(status)) throw fail('Choose a valid review status.', 400, 'invalid_status');
    const { data, error } = await db.from('engagement_integrity_flags').update({
      status,
      reviewed_by: user.id,
      review_notes: cleanText(req.body?.review_notes, 1200) || null,
      reviewed_at: nowIso(),
      updated_at: nowIso(),
    }).eq('flag_id', req.params.id).eq('status', 'open').select('*').maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!data) throw fail('This integrity flag was already reviewed.', 409, 'review_closed');
    res.json({ item: data });
  }));

  app.get('/api/admin/engagement/reports', wrap(async (req, res) => {
    await requireAdmin(req);
    let query = db.from('engagement_abuse_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(500, Math.max(1, Number(req.query.limit || 200))));
    if (req.query.status) query = query.eq('status', cleanText(req.query.status, 30));
    const { data, error } = await query;
    if (error) throw fail(error.message, 500);
    res.json({ items: await attachProfiles(data || [], ['reporter_user_id', 'reported_user_id', 'reviewed_by']) });
  }));

  app.patch('/api/admin/engagement/reports/:id', wrap(async (req, res) => {
    const { user } = await requireAdmin(req);
    const status = cleanText(req.body?.status, 20);
    if (!['reviewing', 'resolved', 'dismissed'].includes(status)) throw fail('Choose a valid report status.', 400, 'invalid_status');
    const { data, error } = await db.from('engagement_abuse_reports').update({
      status,
      reviewed_by: user.id,
      reviewed_at: nowIso(),
      resolution_notes: cleanText(req.body?.resolution_notes, 1200) || null,
      updated_at: nowIso(),
    }).eq('report_id', req.params.id).in('status', ['open', 'reviewing']).select('*').maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!data) throw fail('This report was already closed.', 409, 'review_closed');
    res.json({ item: data });
  }));
}

const originalListen = express.application.listen;
express.application.listen = function listenWithEngagementPhase6Corrections(...args) {
  register(this);
  return originalListen.apply(this, args);
};
