import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { cacheRouteUser, getPostAuthRoute, normalizeRouteRole, normalizeRouteStatus } from '@/lib/routing';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
  </div>
);

function ApprovalStatusScreen({ status, role }) {
  const blocked = status === 'blocked' || status === 'deactivated';
  const isStaff = role === 'gym_staff';
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${blocked ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>
          {blocked ? '!' : '✓'}
        </div>
        <h1 className="font-heading text-2xl font-bold">
          {blocked ? 'Account access disabled' : 'Admin approval pending'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {blocked
            ? `Your ${isStaff ? 'gym staff' : 'gym owner'} access is not active. Contact the gym owner or SE7EN FIT support.`
            : 'Your gym owner account is registered and email verified. You can access the dashboard after admin approval.'}
        </p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const hasToken = Boolean(base44.auth.getToken());
    if ((!authChecked && !isLoadingAuth) || (authChecked && !isAuthenticated && hasToken && !isLoadingAuth)) {
      checkUserAuth();
    }
  }, [authChecked, isAuthenticated, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) return fallback;

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    if (base44.auth.getToken()) return fallback;
    return unauthenticatedElement;
  }

  const currentUser = cacheRouteUser(user || base44.auth.getCachedUser?.() || {});
  const role = normalizeRouteRole(currentUser.role, currentUser);
  const status = normalizeRouteStatus(currentUser);
  const path = location.pathname;

  if (path.startsWith('/admin') && role !== 'admin') {
    return <Navigate to={getPostAuthRoute(currentUser)} replace />;
  }

  if (path.startsWith('/gym-owner')) {
    if (!['gym_owner', 'gym_staff'].includes(role)) return <Navigate to={getPostAuthRoute(currentUser)} replace />;
    if (status !== 'active' && !path.includes('pending')) return <ApprovalStatusScreen status={status} role={role} />;
    return <Outlet />;
  }

  if (['gym_owner', 'gym_staff', 'admin'].includes(role)) {
    return <Navigate to={getPostAuthRoute(currentUser)} replace />;
  }

  return <Outlet />;
}