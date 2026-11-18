import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { getDashboardPath, useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white px-4">
        <div className="surface-matte flex items-center gap-3 px-6 py-4">
          <span className="h-3 w-3 animate-pulse rounded-full bg-mint-dark" />
          <span className="text-sm font-medium text-charcoal-muted">
            Verifying your SafeStop 360 session...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return <>{children}</>;
}
