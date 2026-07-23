// SE7ENFIT Subscription & Feature Access Utilities

export const PLANS = {
  FREE_TRIAL: 'free_trial',
  FREE: 'free',
  BASIC: 'basic_monthly',
  PREMIUM_MONTHLY: 'premium_monthly',
  PREMIUM_QUARTERLY: 'premium_quarterly',
  PREMIUM_ANNUAL: 'premium_annual',
};

export const PLAN_CONFIG = [
  {
    key: PLANS.FREE_TRIAL,
    label: 'Free Trial',
    price: 0,
    duration: '7 days',
    billing: 'one-time',
    tagline: 'Try SE7ENFIT free',
    color: 'text-muted-foreground',
    border: 'border-border',
    features: ['7-day free access', '5 AI trainer messages/day', '3 food scans total', 'Basic tracking', '2 animated guides', 'Basic challenges'],
  },
  {
    key: PLANS.BASIC,
    label: 'Basic',
    price: 299,
    duration: 'month',
    billing: 'monthly',
    tagline: 'Get started',
    color: 'text-blue-400',
    border: 'border-blue-500/40',
    features: ['20 AI messages/day', '10 food scans/month', 'Basic workout plans', 'Full tracking dashboard', 'Basic challenges', 'Progress analytics'],
  },
  {
    key: PLANS.PREMIUM_MONTHLY,
    label: 'Premium',
    price: 499,
    duration: 'month',
    billing: 'monthly',
    popular: true,
    tagline: 'Unlock everything',
    color: 'text-accent',
    border: 'border-accent',
    features: ['Unlimited AI Trainer', 'Unlimited food scans', 'All animated guides', 'Full progress analytics', 'All challenges + rewards', 'Transformation reports', 'Premium community'],
  },
  {
    key: PLANS.PREMIUM_QUARTERLY,
    label: 'Quarterly',
    price: 999,
    duration: '3 months',
    billing: 'quarterly',
    tagline: 'Best value',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    savings: 'Save ₹498',
    features: ['Everything in Premium', '3 months access', 'Priority support', 'Advanced AI insights'],
  },
  {
    key: PLANS.PREMIUM_ANNUAL,
    label: 'Annual',
    price: 3999,
    duration: 'year',
    billing: 'annual',
    tagline: 'Maximum savings',
    color: 'text-purple-400',
    border: 'border-purple-500/40',
    savings: 'Save ₹1,989',
    features: ['Everything in Premium', '12 months access', 'VIP community badge', 'Exclusive challenges', 'Yearly progress report'],
  },
];

export const isPremiumPlan = (plan) => {
  return [PLANS.PREMIUM_MONTHLY, PLANS.PREMIUM_QUARTERLY, PLANS.PREMIUM_ANNUAL].includes(plan);
};

export const isActivePlan = (subscription) => {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (subscription.end_date) {
    return new Date(subscription.end_date) >= new Date();
  }
  return true;
};

export const isTrialExpired = (subscription) => {
  if (!subscription) return false;
  if (subscription.plan !== PLANS.FREE_TRIAL) return false;
  if (!subscription.end_date) return false;
  return new Date(subscription.end_date) < new Date();
};

export const getDaysRemaining = (endDate) => {
  if (!endDate) return 0;
  const diff = new Date(endDate) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Feature access checker
export const checkFeatureAccess = (subscription, feature) => {
  const plan = subscription?.plan || PLANS.FREE;
  const active = isActivePlan(subscription);

  if (!active) return { allowed: false, reason: 'subscription_expired' };

  const fullAccess = isPremiumPlan(plan);

  const limits = {
    ai_trainer: {
      [PLANS.FREE_TRIAL]: { allowed: true, limit: 5 },
      [PLANS.FREE]: { allowed: true, limit: 3 },
      [PLANS.BASIC]: { allowed: true, limit: 20 },
    },
    food_scan: {
      [PLANS.FREE_TRIAL]: { allowed: true, limit: 3 },
      [PLANS.FREE]: { allowed: false },
      [PLANS.BASIC]: { allowed: true, limit: 10 },
    },
    animated_guides: {
      [PLANS.FREE_TRIAL]: { allowed: true, limit: 2 },
      [PLANS.FREE]: { allowed: false },
      [PLANS.BASIC]: { allowed: true, limit: 5 },
    },
    advanced_analytics: {
      [PLANS.FREE_TRIAL]: { allowed: false },
      [PLANS.FREE]: { allowed: false },
      [PLANS.BASIC]: { allowed: false },
    },
    all_challenges: {
      [PLANS.FREE_TRIAL]: { allowed: false },
      [PLANS.FREE]: { allowed: false },
      [PLANS.BASIC]: { allowed: false },
    },
    transformation_report: {
      [PLANS.FREE_TRIAL]: { allowed: false },
      [PLANS.FREE]: { allowed: false },
      [PLANS.BASIC]: { allowed: false },
    },
    reward_wallet: {
      [PLANS.FREE_TRIAL]: { allowed: true },
      [PLANS.FREE]: { allowed: false },
      [PLANS.BASIC]: { allowed: false },
    },
  };

  if (fullAccess) return { allowed: true, limit: Infinity };

  const featureLimits = limits[feature];
  if (!featureLimits) return { allowed: true };
  return featureLimits[plan] || { allowed: false };
};
