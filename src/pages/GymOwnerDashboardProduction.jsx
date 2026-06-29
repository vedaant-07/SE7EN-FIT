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

function patchGymOwnerDashboardDataBridge() {
  if (base44.__se7enfitExistingGymOwnerDashboardBridge) return;
  base44.__se7enfitExistingGymOwnerDashboardBridge = true;

  const originalGetMine = base44.gymOwner.getMine.bind(base44.gymOwner);
  const originalUpsert = base44.gymOwner.upsert?.bind(base44.gymOwner);

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
}

export default function GymOwnerDashboardProduction() {
  useMemo(() => {
    patchGymOwnerDashboardDataBridge();
  }, []);

  return <GymOwnerDashboard />;
}
