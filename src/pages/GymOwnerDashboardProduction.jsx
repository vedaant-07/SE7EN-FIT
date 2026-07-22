import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import GymOwnerDashboard from './GymOwnerDashboard.jsx';

const OWNER_CACHE_KEY = 'se7enfit_gym_owner_profile_cache';

const readJson = (key, fallback = {}) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  return value;
};

const makeReferralCode = (name = 'SE7ENF') => `${String(name || 'SE7ENF').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'SE7ENF'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function normalizeOwner(raw = {}, user = {}) {
  const item = raw?.item || raw || {};
  const owner = item.owner || item.gym_owner || item;
  const gym = item.gym || item.gyms?.[0] || owner?.gym || owner?.gyms?.[0] || {};
  const openingHours = gym.opening_hours || owner.opening_hours || {};
  const pricing = gym.pricing || owner.pricing || {};
  const cached = readJson(OWNER_CACHE_KEY, {});
  const gymId = gym.gym_id || gym.id || owner.gym_id || cached.gym_id || owner.id || cached.id || user.id;

  return writeJson(OWNER_CACHE_KEY, {
    ...cached,
    ...owner,
    id: gymId || 'gym-local',
    gym_id: gymId || 'gym-local',
    user_id: owner.user_id || cached.user_id || user.id,
    owner_name: owner.owner_name || cached.owner_name || user.full_name || user.name || user.email?.split('@')?.[0] || 'Gym Owner',
    email: gym.email || owner.email || cached.email || user.email || '',
    phone: gym.phone || owner.phone || cached.phone || user.phone || user.mobile || '',
    gym_name: gym.name || gym.gym_name || owner.gym_name || owner.name || cached.gym_name || 'SE7EN FIT',
    city: gym.city || owner.city || cached.city || '',
    address: gym.address || owner.address || cached.address || '',
    description: gym.description || owner.description || cached.description || '',
    opening_time: openingHours.opening_time || owner.opening_time || cached.opening_time || '06:00',
    closing_time: openingHours.closing_time || owner.closing_time || cached.closing_time || '22:00',
    monthly_fee: Number(pricing.monthly_fee || owner.monthly_fee || cached.monthly_fee || 1199),
    quarterly_fee: Number(pricing.quarterly_fee || owner.quarterly_fee || cached.quarterly_fee || 2666),
    yearly_fee: Number(pricing.yearly_fee || owner.yearly_fee || cached.yearly_fee || 5656),
    facilities: Array.isArray(gym.amenities) ? gym.amenities : Array.isArray(owner.facilities) ? owner.facilities : (cached.facilities || []),
    referral_code: gym.referral_code || owner.referral_code || cached.referral_code || makeReferralCode(gym.name || owner.gym_name || cached.gym_name),
    onboarding_complete: true,
  });
}

function normalizeChallenge(row = {}) {
  const rules = row.rules && typeof row.rules === 'object' ? row.rules : {};
  return {
    ...row,
    id: row.id || row.challenge_id,
    title: row.title || row.name || 'Gym Challenge',
    target: row.target || rules.target_label || `${rules.target_days || row.duration_days || 7} verified days`,
    reward: row.reward || rules.reward_text || `${row.reward_coins || 0} coins`,
    duration_days: Number(row.duration_days || rules.target_days || 7),
    status: row.status || 'active',
  };
}

function patchGymOwnerDashboardDataBridge() {
  if (base44.__se7enfitExistingGymOwnerDashboardBridge) return;
  base44.__se7enfitExistingGymOwnerDashboardBridge = true;

  const originalGetMine = base44.gymOwner.getMine.bind(base44.gymOwner);
  const originalUpsert = base44.gymOwner.upsert?.bind(base44.gymOwner);
  const challengeEntity = base44.entities.Challenge;

  base44.gymOwner.getMine = async () => {
    const cachedUser = base44.auth.getCachedUser?.() || {};
    const cachedOwner = readJson(OWNER_CACHE_KEY, null);
    try {
      const remoteOwner = await originalGetMine();
      return normalizeOwner(remoteOwner, cachedUser);
    } catch (error) {
      if (cachedOwner) return normalizeOwner(cachedOwner, cachedUser);
      throw error;
    }
  };

  base44.gymOwner.upsert = async (data = {}) => {
    const cachedUser = base44.auth.getCachedUser?.() || {};
    try {
      if (originalUpsert) {
        const saved = await originalUpsert(data);
        return normalizeOwner(saved, cachedUser);
      }
    } catch (error) {
      console.warn('[SE7EN FIT] owner upsert fallback:', error?.message || error);
    }
    return normalizeOwner(data, cachedUser);
  };

  base44.entities.GymOwner = {
    async filter() {
      const cachedUser = base44.auth.getCachedUser?.() || {};
      try {
        const owner = await base44.gymOwner.getMine();
        return owner ? [normalizeOwner(owner, cachedUser)] : [];
      } catch {
        const cachedOwner = readJson(OWNER_CACHE_KEY, null);
        return cachedOwner ? [normalizeOwner(cachedOwner, cachedUser)] : [];
      }
    },
    async create(data = {}) {
      return normalizeOwner(data, base44.auth.getCachedUser?.() || {});
    },
    async update(_id, data = {}) {
      return normalizeOwner(data, base44.auth.getCachedUser?.() || {});
    },
  };

  // The legacy dashboard calls GymChallenge, while production stores these
  // records in the shared Challenge entity. This bridge keeps the UI working
  // without creating a second challenge system.
  base44.entities.GymChallenge = {
    async filter(query = {}) {
      const rows = await challengeEntity.filter({ gym_id: query.gym_id }, '-created_date', 100);
      return rows.map(normalizeChallenge);
    },
    async create(data = {}) {
      const duration = Math.max(1, Number(data.duration_days || 7));
      const rewardCoins = Math.max(0, Number(data.reward_coins || 0));
      const created = await challengeEntity.create({
        gym_id: data.gym_id,
        title: data.title || data.name || 'Gym Challenge',
        description: data.description || `Complete ${data.target || duration} with your gym community.`,
        difficulty: data.difficulty || 'Medium',
        duration_days: duration,
        reward_coins: rewardCoins,
        target_scope: 'gym',
        premium_required: Boolean(data.premium_required),
        status: data.status || 'active',
        rules: {
          metric: data.metric || 'gym_visit',
          threshold: Math.max(1, Number(data.threshold || 1)),
          target_days: duration,
          target_label: data.target || `${duration} verified gym days`,
          reward_text: data.reward || `${rewardCoins} coins`,
          unit: data.unit || 'visit',
          emoji: data.emoji || '🏋️',
          action_path: '/my-gym',
        },
      });
      return normalizeChallenge(created);
    },
    async update(id, data = {}) {
      const patch = { ...data };
      if (patch.is_active !== undefined && patch.status === undefined) patch.status = patch.is_active ? 'active' : 'inactive';
      const updated = await challengeEntity.update(id, patch);
      return normalizeChallenge(updated);
    },
    async delete(id) {
      return challengeEntity.delete(id);
    },
  };
}

export default function GymOwnerDashboardProduction() {
  useMemo(() => {
    patchGymOwnerDashboardDataBridge();
  }, []);

  return <GymOwnerDashboard />;
}
