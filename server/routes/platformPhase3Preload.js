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
const STAFF_INVITATION_URL = process.env.STAFF_INVITATION_URL || 'https://se7enfit.in/gym-management/staff/accept';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables for gym-management workflows');
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALL_PERMISSIONS = Object.freeze([
  'dashboard:read',
  'members:read',
  'members:write',
  'attendance:read',
  'attendance:write',
  'equipment:read',
  'equipment:write',
  'leads:read',
  'leads:write',
  'payments:read',
  'payments:write',
  'announcements:read',
  'announcements:write',
  'plans:read',
  'plans:write',
  'reports:read',
  'settings:write',
]);

const ROLE_PERMISSIONS = Object.freeze({
  manager: [...ALL_PERMISSIONS],
  receptionist: [
    'dashboard:read', 'members:read', 'members:write', 'attendance:read', 'attendance:write',
    'leads:read', 'leads:write', 'payments:read', 'payments:write', 'announcements:read', 'plans:read',
  ],
  trainer: ['dashboard:read', 'members:read', 'attendance:read', 'announcements:read', 'plans:read'],
  accountant: ['dashboard:read', 'members:read', 'payments:read', 'payments:write', 'reports:read'],
  custom: [],
});

const uuid = z.string().uuid();
const email = z.string().trim().toLowerCase().email().max(254);
const optionalEmail = email.optional().nullable().or(z.literal(''));
const optionalPhone = z.string().trim().regex(/^[+0-9()\-\s]{6,24}$/).optional().nullable().or(z.literal(''));
const optionalText = (max = 500) => z.string().trim().max(max).optional().nullable();
const shortText = (max = 120) => z.string().trim().min(1).max(max);
const staffRole = z.enum(['manager', 'receptionist', 'trainer', 'accountant', 'custom']);
const staffStatus = z.enum(['active', 'inactive', 'suspended', 'removed']);
const billingCycle = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'annual', 'custom']);
const paymentStatus = z.enum(['paid', 'pending', 'failed', 'refunded', 'cancelled']);

const StaffInvitationInput = z.object({
  email,
  name: optionalText(120),
  phone: optionalPhone,
  role: staffRole.default('trainer'),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length).optional(),
  expires_in_days: z.coerce.number().int().min(1).max(30).default(7),
}).strict();

const StaffUpdateInput = z.object({
  name: optionalText(120),
  phone: optionalPhone,
  role: staffRole.optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length).optional(),
  status: staffStatus.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const PlanCreateInput = z.object({
  name: shortText(120),
  price: z.coerce.number().finite().min(0).max(10_000_000),
  billing_cycle: billingCycle,
  duration_days: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  features: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  active: z.boolean().default(true),
}).strict();

const PlanUpdateInput = PlanCreateInput.partial().strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const ManualMemberUpdateInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: optionalEmail,
  phone: optionalPhone,
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
  notes: optionalText(500),
}).strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const AttendanceUpdateInput = z.object({
  check_in_at: z.string().datetime({ offset: true }).optional(),
  check_out_at: z.string().datetime({ offset: true }).optional().nullable(),
  method: z.enum(['manual', 'qr', 'app', 'biometric']).optional(),
  status: z.enum(['checked_in', 'checked_out', 'cancelled']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const PaymentUpdateInput = z.object({
  status: paymentStatus.optional(),
  method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']).optional(),
  notes: optionalText(500),
  payment_reference: z.string().trim().max(120).optional().nullable(),
  paid_at: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const fail = (message, status = 400, code = 'request_failed') => Object.assign(new Error(message), { status, code });
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const nowIso = () => new Date().toISOString();
const cleanEmail = (value) => String(value || '').trim().toLowerCase();
const cleanNullable = (value) => value === undefined ? undefined : value === null || value === '' ? null : value;
const tokenHash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

function publicError(error) {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: { error: 'Invalid input', code: 'validation_failed', fields: error.flatten().fieldErrors },
    };
  }
  const status = Number(error?.status || 500);
  return {
    status,
    body: {
      error: status >= 500 ? 'The server could not complete this request.' : String(error?.message || 'Request failed'),
      code: error?.code || 'request_failed',
    },
  };
}

function normalizePermissions(role, permissions) {
  const source = Array.isArray(permissions) && permissions.length ? permissions : ROLE_PERMISSIONS[role] || [];
  return [...new Set(source.filter((permission) => ALL_PERMISSIONS.includes(permission)))];
}

function can(context, permission) {
  return context.access === 'owner' || context.access === 'admin' || context.permissions.includes(permission);
}

function requirePermission(context, permission) {
  if (!can(context, permission)) throw fail('You do not have permission to perform this action.', 403, 'permission_denied');
}

function requireOwner(context) {
  if (!['owner', 'admin'].includes(context.access)) throw fail('Only the gym owner can perform this action.', 403, 'owner_required');
}

async function requireUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw fail('Login required', 401, 'auth_required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Your session expired. Please log in again.', 401, 'session_expired');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('user_id,email,role,status,full_name,phone')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw fail('Could not verify account access.', 500, 'profile_lookup_failed');
  if (['blocked', 'deactivated', 'disabled', 'inactive', 'suspended'].includes(String(profile?.status || '').toLowerCase())) {
    throw fail('This account is not active.', 403, 'account_inactive');
  }
  return { authUser: data.user, profile, token };
}

async function resolveContext(req) {
  const identity = await requireUser(req);
  const userId = identity.authUser.id;
  const profileRole = String(identity.profile?.role || '').toLowerCase();
  const isAdmin = ['admin', 'super_admin'].includes(profileRole);
  const requestedGymId = String(req.headers['x-gym-id'] || req.query?.gym_id || '').trim();

  if (isAdmin && requestedGymId) {
    const gymId = uuid.parse(requestedGymId);
    const { data: gym, error } = await db.from('gyms').select('*').eq('gym_id', gymId).maybeSingle();
    if (error) throw fail('Could not load gym.', 500, 'gym_lookup_failed');
    if (!gym) throw fail('Gym not found.', 404, 'gym_not_found');
    return { ...identity, gym, access: 'admin', permissions: [...ALL_PERMISSIONS], staff: null };
  }

  const { data: ownerLink, error: ownerError } = await db
    .from('gym_owners')
    .select('gym_id,kyc_status,onboarding_complete')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (ownerError) throw fail('Could not verify gym ownership.', 500, 'owner_lookup_failed');

  let gymId = ownerLink?.gym_id || null;
  let access = ownerLink ? 'owner' : null;
  let staff = null;

  if (!gymId) {
    const { data: staffLink, error: staffError } = await db
      .from('gym_staff')
      .select('id,gym_id,user_id,name,email,phone,role,permissions,status,created_at,updated_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (staffError) throw fail('Could not verify gym staff access.', 500, 'staff_lookup_failed');
    if (staffLink) {
      gymId = staffLink.gym_id;
      access = 'staff';
      staff = staffLink;
    }
  }

  if (!gymId && ['gym_owner', 'owner'].includes(profileRole)) {
    const { data: ownedGym, error: ownedGymError } = await db
      .from('gyms')
      .select('gym_id')
      .or(`owner_user_id.eq.${userId},owner_id.eq.${userId},owner_profile_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ownedGymError) throw fail('Could not verify gym ownership.', 500, 'gym_owner_lookup_failed');
    if (ownedGym) {
      gymId = ownedGym.gym_id;
      access = 'owner';
    }
  }

  if (!gymId) throw fail('This account is not connected to an approved gym.', 403, 'gym_access_required');

  const { data: gym, error: gymError } = await db.from('gyms').select('*').eq('gym_id', gymId).maybeSingle();
  if (gymError) throw fail('Could not load gym.', 500, 'gym_lookup_failed');
  if (!gym) throw fail('Connected gym was not found.', 404, 'gym_not_found');
  if (!isAdmin && !['active', 'approved'].includes(String(gym.status || '').toLowerCase())) {
    throw fail('Gym access is not active yet.', 403, 'gym_not_active');
  }

  const permissions = access === 'staff' ? normalizePermissions(staff.role, staff.permissions) : [...ALL_PERMISSIONS];
  return { ...identity, gym, access: isAdmin ? 'admin' : access, permissions, staff, ownerLink };
}

function permissionForRequest(req) {
  const path = req.path;
  const method = req.method;
  if (path === '/workspace') return 'dashboard:read';
  if (path.startsWith('/collections/')) {
    const resource = path.split('/')[2];
    const map = {
      'app-members': 'members:read', 'manual-members': 'members:read', attendance: 'attendance:read',
      equipment: 'equipment:read', leads: 'leads:read', payments: 'payments:read',
      announcements: 'announcements:read', plans: 'plans:read', staff: 'settings:write',
    };
    return map[resource] || 'dashboard:read';
  }
  if (path.startsWith('/export/')) return 'reports:read';
  if (path === '/profile' && method === 'PATCH') return 'settings:write';
  if (path.startsWith('/manual-members') || path.startsWith('/members/')) return 'members:write';
  if (path.startsWith('/attendance')) return method === 'GET' ? 'attendance:read' : 'attendance:write';
  if (path.startsWith('/equipment')) return method === 'GET' ? 'equipment:read' : 'equipment:write';
  if (path.startsWith('/leads')) return method === 'GET' ? 'leads:read' : 'leads:write';
  if (path.startsWith('/payments')) return method === 'GET' ? 'payments:read' : 'payments:write';
  if (path.startsWith('/announcements')) return method === 'GET' ? 'announcements:read' : 'announcements:write';
  if (path.startsWith('/plans')) return method === 'GET' ? 'plans:read' : 'plans:write';
  if (path.startsWith('/commissions')) return 'reports:read';
  return 'dashboard:read';
}

function parsePage(req, defaultSize = 50) {
  const page = Math.max(1, Math.min(100_000, Number.parseInt(String(req.query.page || '1'), 10) || 1));
  const pageSize = Math.max(1, Math.min(200, Number.parseInt(String(req.query.page_size || defaultSize), 10) || defaultSize));
  const search = String(req.query.search || '').trim().slice(0, 80).replace(/[,%()]/g, ' ');
  const status = String(req.query.status || '').trim().slice(0, 40);
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1, search, status };
}

function pageResult(items, total, page, pageSize) {
  const safeTotal = Number(total || 0);
  return {
    items: items || [],
    page,
    page_size: pageSize,
    total: safeTotal,
    total_pages: Math.max(1, Math.ceil(safeTotal / pageSize)),
  };
}

async function profilesForUserIds(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await db.from('profiles').select('user_id,full_name,email,phone,avatar_url,status').in('user_id', ids);
  if (error) throw fail('Could not load member profiles.', 500, 'member_profiles_load_failed');
  return new Map((data || []).map((profile) => [profile.user_id, profile]));
}

function appMember(membership, profile = {}) {
  return {
    id: membership.membership_id,
    membership_id: membership.membership_id,
    member_type: 'app',
    gym_id: membership.gym_id,
    user_id: membership.user_id,
    full_name: profile.full_name || profile.email || 'SE7EN FIT member',
    name: profile.full_name || profile.email || 'SE7EN FIT member',
    email: profile.email || null,
    phone: profile.phone || null,
    avatar_url: profile.avatar_url || null,
    profile_status: profile.status || null,
    status: membership.status,
    plan_id: membership.plan_id || null,
    starts_at: membership.starts_at || null,
    ends_at: membership.ends_at || null,
    membership_number: membership.membership_number || null,
    joined_at: membership.joined_at,
    referred_by_code: membership.referred_by_code,
    amount: Number(membership.amount || 0),
    currency: membership.currency || 'INR',
    payment_status: membership.payment_status || 'pending',
    metadata: membership.metadata || {},
  };
}

async function loadCollection(context, resource, reqLike = {}) {
  const req = { query: reqLike.query || reqLike };
  const { page, pageSize, from, to, search, status } = parsePage(req, Number(reqLike.defaultSize || 50));
  const gymId = context.gym.gym_id;

  if (resource === 'app-members') {
    let matchingUserIds = null;
    if (search) {
      const { data: matches, error } = await db.from('profiles')
        .select('user_id')
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(5000);
      if (error) throw fail('Could not search app members.', 500, 'member_search_failed');
      matchingUserIds = (matches || []).map((row) => row.user_id);
      if (!matchingUserIds.length) return pageResult([], 0, page, pageSize);
    }
    let query = db.from('gym_memberships').select('*', { count: 'exact' }).eq('gym_id', gymId);
    if (status) query = query.eq('status', status);
    if (matchingUserIds) query = query.in('user_id', matchingUserIds);
    const { data, count, error } = await query.order('joined_at', { ascending: false }).range(from, to);
    if (error) throw fail('Could not load app members.', 500, 'app_members_load_failed');
    const profileMap = await profilesForUserIds((data || []).map((row) => row.user_id));
    return pageResult((data || []).map((row) => appMember(row, profileMap.get(row.user_id) || {})), count, page, pageSize);
  }

  if (resource === 'manual-members') {
    let query = db.from('gym_manual_members').select('*', { count: 'exact' }).eq('gym_id', gymId);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) throw fail('Could not load manual members.', 500, 'manual_members_load_failed');
    return pageResult((data || []).map((row) => ({ ...row, member_type: 'manual', full_name: row.name || 'Manual member' })), count, page, pageSize);
  }

  const definitions = {
    attendance: { table: 'gym_attendance_logs', order: 'check_in_at', permission: 'attendance:read' },
    equipment: { table: 'gym_equipment', order: 'created_at', permission: 'equipment:read', search: ['name', 'category'] },
    leads: { table: 'gym_leads', order: 'created_at', permission: 'leads:read', search: ['name', 'email', 'phone', 'source'] },
    payments: { table: 'gym_payments', order: 'paid_at', permission: 'payments:read', search: ['payment_reference', 'notes'] },
    announcements: { table: 'gym_announcements', order: 'created_at', permission: 'announcements:read', search: ['title', 'body'] },
    plans: { table: 'gym_plans', order: 'created_at', permission: 'plans:read', search: ['name'] },
    staff: { table: 'gym_staff', order: 'created_at', permission: 'settings:write', search: ['name', 'email', 'phone', 'role'] },
  };
  const definition = definitions[resource];
  if (!definition) throw fail('Unknown collection.', 404, 'collection_not_found');
  requirePermission(context, definition.permission);
  if (resource === 'staff') requireOwner(context);

  let query = db.from(definition.table).select('*', { count: 'exact' }).eq('gym_id', gymId);
  if (status) {
    if (resource === 'plans') query = query.eq('active', status === 'active');
    else query = query.eq('status', status);
  }
  if (search && definition.search?.length) {
    query = query.or(definition.search.map((field) => `${field}.ilike.%${search}%`).join(','));
  }
  const { data, count, error } = await query.order(definition.order, { ascending: false, nullsFirst: false }).range(from, to);
  if (error) throw fail('Could not load gym records.', 500, `${resource}_load_failed`);
  return pageResult(data || [], count, page, pageSize);
}

async function loadInvitations(context, limit = 100) {
  requireOwner(context);
  const { data, error } = await db.from('gym_staff_invitations')
    .select('invitation_id,gym_id,email,name,phone,role,permissions,status,expires_at,accepted_by,accepted_at,revoked_at,created_by,created_at,updated_at')
    .eq('gym_id', context.gym.gym_id)
    .order('created_at', { ascending: false })
    .limit(Math.min(500, Math.max(1, Number(limit || 100))));
  if (error) throw fail('Could not load staff invitations.', 500, 'staff_invitations_load_failed');
  return data || [];
}

async function loadCommissionSummary(context) {
  requirePermission(context, 'reports:read');
  const { data, error } = await db.from('gym_commission_ledger')
    .select('commission_amount,status,currency')
    .eq('gym_id', context.gym.gym_id)
    .range(0, 9999);
  if (error) throw fail('Could not load commission summary.', 500, 'commissions_load_failed');
  return (data || []).reduce((summary, row) => {
    const rowStatus = String(row.status || 'pending');
    const amount = Number(row.commission_amount || 0);
    summary.total += amount;
    summary[rowStatus] = Number(summary[rowStatus] || 0) + amount;
    summary.currency = row.currency || summary.currency;
    return summary;
  }, { total: 0, pending: 0, approved: 0, paid: 0, reversed: 0, currency: 'INR' });
}

async function loadWorkspace(context) {
  const jobs = {
    appMembers: can(context, 'members:read') ? loadCollection(context, 'app-members', { page: 1, page_size: 50 }) : Promise.resolve(pageResult([], 0, 1, 50)),
    manualMembers: can(context, 'members:read') ? loadCollection(context, 'manual-members', { page: 1, page_size: 50 }) : Promise.resolve(pageResult([], 0, 1, 50)),
    attendance: can(context, 'attendance:read') ? loadCollection(context, 'attendance', { page: 1, page_size: 100 }) : Promise.resolve(pageResult([], 0, 1, 100)),
    equipment: can(context, 'equipment:read') ? loadCollection(context, 'equipment', { page: 1, page_size: 100 }) : Promise.resolve(pageResult([], 0, 1, 100)),
    leads: can(context, 'leads:read') ? loadCollection(context, 'leads', { page: 1, page_size: 100 }) : Promise.resolve(pageResult([], 0, 1, 100)),
    payments: can(context, 'payments:read') ? loadCollection(context, 'payments', { page: 1, page_size: 100 }) : Promise.resolve(pageResult([], 0, 1, 100)),
    announcements: can(context, 'announcements:read') ? loadCollection(context, 'announcements', { page: 1, page_size: 100 }) : Promise.resolve(pageResult([], 0, 1, 100)),
    plans: can(context, 'plans:read') ? loadCollection(context, 'plans', { page: 1, page_size: 100 }) : Promise.resolve(pageResult([], 0, 1, 100)),
    staff: ['owner', 'admin'].includes(context.access) ? loadCollection(context, 'staff', { page: 1, page_size: 100 }) : Promise.resolve(pageResult([], 0, 1, 100)),
    invitations: ['owner', 'admin'].includes(context.access) ? loadInvitations(context, 100) : Promise.resolve([]),
    commission: can(context, 'reports:read') ? loadCommissionSummary(context) : Promise.resolve({ total: 0, pending: 0, approved: 0, paid: 0, reversed: 0, currency: 'INR' }),
  };
  const result = await Promise.all(Object.values(jobs));
  const [appMembers, manualMembers, attendance, equipment, leads, payments, announcements, plans, staff, invitations, commission] = result;
  const members = [...appMembers.items, ...manualMembers.items]
    .sort((a, b) => new Date(b.joined_at || b.created_at || 0) - new Date(a.joined_at || a.created_at || 0));

  return {
    gym: {
      ...context.gym,
      id: context.gym.gym_id,
      gym_id: context.gym.gym_id,
      owner_id: context.gym.owner_user_id || context.gym.owner_id || context.gym.owner_profile_id,
    },
    access: context.access,
    permissions: context.permissions,
    permission_presets: ROLE_PERMISSIONS,
    staff_profile: context.staff,
    members,
    app_members: appMembers.items,
    manual_members: manualMembers.items,
    attendance: attendance.items,
    equipment: equipment.items,
    leads: leads.items,
    payments: payments.items,
    announcements: announcements.items,
    plans: plans.items,
    staff: staff.items,
    staff_invitations: invitations,
    commissions: [],
    commission_summary: commission,
    page_info: {
      app_members: appMembers,
      manual_members: manualMembers,
      attendance,
      equipment,
      leads,
      payments,
      announcements,
      plans,
      staff,
    },
    generated_at: nowIso(),
  };
}

async function sendStaffInvitationEmail(invitation, invitationUrl, gymName) {
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY || !MAILJET_FROM_EMAIL) return false;
  const authorization = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Messages: [{
        From: { Email: MAILJET_FROM_EMAIL, Name: MAILJET_FROM_NAME },
        To: [{ Email: invitation.email, Name: invitation.name || undefined }],
        Subject: `${gymName} invited you to SE7EN FIT`,
        TextPart: `You have been invited as ${invitation.role}. Open this secure link before ${new Date(invitation.expires_at).toLocaleString('en-IN')}: ${invitationUrl}`,
        HTMLPart: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>SE7EN FIT gym staff invitation</h2><p>${gymName} invited you as <strong>${invitation.role}</strong>.</p><p><a href="${invitationUrl}" style="display:inline-block;padding:12px 18px;background:#84cc16;color:#111;text-decoration:none;font-weight:700">Accept invitation</a></p><p>This link expires on ${new Date(invitation.expires_at).toLocaleString('en-IN')}.</p></div>`,
      }],
    }),
  });
  return response.ok;
}

function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(rows, columns) {
  const header = columns.map(([label]) => csvCell(label)).join(',');
  const body = rows.map((row) => columns.map(([, key]) => csvCell(typeof key === 'function' ? key(row) : row[key])).join(',')).join('\r\n');
  return `\ufeff${header}${body ? `\r\n${body}` : ''}`;
}

async function allCollectionItems(context, resource, limit) {
  const items = [];
  let page = 1;
  while (items.length < limit) {
    const result = await loadCollection(context, resource, { page, page_size: Math.min(200, limit - items.length) });
    items.push(...result.items);
    if (page >= result.total_pages || !result.items.length) break;
    page += 1;
  }
  return items.slice(0, limit);
}

function register(app) {
  if (app.__se7enfitPlatformPhase3Routes) return;
  app.__se7enfitPlatformPhase3Routes = true;

  const rateBuckets = new Map();
  app.use('/api/gym-owner/platform', wrap(async (req, res, next) => {
    const identity = String(req.headers.authorization || req.ip || 'anonymous').slice(-96);
    const minute = Math.floor(Date.now() / 60_000);
    const key = `${identity}:${minute}`;
    const count = Number(rateBuckets.get(key) || 0) + 1;
    rateBuckets.set(key, count);
    if (rateBuckets.size > 10_000) {
      for (const bucketKey of rateBuckets.keys()) {
        const bucketMinute = Number(bucketKey.split(':').at(-1));
        if (!Number.isFinite(bucketMinute) || bucketMinute < minute - 2) rateBuckets.delete(bucketKey);
      }
    }
    if (count > 180) throw fail('Too many requests. Please wait a minute.', 429, 'rate_limited');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    if (req.method === 'POST' && req.path === '/staff/invitations/accept') return next();
    const context = await resolveContext(req);
    requirePermission(context, permissionForRequest(req));
    req.platformContext = context;
    return next();
  }));

  app.get('/api/gym-owner/platform/workspace', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    res.json(await loadWorkspace(context));
  }));

  app.get('/api/gym-owner/platform/collections/:resource', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    res.json(await loadCollection(context, String(req.params.resource || ''), req));
  }));

  app.patch('/api/gym-owner/platform/manual-members/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'members:write');
    const id = uuid.parse(req.params.id);
    const input = ManualMemberUpdateInput.parse(req.body || {});
    const { data: current, error: currentError } = await db.from('gym_manual_members').select('*').eq('id', id).eq('gym_id', context.gym.gym_id).maybeSingle();
    if (currentError) throw fail('Could not load member.', 500, 'manual_member_lookup_failed');
    if (!current) throw fail('Member not found.', 404, 'member_not_found');
    const metadata = input.notes === undefined ? current.metadata || {} : { ...(current.metadata || {}), notes: cleanNullable(input.notes) };
    const payload = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: cleanNullable(input.email) } : {}),
      ...(input.phone !== undefined ? { phone: cleanNullable(input.phone) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      metadata,
      updated_at: nowIso(),
    };
    const { data, error } = await db.from('gym_manual_members').update(payload).eq('id', id).eq('gym_id', context.gym.gym_id).select('*').single();
    if (error) throw fail('The member could not be updated.', 500, 'manual_member_update_failed');
    res.json({ item: { ...data, member_type: 'manual', full_name: data.name || 'Manual member' } });
  }));

  app.delete('/api/gym-owner/platform/manual-members/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'members:write');
    const id = uuid.parse(req.params.id);
    const { data: current, error: lookupError } = await db.from('gym_manual_members').select('id,metadata').eq('id', id).eq('gym_id', context.gym.gym_id).maybeSingle();
    if (lookupError) throw fail('Could not load member.', 500, 'manual_member_lookup_failed');
    if (!current) throw fail('Member not found.', 404, 'member_not_found');
    const { data, error } = await db.from('gym_manual_members').update({
      status: 'inactive',
      metadata: { ...(current.metadata || {}), archived_at: nowIso() },
      updated_at: nowIso(),
    }).eq('id', id).eq('gym_id', context.gym.gym_id).select('*').single();
    if (error) throw fail('The member could not be archived.', 500, 'manual_member_archive_failed');
    res.json({ item: { ...data, member_type: 'manual', full_name: data.name || 'Manual member' }, archived: true });
  }));

  app.patch('/api/gym-owner/platform/attendance/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'attendance:write');
    const id = uuid.parse(req.params.id);
    const input = AttendanceUpdateInput.parse(req.body || {});
    const { data: current, error: lookupError } = await db.from('gym_attendance_logs').select('*').eq('log_id', id).eq('gym_id', context.gym.gym_id).maybeSingle();
    if (lookupError) throw fail('Could not load attendance record.', 500, 'attendance_lookup_failed');
    if (!current) throw fail('Attendance record not found.', 404, 'attendance_not_found');
    const checkIn = new Date(input.check_in_at || current.check_in_at || nowIso());
    const checkOutValue = input.check_out_at === undefined ? current.check_out_at : input.check_out_at;
    const checkOut = checkOutValue ? new Date(checkOutValue) : null;
    if (checkOut && checkOut.getTime() < checkIn.getTime()) throw fail('Check-out cannot be earlier than check-in.', 400, 'invalid_attendance_time');
    const duration = checkOut ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000)) : null;
    const payload = {
      ...input,
      check_in_at: checkIn.toISOString(),
      check_out_at: checkOut?.toISOString() || null,
      duration_minutes: duration,
      status: input.status || (checkOut ? 'checked_out' : 'checked_in'),
      updated_at: nowIso(),
    };
    const { data, error } = await db.from('gym_attendance_logs').update(payload).eq('log_id', id).eq('gym_id', context.gym.gym_id).select('*').single();
    if (error) throw fail('Attendance could not be corrected.', 500, 'attendance_update_failed');
    res.json({ item: data });
  }));

  app.delete('/api/gym-owner/platform/attendance/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requireOwner(context);
    const id = uuid.parse(req.params.id);
    const { data, error } = await db.from('gym_attendance_logs').delete().eq('log_id', id).eq('gym_id', context.gym.gym_id).select('log_id').maybeSingle();
    if (error) throw fail('Attendance record could not be deleted.', 500, 'attendance_delete_failed');
    if (!data) throw fail('Attendance record not found.', 404, 'attendance_not_found');
    res.json({ success: true });
  }));

  app.delete('/api/gym-owner/platform/leads/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'leads:write');
    const id = uuid.parse(req.params.id);
    const { data, error } = await db.from('gym_leads').delete().eq('lead_id', id).eq('gym_id', context.gym.gym_id).select('lead_id').maybeSingle();
    if (error) throw fail('Lead could not be deleted.', 500, 'lead_delete_failed');
    if (!data) throw fail('Lead not found.', 404, 'lead_not_found');
    res.json({ success: true });
  }));

  app.patch('/api/gym-owner/platform/payments/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'payments:write');
    const id = uuid.parse(req.params.id);
    const input = PaymentUpdateInput.parse(req.body || {});
    const payload = {
      ...input,
      notes: cleanNullable(input.notes),
      payment_reference: cleanNullable(input.payment_reference),
      updated_at: nowIso(),
    };
    const { data, error } = await db.from('gym_payments').update(payload).eq('id', id).eq('gym_id', context.gym.gym_id).select('*').maybeSingle();
    if (error) throw fail('Payment record could not be updated.', error.code === '23505' ? 409 : 500, 'payment_update_failed');
    if (!data) throw fail('Payment record not found.', 404, 'payment_not_found');
    res.json({ item: data });
  }));

  app.delete('/api/gym-owner/platform/announcements/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'announcements:write');
    const id = uuid.parse(req.params.id);
    const { data, error } = await db.from('gym_announcements').delete().eq('id', id).eq('gym_id', context.gym.gym_id).select('id').maybeSingle();
    if (error) throw fail('Announcement could not be deleted.', 500, 'announcement_delete_failed');
    if (!data) throw fail('Announcement not found.', 404, 'announcement_not_found');
    res.json({ success: true });
  }));

  app.post('/api/gym-owner/platform/plans', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'plans:write');
    const input = PlanCreateInput.parse(req.body || {});
    const { data, error } = await db.from('gym_plans').insert({ gym_id: context.gym.gym_id, ...input }).select('*').single();
    if (error) throw fail(error.code === '23505' ? 'A plan with this name already exists.' : 'Plan could not be created.', error.code === '23505' ? 409 : 500, 'plan_create_failed');
    res.status(201).json({ item: data });
  }));

  app.patch('/api/gym-owner/platform/plans/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'plans:write');
    const id = uuid.parse(req.params.id);
    const input = PlanUpdateInput.parse(req.body || {});
    const { data, error } = await db.from('gym_plans').update({ ...input, updated_at: nowIso() }).eq('plan_id', id).eq('gym_id', context.gym.gym_id).select('*').maybeSingle();
    if (error) throw fail(error.code === '23505' ? 'A plan with this name already exists.' : 'Plan could not be updated.', error.code === '23505' ? 409 : 500, 'plan_update_failed');
    if (!data) throw fail('Plan not found.', 404, 'plan_not_found');
    res.json({ item: data });
  }));

  app.delete('/api/gym-owner/platform/plans/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'plans:write');
    const id = uuid.parse(req.params.id);
    const { data, error } = await db.from('gym_plans').update({ active: false, updated_at: nowIso() }).eq('plan_id', id).eq('gym_id', context.gym.gym_id).select('*').maybeSingle();
    if (error) throw fail('Plan could not be archived.', 500, 'plan_archive_failed');
    if (!data) throw fail('Plan not found.', 404, 'plan_not_found');
    res.json({ item: data, archived: true });
  }));

  app.get('/api/gym-owner/platform/staff/invitations', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    res.json({ items: await loadInvitations(context, req.query.limit) });
  }));

  app.post('/api/gym-owner/platform/staff/invitations', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requireOwner(context);
    const input = StaffInvitationInput.parse(req.body || {});
    const permissions = normalizePermissions(input.role, input.permissions);
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + input.expires_in_days * 86_400_000).toISOString();

    await db.from('gym_staff_invitations').update({ status: 'revoked', revoked_at: nowIso(), updated_at: nowIso() })
      .eq('gym_id', context.gym.gym_id).eq('email', input.email).eq('status', 'pending');

    const { data, error } = await db.from('gym_staff_invitations').insert({
      gym_id: context.gym.gym_id,
      email: input.email,
      name: cleanNullable(input.name),
      phone: cleanNullable(input.phone),
      role: input.role,
      permissions,
      token_hash: tokenHash(rawToken),
      status: 'pending',
      expires_at: expiresAt,
      created_by: context.authUser.id,
    }).select('invitation_id,gym_id,email,name,phone,role,permissions,status,expires_at,created_by,created_at,updated_at').single();
    if (error) throw fail('Staff invitation could not be created.', error.code === '23505' ? 409 : 500, 'staff_invitation_create_failed');

    const separator = STAFF_INVITATION_URL.includes('?') ? '&' : '?';
    const invitationUrl = `${STAFF_INVITATION_URL}${separator}token=${encodeURIComponent(rawToken)}`;
    const emailed = await sendStaffInvitationEmail(data, invitationUrl, context.gym.name).catch(() => false);
    res.status(201).json({ item: data, delivery: emailed ? 'email' : 'manual', invitation_url: invitationUrl });
  }));

  app.delete('/api/gym-owner/platform/staff/invitations/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requireOwner(context);
    const id = uuid.parse(req.params.id);
    const { data, error } = await db.from('gym_staff_invitations').update({ status: 'revoked', revoked_at: nowIso(), updated_at: nowIso() })
      .eq('invitation_id', id).eq('gym_id', context.gym.gym_id).eq('status', 'pending')
      .select('invitation_id').maybeSingle();
    if (error) throw fail('Invitation could not be revoked.', 500, 'staff_invitation_revoke_failed');
    if (!data) throw fail('Pending invitation not found.', 404, 'staff_invitation_not_found');
    res.json({ success: true });
  }));

  app.post('/api/gym-owner/platform/staff/invitations/accept', wrap(async (req, res) => {
    const identity = await requireUser(req);
    const rawToken = z.string().trim().min(32).max(256).parse(req.body?.token);
    const hash = tokenHash(rawToken);
    const { data: invitation, error } = await db.from('gym_staff_invitations')
      .select('invitation_id,email,status,expires_at')
      .eq('token_hash', hash)
      .maybeSingle();
    if (error) throw fail('Invitation could not be verified.', 500, 'staff_invitation_lookup_failed');
    if (!invitation) throw fail('Invitation is invalid.', 404, 'staff_invitation_not_found');
    if (invitation.status !== 'pending') throw fail('Invitation is no longer active.', 409, 'staff_invitation_inactive');
    if (new Date(invitation.expires_at).getTime() <= Date.now()) throw fail('Invitation has expired.', 410, 'staff_invitation_expired');
    if (cleanEmail(identity.authUser.email) !== cleanEmail(invitation.email)) {
      throw fail('Sign in with the email address that received this invitation.', 403, 'staff_invitation_email_mismatch');
    }
    const { data, error: acceptError } = await db.rpc('accept_gym_staff_invitation', {
      p_invitation_id: invitation.invitation_id,
      p_user_id: identity.authUser.id,
      p_email: identity.authUser.email,
    });
    if (acceptError) throw fail(String(acceptError.message || '').includes('expired') ? 'Invitation has expired.' : 'Invitation could not be accepted.', 409, 'staff_invitation_accept_failed');
    res.json({ item: data, accepted: true });
  }));

  app.patch('/api/gym-owner/platform/staff/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requireOwner(context);
    const id = uuid.parse(req.params.id);
    const input = StaffUpdateInput.parse(req.body || {});
    const { data: current, error: lookupError } = await db.from('gym_staff').select('*').eq('id', id).eq('gym_id', context.gym.gym_id).maybeSingle();
    if (lookupError) throw fail('Could not load staff member.', 500, 'staff_lookup_failed');
    if (!current) throw fail('Staff member not found.', 404, 'staff_not_found');
    const nextRole = input.role || current.role;
    const payload = {
      ...input,
      name: cleanNullable(input.name),
      phone: cleanNullable(input.phone),
      permissions: input.permissions ? normalizePermissions(nextRole, input.permissions) : current.permissions,
      updated_at: nowIso(),
    };
    const { data, error } = await db.from('gym_staff').update(payload).eq('id', id).eq('gym_id', context.gym.gym_id).select('*').single();
    if (error) throw fail('Staff member could not be updated.', 500, 'staff_update_failed');
    res.json({ item: data });
  }));

  app.delete('/api/gym-owner/platform/staff/:id', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requireOwner(context);
    const id = uuid.parse(req.params.id);
    const { data: current, error: lookupError } = await db.from('gym_staff').select('id,user_id').eq('id', id).eq('gym_id', context.gym.gym_id).maybeSingle();
    if (lookupError) throw fail('Could not load staff member.', 500, 'staff_lookup_failed');
    if (!current) throw fail('Staff member not found.', 404, 'staff_not_found');
    const { data, error } = await db.from('gym_staff').update({ status: 'removed', updated_at: nowIso() }).eq('id', id).eq('gym_id', context.gym.gym_id).select('*').single();
    if (error) throw fail('Staff access could not be removed.', 500, 'staff_remove_failed');
    if (current.user_id) {
      await db.from('user_roles').delete().eq('user_id', current.user_id).eq('role', 'staff').eq('gym_id', context.gym.gym_id);
      const { data: profile } = await db.from('profiles').select('role').eq('user_id', current.user_id).maybeSingle();
      if (profile?.role === 'staff') await db.from('profiles').update({ role: 'user', updated_at: nowIso() }).eq('user_id', current.user_id);
      await db.auth.admin.signOut(current.user_id, 'global').catch(() => null);
    }
    res.json({ item: data, removed: true });
  }));

  app.get('/api/gym-owner/platform/export/:resource', wrap(async (req, res) => {
    const context = req.platformContext || await resolveContext(req);
    requirePermission(context, 'reports:read');
    const resource = String(req.params.resource || '');
    const limit = Math.max(1, Math.min(10_000, Number.parseInt(String(req.query.limit || '10000'), 10) || 10_000));
    let rows;
    let columns;

    if (resource === 'members') {
      requirePermission(context, 'members:read');
      const [appRows, manualRows] = await Promise.all([
        allCollectionItems(context, 'app-members', limit),
        allCollectionItems(context, 'manual-members', limit),
      ]);
      rows = [...appRows, ...manualRows].slice(0, limit);
      columns = [['Name', 'full_name'], ['Type', 'member_type'], ['Email', 'email'], ['Phone', 'phone'], ['Status', 'status'], ['Joined', (row) => row.joined_at || row.created_at], ['Membership number', 'membership_number']];
    } else {
      const definitions = {
        attendance: { permission: 'attendance:read', columns: [['Date', 'date'], ['Check in', 'check_in_at'], ['Check out', 'check_out_at'], ['Duration minutes', 'duration_minutes'], ['Status', 'status'], ['Method', 'method'], ['User ID', 'user_id']] },
        equipment: { permission: 'equipment:read', columns: [['Name', 'name'], ['Category', 'category'], ['Quantity', 'quantity'], ['Available', 'available'], ['Created', 'created_at']] },
        leads: { permission: 'leads:read', columns: [['Name', 'name'], ['Phone', 'phone'], ['Email', 'email'], ['Source', 'source'], ['Status', 'status'], ['Created', 'created_at']] },
        payments: { permission: 'payments:read', columns: [['Amount', 'amount'], ['Currency', 'currency'], ['Status', 'status'], ['Method', 'method'], ['Reference', 'payment_reference'], ['Paid at', 'paid_at'], ['Notes', 'notes']] },
        plans: { permission: 'plans:read', columns: [['Name', 'name'], ['Price', 'price'], ['Billing cycle', 'billing_cycle'], ['Duration days', 'duration_days'], ['Active', 'active'], ['Features', 'features']] },
        staff: { permission: 'settings:write', owner: true, columns: [['Name', 'name'], ['Email', 'email'], ['Phone', 'phone'], ['Role', 'role'], ['Status', 'status'], ['Permissions', 'permissions'], ['Created', 'created_at']] },
      };
      const definition = definitions[resource];
      if (!definition) throw fail('Unsupported export.', 404, 'export_not_found');
      requirePermission(context, definition.permission);
      if (definition.owner) requireOwner(context);
      rows = await allCollectionItems(context, resource, limit);
      columns = definition.columns;
    }

    const fileName = `${String(context.gym.name || 'gym').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'gym'}-${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv(rows, columns));
  }));

  app.use('/api/gym-owner/platform', (error, _req, res, _next) => {
    const response = publicError(error);
    if (response.status >= 500) console.error('[platform-phase3] request failed:', error);
    res.status(response.status).json(response.body);
  });
}

const originalListen = express.application.listen;
express.application.listen = function listenWithPlatformPhase3(...args) {
  register(this);
  return originalListen.apply(this, args);
};
