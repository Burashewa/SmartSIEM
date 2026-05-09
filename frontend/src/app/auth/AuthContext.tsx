import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/collectorAuthApi';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: api.UserPublic; accessToken: string; refreshToken: string };

type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
};

const LS_ACCESS = 'smartsiem_access_token';
const LS_REFRESH = 'smartsiem_refresh_token';
const LS_USER = 'smartsiem_user';

const AuthContext = createContext<AuthContextValue | null>(null);

function loadPersisted(): { accessToken: string | null; refreshToken: string | null; user: api.UserPublic | null } {
  try {
    const accessToken = localStorage.getItem(LS_ACCESS);
    const refreshToken = localStorage.getItem(LS_REFRESH);
    const userRaw = localStorage.getItem(LS_USER);
    const user = userRaw ? (JSON.parse(userRaw) as api.UserPublic) : null;
    return { accessToken, refreshToken, user };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

function persistAuthenticated(user: api.UserPublic, tokens: api.AuthTokens) {
  localStorage.setItem(LS_ACCESS, tokens.access_token);
  localStorage.setItem(LS_REFRESH, tokens.refresh_token);
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

function clearPersisted() {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_USER);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const persisted = loadPersisted();
      if (!persisted.accessToken || !persisted.refreshToken) {
        setState({ status: 'anonymous' });
        return;
      }

      // First try current access token, fallback to refresh.
      try {
        const me = await api.fetchMe(persisted.accessToken);
        if (cancelled) return;
        persistAuthenticated(me, { access_token: persisted.accessToken, refresh_token: persisted.refreshToken, token_type: 'bearer' });
        setState({
          status: 'authenticated',
          user: me,
          accessToken: persisted.accessToken,
          refreshToken: persisted.refreshToken,
        });
        return;
      } catch {
        // ignore
      }

      try {
        const refreshed = await api.refresh(persisted.refreshToken);
        if (cancelled) return;
        persistAuthenticated(refreshed.user, refreshed.tokens);
        setState({
          status: 'authenticated',
          user: refreshed.user,
          accessToken: refreshed.tokens.access_token,
          refreshToken: refreshed.tokens.refresh_token,
        });
      } catch {
        if (cancelled) return;
        clearPersisted();
        setState({ status: 'anonymous' });
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async login(email, password) {
        const res = await api.login(email, password);
        persistAuthenticated(res.user, res.tokens);
        setState({
          status: 'authenticated',
          user: res.user,
          accessToken: res.tokens.access_token,
          refreshToken: res.tokens.refresh_token,
        });
      },
      async register(email, password, displayName) {
        await api.register(email, password, displayName);
        const res = await api.login(email, password);
        persistAuthenticated(res.user, res.tokens);
        setState({
          status: 'authenticated',
          user: res.user,
          accessToken: res.tokens.access_token,
          refreshToken: res.tokens.refresh_token,
        });
      },
      async logout() {
        const persisted = loadPersisted();
        try {
          if (persisted.refreshToken) await api.logout(persisted.refreshToken);
        } finally {
          clearPersisted();
          setState({ status: 'anonymous' });
        }
      },
      getAccessToken() {
        if (state.status !== 'authenticated') return null;
        return state.accessToken;
      },
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

