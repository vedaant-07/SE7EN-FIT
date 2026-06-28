import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import GymOwnerDashboard from './GymOwnerDashboard.jsx';

function flattenOwner(raw = {}) {
  const item = raw?.item || raw || {};
  const owner = item.owner || item.gym_owner || item;
  const gym = item.gym || item.gyms?.[0] || owner?.gym || owner?.gyms?.[0] || {};
  const openingHours = gym.opening_hours || owner.opening_hours || {};
  const pricing = gym.pricing || owner.pricing || {};
  if (!owner && !gym) return null;
  return {
    ...owner,
    id: gym.gym_id || gym.id || owner.gym_id || owner.id,
    gym_id: gym.gym_id || gym.id || owner.gym_id,
    user_id: owner.user_id,
    gym_name: gym.name || gym.gym_name || owner.gym_name || owner.name || 'My Gym',
    city: gym.city || owner.city || '',
    address: gym.address || owner.address || '',
    description: gym.description || owner.description || '',
    email: gym.email || owner.email || '',
    phone: gym.phone || owner.phone || '',
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

export default function GymOwnerDashboardProduction() {
  useMemo(() => {
    if (base44.gymOwner.__dashboardBridge) return;
    base44.gymOwner.__dashboardBridge = true;
    const originalGetMine = base44.gymOwner.getMine.bind(base44.gymOwner);
    base44.gymOwner.getMine = async () => flattenOwner(await originalGetMine());
  }, []);

  return <GymOwnerDashboard />;
}
