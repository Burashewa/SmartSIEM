import { ENDPOINTS } from '../constants/endpoints';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const ACCESS_KEY = 'smartsiem_access_token';
const REFRESH_KEY = 'smartsiem_refresh_token';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) {
    return null;
  }
  const response = await fetch(`${API_BASE}${ENDPOINTS.auth.refresh}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    return null;
  }
  const payload = (await response.json()) as { access_token: string };
  localStorage.setItem(ACCESS_KEY, payload.access_token);
  return payload.access_token;
}

async function requestInternal<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  allowRetry = true,
): Promise<T> {
  const token = localStorage.getItem(ACCESS_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.status === 401 && allowRetry) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return requestInternal<T>(path, method, body, false);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => requestInternal<T>(path, 'GET'),
  post: <T>(path: string, body?: unknown) => requestInternal<T>(path, 'POST', body),
  put: <T>(path: string, body?: unknown) => requestInternal<T>(path, 'PUT', body),
  patch: <T>(path: string, body?: unknown) => requestInternal<T>(path, 'PATCH', body),
  delete: <T>(path: string) => requestInternal<T>(path, 'DELETE'),
  baseUrl: API_BASE,
};

export const authStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
