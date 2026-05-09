import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { state } = useAuth();
  const loc = useLocation();

  if (state.status === 'loading') return null;
  if (state.status !== 'authenticated') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

