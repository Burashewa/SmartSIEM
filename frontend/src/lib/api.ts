import {
  authFetch,
  clearSession,
  getSession,
  login as appLogin,
} from '../app/api/auth';

export async function login(username: string, password: string): Promise<void> {
  await appLogin(username, password);
}

export function logout(): void {
  clearSession();
}

export function isAuthenticated(): boolean {
  return Boolean(getSession()?.accessToken);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await authFetch(path, { ...init, headers });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
