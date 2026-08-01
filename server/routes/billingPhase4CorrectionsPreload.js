import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables for billing corrections');
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const Input = z.object({
  status: z.enum(['refunded', 'partially_refunded', 'chargeback', 'cancelled', 'reversed']),
  refunded_amount: z.coerce.number().finite().min(0).optional(),
  provider_event_id: z.string().trim().min(3).max(200).optional().nullable(),
  note: z.string().trim().min(3).max(1000),
}).strict();

const fail = (message, status = 400, code = 'payment_reconcile_failed') => Object.assign(new Error(message), { status, code });
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

async function requireAdmin(req) {
  const identity = req.securityAuthUser || req.authUser;
  if (!identity?.id) throw fail('Authentication required.', 401, 'auth_required');
  const { data, error } = await db.rpc('is_admin', { _user_id: identity.id });
  if (error || data !== true) throw fail('Administrator access required.', 403, 'admin_required');
  return identity;
}

async function reconcilePayment(req, res) {
  const admin = await requireAdmin(req);
  const paymentId = z.string().uuid().parse(req.params.paymentId);
  const input = Input.parse(req.body || {});

  const { data: payment, error: paymentError } = await db
    .from('payments')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (paymentError) throw fail('Could not load payment.', 503, 'payment_lookup_failed');
  if (!payment) throw fail('Payment not found.', 404, 'payment_not_found');

  const { data: commission, error: commissionError } = await db
    .from('gym_commission_ledger')
    .select('commission_id,status,payout_reference')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (commissionError) throw fail('Could not verify commission state.', 503, 'commission_lookup_failed');

  if (commission?.payout_reference && commission.status !== 'paid') {
    const { data: payout } = await db
      .from('gym_commission_payouts')
      .select('payout_id,status')
      .eq('payout_id', commission.payout_reference)
      .maybeSingle();
    if (payout && ['pending', 'processing'].includes(payout.status)) {
      throw fail(
        'Cancel or fail the pending gym payout before reconciling this payment.',
        409,
        'payment_locked_by_payout',
      );
    }
  }

  const grossAmount = Number(payment.amount || 0);
  const refundedAmount = input.refunded_amount === undefined
    ? (input.status === 'partially_refunded' ? Number(payment.refunded_amount || 0) : grossAmount)
    : input.refunded_amount;

  if (refundedAmount > grossAmount) {
    throw fail('Refund cannot exceed the payment amount.', 400, 'refund_amount_invalid');
  }
  if (input.status === 'partially_refunded' && (refundedAmount <= 0 || refundedAmount >= grossAmount)) {
    throw fail('A partial refund must be greater than zero and less than the payment amount.', 400, 'partial_refund_invalid');
  }

  const patch = {
    status: input.status,
    refunded_amount: refundedAmount,
    refunded_at: refundedAmount > 0 ? new Date().toISOString() : null,
    provider_event_id: input.provider_event_id || payment.provider_event_id,
    metadata: {
      ...(payment.metadata || {}),
      reconciliation_note: input.note,
      reconciled_by: admin.id,
      reconciled_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('payments')
    .update(patch)
    .eq('payment_id', paymentId)
    .select('*')
    .single();
  if (error) throw fail('Could not reconcile payment.', 503, 'payment_reconcile_failed');

  await db.from('admin_logs').insert({
    actor_id: admin.id,
    action: 'payment.reconciled',
    entity: 'payment',
    entity_id: paymentId,
    details: input,
  }).catch(() => null);

  return res.json({ ok: true, payment: data });
}

const previousPatch = express.application.patch;
express.application.patch = function billingCorrectionRegistration(path, ...handlers) {
  if (path === '/api/admin/billing/payments/:paymentId') {
    return previousPatch.call(this, path, wrap(reconcilePayment));
  }
  return previousPatch.call(this, path, ...handlers);
};
