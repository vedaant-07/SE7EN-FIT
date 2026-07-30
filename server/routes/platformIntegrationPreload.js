import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const uuid = z.string().uuid();
const shortText = (max = 120) => z.string().trim().min(1).max(max);
const optionalText = (max = 500) => z.string().trim().max(max).optional().nullable();
const optionalEmail = z.string().trim().email().max(254).optional().nullable().or(z.literal(''));
const optionalPhone = z.string().trim().regex(/^[+0-9()\-\s]{6,24}$/).optional().nullable().or(z.literal(''));
const positiveAmount = z.coerce.number().finite().positive().max(10_000_000);
const nonNegativeInteger = z.coerce.number().int().min(0).max(100_000);
const memberStatus = z.enum(['pending', 'active', 'approved', 'inactive', 'blocked', 'cancelled']);
const leadStatus = z.enum(['new', 'contacted', 'qualified', 'converted', 'lost', 'closed']);
const paymentStatus = z.enum(['paid', 'pending', 'failed', 'refunded', 'cancelled']);
const paymentMethod = z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other']);
const announcementAudience = z.enum(['all_members', 'active_members', 'staff']);

const ManualMemberInput = z.object({
  name: shortText(120),
  email: optionalEmail,
  phone: optionalPhone,
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  notes: optionalText(500),
}).strict();

const MemberUpdateInput = z.object({ status: memberStatus }).strict();

const AttendanceInput = z.object({
  member_type: z.enum(['app', 'manual']),
  member_id: uuid,
  method: z.enum(['manual', 'qr', 'app', 'biometric']).default('manual'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

const EquipmentCreateInput = z.object({
  name: shortText(120),
  category: optionalText(80),
  quantity: nonNegativeInteger.refine((value) => value >= 1, 'Quantity must be at least 1').default(1),
  available: z.boolean().default(true),
  image_url: z.string().trim().url().max(2048).optional().nullable().or(z.literal('')),
}).strict();

const EquipmentUpdateInput = EquipmentCreateInput.partial().strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const LeadCreateInput = z.object({
  name: shortText(120),
  phone: optionalPhone,
  email: optionalEmail,
  city: optionalText(120),
  source: z.string().trim().min(1).max(80).default('website'),
  message: optionalText(1000),
}).strict();

const LeadUpdateInput = z.object({
  status: leadStatus.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: optionalPhone,
  email: optionalEmail,
  city: optionalText(120),
  message: optionalText(1000),
}).strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const GymPaymentInput = z.object({
  member_type: z.enum(['app', 'manual']).optional(),
  member_id: uuid.optional().nullable(),
  amount: positiveAmount,
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default('INR'),
  status: paymentStatus.default('paid'),
  method: paymentMethod.default('cash'),
  notes: optionalText(500),
  paid_at: z.string().datetime({ offset: true }).optional(),
}).strict();

const AnnouncementCreateInput = z.object({
  title: shortText(160),
  body: shortText(4000),
  audience: announcementAudience.default('all_members'),
  is_published: z.boolean().default(true),
}).strict();

const AnnouncementUpdateInput = AnnouncementCreateInput.partial().strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const GymProfileInput = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(500),
  city: optionalText(120),
  state: optionalText(120),
  country: optionalText(120),
  pincode: z.string().trim().regex(/^[A-Za-z0-9\-\s]{3,12}$/).optional().nullable().or(z.literal('')),
  description: optionalText(2000),
  location_url: z.string().trim().url().max(2048).optional().nullable().or(z.literal('')),
  logo_url: z.string().trim().url().max(2048).optional().nullable().or(z.literal('')),
  cover_url: z.string().trim().url().max(2048).optional().nullable().or(z.literal('')),
  amenities: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  opening_hours: z.record(z.string(), z.unknown()).optional(),
  pricing: z.record(z.string(), z.unknown()).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

const fail = (message, status = 400, code = 'request_failed') => Object.assign(new Error(message), { status, code });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);

function publicError(error) {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: 'Invalid input',
        code: 'validation_failed',
        fields: error.flatten().fieldErrors,
      },
    };
  }
  return {
    status: Number(error?.status || 500),
    body: {
      error: Number(error?.status || 500) >= 500 ? 'The server could not complete this request.' : String(error?.message || 'Request failed'),
      code: error?.code || 'request_failed',
    },
  };
}

function cleanNullable(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return value;
}

function compactPayload(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
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
  if (profileError) throw fail('Could not verify account access', 500, 'profile_lookup_failed');
  if (profile?.status === 'blocked') throw fail('This account is blocked.', 403, 'account_blocked');
  return { authUser: data.user, profile };
}

async function resolveGymAccess(req) {
  const identity = await requireUser(req);
  const userId = identity.authUser.id;
  const profileRole = String(identity.profile?.role || '').toLowerCase();
  const isAdmin = ['admin', 'super_admin'].includes(profileRole);
  const requestedGymId = String(req.headers['x-gym-id'] || req.query?.gym_id || '').trim();

  if (isAdmin && requestedGymId) {
    const parsedGymId = uuid.safeParse(requestedGymId);
    if (!parsedGymId.success) throw fail('Invalid gym identifier', 400, 'invalid_gym_id');
    const { data: adminGym, error } = await db.from('gyms').select('*').eq('gym_id', parsedGymId.data).maybeSingle();
    if (error) throw fail('Could not load gym', 500, 'gym_lookup_failed');
    if (!adminGym) throw fail('Gym not found', 404, 'gym_not_found');
    return { ...identity, gym: adminGym, access: 'admin' };
  }

  const { data: ownerLink, error: ownerError } = await db
    .from('gym_owners')
    .select('gym_id,kyc_status,onboarding_complete')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (ownerError) throw fail('Could not verify gym access', 500, 'owner_lookup_failed');

  let gymId = ownerLink?.gym_id || null;
  let access = ownerLink ? 'owner' : null;

  if (!gymId) {
    const { data: roleLink, error: roleError } = await db
      .from('user_roles')
      .select('gym_id,role')
      .eq('user_id', userId)
      .in('role', ['gym_owner', 'gym_staff', 'admin', 'super_admin'])
      .not('gym_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (roleError) throw fail('Could not verify gym role', 500, 'role_lookup_failed');
    gymId = roleLink?.gym_id || null;
    access = roleLink?.role || access;
  }

  if (!gymId) {
    const { data: staffLink, error: staffError } = await db
      .from('gym_staff')
      .select('gym_id,role,permissions')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (staffError) throw fail('Could not verify gym staff access', 500, 'staff_lookup_failed');
    gymId = staffLink?.gym_id || null;
    access = staffLink ? 'staff' : access;
  }

  if (!gymId) {
    const { data: ownedGym, error: gymOwnerError } = await db
      .from('gyms')
      .select('gym_id')
      .or(`owner_user_id.eq.${userId},owner_id.eq.${userId},owner_profile_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gymOwnerError) throw fail('Could not verify gym ownership', 500, 'gym_owner_lookup_failed');
    gymId = ownedGym?.gym_id || null;
    access = ownedGym ? 'owner' : access;
  }

  if (!gymId) throw fail('This account is not connected to an approved gym.', 403, 'gym_access_required');

  const { data: gym, error: gymError } = await db.from('gyms').select('*').eq('gym_id', gymId).maybeSingle();
  if (gymError) throw fail('Could not load gym', 500, 'gym_lookup_failed');
  if (!gym) throw fail('Connected gym was not found.', 404, 'gym_not_found');
  if (!isAdmin && !['active', 'approved'].includes(String(gym.status || '').toLowerCase())) {
    throw fail('Gym access is not active yet.', 403, 'gym_not_active');
  }

  return { ...identity, gym, access, ownerLink };
}

async function selectOrThrow(query, code = 'database_query_failed') {
  const { data, error } = await query;
  if (error) throw fail('Could not load the latest gym data.', 500, code);
  return data || [];
}

async function mutationOrThrow(query, code = 'database_write_failed') {
  const { data, error } = await query;
  if (error) {
    console.error(`[platform] ${code}:`, error.message);
    throw fail('The change could not be saved. Please try again.', 500, code);
  }
  return data;
}

async function loadWorkspace(gym) {
  const gymId = gym.gym_id;
  const [memberships, manualMembers, attendance, equipment, leads, payments, announcements, commissions] = await Promise.all([
    selectOrThrow(db.from('gym_memberships').select('*').eq('gym_id', gymId).order('joined_at', { ascending: false }), 'memberships_load_failed'),
    selectOrThrow(db.from('gym_manual_members').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }), 'manual_members_load_failed'),
    selectOrThrow(db.from('gym_attendance_logs').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }).limit(500), 'attendance_load_failed'),
    selectOrThrow(db.from('gym_equipment').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }), 'equipment_load_failed'),
    selectOrThrow(db.from('gym_leads').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }).limit(500), 'leads_load_failed'),
    selectOrThrow(db.from('gym_payments').select('*').eq('gym_id', gymId).order('paid_at', { ascending: false }).limit(500), 'payments_load_failed'),
    selectOrThrow(db.from('gym_announcements').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }).limit(200), 'announcements_load_failed'),
    selectOrThrow(db.from('gym_commission_ledger').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }).limit(500), 'commissions_load_failed'),
  ]);

  const userIds = [...new Set(memberships.map((row) => row.user_id).filter(Boolean))];
  const profiles = userIds.length
    ? await selectOrThrow(db.from('profiles').select('user_id,full_name,email,phone,avatar_url,status').in('user_id', userIds), 'member_profiles_load_failed')
    : [];
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));

  const appMembers = memberships.map((membership) => {
    const profile = profileMap.get(membership.user_id) || {};
    return {
      id: membership.membership_id,
      member_type: 'app',
      gym_id: membership.gym_id,
      user_id: membership.user_id,
      name: profile.full_name || profile.email || 'SE7EN FIT member',
      full_name: profile.full_name || profile.email || 'SE7EN FIT member',
      email: profile.email || null,
      phone: profile.phone || null,
      avatar_url: profile.avatar_url || null,
      status: membership.status,
      joined_at: membership.joined_at,
      referred_by_code: membership.referred_by_code,
      amount: Number(membership.amount || 0),
      currency: membership.currency || 'INR',
      payment_status: membership.payment_status || 'pending',
      metadata: membership.metadata || {},
    };
  });

  const manual = manualMembers.map((member) => ({
    ...member,
    member_type: 'manual',
    full_name: member.name || 'Manual member',
  }));

  const commissionSummary = commissions.reduce((summary, row) => {
    const status = String(row.status || 'pending');
    const amount = Number(row.commission_amount || 0);
    summary.total += amount;
    summary[status] = Number(summary[status] || 0) + amount;
    return summary;
  }, { total: 0, pending: 0, approved: 0, paid: 0, reversed: 0, currency: commissions[0]?.currency || 'INR' });

  return {
    gym: {
      ...gym,
      id: gym.gym_id,
      gym_id: gym.gym_id,
      owner_id: gym.owner_user_id || gym.owner_id || gym.owner_profile_id,
    },
    members: [...appMembers, ...manual],
    app_members: appMembers,
    manual_members: manual,
    attendance,
    equipment,
    leads,
    payments,
    announcements,
    commissions,
    commission_summary: commissionSummary,
    generated_at: nowIso(),
  };
}

function register(app) {
  if (app.__se7enfitPlatformIntegrationRoutes) return;
  app.__se7enfitPlatformIntegrationRoutes = true;

  const rateBuckets = new Map();
  app.use('/api/gym-owner/platform', (req, res, next) => {
    const identity = String(req.headers.authorization || req.ip || 'anonymous').slice(-80);
    const key = `${identity}:${Math.floor(Date.now() / 60_000)}`;
    const count = Number(rateBuckets.get(key) || 0) + 1;
    rateBuckets.set(key, count);
    if (rateBuckets.size > 10_000) {
      const currentMinute = Math.floor(Date.now() / 60_000);
      for (const bucketKey of rateBuckets.keys()) {
        const minute = Number(bucketKey.split(':').at(-1));
        if (!Number.isFinite(minute) || minute < currentMinute - 2) rateBuckets.delete(bucketKey);
      }
    }
    if (count > 180) return res.status(429).json({ error: 'Too many requests. Please wait a minute.', code: 'rate_limited' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    return next();
  });

  app.get('/api/gym-owner/platform/workspace', wrap(async (req, res) => {
    const { gym, access } = await resolveGymAccess(req);
    const workspace = await loadWorkspace(gym);
    res.json({ ...workspace, access });
  }));

  app.patch('/api/gym-owner/platform/profile', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const input = GymProfileInput.parse(req.body || {});
    const payload = compactPayload({
      name: cleanNullable(input.name),
      phone: cleanNullable(input.phone),
      email: cleanNullable(input.email),
      contact_email: cleanNullable(input.email),
      address: cleanNullable(input.address),
      city: cleanNullable(input.city),
      state: cleanNullable(input.state),
      country: cleanNullable(input.country),
      pincode: cleanNullable(input.pincode),
      description: cleanNullable(input.description),
      location_url: cleanNullable(input.location_url),
      google_maps_link: cleanNullable(input.location_url),
      logo_url: cleanNullable(input.logo_url),
      cover_url: cleanNullable(input.cover_url),
      amenities: input.amenities,
      opening_hours: input.opening_hours,
      pricing: input.pricing,
      updated_at: nowIso(),
    });
    const saved = await mutationOrThrow(
      db.from('gyms').update(payload).eq('gym_id', gym.gym_id).select('*').single(),
      'gym_profile_update_failed',
    );
    res.json({ item: saved });
  }));

  app.post('/api/gym-owner/platform/manual-members', wrap(async (req, res) => {
    const { gym, authUser } = await resolveGymAccess(req);
    const input = ManualMemberInput.parse(req.body || {});
    const saved = await mutationOrThrow(
      db.from('gym_manual_members').insert({
        gym_id: gym.gym_id,
        created_by: authUser.id,
        name: input.name,
        email: cleanNullable(input.email),
        phone: cleanNullable(input.phone),
        status: input.status,
        metadata: input.notes ? { notes: input.notes } : {},
      }).select('*').single(),
      'manual_member_create_failed',
    );
    res.status(201).json({ item: { ...saved, member_type: 'manual', full_name: saved.name } });
  }));

  app.patch('/api/gym-owner/platform/members/:kind/:id', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const id = uuid.parse(req.params.id);
    const input = MemberUpdateInput.parse(req.body || {});
    const kind = String(req.params.kind || '');

    if (kind === 'app') {
      const payload = {
        status: input.status,
        approved_at: ['active', 'approved'].includes(input.status) ? nowIso() : null,
        cancelled_at: input.status === 'cancelled' ? nowIso() : null,
        updated_at: nowIso(),
      };
      const saved = await mutationOrThrow(
        db.from('gym_memberships').update(payload).eq('membership_id', id).eq('gym_id', gym.gym_id).select('*').single(),
        'membership_update_failed',
      );
      return res.json({ item: { ...saved, id: saved.membership_id, member_type: 'app' } });
    }

    if (kind === 'manual') {
      const saved = await mutationOrThrow(
        db.from('gym_manual_members').update({ status: input.status, updated_at: nowIso() }).eq('id', id).eq('gym_id', gym.gym_id).select('*').single(),
        'manual_member_update_failed',
      );
      return res.json({ item: { ...saved, member_type: 'manual', full_name: saved.name } });
    }

    throw fail('Unknown member type', 400, 'invalid_member_type');
  }));

  app.post('/api/gym-owner/platform/attendance/check-in', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const input = AttendanceInput.parse(req.body || {});
    const row = {
      gym_id: gym.gym_id,
      date: input.date || todayIso(),
      check_in_at: nowIso(),
      status: 'checked_in',
      method: input.method,
    };

    if (input.member_type === 'app') {
      const { data: membership, error } = await db.from('gym_memberships')
        .select('membership_id,user_id,status')
        .eq('membership_id', input.member_id)
        .eq('gym_id', gym.gym_id)
        .maybeSingle();
      if (error) throw fail('Could not verify member', 500, 'membership_lookup_failed');
      if (!membership || !['active', 'approved'].includes(membership.status)) throw fail('Member is not active.', 422, 'member_not_active');
      row.membership_id = membership.membership_id;
      row.user_id = membership.user_id;
    } else {
      const { data: manualMember, error } = await db.from('gym_manual_members')
        .select('id,status')
        .eq('id', input.member_id)
        .eq('gym_id', gym.gym_id)
        .maybeSingle();
      if (error) throw fail('Could not verify member', 500, 'manual_member_lookup_failed');
      if (!manualMember || manualMember.status !== 'active') throw fail('Member is not active.', 422, 'member_not_active');
      row.manual_member_id = manualMember.id;
    }

    let duplicate = db.from('gym_attendance_logs')
      .select('log_id')
      .eq('gym_id', gym.gym_id)
      .eq('status', 'checked_in')
      .is('check_out_at', null)
      .limit(1);
    duplicate = input.member_type === 'app'
      ? duplicate.eq('membership_id', input.member_id)
      : duplicate.eq('manual_member_id', input.member_id);
    const { data: existing, error: duplicateError } = await duplicate.maybeSingle();
    if (duplicateError) throw fail('Could not verify attendance state', 500, 'attendance_lookup_failed');
    if (existing) throw fail('This member is already checked in.', 409, 'already_checked_in');

    const saved = await mutationOrThrow(
      db.from('gym_attendance_logs').insert(row).select('*').single(),
      'attendance_checkin_failed',
    );
    res.status(201).json({ item: saved });
  }));

  app.patch('/api/gym-owner/platform/attendance/:id/check-out', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const logId = uuid.parse(req.params.id);
    const { data: current, error } = await db.from('gym_attendance_logs')
      .select('log_id,check_in_at,check_out_at')
      .eq('log_id', logId)
      .eq('gym_id', gym.gym_id)
      .maybeSingle();
    if (error) throw fail('Could not load attendance record', 500, 'attendance_lookup_failed');
    if (!current) throw fail('Attendance record not found', 404, 'attendance_not_found');
    if (current.check_out_at) throw fail('Member is already checked out.', 409, 'already_checked_out');
    const checkout = new Date();
    const checkin = new Date(current.check_in_at || checkout);
    const duration = Math.max(0, Math.round((checkout.getTime() - checkin.getTime()) / 60_000));
    const saved = await mutationOrThrow(
      db.from('gym_attendance_logs').update({
        check_out_at: checkout.toISOString(),
        duration_minutes: duration,
        status: 'checked_out',
        updated_at: nowIso(),
      }).eq('log_id', logId).eq('gym_id', gym.gym_id).select('*').single(),
      'attendance_checkout_failed',
    );
    res.json({ item: saved });
  }));

  app.post('/api/gym-owner/platform/equipment', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const input = EquipmentCreateInput.parse(req.body || {});
    const saved = await mutationOrThrow(
      db.from('gym_equipment').insert({
        gym_id: gym.gym_id,
        name: input.name,
        category: cleanNullable(input.category),
        quantity: input.quantity,
        available: input.available,
        image_url: cleanNullable(input.image_url),
      }).select('*').single(),
      'equipment_create_failed',
    );
    res.status(201).json({ item: { ...saved, id: saved.equipment_id } });
  }));

  app.patch('/api/gym-owner/platform/equipment/:id', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const equipmentId = uuid.parse(req.params.id);
    const input = EquipmentUpdateInput.parse(req.body || {});
    const payload = compactPayload({
      name: input.name,
      category: cleanNullable(input.category),
      quantity: input.quantity,
      available: input.available,
      image_url: cleanNullable(input.image_url),
      updated_at: nowIso(),
    });
    const saved = await mutationOrThrow(
      db.from('gym_equipment').update(payload).eq('equipment_id', equipmentId).eq('gym_id', gym.gym_id).select('*').single(),
      'equipment_update_failed',
    );
    res.json({ item: { ...saved, id: saved.equipment_id } });
  }));

  app.delete('/api/gym-owner/platform/equipment/:id', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const equipmentId = uuid.parse(req.params.id);
    await mutationOrThrow(
      db.from('gym_equipment').delete().eq('equipment_id', equipmentId).eq('gym_id', gym.gym_id).select('equipment_id').single(),
      'equipment_delete_failed',
    );
    res.json({ success: true });
  }));

  app.post('/api/gym-owner/platform/leads', wrap(async (req, res) => {
    const { gym, authUser } = await resolveGymAccess(req);
    const input = LeadCreateInput.parse(req.body || {});
    const saved = await mutationOrThrow(
      db.from('gym_leads').insert({
        gym_id: gym.gym_id,
        owner_user_id: authUser.id,
        source: input.source,
        name: input.name,
        phone: cleanNullable(input.phone),
        email: cleanNullable(input.email),
        city: cleanNullable(input.city),
        message: cleanNullable(input.message),
        status: 'new',
      }).select('*').single(),
      'lead_create_failed',
    );
    res.status(201).json({ item: { ...saved, id: saved.lead_id, full_name: saved.name } });
  }));

  app.patch('/api/gym-owner/platform/leads/:id', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const leadId = uuid.parse(req.params.id);
    const input = LeadUpdateInput.parse(req.body || {});
    const payload = compactPayload({
      status: input.status,
      name: input.name,
      phone: cleanNullable(input.phone),
      email: cleanNullable(input.email),
      city: cleanNullable(input.city),
      message: cleanNullable(input.message),
      updated_at: nowIso(),
    });
    const saved = await mutationOrThrow(
      db.from('gym_leads').update(payload).eq('lead_id', leadId).eq('gym_id', gym.gym_id).select('*').single(),
      'lead_update_failed',
    );
    res.json({ item: { ...saved, id: saved.lead_id, full_name: saved.name } });
  }));

  app.post('/api/gym-owner/platform/payments', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const input = GymPaymentInput.parse(req.body || {});
    let memberId = input.member_id || null;
    if (memberId && input.member_type === 'app') {
      const { data: membership } = await db.from('gym_memberships').select('membership_id').eq('membership_id', memberId).eq('gym_id', gym.gym_id).maybeSingle();
      if (!membership) throw fail('Member was not found in this gym.', 404, 'member_not_found');
    }
    if (memberId && input.member_type === 'manual') {
      const { data: manualMember } = await db.from('gym_manual_members').select('id').eq('id', memberId).eq('gym_id', gym.gym_id).maybeSingle();
      if (!manualMember) throw fail('Member was not found in this gym.', 404, 'member_not_found');
    }
    const saved = await mutationOrThrow(
      db.from('gym_payments').insert({
        gym_id: gym.gym_id,
        member_id: memberId,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        method: input.method,
        paid_at: input.paid_at || nowIso(),
        notes: cleanNullable(input.notes),
      }).select('*').single(),
      'gym_payment_create_failed',
    );
    res.status(201).json({ item: saved });
  }));

  app.post('/api/gym-owner/platform/announcements', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const input = AnnouncementCreateInput.parse(req.body || {});
    const saved = await mutationOrThrow(
      db.from('gym_announcements').insert({ gym_id: gym.gym_id, ...input }).select('*').single(),
      'announcement_create_failed',
    );
    res.status(201).json({ item: saved });
  }));

  app.patch('/api/gym-owner/platform/announcements/:id', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const announcementId = uuid.parse(req.params.id);
    const input = AnnouncementUpdateInput.parse(req.body || {});
    const saved = await mutationOrThrow(
      db.from('gym_announcements').update({ ...input, updated_at: nowIso() }).eq('id', announcementId).eq('gym_id', gym.gym_id).select('*').single(),
      'announcement_update_failed',
    );
    res.json({ item: saved });
  }));

  app.get('/api/gym-owner/platform/commissions', wrap(async (req, res) => {
    const { gym } = await resolveGymAccess(req);
    const rows = await selectOrThrow(
      db.from('gym_commission_ledger').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false }).limit(1000),
      'commissions_load_failed',
    );
    const summary = rows.reduce((result, row) => {
      const status = String(row.status || 'pending');
      const amount = Number(row.commission_amount || 0);
      result.total += amount;
      result[status] = Number(result[status] || 0) + amount;
      return result;
    }, { total: 0, pending: 0, approved: 0, paid: 0, reversed: 0, currency: rows[0]?.currency || 'INR' });
    res.json({ items: rows, summary });
  }));

  app.use('/api/gym-owner/platform', (error, _req, res, _next) => {
    const response = publicError(error);
    if (response.status >= 500) console.error('[platform] request failed:', error);
    res.status(response.status).json(response.body);
  });
}

const originalListen = express.application.listen;
express.application.listen = function listenWithPlatformIntegration(...args) {
  register(this);
  return originalListen.apply(this, args);
};
