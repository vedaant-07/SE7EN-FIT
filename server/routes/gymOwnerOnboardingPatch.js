import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' }));
const clean = (v) => String(v || '').trim();
const makeCode = (name) => `${clean(name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'GYM'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

async function user(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Missing bearer token', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Invalid or expired token', 401);
  return data.user;
}
function missingColumn(message = '') {
  const match = String(message).match(/'([^']+)' column|column "([^"]+)"/i);
  return match?.[1] || match?.[2] || '';
}
async function saveInsert(table, payload) {
  let body = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    const result = await db.from(table).insert(body).select('*').single();
    if (!result.error) return result.data;
    const column = missingColumn(result.error.message);
    if (!column || !(column in body)) throw fail(result.error.message, 500);
    delete body[column];
  }
  throw fail(`Could not save ${table}`, 500);
}
async function saveUpdate(table, payload, key, value) {
  let body = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    const result = await db.from(table).update(body).eq(key, value).select('*').single();
    if (!result.error) return result.data;
    const column = missingColumn(result.error.message);
    if (!column || !(column in body)) throw fail(result.error.message, 500);
    delete body[column];
  }
  throw fail(`Could not update ${table}`, 500);
}
async function patchedOnboarding(req, res) {
  const authUser = await user(req);
  const body = req.body || {};
  const gymName = clean(body.gym_name || body.name);
  if (!gymName) throw fail('Gym name is required', 400);
  const existingResult = await db.from('gyms').select('*').eq('owner_user_id', authUser.id).limit(1);
  if (existingResult.error) throw fail(existingResult.error.message, 500);
  const existing = existingResult.data?.[0] || null;
  const gymPayload = {
    owner_user_id: authUser.id,
    name: gymName,
    slug: existing?.slug || `${gymName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 6)}`,
    referral_code: existing?.referral_code || body.referral_code || makeCode(gymName),
    phone: body.phone || existing?.phone || null,
    email: body.email || existing?.email || authUser.email,
    address: body.address || existing?.address || null,
    city: body.city || existing?.city || null,
    state: body.state || existing?.state || null,
    pincode: body.pincode || existing?.pincode || null,
    opening_hours: body.opening_hours || existing?.opening_hours || {},
    amenities: body.amenities || body.facilities || existing?.amenities || [],
    pricing: body.pricing || existing?.pricing || {},
    status: existing?.status || 'pending',
    updated_at: new Date().toISOString(),
  };
  const gym = existing?.gym_id ? await saveUpdate('gyms', gymPayload, 'gym_id', existing.gym_id) : await saveInsert('gyms', gymPayload);
  const ownerPayload = {
    user_id: authUser.id,
    gym_id: gym.gym_id,
    owner_name: body.owner_name || authUser.user_metadata?.full_name || authUser.email,
    email: body.email || authUser.email,
    phone: body.phone || authUser.user_metadata?.phone || null,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  };
  const ownerSaved = await db.from('gym_owners').upsert(ownerPayload, { onConflict: 'user_id,gym_id' }).select('*').single();
  if (ownerSaved.error) throw fail(ownerSaved.error.message, 500);
  res.json({ item: { owner: ownerSaved.data, gym } });
}

const originalPost = express.application.post;
express.application.post = function patchOwnerOnboarding(path, ...handlers) {
  if (path === '/api/gym-owners/onboarding' && !this.__se7enfitOwnerOnboardingPatched) {
    this.__se7enfitOwnerOnboardingPatched = true;
    originalPost.call(this, path, wrap(patchedOnboarding));
  }
  return originalPost.call(this, path, ...handlers);
};
