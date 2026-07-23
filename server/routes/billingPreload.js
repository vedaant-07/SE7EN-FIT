import crypto from 'crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const RAZORPAY_API = 'https://api.razorpay.com/v1';

const PLAN_CATALOG = {
  basic_monthly: { label: 'Basic', amount: 29900, months: 1 },
  premium_monthly: { label: 'Premium', amount: 49900, months: 1 },
  premium_quarterly: { label: 'Quarterly', amount: 99900, months: 3 },
  premium_annual: { label: 'Annual', amount: 399900, months: 12 },
};

const OFFER_CATALOG = {
  WELCOME20: { type: 'percent', value: 20, firstPurchaseOnly: true },
  SE7EN50: { type: 'flat', value: 5000, plans: ['basic_monthly', 'premium_monthly'], firstPurchaseOnly: true },
  YEARLY25: { type: 'percent', value: 25, plans: ['premium_annual'] },
};

const fail = (message, status = 400, code = 'billing_error') => Object.assign(new Error(message), { status, code });
const safeJson = (value, fallback = {}) => value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
const dateOnly = (value) => value ? String(value).slice(0, 10) : null;

function cleanError(error, fallback = 'Payment service is temporarily unavailable.') {
  const message = String(error?.message || error?.error?.description || error?.error || '').trim();
  if (!message || message === '[object Object]') return fallback;
  return message;
}

function normalizeSubscription(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.subscription_id,
    plan: row.plan_code,
    start_date: dateOnly(row.current_period_start),
    end_date: dateOnly(row.current_period_end),
  };
}

function normalizePayment(row) {
  if (!row) return null;
  const metadata = safeJson(row.metadata);
  return {
    ...row,
    id: row.payment_id,
    plan: metadata.plan_code,
    razorpay_order_id: metadata.razorpay_order_id,
    razorpay_payment_id: row.provider_payment_id,
    original_amount: Number(metadata.original_amount_paise || 0) / 100,
    discount_amount: Number(metadata.discount_amount_paise || 0) / 100,
    paid_at: metadata.paid_at || null,
  };
}

function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function timingSafeHexEqual(left, right) {
  try {
    const a = Buffer.from(String(left || ''), 'hex');
    const b = Buffer.from(String(right || ''), 'hex');
    return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function razorpayAuthHeader() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw fail('Payments are not configured yet. Please contact support.', 503, 'payments_not_configured');
  }
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`;
}

async function razorpayRequest(path, options = {}) {
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw fail(cleanError(data, 'Razorpay could not process this request.'), response.status >= 500 ? 503 : 400, 'razorpay_request_failed');
  }
  return data;
}

async function authContext(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Please log in again.', 401, 'auth_required');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Your session expired. Please log in again.', 401, 'session_expired');
  const { data: profile } = await db.from('profiles').select('*').eq('user_id', data.user.id).maybeSingle();
  if (profile?.status === 'blocked') throw fail('This account is blocked.', 403, 'account_blocked');
  return { user: data.user, profile: profile || {} };
}

async function currentSubscription(userId, { includeExpired = false } = {}) {
  const { data, error } = await db.from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw fail(error.message, 500);

  const now = Date.now();
  const rows = data || [];
  const expiredActive = rows.filter((row) => row.status === 'active' && row.current_period_end && new Date(row.current_period_end).getTime() < now);
  if (expiredActive.length) {
    await db.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).in('subscription_id', expiredActive.map((row) => row.subscription_id));
  }

  const active = rows.find((row) => row.status === 'active' && (!row.current_period_end || new Date(row.current_period_end).getTime() >= now));
  if (active) return normalizeSubscription(active);
  return includeExpired ? normalizeSubscription(rows[0] || null) : null;
}

async function hasSuccessfulPayment(userId) {
  const { count, error } = await db.from('payments')
    .select('payment_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', 'razorpay')
    .eq('status', 'success');
  if (error) throw fail(error.message, 500);
  return Number(count || 0) > 0;
}

function calculateOffer(planCode, offerCode, firstPurchase) {
  const code = String(offerCode || '').trim().toUpperCase();
  if (!code) return { code: null, discount: 0 };
  const offer = OFFER_CATALOG[code];
  if (!offer) throw fail('This offer code is not valid.', 400, 'invalid_offer');
  if (offer.plans && !offer.plans.includes(planCode)) throw fail('This offer is not available for the selected plan.', 400, 'offer_not_eligible');
  if (offer.firstPurchaseOnly && !firstPurchase) throw fail('This starter offer has already been used.', 400, 'offer_already_used');
  const amount = PLAN_CATALOG[planCode].amount;
  const discount = offer.type === 'percent'
    ? Math.round((amount * Number(offer.value || 0)) / 100)
    : Number(offer.value || 0);
  return { code, discount: Math.min(amount - 100, Math.max(0, discount)) };
}

async function findPaymentByOrder(userId, orderId) {
  const { data, error } = await db.from('payments')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'razorpay')
    .contains('metadata', { razorpay_order_id: orderId })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw fail(error.message, 500);
  return data?.[0] || null;
}

async function findPaymentByOrderAnyUser(orderId) {
  const { data, error } = await db.from('payments')
    .select('*')
    .eq('provider', 'razorpay')
    .contains('metadata', { razorpay_order_id: orderId })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw fail(error.message, 500);
  return data?.[0] || null;
}

async function markPaymentVerificationFailure(payment, reason) {
  const metadata = { ...safeJson(payment.metadata), verification_failure: reason, verification_failed_at: new Date().toISOString() };
  await db.from('payments').update({ status: 'verification_failed', metadata }).eq('payment_id', payment.payment_id).eq('user_id', payment.user_id).catch(() => null);
}

async function activatePayment(payment, providerPayment) {
  const metadata = safeJson(payment.metadata);
  const planCode = metadata.plan_code;
  const plan = PLAN_CATALOG[planCode];
  if (!plan) throw fail('The purchased plan is no longer available.', 409, 'plan_unavailable');

  const paymentId = providerPayment.id;
  const orderId = providerPayment.order_id;
  const expectedAmount = Number(metadata.amount_paise || payment.amount * 100 || 0);

  if (String(orderId) !== String(metadata.razorpay_order_id)) {
    await markPaymentVerificationFailure(payment, 'order_mismatch');
    throw fail('Payment verification failed. Please contact support.', 400, 'order_mismatch');
  }
  if (Number(providerPayment.amount || 0) !== expectedAmount || String(providerPayment.currency || '').toUpperCase() !== 'INR') {
    await markPaymentVerificationFailure(payment, 'amount_or_currency_mismatch');
    throw fail('Payment amount verification failed. Please contact support.', 400, 'amount_mismatch');
  }
  if (providerPayment.status !== 'captured' && providerPayment.captured !== true) {
    return { pending: true, message: 'Payment is authorised and waiting for capture. Activation will retry shortly.' };
  }

  const { data: existingSubscriptions, error: existingError } = await db.from('subscriptions')
    .select('*')
    .eq('user_id', payment.user_id)
    .eq('provider', 'razorpay')
    .eq('provider_subscription_id', paymentId)
    .limit(1);
  if (existingError) throw fail(existingError.message, 500);
  if (existingSubscriptions?.[0]) {
    return { pending: false, subscription: normalizeSubscription(existingSubscriptions[0]), idempotent: true };
  }

  const paidAt = providerPayment.created_at
    ? new Date(Number(providerPayment.created_at) * 1000).toISOString()
    : new Date().toISOString();
  const paymentMetadata = {
    ...metadata,
    paid_at: paidAt,
    captured_at: new Date().toISOString(),
    method: providerPayment.method || null,
    bank: providerPayment.bank || null,
    wallet: providerPayment.wallet || null,
    vpa: providerPayment.vpa || null,
    email: providerPayment.email || null,
    contact: providerPayment.contact || null,
  };

  const { error: paymentUpdateError } = await db.from('payments').update({
    provider_payment_id: paymentId,
    status: 'success',
    metadata: paymentMetadata,
  }).eq('payment_id', payment.payment_id).eq('user_id', payment.user_id);
  if (paymentUpdateError && !String(paymentUpdateError.message || '').toLowerCase().includes('duplicate')) {
    throw fail(paymentUpdateError.message, 500);
  }

  const active = await currentSubscription(payment.user_id);
  const now = new Date();
  const canExtend = active?.plan === planCode && active?.current_period_end && new Date(active.current_period_end).getTime() > now.getTime();
  const periodStart = canExtend ? new Date(active.current_period_end) : now;
  const periodEnd = addMonths(periodStart, plan.months);

  const { error: expireError } = await db.from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('user_id', payment.user_id)
    .eq('status', 'active');
  if (expireError) throw fail(expireError.message, 500);

  const subscriptionRow = {
    user_id: payment.user_id,
    plan_code: planCode,
    provider: 'razorpay',
    provider_subscription_id: paymentId,
    status: 'active',
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
  };

  let subscription;
  const { data: inserted, error: insertError } = await db.from('subscriptions').insert(subscriptionRow).select('*').single();
  if (insertError) {
    if (String(insertError.message || '').toLowerCase().includes('duplicate')) {
      const { data: duplicate } = await db.from('subscriptions').select('*').eq('provider', 'razorpay').eq('provider_subscription_id', paymentId).maybeSingle();
      subscription = duplicate;
    } else {
      throw fail(insertError.message, 500);
    }
  } else {
    subscription = inserted;
  }

  return { pending: false, subscription: normalizeSubscription(subscription) };
}

async function verifyCheckoutPayment({ payment, orderId, paymentId, signature }) {
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  if (!timingSafeHexEqual(expected, signature)) {
    await markPaymentVerificationFailure(payment, 'signature_mismatch');
    throw fail('Payment signature verification failed.', 400, 'signature_mismatch');
  }
  const providerPayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  return activatePayment(payment, providerPayment);
}

function sendError(res, error) {
  const status = Number(error?.status || 500);
  if (status >= 500) console.error('[billing]', error);
  res.status(status).json({
    error: status >= 500 ? 'Payment service is temporarily unavailable. Please try again.' : cleanError(error),
    code: error?.code || 'billing_error',
  });
}

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(res, error);
  }
};

async function razorpayWebhook(req, res) {
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) throw fail('Webhook is not configured.', 503, 'webhook_not_configured');
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const received = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    if (!timingSafeHexEqual(expected, received)) throw fail('Invalid webhook signature.', 400, 'invalid_webhook_signature');

    const event = JSON.parse(rawBody.toString('utf8'));
    if (!['order.paid', 'payment.captured'].includes(event?.event)) return res.json({ received: true, ignored: true });
    const providerPayment = event?.payload?.payment?.entity;
    const orderId = providerPayment?.order_id || event?.payload?.order?.entity?.id;
    if (!providerPayment?.id || !orderId) return res.json({ received: true, ignored: true });

    const payment = await findPaymentByOrderAnyUser(orderId);
    if (!payment) return res.json({ received: true, unmatched: true });
    await activatePayment(payment, { ...providerPayment, status: providerPayment.status || 'captured', captured: providerPayment.captured ?? true });
    return res.json({ received: true });
  } catch (error) {
    return sendError(res, error);
  }
}

// Register the webhook before express.json() so Razorpay's raw-body signature can be verified.
const originalUse = express.application.use;
express.application.use = function useWithBillingWebhook(...args) {
  if (!this.__se7enfitBillingWebhookRoute) {
    this.__se7enfitBillingWebhookRoute = true;
    this.post('/api/billing/webhook/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook);
  }
  return originalUse.apply(this, args);
};

function register(app) {
  if (app.__se7enfitBillingRoutes) return;
  app.__se7enfitBillingRoutes = true;

  app.get('/api/billing/subscription', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const subscription = await currentSubscription(user.id, { includeExpired: true });
    res.json({ item: subscription });
  }));

  app.post('/api/billing/order', wrap(async (req, res) => {
    const { user, profile } = await authContext(req);
    const planCode = String(req.body?.plan_code || '').trim();
    const plan = PLAN_CATALOG[planCode];
    if (!plan) throw fail('Select a valid paid plan.', 400, 'invalid_plan');

    const firstPurchase = !(await hasSuccessfulPayment(user.id));
    const offer = calculateOffer(planCode, req.body?.offer_code, firstPurchase);
    const amount = Math.max(100, plan.amount - offer.discount);
    const receipt = `s7f_${String(user.id).slice(0, 8)}_${Date.now()}`.slice(0, 40);

    const order = await razorpayRequest('/orders', {
      method: 'POST',
      body: {
        amount,
        currency: 'INR',
        receipt,
        notes: {
          user_id: user.id,
          plan_code: planCode,
          offer_code: offer.code || '',
        },
      },
    });

    const metadata = {
      razorpay_order_id: order.id,
      receipt,
      plan_code: planCode,
      plan_label: plan.label,
      original_amount_paise: plan.amount,
      discount_amount_paise: offer.discount,
      amount_paise: amount,
      offer_code: offer.code,
      checkout_created_at: new Date().toISOString(),
    };
    const { data: payment, error } = await db.from('payments').insert({
      user_id: user.id,
      provider: 'razorpay',
      amount: amount / 100,
      currency: 'INR',
      status: 'created',
      metadata,
    }).select('*').single();
    if (error) throw fail(error.message, 500);

    res.status(201).json({
      item: {
        payment_reference: payment.payment_id,
        key_id: RAZORPAY_KEY_ID,
        order_id: order.id,
        amount,
        currency: 'INR',
        plan_code: planCode,
        plan_label: plan.label,
        original_amount: plan.amount / 100,
        discount_amount: offer.discount / 100,
        payable_amount: amount / 100,
        offer_code: offer.code,
        prefill: {
          name: profile.full_name || user.user_metadata?.full_name || '',
          email: profile.email || user.email || '',
          contact: profile.phone || user.user_metadata?.phone || '',
        },
      },
    });
  }));

  app.post('/api/billing/verify', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const orderId = String(req.body?.razorpay_order_id || '').trim();
    const paymentId = String(req.body?.razorpay_payment_id || '').trim();
    const signature = String(req.body?.razorpay_signature || '').trim();
    if (!orderId || !paymentId || !signature) throw fail('Payment confirmation is incomplete.', 400, 'missing_payment_confirmation');

    const payment = await findPaymentByOrder(user.id, orderId);
    if (!payment) throw fail('This payment order was not created for your account.', 404, 'payment_order_not_found');
    if (payment.provider_payment_id && payment.provider_payment_id !== paymentId) {
      throw fail('This order is already linked to another payment.', 409, 'payment_conflict');
    }

    const result = await verifyCheckoutPayment({ payment, orderId, paymentId, signature });
    res.status(result.pending ? 202 : 200).json({ item: result });
  }));

  // Read-only compatibility for older screens. Paid records cannot be created or changed through generic entity APIs.
  app.get('/api/entities/Subscription', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const { data, error } = await db.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(Number(req.query.limit || 50));
    if (error) throw fail(error.message, 500);
    res.json((data || []).map(normalizeSubscription));
  }));
  app.get('/api/entities/Subscription/:id', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const { data, error } = await db.from('subscriptions').select('*').eq('subscription_id', req.params.id).eq('user_id', user.id).maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!data) throw fail('Subscription not found.', 404);
    res.json(normalizeSubscription(data));
  }));
  app.get('/api/entities/Payment', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const { data, error } = await db.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(Number(req.query.limit || 50));
    if (error) throw fail(error.message, 500);
    res.json((data || []).map(normalizePayment));
  }));
  app.get('/api/entities/Payment/:id', wrap(async (req, res) => {
    const { user } = await authContext(req);
    const { data, error } = await db.from('payments').select('*').eq('payment_id', req.params.id).eq('user_id', user.id).maybeSingle();
    if (error) throw fail(error.message, 500);
    if (!data) throw fail('Payment not found.', 404);
    res.json(normalizePayment(data));
  }));

  const rejectGenericBillingWrite = (_req, res) => res.status(403).json({ error: 'Billing records are managed only by the secure payment service.', code: 'secure_billing_only' });
  app.post('/api/entities/Subscription', rejectGenericBillingWrite);
  app.put('/api/entities/Subscription/:id', rejectGenericBillingWrite);
  app.delete('/api/entities/Subscription/:id', rejectGenericBillingWrite);
  app.post('/api/entities/Payment', rejectGenericBillingWrite);
  app.put('/api/entities/Payment/:id', rejectGenericBillingWrite);
  app.delete('/api/entities/Payment/:id', rejectGenericBillingWrite);
}

const originalListen = express.application.listen;
express.application.listen = function listenWithBilling(...args) {
  register(this);
  return originalListen.apply(this, args);
};
