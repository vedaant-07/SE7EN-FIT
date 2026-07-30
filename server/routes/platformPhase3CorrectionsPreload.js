import crypto from 'crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const MAILJET_FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;
const MAILJET_FROM_NAME = process.env.MAILJET_FROM_NAME || 'SE7EN FIT';
const STAFF_INVITATION_URL = String(process.env.STAFF_INVITATION_URL || '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables for Phase 3 corrections');
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PERMISSIONS = [
  'dashboard:read', 'members:read', 'members:write', 'attendance:read', 'attendance:write',
  'equipment:read', 'equipment:write', 'leads:read', 'leads:write', 'payments:read',
  'payments:write', 'announcements:read', 'announcements:write', 'plans:read', 'plans:write',
  'reports:read', 'settings:write',
];

const ROLE_PERMISSIONS = {
  manager: [...PERMISSIONS],
  receptionist: [
    'dashboard:read', 'members:read', 'members:write', 'attendance:read', 'attendance:write',
    'leads:read', 'leads:write', 'payments:read', 'payments:write', 'announcements:read', 'plans:read',
  ],
  trainer: ['dashboard:read', 'members:read', 'attendance:read', 'announcements:read', 'plans:read'],
  accountant: ['dashboard:read', 'members:read', 'payments:read', 'payments:write', 'reports:read'],
  custom: [],
};

const invitationInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().regex(/^[+0-9()\-\s]{6,24}$/).optional().nullable().or(z.literal('')),
  role: z.enum(['manager', 'receptionist', 'trainer', 'accountant', 'custom']).default('trainer'),
  permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).optional(),
  expires_in_days: z.coerce.number().int().min(1).max(30).default(7),
}).strict();

const fail = (message, status = 400, code = 'request_failed') => Object.assign(new Error(message), { status, code });
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const nowIso = () => new Date().toISOString();
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

function normalizePermissions(role, requested) {
  const values = requested?.length ? requested : ROLE_PERMISSIONS[role] || [];
  return [...new Set(values.filter((permission) => PERMISSIONS.includes(permission)))];
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function requireOwner(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw fail('Login required.', 401, 'auth_required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Your session expired. Please log in again.', 401, 'session_expired');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('user_id,role,status')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw fail('Could not verify account access.', 500, 'profile_lookup_failed');
  if (['blocked', 'deactivated', 'inactive', 'suspended'].includes(String(profile?.status || '').toLowerCase())) {
    throw fail('This account is not active.', 403, 'account_inactive');
  }

  const isAdmin = ['admin', 'super_admin'].includes(String(profile?.role || '').toLowerCase());
  const requestedGymId = String(req.headers['x-gym-id'] || req.query?.gym_id || '').trim();
  if (isAdmin && requestedGymId) {
    const parsed = z.string().uuid().safeParse(requestedGymId);
    if (!parsed.success) throw fail('Invalid gym identifier.', 400, 'invalid_gym_id');
    const { data: gym, error: gymError } = await db.from('gyms').select('*').eq('gym_id', parsed.data).maybeSingle();
    if (gymError) throw fail('Could not load gym.', 500, 'gym_lookup_failed');
    if (!gym) throw fail('Gym not found.', 404, 'gym_not_found');
    return { authUser: data.user, profile, gym, access: 'admin' };
  }

  const { data: owner, error: ownerError } = await db
    .from('gym_owners')
    .select('gym_id')
    .eq('user_id', data.user.id)
    .limit(1)
    .maybeSingle();
  if (ownerError) throw fail('Could not verify gym ownership.', 500, 'owner_lookup_failed');

  let gymId = owner?.gym_id || null;
  if (!gymId) {
    const { data: gymLink, error: linkError } = await db.from('gyms')
      .select('gym_id')
      .or(`owner_user_id.eq.${data.user.id},owner_id.eq.${data.user.id},owner_profile_id.eq.${data.user.id}`)
      .limit(1)
      .maybeSingle();
    if (linkError) throw fail('Could not verify gym ownership.', 500, 'owner_lookup_failed');
    gymId = gymLink?.gym_id || null;
  }
  if (!gymId) throw fail('Only a gym owner can perform this action.', 403, 'owner_required');

  const { data: gym, error: gymError } = await db.from('gyms').select('*').eq('gym_id', gymId).maybeSingle();
  if (gymError) throw fail('Could not load gym.', 500, 'gym_lookup_failed');
  if (!gym) throw fail('Gym not found.', 404, 'gym_not_found');
  if (!['active', 'approved'].includes(String(gym.status || '').toLowerCase())) {
    throw fail('Gym access is not active.', 403, 'gym_not_active');
  }
  return { authUser: data.user, profile, gym, access: 'owner' };
}

async function sendInvitationEmail(invitation, invitationUrl, gymName) {
  if (!invitationUrl || !MAILJET_API_KEY || !MAILJET_SECRET_KEY || !MAILJET_FROM_EMAIL) return false;
  const authorization = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
  const safeGym = escapeHtml(gymName);
  const safeRole = escapeHtml(invitation.role);
  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Messages: [{
        From: { Email: MAILJET_FROM_EMAIL, Name: MAILJET_FROM_NAME },
        To: [{ Email: invitation.email, Name: invitation.name || undefined }],
        Subject: `${gymName} invited you to SE7EN FIT`,
        TextPart: `You have been invited as ${invitation.role}. Open this secure link before ${new Date(invitation.expires_at).toLocaleString('en-IN')}: ${invitationUrl}`,
        HTMLPart: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>SE7EN FIT gym staff invitation</h2><p>${safeGym} invited you as <strong>${safeRole}</strong>.</p><p><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;padding:12px 18px;background:#84cc16;color:#111;text-decoration:none;font-weight:700">Accept invitation</a></p><p>This link expires on ${new Date(invitation.expires_at).toLocaleString('en-IN')}.</p></div>`,
      }],
    }),
  });
  return response.ok;
}

function register(app) {
  if (app.__se7enfitPlatformPhase3Corrections) return;
  app.__se7enfitPlatformPhase3Corrections = true;

  app.post('/api/gym-owner/platform/staff/invitations', wrap(async (req, res) => {
    const context = await requireOwner(req);
    const input = invitationInput.parse(req.body || {});
    const permissions = normalizePermissions(input.role, input.permissions);
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + input.expires_in_days * 86_400_000).toISOString();

    await db.from('gym_staff_invitations')
      .update({ status: 'revoked', revoked_at: nowIso(), updated_at: nowIso() })
      .eq('gym_id', context.gym.gym_id)
      .eq('email', input.email)
      .eq('status', 'pending');

    const { data, error } = await db.from('gym_staff_invitations').insert({
      gym_id: context.gym.gym_id,
      email: input.email,
      name: input.name || null,
      phone: input.phone || null,
      role: input.role,
      permissions,
      token_hash: hashToken(rawToken),
      status: 'pending',
      expires_at: expiresAt,
      created_by: context.authUser.id,
    }).select('invitation_id,gym_id,email,name,phone,role,permissions,status,expires_at,created_by,created_at,updated_at').single();
    if (error) throw fail('Staff invitation could not be created.', error.code === '23505' ? 409 : 500, 'staff_invitation_create_failed');

    const invitationPath = `/gym-management/staff/accept?token=${encodeURIComponent(rawToken)}`;
    const invitationUrl = STAFF_INVITATION_URL
      ? `${STAFF_INVITATION_URL}${STAFF_INVITATION_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(rawToken)}`
      : null;
    const emailed = await sendInvitationEmail(data, invitationUrl, context.gym.name).catch(() => false);

    res.status(201).json({
      item: data,
      delivery: emailed ? 'email' : 'manual',
      invitation_url: invitationUrl,
      invitation_path: invitationPath,
      configuration_required: !STAFF_INVITATION_URL,
    });
  }));

  app.delete('/api/gym-owner/platform/staff/:id', wrap(async (req, res) => {
    const context = await requireOwner(req);
    const id = z.string().uuid().parse(req.params.id);
    const { data: current, error: lookupError } = await db.from('gym_staff')
      .select('id,user_id,status')
      .eq('id', id)
      .eq('gym_id', context.gym.gym_id)
      .maybeSingle();
    if (lookupError) throw fail('Could not load staff member.', 500, 'staff_lookup_failed');
    if (!current) throw fail('Staff member not found.', 404, 'staff_not_found');

    const { data, error } = await db.from('gym_staff')
      .update({ status: 'removed', updated_at: nowIso() })
      .eq('id', id)
      .eq('gym_id', context.gym.gym_id)
      .select('*')
      .single();
    if (error) throw fail('Staff access could not be removed.', 500, 'staff_remove_failed');

    if (current.user_id) {
      await db.from('user_roles')
        .delete()
        .eq('user_id', current.user_id)
        .eq('role', 'staff')
        .eq('gym_id', context.gym.gym_id);
      const { data: profile } = await db.from('profiles').select('role').eq('user_id', current.user_id).maybeSingle();
      if (profile?.role === 'staff') {
        await db.from('profiles').update({ role: 'user', updated_at: nowIso() }).eq('user_id', current.user_id);
      }
      await db.rpc('revoke_user_auth_sessions', { p_user_id: current.user_id }).catch(() => null);
    }

    res.json({ item: data, removed: true });
  }));

  app.use('/api/gym-owner/platform', (error, _req, res, next) => {
    if (!error) return next();
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', code: 'validation_failed', fields: error.flatten().fieldErrors });
    }
    const status = Number(error?.status || 500);
    if (status >= 500) console.error('[platform-phase3-corrections] request failed:', error);
    return res.status(status).json({
      error: status >= 500 ? 'The server could not complete this request.' : String(error?.message || 'Request failed'),
      code: error?.code || 'request_failed',
    });
  });
}

const originalListen = express.application.listen;
express.application.listen = function listenWithPlatformPhase3Corrections(...args) {
  register(this);
  return originalListen.apply(this, args);
};
