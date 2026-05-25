import { Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { useAuth } from './AuthContext';
import { ROUTES } from './routes';

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }

  return (
    <AppLayout session={session} onLogout={logout}>
      {children}
    </AppLayout>
  );
}
