const collectorBase = '/api/collector';

export type UserPublic = {
  id: string;
  email: string;
  display_name?: string | null;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
};

export type AuthResponse = {
  user: UserPublic;
  tokens: AuthTokens;
};

export type AgentPublic = {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string | null;
  /** True when the collector stored the API key encrypted and it can be revealed later. */
  key_stored?: boolean;
};

export type AgentCreateResponse = {
  agent: AgentPublic;
  api_key: string;
};

export type AgentKeyResponse = {
  agent_id: string;
  api_key: string;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      // Upstream (proxy/gateway/uvicorn) returned a non-JSON body, e.g. plain
      // "Internal Server Error". Surface a readable message instead of a
      // confusing JSON parse error from the caller.
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}: ${text.slice(0, 200)}` +
            ' — the collector likely crashed or restarted; check its terminal log.'
        );
      }
      throw new Error(`Unexpected non-JSON response from ${res.url}: ${text.slice(0, 200)}`);
    }
  }
  if (!res.ok) {
    const detail =
      data && typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : null;
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function register(email: string, password: string, displayName?: string) {
  const res = await fetch(`${collectorBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName || null }),
  });
  return jsonOrThrow<UserPublic>(res);
}

export async function login(email: string, password: string) {
  const res = await fetch(`${collectorBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return jsonOrThrow<AuthResponse>(res);
}

export async function refresh(refreshToken: string) {
  const res = await fetch(`${collectorBase}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return jsonOrThrow<AuthResponse>(res);
}

export async function logout(refreshToken: string) {
  const res = await fetch(`${collectorBase}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return jsonOrThrow<{ status: string }>(res);
}

export async function fetchMe(accessToken: string) {
  const res = await fetch(`${collectorBase}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return jsonOrThrow<UserPublic>(res);
}

export async function listAgents(accessToken: string) {
  const res = await fetch(`${collectorBase}/agents`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return jsonOrThrow<AgentPublic[]>(res);
}

export async function createAgent(
  accessToken: string,
  name: string,
  options?: { storeEncrypted?: boolean }
) {
  const res = await fetch(`${collectorBase}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name, store_encrypted: Boolean(options?.storeEncrypted) }),
  });
  return jsonOrThrow<AgentCreateResponse>(res);
}

export async function revealAgentKey(accessToken: string, agentId: string) {
  const res = await fetch(`${collectorBase}/agents/${encodeURIComponent(agentId)}/key`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return jsonOrThrow<AgentKeyResponse>(res);
}

export async function deleteAgent(accessToken: string, agentId: string) {
  const res = await fetch(`${collectorBase}/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return jsonOrThrow<{ status: string }>(res);
}

