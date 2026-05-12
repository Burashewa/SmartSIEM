import { apiClient, authStorage } from '../client';
import { ENDPOINTS } from '../../constants/endpoints';
import type { AuthTokens, User } from '../../types/api.types';

export const authService = {
  async login(username: string, password: string): Promise<AuthTokens> {
    const params = new URLSearchParams();
    params.set('username', username);
    params.set('password', password);
    const response = await fetch(`${apiClient.baseUrl}${ENDPOINTS.auth.login}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) {
      throw new Error('Invalid credentials');
    }
    const tokens = (await response.json()) as AuthTokens;
    authStorage.setTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },
  me: () => apiClient.get<User>(ENDPOINTS.auth.me),
  logout: async () => {
    try {
      await apiClient.post(ENDPOINTS.auth.logout);
    } finally {
      authStorage.clear();
    }
  },
};
