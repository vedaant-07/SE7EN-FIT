export function normalizeRouteRole(role, user = {}) {
  const value = String(role || user.role || 'user').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['owner', 'gym_owner', 'gymowner'].includes(value)) return 'gym_owner';
  if (['admin', 'super_admin', 'superadmin'].includes(value)) return 'admin';
  return 'user';
}

export function normalizeRouteStatus(user = {}) {
  const raw = user.account_status || user.status || user.approval_status || user.gym_owner_status || (normalizeRouteRole(user.role, user) === 'gym_owner' ? 'pending' : 'active');
  const value = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['approved', 'active', 'enabled'].includes(value)) return 'active';
  if (['deactivated', 'disabled', 'inactive', 'suspended'].includes(value)) return 'deactivated';
  if (['blocked', 'banned'].includes(value)) return 'blocked';
  if (['pending', 'pending_approval', 'review', 'under_review'].includes(value)) return 'pending';
  return value || 'active';
}

export function getPostAuthRoute(user = {}) {
  const role = normalizeRouteRole(user.role, user);
  if (role === 'admin') return '/admin';
  if (role === 'gym_owner') return '/gym-owner/dashboard';
  return '/';
}

export function cacheRouteUser(user = {}) {
  const role = normalizeRouteRole(user.role, user);
  const status = normalizeRouteStatus({ ...user, role });
  const cached = { ...user, role, active_role: role, status, account_status: status };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('se7enfit_active_role', role);
    if (cached.email || cached.id || cached.user_id) localStorage.setItem('se7enfit_user', JSON.stringify(cached));
  }
  return cached;
}
