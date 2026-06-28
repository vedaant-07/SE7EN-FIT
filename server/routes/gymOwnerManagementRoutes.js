import { app, asyncHandler, supabaseAdmin, fail, one, many, insertRow, listRows } from '../lib/productionCore.js';
import { requireAuth } from '../lib/productionAuth.js';

async function getManagedGym(req) {
  const { data, error } = await supabaseAdmin.from('gyms').select('*').eq('owner_user_id', req.user.id).limit(1);
  if (error) throw fail(error.message, 500);
  if (data?.[0]) return data[0];
  const staff = await supabaseAdmin.from('gym_staff').select('gyms(*)').eq('user_id', req.user.id).eq('status', 'active').limit(1);
  if (staff.error) throw fail(staff.error.message, 500);
  return staff.data?.[0]?.gyms || null;
}
async function requireGym(req) {
  const gym = await getManagedGym(req);
  if (!gym) throw fail('Gym owner or gym staff access required', 403);
  return gym;
}

function crud(base, table, idColumn, extra = () => ({})) {
  app.get(`/api/gym-owner/${base}`, requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    many(res, await listRows(table, (q) => q.eq('gym_id', gym.gym_id).order('created_at', { ascending: false })));
  }));
  app.post(`/api/gym-owner/${base}`, requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    one(res, await insertRow(table, { gym_id: gym.gym_id, created_by: req.user.id, ...(req.body || {}), ...extra(req.body || {}) }));
  }));
  app.patch(`/api/gym-owner/${base}/:id`, requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    const { data, error } = await supabaseAdmin.from(table).update(req.body || {}).eq(idColumn, req.params.id).eq('gym_id', gym.gym_id).select('*').single();
    if (error) throw fail(error.message, 500);
    one(res, data);
  }));
  app.delete(`/api/gym-owner/${base}/:id`, requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    const { error } = await supabaseAdmin.from(table).delete().eq(idColumn, req.params.id).eq('gym_id', gym.gym_id);
    if (error) throw fail(error.message, 500);
    res.json({ success: true });
  }));
}

export function registerGymOwnerManagementRoutes() {
  crud('plans', 'gym_plans', 'plan_id', (b) => ({ active: b.active !== false, features: b.features || [] }));
  crud('classes', 'gym_classes', 'class_id', (b) => ({ status: b.status || 'active', metadata: b.metadata || {} }));
  crud('reviews', 'gym_reviews', 'review_id', (b) => ({ status: b.status || 'published', source: 'gym_owner', rating: Number(b.rating || 5) }));
  crud('workout-plans', 'workout_plans', 'plan_id', (b) => ({ visibility: b.visibility || 'gym', plan_data: b.plan_data || b.data || {} }));
  crud('diet-plans', 'diet_plans', 'plan_id', (b) => ({ visibility: b.visibility || 'gym', plan_data: b.plan_data || b.data || {} }));

  app.get('/api/gym-owner/staff', requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    many(res, await listRows('gym_staff', (q) => q.eq('gym_id', gym.gym_id).order('created_at', { ascending: false })));
  }));
  app.post('/api/gym-owner/staff', requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    one(res, await insertRow('gym_staff', { gym_id: gym.gym_id, user_id: req.body?.user_id, role: req.body?.role || 'staff', permissions: req.body?.permissions || {}, status: req.body?.status || 'active' }));
  }));
  app.patch('/api/gym-owner/staff/:id', requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    const { data, error } = await supabaseAdmin.from('gym_staff').update(req.body || {}).eq('id', req.params.id).eq('gym_id', gym.gym_id).select('*').single();
    if (error) throw fail(error.message, 500);
    one(res, data);
  }));
  app.delete('/api/gym-owner/staff/:id', requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    await supabaseAdmin.from('gym_staff').delete().eq('id', req.params.id).eq('gym_id', gym.gym_id);
    res.json({ success: true });
  }));

  app.get('/api/gym-owner/reports', requireAuth, asyncHandler(async (req, res) => {
    const gym = await requireGym(req);
    const tables = { members: 'gym_memberships', leads: 'gym_leads', attendance: 'gym_attendance_logs', ads: 'advertisements', plans: 'gym_plans' };
    const metrics = {};
    for (const [key, table] of Object.entries(tables)) {
      const { count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).eq('gym_id', gym.gym_id);
      metrics[key] = count || 0;
    }
    one(res, { gym_id: gym.gym_id, metrics });
  }));
}
