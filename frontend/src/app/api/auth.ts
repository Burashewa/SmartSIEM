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

interface ForgotPasswordResponse {
  message: string;
  devResetUrl?: string;
  emailSent?: boolean;
}

interface ResetPasswordResponse {
  ok: boolean;
  message: string;
}

const AUTH_STORAGE_KEY = 'smartsiem.auth.tokens';
// Client-side maximum session lifetime (ms). After this, require interactive login.
const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return fallback;
    const body = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(body.message)) {
      return body.message.join('. ');
    }
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
  } catch {
    // ignore parse errors
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
    const parsed = JSON.parse(raw) as Partial<AuthSession & { createdAt?: number }>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.username || !parsed.role) return null;
    const createdAt = parsed.createdAt ?? 0;
    // If the stored session is older than our client-side max lifetime, clear it and require login
    if (createdAt && Date.now() - createdAt > MAX_SESSION_MS) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
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
  // Preserve original createdAt (initial login time) if present, so refreshes don't extend lifetime
  try {
    const existingRaw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as { createdAt?: number }) : null;
    const createdAt = existing?.createdAt ?? Date.now();
    const toStore = { ...value, createdAt } as AuthSession & { createdAt: number };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    const toStore = { ...value, createdAt: Date.now() } as AuthSession & { createdAt: number };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toStore));
  }
};

function applyLoginResponse(data: LoginResponse): AuthSession {
  const next: AuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    role: data.role,
    username: data.username,
  };
  setSession(next);
  return next;
}

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
    throw new Error(await readErrorMessage(response, `Login failed (${response.status})`));
  }
  const data = (await response.json()) as LoginResponse;
  return applyLoginResponse(data);
}

export async function loginWithGoogle(credential: string): Promise<AuthSession> {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Google sign-in failed (${response.status})`),
    );
  }
  const data = (await response.json()) as LoginResponse;
  return applyLoginResponse(data);
}

export async function register(
  username: string,
  password: string,
  role: SiemRole,
  email?: string,
): Promise<RegisterResponse> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      role,
      ...(email?.trim() ? { email: email.trim() } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Registration failed (${response.status})`),
    );
  }
  return (await response.json()) as RegisterResponse;
}

export async function requestPasswordReset(
  identifier: string,
): Promise<ForgotPasswordResponse> {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Password reset request failed (${response.status})`),
    );
  }
  return (await response.json()) as ForgotPasswordResponse;
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<ResetPasswordResponse> {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Password reset failed (${response.status})`),
    );
  }
  return (await response.json()) as ResetPasswordResponse;
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

/** Resolve API path; optional VITE_API_BASE_URL for production builds without Vite proxy. */
export function apiPath(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = input.startsWith('/api') ? apiPath(input) : input;
  const current = getSession();
  const headers = new Headers(init.headers ?? {});
  if (current?.accessToken) {
    headers.set('Authorization', `Bearer ${current.accessToken}`);
  }
  let response = await fetch(url, { ...init, headers });
  if (response.status !== 401) return response;

  const refreshed = await ensureFreshSession();
  if (!refreshed) return response;

  const latest = getSession();
  if (!latest?.accessToken) return response;
  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${latest.accessToken}`);
  response = await fetch(url, { ...init, headers: retryHeaders });
  return response;
}
