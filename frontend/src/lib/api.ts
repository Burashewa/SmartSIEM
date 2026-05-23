import { apiClient, authStorage } from '../api/client';
import { authService } from '../api/services/auth.service';

export async function login(username: string, password: string): Promise<void> {
  await authService.login(username, password);
}

export function logout(): void {
  authStorage.clear();
}

export function isAuthenticated(): boolean {
  return Boolean(authStorage.getAccessToken());
}

export const api = {
  get: <T>(path: string) => apiClient.get<T>(path),
  post: <T>(path: string, body?: unknown) => apiClient.post<T>(path, body),
  put: <T>(path: string, body?: unknown) => apiClient.put<T>(path, body),
  patch: <T>(path: string, body?: unknown) => apiClient.patch<T>(path, body),
  delete: <T>(path: string) => apiClient.delete<T>(path),
};
