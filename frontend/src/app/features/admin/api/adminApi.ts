import { authFetch } from '../../../api/auth';

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message === 'signal is aborted without reason');
}

export type Role = 'admin' | 'security_analyst';
export type Outcome = 'success' | 'failure';
export type UserStatus = 'active' | 'disabled' | 'locked';

export interface AdminOverview {
  users: { total: number; active: number; locked: number; disabled: number; admins: number };
  ingestion: { eps: number; logsLast24h: number; logsLastMinute?: number };
  alerts: { open: number; critical: number; high?: number; medium?: number; low?: number; bySeverity: Record<string, number> };
  security: { failedLogins24h: number };
  rules: { enabled: number; total: number; disabled?: number };
  agents: { total: number };
  system: {
    database?: { connected: boolean; state: string; provider: string };
    mongoStatus?: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
    systemStatus: { status: 'healthy' | 'critical'; activeAlerts?: number; criticalThreats?: number };
    activeAlerts?: number;
    criticalThreats?: number;
  };
  recentAudit: AuditEntry[];
  generatedAt: string;
}

export interface Agent {
  name: string;
  agentId: string;
  ownerUsername?: string | null;
  storageMode: string;
  apiKeyStorageMode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  id?: string;
  username: string;
  role: Role;
  isActive: boolean;
  status?: UserStatus;
  isLocked: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  agentCount: number;
  agents?: Agent[];
}

export interface AuditEntry {
  id?: string;
  timestamp: string;
  createdAt?: string;
  username: string;
  action: string;
  outcome: Outcome;
  reason?: string;
  sourceIp?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface ApiList<T> {
  items: T[];
  total: number;
}

const AUDIT_ACTIONS_FALLBACK = [
  'auth.login',
  'auth.user_create',
  'auth.user_block',
  'auth.user_unlock',
  'auth.password_reset',
  'auth.user_update',
];

export const AUDIT_ACTIONS = AUDIT_ACTIONS_FALLBACK;

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(' ');
    if (body.message) return body.message;
  } catch {
    // Use fallback below.
  }
  return fallback;
}

function adminErrorMessage(status: number, detail: string): string {
  if (status === 401) {
    return 'Session expired or missing. Sign in again with an admin account.';
  }
  if (status === 403) {
    return detail || 'Admin role required. Sign in with an admin account.';
  }
  if (status >= 500) {
    return 'Backend unavailable. Ensure the NestJS server is running.';
  }
  return detail;
}

async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await authFetch(path, { ...init, headers, signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new Error('Cannot reach backend. Start the NestJS server and reload.');
  }
  if (!response.ok) {
    const detail = await readError(response, `Admin request failed (${response.status})`);
    throw new Error(adminErrorMessage(response.status, detail));
  }
  return (await response.json()) as T;
}

function normalizeUser(user: Omit<AdminUser, 'isLocked'> & { isLocked?: boolean }): AdminUser {
  const isLocked = user.isLocked ?? user.status === 'locked';
  return {
    ...user,
    isLocked,
    agentCount: user.agentCount ?? 0,
  };
}

function normalizeAgent(agent: Agent): Agent {
  return {
    ...agent,
    storageMode: agent.storageMode ?? agent.apiKeyStorageMode ?? 'unknown',
  };
}

function normalizeAudit(entry: AuditEntry): AuditEntry {
  const timestamp = entry.timestamp ?? entry.createdAt ?? new Date().toISOString();
  const outcome: Outcome = entry.outcome === 'failure' ? 'failure' : 'success';
  return { ...entry, timestamp, outcome };
}

function normalizeOverview(overview: AdminOverview): AdminOverview {
  const system = overview.system ?? {
    systemStatus: { status: 'critical' as const },
  };
  const systemStatus = system.systemStatus ?? { status: 'critical' as const };
  return {
    ...overview,
    alerts: {
      ...overview.alerts,
      bySeverity: overview.alerts?.bySeverity ?? {},
    },
    system: {
      ...system,
      mongoStatus:
        system.mongoStatus ??
        (system.database?.state as AdminOverview['system']['mongoStatus']) ??
        'disconnected',
      systemStatus,
      activeAlerts: system.activeAlerts ?? systemStatus.activeAlerts ?? overview.alerts?.open ?? 0,
      criticalThreats:
        system.criticalThreats ?? systemStatus.criticalThreats ?? overview.alerts?.critical ?? 0,
    },
    recentAudit: (overview.recentAudit ?? []).map(normalizeAudit),
  };
}

export const adminApi = {
  async getOverview(signal?: AbortSignal): Promise<AdminOverview> {
    return normalizeOverview(await request<AdminOverview>('/api/admin/overview', {}, signal));
  },

  async getUsers(signal?: AbortSignal): Promise<AdminUser[]> {
    const data = await request<ApiList<Omit<AdminUser, 'isLocked'> & { isLocked?: boolean }>>(
      '/api/admin/users',
      {},
      signal,
    );
    return data.items.map(normalizeUser);
  },

  async getUser(username: string, signal?: AbortSignal): Promise<AdminUser | undefined> {
    const data = await request<{ user: Omit<AdminUser, 'isLocked'> & { isLocked?: boolean }; agents: Agent[] }>(
      `/api/admin/users/${encodeURIComponent(username)}`,
      {},
      signal,
    );
    return normalizeUser({
      ...data.user,
      agents: data.agents.map(normalizeAgent),
      agentCount: data.agents.length,
    });
  },

  async createUser(body: { username: string; password: string; role: Role }): Promise<AdminUser> {
    const created = await request<{ username: string; role: Role }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return normalizeUser({
      username: created.username,
      role: created.role,
      isActive: true,
      failedLoginAttempts: 0,
      agentCount: 0,
    });
  },

  async updateUser(username: string, body: { role?: Role; isActive?: boolean }): Promise<AdminUser> {
    const updated = await request<{ username: string; role: Role; isActive: boolean }>(
      `/api/admin/users/${encodeURIComponent(username)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
    return normalizeUser({ ...updated, failedLoginAttempts: 0, agentCount: 0 });
  },

  async unlockUser(username: string): Promise<AdminUser> {
    await request<{ username: string; unlocked: boolean }>(
      `/api/admin/users/${encodeURIComponent(username)}/unlock`,
      { method: 'POST' },
    );
    const user = await this.getUser(username);
    if (!user) throw new Error('User not found after unlock');
    return user;
  },

  async resetPassword(username: string, body: { newPassword: string }): Promise<{ ok: true }> {
    await request(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: body.newPassword }),
    });
    return { ok: true };
  },

  async getAuditLog(
    params: {
      limit?: number;
      offset?: number;
      username?: string;
      action?: string;
      since?: string;
      until?: string;
    },
    signal?: AbortSignal,
  ): Promise<AuditResponse> {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') search.set(key, String(value));
    });
    const data = await request<ApiList<AuditEntry> & { limit: number; offset: number }>(
      `/api/admin/audit?${search.toString()}`,
      {},
      signal,
    );
    return {
      entries: data.items.map(normalizeAudit),
      total: data.total,
      limit: data.limit,
      offset: data.offset,
    };
  },

  async getAgents(signal?: AbortSignal): Promise<Agent[]> {
    const data = await request<ApiList<Agent>>('/api/admin/agents', {}, signal);
    return data.items.map(normalizeAgent);
  },
};
