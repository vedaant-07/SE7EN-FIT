import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import GymOwnerOnboarding from './GymOwnerOnboarding.jsx';

function flattenOwner(raw = {}) {
  const item = raw?.item || raw || {};
  const owner = item.owner || item.gym_owner || item;
  const gym = item.gym || item.gyms?.[0] || owner?.gym || owner?.gyms?.[0] || {};
  const openingHours = gym.opening_hours || owner.opening_hours || {};
  const pricing = gym.pricing || owner.pricing || {};
  return {
    ...owner,
    id: gym.gym_id || gym.id || owner.gym_id || owner.id,
    gym_id: gym.gym_id || gym.id || owner.gym_id,
    user_id: owner.user_id,
    gym_name: gym.name || gym.gym_name || owner.gym_name || owner.name || '',
    city: gym.city || owner.city || '',
    address: gym.address || owner.address || '',
    description: gym.description || owner.description || '',
    opening_time: openingHours.opening_time || owner.opening_time || '06:00',
    closing_time: openingHours.closing_time || owner.closing_time || '22:00',
    monthly_fee: pricing.monthly_fee || owner.monthly_fee || '',
    quarterly_fee: pricing.quarterly_fee || owner.quarterly_fee || '',
    yearly_fee: pricing.yearly_fee || owner.yearly_fee || '',
    facilities: Array.isArray(gym.amenities) ? gym.amenities : Array.isArray(owner.facilities) ? owner.facilities : [],
    referral_code: gym.referral_code || owner.referral_code || '',
    onboarding_complete: Boolean(owner.onboarding_complete || gym.gym_id || gym.id),
  };
}

function toProductionPayload(data = {}) {
  return {
    ...data,
    name: data.gym_name || data.name,
    opening_hours: data.opening_hours || {
      opening_time: data.opening_time || '06:00',
      closing_time: data.closing_time || '22:00',
    },
    pricing: data.pricing || {
      monthly_fee: data.monthly_fee ? Number(data.monthly_fee) : undefined,
      quarterly_fee: data.quarterly_fee ? Number(data.quarterly_fee) : undefined,
      yearly_fee: data.yearly_fee ? Number(data.yearly_fee) : undefined,
    },
    amenities: data.amenities || data.facilities || [],
    facilities: data.facilities || data.amenities || [],
    onboarding_complete: true,
  };
}

export default function GymOwnerOnboardingProduction() {
  useMemo(() => {
    if (base44.entities.__gymOwnerProductionBridge) return;
    base44.entities.__gymOwnerProductionBridge = true;
    base44.entities.GymOwner = {
      async filter() {
        const raw = await base44.gymOwner.getMine().catch(() => null);
        const flat = raw ? flattenOwner(raw) : null;
        return flat?.id ? [flat] : [];
      },
      async create(data = {}) {
        return flattenOwner(await base44.gymOwner.completeOnboarding(toProductionPayload(data)));
      },
      async update(_id, data = {}) {
        return flattenOwner(await base44.gymOwner.completeOnboarding(toProductionPayload(data)));
      },
    };
  }, []);

  return <GymOwnerOnboarding />;
}
