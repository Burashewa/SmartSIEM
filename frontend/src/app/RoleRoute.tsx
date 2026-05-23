import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { SiemRole } from './api/auth';
import { homePathForRole } from './roleAccess';

export function RoleRoute({ allow, children }: { allow: readonly SiemRole[]; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return null;
  if (!allow.includes(session.role)) {
    return <Navigate to={homePathForRole(session.role)} replace />;
  }
  return <>{children}</>;
}
