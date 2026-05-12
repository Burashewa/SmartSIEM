import { create } from 'zustand';

import { authService } from '../api/services/auth.service';
import { authStorage } from '../api/client';
import type { User } from '../types/api.types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: authStorage.getAccessToken(),
  refreshToken: authStorage.getRefreshToken(),
  user: null,
  isAuthenticated: Boolean(authStorage.getAccessToken()),
  isLoading: false,
  login: async (username, password) => {
    set({ isLoading: true });
    const tokens = await authService.login(username, password);
    set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      isAuthenticated: true,
      isLoading: false,
    });
    try {
      const user = await authService.me();
      set({ user });
    } catch {
      // Ignore profile fetch errors for now.
    }
  },
  bootstrap: async () => {
    if (!get().accessToken) {
      return;
    }
    try {
      const user = await authService.me();
      set({ user, isAuthenticated: true });
    } catch {
      authStorage.clear();
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      });
    }
  },
  logout: async () => {
    await authService.logout();
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
