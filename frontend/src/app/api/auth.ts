export type SiemRole = 'security_analyst' | 'admin';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  role: SiemRole;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  role: SiemRole;
  username: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
}

interface RegisterResponse {
  ok: boolean;
  user: {
    username: string;
    role: SiemRole;
  };
}

const AUTH_STORAGE_KEY = 'smartsiem.auth.tokens';

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return fallback;
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(' ');
    }
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  } catch {
    // ignore
  }
  return fallback;
}

let session: AuthSession | null = null;
let refreshInFlight: Promise<boolean> | null = null;

const hasWindow = () => typeof window !== 'undefined';

const readStoredSession = (): AuthSession | null => {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.username || !parsed.role) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      username: parsed.username,
      role: parsed.role,
    };
  } catch {
    return null;
  }
};

const writeStoredSession = (value: AuthSession | null): void => {
  if (!hasWindow()) return;
  if (!value) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
};

export function getSession(): AuthSession | null {
  if (!session) {
    session = readStoredSession();
  }
  return session;
}

function setSession(value: AuthSession | null): void {
  session = value;
  writeStoredSession(value);
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const msg = await readErrorMessage(
      response,
      `Login failed (${response.status})`,
    );
    throw new Error(msg);
  }
  const data = (await response.json()) as LoginResponse;
  const next: AuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    role: data.role,
    username: data.username,
  };
  setSession(next);
  return next;
}

export async function register(
  username: string,
  password: string,
  role: SiemRole,
): Promise<RegisterResponse> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
  if (!response.ok) {
    const msg = await readErrorMessage(
      response,
      `Registration failed (${response.status})`,
    );
    throw new Error(msg);
  }
  return (await response.json()) as RegisterResponse;
}

async function refresh(): Promise<boolean> {
  const current = getSession();
  if (!current?.refreshToken) return false;
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!response.ok) {
    setSession(null);
    return false;
  }
  const data = (await response.json()) as RefreshResponse;
  setSession({
    ...current,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return true;
}

async function ensureFreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function logout(): Promise<void> {
  const current = getSession();
  try {
    if (current?.refreshToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
    }
  } finally {
    setSession(null);
  }
}

export function clearSession(): void {
  setSession(null);
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const current = getSession();
  const headers = new Headers(init.headers ?? {});
  if (current?.accessToken) {
    headers.set('Authorization', `Bearer ${current.accessToken}`);
  }
  let response = await fetch(input, { ...init, headers });
  if (response.status !== 401) return response;

  const refreshed = await ensureFreshSession();
  if (!refreshed) return response;

  const latest = getSession();
  if (!latest?.accessToken) return response;
  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${latest.accessToken}`);
  response = await fetch(input, { ...init, headers: retryHeaders });
  return response;
}
