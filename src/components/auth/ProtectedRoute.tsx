import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?returnUrl=${returnUrl}`} replace />;
  }

  return <Outlet />;
}
