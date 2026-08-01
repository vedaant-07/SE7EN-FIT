import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHECKOUT_ENABLED = String(process.env.BILLING_CHECKOUT_ENABLED || '').toLowerCase() === 'true';
const RAZORPAY_CONFIGURED = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables for Phase 4 billing');
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fail = (message, status = 400, code = 'billing_request_failed') => Object.assign(new Error(message), { status, code });
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const uuid = z.string().uuid();
const pageSchema = z.coerce.number().int().min(1).max(100000).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(200).default(50);
const statusText = z.string().trim().max(40).optional();

const PlanUpdateInput = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  price_minor: z.coerce.number().int().min(0).max(100_000_000).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  is_active: z.boolean().optional(),
  is_public: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No plan changes supplied');

const CommissionApprovalInput = z.object({
  commission_ids: z.array(uuid).min(1).max(500),
}).strict();

const PayoutCreateInput = z.object({
  gym_id: uuid,
  commission_ids: z.array(uuid).min(1).max(500),
  notes: z.string().trim().max(1000).optional().nullable(),
}).strict();

const PayoutUpdateInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('processing'), notes: z.string().trim().max(1000).optional().nullable() }).strict(),
  z.object({ action: z.literal('paid'), payment_reference: z.string().trim().min(3).max(160) }).strict(),
  z.object({ action: z.literal('failed'), notes: z.string().trim().min(3).max(1000) }).strict(),
  z.object({ action: z.literal('cancelled'), notes: z.string().trim().min(3).max(1000) }).strict(),
]);

const PaymentReconciliationInput = z.object({
  status: z.enum(['refunded', 'partially_refunded', 'chargeback', 'cancelled', 'reversed']),
  refunded_amount: z.coerce.number().finite().min(0).optional(),
  provider_event_id: z.string().trim().min(3).max(200).optional().nullable(),
  note: z.string().trim().min(3).max(1000),
}).strict();

function publicError(error) {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: { error: 'Invalid billing input.', code: 'validation_failed', fields: error.flatten().fieldErrors },
    };
  }
  const status = Number(error?.status || 500);
  return {
    status,
    body: {
      error: status >= 500 ? 'The billing service could not complete this request.' : String(error?.message || 'Billing request failed.'),
      code: error?.code || 'billing_request_failed',
    },
  };
}

function queryPage(req) {
  const page = pageSchema.parse(req.query?.page || 1);
  const pageSize = pageSizeSchema.parse(req.query?.page_size || 50);
  const search = String(req.query?.search || '').trim().slice(0, 100).replace(/[,%()]/g, ' ');
  const status = statusText.parse(req.query?.status || undefined);
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1, search, status };
}

function pageResult(items, count, page, pageSize) {
  const total = Number(count || 0);
  return { items: items || [], page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
}

async function identity(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw fail('Login required.', 401, 'auth_required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Your session expired. Please log in again.', 401, 'session_expired');
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('user_id,email,full_name,phone,role,status')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw fail('Could not verify account access.', 503, 'profile_lookup_failed');
  if (['blocked', 'deactivated', 'disabled', 'inactive', 'suspended'].includes(String(profile?.status || '').toLowerCase())) {
    throw fail('This account is not active.', 403, 'account_inactive');
  }
  return { token, authUser: data.user, profile: profile || {} };
}

async function adminIdentity(req) {
  const context = await identity(req);
  if (!['admin', 'super_admin'].includes(String(context.profile.role || '').toLowerCase())) {
    throw fail('Administrator access required.', 403, 'admin_required');
  }
  return context;
}

async function managedGym(req) {
  const context = await identity(req);
  const userId = context.authUser.id;
  const { data: owner } = await db.from('gym_owners').select('gym_id').eq('user_id', userId).limit(1).maybeSingle();
  let gymId = owner?.gym_id || null;
  if (!gymId) {
    const { data: gym } = await db.from('gyms').select('gym_id').or(`owner_user_id.eq.${userId},owner_id.eq.${userId},owner_profile_id.eq.${userId}`).limit(1).maybeSingle();
    gymId = gym?.gym_id || null;
  }
  if (!gymId) {
    const { data: staff } = await db.from('gym_staff').select('gym_id,permissions,status').eq('user_id', userId).eq('status', 'active').limit(1).maybeSingle();
    if (staff && (Array.isArray(staff.permissions) ? staff.permissions.includes('reports:read') : false)) gymId = staff.gym_id;
  }
  if (!gymId) throw fail('Gym finance access required.', 403, 'gym_finance_access_required');
  return { ...context, gymId };
}

async function plansWithEntitlements({ publicOnly = false } = {}) {
  let query = db.from('subscription_plans').select('*').order('sort_order', { ascending: true }).order('price_minor', { ascending: true });
  if (publicOnly) query = query.eq('is_active', true).eq('is_public', true);
  const { data: plans, error } = await query;
  if (error) throw fail('Could not load subscription plans.', 503, 'plans_load_failed');
  const codes = (plans || []).map((plan) => plan.plan_code);
  const { data: entitlements, error: entitlementError } = codes.length
    ? await db.from('subscription_plan_entitlements').select('*').in('plan_code', codes).order('feature_code')
    : { data: [], error: null };
  if (entitlementError) throw fail('Could not load plan entitlements.', 503, 'entitlements_load_failed');
  const grouped = new Map();
  for (const row of entitlements || []) {
    if (!grouped.has(row.plan_code)) grouped.set(row.plan_code, []);
    grouped.get(row.plan_code).push(row);
  }
  return (plans || []).map((plan) => ({
    ...plan,
    price: Number(plan.price_minor || 0) / 100,
    entitlements: grouped.get(plan.plan_code) || [],
  }));
}

async function getMemberBilling(req, res) {
  const context = await identity(req);
  const userId = context.authUser.id;
  const { data: entitlementSnapshot, error: entitlementError } = await db.rpc('resolve_user_subscription_entitlements', { p_user_id: userId });
  if (entitlementError) throw fail('Could not load your subscription.', 503, 'subscription_load_failed');
  const [catalog, paymentResult, referralResult] = await Promise.all([
    plansWithEntitlements({ publicOnly: true }),
    db.from('payments').select('payment_id,subscription_id,provider,provider_payment_id,amount,currency,status,refunded_amount,captured_at,refunded_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    db.from('gym_referrals').select('gym_id,referral_code,source,attributed_at,qualified_at,locked_at').eq('user_id', userId).maybeSingle(),
  ]);
  if (paymentResult.error) throw fail('Could not load payment history.', 503, 'payments_load_failed');
  if (referralResult.error) throw fail('Could not load gym attribution.', 503, 'referral_load_failed');
  return res.json({
    ok: true,
    catalog,
    ...entitlementSnapshot,
    payments: paymentResult.data || [],
    referral: referralResult.data || null,
    checkout: {
      enabled: CHECKOUT_ENABLED && RAZORPAY_CONFIGURED,
      provider: 'razorpay',
      status: CHECKOUT_ENABLED && RAZORPAY_CONFIGURED ? 'configured' : 'not_configured',
      message: CHECKOUT_ENABLED && RAZORPAY_CONFIGURED
        ? 'Secure payment activation is available.'
        : 'Online payments are not enabled yet. No plan will activate without verified server-side payment.',
    },
  });
}

async function getCatalog(req, res) {
  await identity(req);
  const plans = await plansWithEntitlements({ publicOnly: true });
  return res.json({
    ok: true,
    plans,
    checkout: {
      enabled: CHECKOUT_ENABLED && RAZORPAY_CONFIGURED,
      provider: 'razorpay',
      status: CHECKOUT_ENABLED && RAZORPAY_CONFIGURED ? 'configured' : 'not_configured',
    },
  });
}

async function adminOverview(req, res) {
  await adminIdentity(req);
  const [plans, subscriptions, payments, commissions, payouts, adjustments] = await Promise.all([
    db.from('subscription_plans').select('plan_code', { count: 'exact', head: true }),
    db.from('subscriptions').select('subscription_id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('payments').select('amount,status,refunded_amount,currency,created_at'),
    db.from('gym_commission_ledger').select('commission_amount,status,currency,available_at'),
    db.from('gym_commission_payouts').select('amount,status,currency'),
    db.from('gym_commission_adjustments').select('amount,status,currency'),
  ]);
  for (const result of [plans, subscriptions, payments, commissions, payouts, adjustments]) {
    if (result.error) throw fail('Could not load billing overview.', 503, 'billing_overview_failed');
  }
  const successful = (payments.data || []).filter((row) => ['success', 'paid', 'captured', 'succeeded', 'completed'].includes(String(row.status).toLowerCase()));
  const revenue = successful.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.refunded_amount || 0)), 0);
  const commissionRows = commissions.data || [];
  const payoutRows = payouts.data || [];
  return res.json({
    ok: true,
    summary: {
      plan_count: Number(plans.count || 0),
      active_subscriptions: Number(subscriptions.count || 0),
      net_revenue: revenue,
      pending_commission: commissionRows.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.commission_amount || 0), 0),
      approved_commission: commissionRows.filter((row) => row.status === 'approved').reduce((sum, row) => sum + Number(row.commission_amount || 0), 0),
      paid_commission: commissionRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.commission_amount || 0), 0),
      outstanding_adjustments: Math.abs((adjustments.data || []).filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount || 0), 0)),
      pending_payouts: payoutRows.filter((row) => ['pending', 'processing'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      paid_payouts: payoutRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0),
      currency: 'INR',
      checkout_enabled: CHECKOUT_ENABLED && RAZORPAY_CONFIGURED,
    },
  });
}

async function adminPlans(req, res) {
  await adminIdentity(req);
  return res.json({ ok: true, plans: await plansWithEntitlements() });
}

async function updateAdminPlan(req, res) {
  const context = await adminIdentity(req);
  const planCode = String(req.params.planCode || '').trim();
  if (!/^[a-z0-9_]{2,64}$/.test(planCode)) throw fail('Invalid plan code.', 400, 'invalid_plan_code');
  const input = PlanUpdateInput.parse(req.body || {});
  const patch = { ...input, updated_at: new Date().toISOString() };
  const { data, error } = await db.from('subscription_plans').update(patch).eq('plan_code', planCode).select('*').maybeSingle();
  if (error) throw fail('Could not update plan.', 503, 'plan_update_failed');
  if (!data) throw fail('Plan not found.', 404, 'plan_not_found');
  await db.from('admin_logs').insert({ actor_id: context.authUser.id, action: 'subscription_plan.updated', entity: 'subscription_plan', entity_id: planCode, details: input }).catch(() => null);
  return res.json({ ok: true, plan: { ...data, price: Number(data.price_minor || 0) / 100 } });
}

async function adminPayments(req, res) {
  await adminIdentity(req);
  const { page, pageSize, from, to, search, status } = queryPage(req);
  let query = db.from('payments').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (status && status !== 'all') query = query.eq('status', status);
  if (search) query = query.or(`provider.ilike.%${search}%,provider_payment_id.ilike.%${search}%,provider_order_id.ilike.%${search}%`);
  const { data, error, count } = await query;
  if (error) throw fail('Could not load payments.', 503, 'payments_load_failed');
  const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean))];
  const gymIds = [...new Set((data || []).map((row) => row.gym_id).filter(Boolean))];
  const [profiles, gyms] = await Promise.all([
    userIds.length ? db.from('profiles').select('user_id,email,full_name').in('user_id', userIds) : { data: [] },
    gymIds.length ? db.from('gyms').select('gym_id,name').in('gym_id', gymIds) : { data: [] },
  ]);
  const profileMap = new Map((profiles.data || []).map((row) => [row.user_id, row]));
  const gymMap = new Map((gyms.data || []).map((row) => [row.gym_id, row]));
  return res.json({
    ok: true,
    ...pageResult((data || []).map((row) => ({ ...row, user: profileMap.get(row.user_id) || null, gym: gymMap.get(row.gym_id) || null })), count, page, pageSize),
  });
}

async function reconcilePayment(req, res) {
  const context = await adminIdentity(req);
  const paymentId = uuid.parse(req.params.paymentId);
  const input = PaymentReconciliationInput.parse(req.body || {});
  const { data: payment, error: paymentError } = await db.from('payments').select('*').eq('payment_id', paymentId).maybeSingle();
  if (paymentError) throw fail('Could not load payment.', 503, 'payment_lookup_failed');
  if (!payment) throw fail('Payment not found.', 404, 'payment_not_found');
  const refundedAmount = input.refunded_amount === undefined
    ? (input.status === 'partially_refunded' ? Number(payment.refunded_amount || 0) : Number(payment.amount || 0))
    : input.refunded_amount;
  if (refundedAmount > Number(payment.amount || 0)) throw fail('Refund cannot exceed the payment amount.', 400, 'refund_amount_invalid');
  if (input.status === 'partially_refunded' && (refundedAmount <= 0 || refundedAmount >= Number(payment.amount || 0))) {
    throw fail('A partial refund must be greater than zero and less than the payment amount.', 400, 'partial_refund_invalid');
  }
  const patch = {
    status: input.status,
    refunded_amount: refundedAmount,
    refunded_at: refundedAmount > 0 ? new Date().toISOString() : null,
    provider_event_id: input.provider_event_id || payment.provider_event_id,
    metadata: { ...(payment.metadata || {}), reconciliation_note: input.note, reconciled_by: context.authUser.id, reconciled_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from('payments').update(patch).eq('payment_id', paymentId).select('*').single();
  if (error) throw fail('Could not reconcile payment.', 503, 'payment_reconcile_failed');
  await db.from('admin_logs').insert({ actor_id: context.authUser.id, action: 'payment.reconciled', entity: 'payment', entity_id: paymentId, details: input }).catch(() => null);
  return res.json({ ok: true, payment: data });
}

async function adminCommissions(req, res) {
  await adminIdentity(req);
  const { page, pageSize, from, to, search, status } = queryPage(req);
  let query = db.from('gym_commission_ledger').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) throw fail('Could not load commissions.', 503, 'commissions_load_failed');
  const gymIds = [...new Set((data || []).map((row) => row.gym_id).filter(Boolean))];
  const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean))];
  const [gyms, profiles, adjustments] = await Promise.all([
    gymIds.length ? db.from('gyms').select('gym_id,name,owner_user_id').in('gym_id', gymIds) : { data: [] },
    userIds.length ? db.from('profiles').select('user_id,email,full_name').in('user_id', userIds) : { data: [] },
    gymIds.length ? db.from('gym_commission_adjustments').select('*').in('gym_id', gymIds).order('created_at', { ascending: false }) : { data: [] },
  ]);
  const gymMap = new Map((gyms.data || []).map((row) => [row.gym_id, row]));
  const profileMap = new Map((profiles.data || []).map((row) => [row.user_id, row]));
  const filtered = search
    ? (data || []).filter((row) => {
      const gym = gymMap.get(row.gym_id);
      const user = profileMap.get(row.user_id);
      return [gym?.name, user?.email, user?.full_name, row.payment_id, row.payout_reference].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
    })
    : data || [];
  return res.json({
    ok: true,
    ...pageResult(filtered.map((row) => ({
      ...row,
      gym: gymMap.get(row.gym_id) || null,
      user: profileMap.get(row.user_id) || null,
      available: row.status === 'pending' && (!row.available_at || new Date(row.available_at).getTime() <= Date.now()),
    })), count, page, pageSize),
    adjustments: adjustments.data || [],
  });
}

async function approveCommissions(req, res) {
  const context = await adminIdentity(req);
  const input = CommissionApprovalInput.parse(req.body || {});
  const { data, error } = await db.rpc('admin_approve_gym_commissions', {
    p_commission_ids: input.commission_ids,
    p_admin_id: context.authUser.id,
  });
  if (error) throw fail(String(error.message || 'Could not approve commissions.').replace(/_/g, ' '), 400, 'commission_approval_failed');
  return res.json(data);
}

async function adminPayouts(req, res) {
  await adminIdentity(req);
  const { page, pageSize, from, to, search, status } = queryPage(req);
  let query = db.from('gym_commission_payouts').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (status && status !== 'all') query = query.eq('status', status);
  if (search) query = query.or(`payment_reference.ilike.%${search}%,notes.ilike.%${search}%`);
  const { data, error, count } = await query;
  if (error) throw fail('Could not load payouts.', 503, 'payouts_load_failed');
  const gymIds = [...new Set((data || []).map((row) => row.gym_id).filter(Boolean))];
  const { data: gyms } = gymIds.length ? await db.from('gyms').select('gym_id,name,owner_user_id').in('gym_id', gymIds) : { data: [] };
  const gymMap = new Map((gyms || []).map((row) => [row.gym_id, row]));
  return res.json({ ok: true, ...pageResult((data || []).map((row) => ({ ...row, gym: gymMap.get(row.gym_id) || null })), count, page, pageSize) });
}

async function createPayout(req, res) {
  const context = await adminIdentity(req);
  const input = PayoutCreateInput.parse(req.body || {});
  const { data, error } = await db.rpc('admin_create_gym_commission_payout_v2', {
    p_gym_id: input.gym_id,
    p_commission_ids: input.commission_ids,
    p_admin_id: context.authUser.id,
    p_notes: input.notes || null,
  });
  if (error) throw fail(String(error.message || 'Could not create payout.').replace(/_/g, ' '), 400, 'payout_create_failed');
  return res.status(201).json(data);
}

async function updatePayout(req, res) {
  const context = await adminIdentity(req);
  const payoutId = uuid.parse(req.params.payoutId);
  const input = PayoutUpdateInput.parse(req.body || {});
  if (input.action === 'paid') {
    const { data, error } = await db.rpc('admin_mark_gym_commission_payout_paid', {
      p_payout_id: payoutId,
      p_admin_id: context.authUser.id,
      p_payment_reference: input.payment_reference,
    });
    if (error) throw fail(String(error.message || 'Could not mark payout paid.').replace(/_/g, ' '), 400, 'payout_payment_failed');
    return res.json(data);
  }
  if (input.action === 'failed' || input.action === 'cancelled') {
    const { data, error } = await db.rpc('admin_release_gym_commission_payout', {
      p_payout_id: payoutId,
      p_admin_id: context.authUser.id,
      p_status: input.action,
      p_notes: input.notes,
    });
    if (error) throw fail(String(error.message || 'Could not release payout.').replace(/_/g, ' '), 400, 'payout_release_failed');
    return res.json(data);
  }
  const { data, error } = await db.from('gym_commission_payouts')
    .update({ status: 'processing', notes: input.notes || undefined, updated_at: new Date().toISOString() })
    .eq('payout_id', payoutId)
    .in('status', ['pending', 'failed'])
    .select('*')
    .maybeSingle();
  if (error) throw fail('Could not move payout to processing.', 503, 'payout_update_failed');
  if (!data) throw fail('Payout cannot move to processing from its current status.', 409, 'payout_state_conflict');
  await db.from('admin_logs').insert({ actor_id: context.authUser.id, action: 'gym_commission_payout.processing', entity: 'gym_commission_payout', entity_id: payoutId, details: { notes: input.notes } }).catch(() => null);
  return res.json({ ok: true, payout: data });
}

async function gymPayouts(req, res) {
  const context = await managedGym(req);
  const { data: payouts, error } = await db.from('gym_commission_payouts').select('*').eq('gym_id', context.gymId).order('created_at', { ascending: false }).limit(100);
  if (error) throw fail('Could not load gym payouts.', 503, 'gym_payouts_load_failed');
  const { data: adjustments, error: adjustmentError } = await db.from('gym_commission_adjustments').select('*').eq('gym_id', context.gymId).order('created_at', { ascending: false }).limit(100);
  if (adjustmentError) throw fail('Could not load gym adjustments.', 503, 'gym_adjustments_load_failed');
  return res.json({
    ok: true,
    payouts: payouts || [],
    adjustments: adjustments || [],
    summary: {
      pending: (payouts || []).filter((row) => ['pending', 'processing'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
      paid: (payouts || []).filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0),
      outstanding_adjustments: Math.abs((adjustments || []).filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount || 0), 0)),
      currency: 'INR',
    },
  });
}

const ROUTES = new Map([
  ['get /api/billing/catalog', getCatalog],
  ['get /api/billing/me', getMemberBilling],
  ['get /api/admin/billing/overview', adminOverview],
  ['get /api/admin/billing/plans', adminPlans],
  ['patch /api/admin/billing/plans/:planCode', updateAdminPlan],
  ['get /api/admin/billing/payments', adminPayments],
  ['patch /api/admin/billing/payments/:paymentId', reconcilePayment],
  ['get /api/admin/billing/commissions', adminCommissions],
  ['post /api/admin/billing/commissions/approve', approveCommissions],
  ['get /api/admin/billing/payouts', adminPayouts],
  ['post /api/admin/billing/payouts', createPayout],
  ['patch /api/admin/billing/payouts/:payoutId', updatePayout],
  ['get /api/gym-owner/platform/payouts', gymPayouts],
]);

function patchMethod(method) {
  const previous = express.application[method];
  express.application[method] = function phase4BillingRouteRegistration(path, ...handlers) {
    const handler = ROUTES.get(`${method} ${path}`);
    if (handler) return previous.call(this, path, wrap(handler));
    return previous.call(this, path, ...handlers);
  };
}

for (const method of ['get', 'post', 'patch']) patchMethod(method);

function registerDirectRoutes(app) {
  if (app.__se7enfitPhase4BillingRoutes) return;
  app.__se7enfitPhase4BillingRoutes = true;
  for (const key of ROUTES.keys()) {
    const [method, ...parts] = key.split(' ');
    const path = parts.join(' ');
    app[method](path, (_req, res) => res.status(500).json({ error: 'Secure billing route was not initialized.' }));
  }
  app.use((error, _req, res, next) => {
    if (!error) return next();
    if (res.headersSent) return next(error);
    const output = publicError(error);
    if (output.status >= 500) console.error('[billing-phase4] request failed:', error);
    return res.status(output.status).json(output.body);
  });
}

const originalListen = express.application.listen;
express.application.listen = function listenWithPhase4BillingRoutes(...args) {
  registerDirectRoutes(this);
  return originalListen.apply(this, args);
};
