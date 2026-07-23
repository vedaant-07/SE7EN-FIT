-- SE7EN FIT secure billing integrity
-- Run after the production schema migrations.

create unique index if not exists idx_payments_provider_payment_unique
  on public.payments(provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists idx_payments_razorpay_order_unique
  on public.payments ((metadata->>'razorpay_order_id'))
  where provider = 'razorpay' and metadata ? 'razorpay_order_id';

create unique index if not exists idx_subscriptions_provider_reference_unique
  on public.subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists idx_payments_user_status_created
  on public.payments(user_id, status, created_at desc);

create index if not exists idx_subscriptions_user_status_period
  on public.subscriptions(user_id, status, current_period_end desc);

create index if not exists idx_payments_metadata_gin
  on public.payments using gin(metadata);
