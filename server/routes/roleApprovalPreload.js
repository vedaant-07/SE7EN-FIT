import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' }));
const cleanEmail = (v) => String(v || '').trim().toLowerCase();
const cleanPhone = (v) => {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};
const normalizeRole = (role) => {
  const value = String(role || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gym_owner', 'gymowner'].includes(value)) return 'gym_owner';
  if (['admin', 'super_admin', 'superadmin'].includes(value)) return 'admin';
  return 'user';
};
const normalizeStatus = (status, role) => {
  const value = String(status || (role === 'gym_owner' ? 'pending' : 'active')).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['approved', 'active', 'enabled'].includes(value)) return 'active';
  if (['disabled', 'inactive', 'suspended', 'deactivated'].includes(value)) return 'deactivated';
  if (['blocked', 'banned'].includes(value)) return 'blocked';
  return 'pending';
};
const specialEmail = () => cleanEmail(process.env.SPECIAL_GYM_OWNER_EMAIL || process.env.VITE_SPECIAL_GYM_OWNER_EMAIL || '');
const specialPhone = () => cleanPhone(process.env.SPECIAL_GYM_OWNER_PHONE || process.env.VITE_SPECIAL_GYM_OWNER_PHONE || '');
const isSpecialOwner = (body = {}) => {
  const email = cleanEmail(body.email);
  const phone = cleanPhone(body.phone || body.mobile || body.identifier || body.email);
  return Boolean((specialEmail() && email === specialEmail()) || (specialPhone() && phone === specialPhone()));
};

async function findAuthUserByEmail(email) {
  const target = cleanEmail(email);
  let page = 1;
  while (page <= 10) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const found = (data?.users || []).find((user) => cleanEmail(user.email) === target);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 1000) return null;
    page += 1;
  }
  return null;
}

async function patchProfileStatus(email, role, status) {
  const authUser = await findAuthUserByEmail(email);
  if (!authUser?.id) return null;
  const patch = { role, status, source: role === 'gym_owner' ? 'gym_owner' : 'app', updated_at: new Date().toISOString() };
  const { data, error } = await db.from('profiles').update(patch).eq('user_id', authUser.id).select('*').maybeSingle();
  if (error) throw fail(error.message, 500);
  await db.from('user_roles').upsert({ user_id: authUser.id, role }, { onConflict: 'user_id,role' }).catch(() => null);
  return data;
}

async function patchOtpProfilePayload(email, purpose, profile) {
  if (!profile) return;
  await db.from('auth_otp_challenges').update({ profile_payload: profile, role: profile.role, updated_at: new Date().toISOString() }).eq('email', cleanEmail(email)).eq('purpose', purpose).catch(() => null);
}

function patchAuthRouteRegistration() {
  if (express.application.__se7enfitRoleApprovalPostPatch) return;
  express.application.__se7enfitRoleApprovalPostPatch = true;
  const originalPost = express.application.post;

  express.application.post = function patchedPost(path, ...handlers) {
    if (path === '/api/auth/register' || path === '/api/auth/google') {
      const pre = async (req, res, next) => {
        const requestedRole = normalizeRole(req.body?.role);
        const role = requestedRole === 'gym_owner' || isSpecialOwner(req.body) ? 'gym_owner' : requestedRole;
        req.body = { ...(req.body || {}), role };
        const originalJson = res.json.bind(res);
        res.json = (payload) => {
          Promise.resolve().then(async () => {
            const purpose = path === '/api/auth/register' ? 'register' : 'login';
            const email = cleanEmail(req.body?.email || payload?.email || payload?.user?.email);
            if (!email) return;
            const status = role === 'gym_owner' ? 'pending' : 'active';
            const profile = await patchProfileStatus(email, role, status);
            await patchOtpProfilePayload(email, purpose, profile);
          }).catch((err) => console.error('[role-approval] auth patch failed:', err?.message || err)).finally(() => originalJson(payload));
          return res;
        };
        next();
      };
      return originalPost.call(this, path, pre, ...handlers);
    }

    if (path === '/api/auth/login') {
      const pre = async (req, _res, next) => {
        try {
          if (isSpecialOwner(req.body)) {
            req.body = { ...(req.body || {}), role: 'gym_owner' };
            const email = cleanEmail(req.body.email);
            if (email) await patchProfileStatus(email, 'gym_owner', 'active').catch(() => null);
          }
        } finally { next(); }
      };
      return originalPost.call(this, path, pre, ...handlers);
    }
    return originalPost.call(this, path, ...handlers);
  };
}

async function requireAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Missing bearer token', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Invalid or expired token', 401);
  const profile = await db.from('profiles').select('*').eq('user_id', data.user.id).maybeSingle();
  if (profile.error) throw fail(profile.error.message, 500);
  if (!['admin', 'super_admin'].includes(normalizeRole(profile.data?.role))) throw fail('Admin access required', 403);
  req.user = { id: data.user.id, email: data.user.email };
  req.userProfile = profile.data;
}

function registerAdminRoutes(app) {
  if (app.__se7enfitRoleApprovalRoutes) return;
  app.__se7enfitRoleApprovalRoutes = true;
  app.get('/api/admin/gym-owners', wrap(async (req, res) => {
    await requireAdmin(req);
    const [profiles, owners, gyms] = await Promise.all([db.from('profiles').select('*').eq('role', 'gym_owner').order('created_at', { ascending: false }), db.from('gym_owners').select('*'), db.from('gyms').select('*')]);
    if (profiles.error) throw fail(profiles.error.message, 500);
    const ownerMap = new Map((owners.data || []).map((row) => [row.user_id, row]));
    const gymMap = new Map((gyms.data || []).map((row) => [row.gym_id, row]));
    const items = (profiles.data || []).map((profile) => { const owner = ownerMap.get(profile.user_id) || null; const gym = owner?.gym_id ? gymMap.get(owner.gym_id) || null : (gyms.data || []).find((g) => g.owner_user_id === profile.user_id) || null; return { ...profile, account_status: normalizeStatus(profile.status, profile.role), owner, gym }; });
    res.json({ items });
  }));
  app.patch('/api/admin/gym-owners/:userId/status', wrap(async (req, res) => {
    await requireAdmin(req);
    const status = normalizeStatus(req.body?.status, 'gym_owner');
    const userId = req.params.userId;
    const profileUpdate = await db.from('profiles').update({ status, updated_at: new Date().toISOString() }).eq('user_id', userId).select('*').maybeSingle();
    if (profileUpdate.error) throw fail(profileUpdate.error.message, 500);
    await db.from('gyms').update({ status: status === 'active' ? 'active' : status }).eq('owner_user_id', userId).catch(() => null);
    await db.from('admin_logs').insert({ actor_id: req.user.id, action: `gym_owner.${status}`, entity: 'profiles', entity_id: userId, details: { status } }).catch(() => null);
    res.json({ item: profileUpdate.data, success: true });
  }));
}

patchAuthRouteRegistration();
const originalListen = express.application.listen;
express.application.listen = function listenWithRoleApprovalRoutes(...args) { registerAdminRoutes(this); return originalListen.apply(this, args); };
