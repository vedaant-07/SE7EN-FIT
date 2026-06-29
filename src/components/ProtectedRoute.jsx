import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { cacheRouteUser, getPostAuthRoute, normalizeRouteRole, normalizeRouteStatus } from '@/lib/routing';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

function ApprovalStatusScreen({ status }) {
  const blocked = status === 'blocked' || status === 'deactivated';
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${blocked ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>
          {blocked ? '!' : '✓'}
        </div>
        <h1 className="font-heading text-2xl font-bold">
          {blocked ? 'Account access disabled' : 'Admin approval pending'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {blocked
            ? 'Your gym owner account is not active. Please contact SE7EN FIT admin support to reactivate access.'
            : 'Your gym owner account is registered and email verified. You can access the gym owner dashboard after admin approval.'}
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

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
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
    if (role !== 'gym_owner') return <Navigate to={getPostAuthRoute(currentUser)} replace />;
    if (status !== 'active' && !path.includes('pending')) return <ApprovalStatusScreen status={status} />;
    return <Outlet />;
  }

  if (role === 'gym_owner' || role === 'admin') {
    return <Navigate to={getPostAuthRoute(currentUser)} replace />;
  }

  return <Outlet />;
}
