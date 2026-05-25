import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getSession,
  logout as logoutRequest,
  type AuthSession,
} from './api/auth';

interface AuthContextValue {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getSession());

  const logout = useCallback(async () => {
    await logoutRequest();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, setSession, logout }),
    [session, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
