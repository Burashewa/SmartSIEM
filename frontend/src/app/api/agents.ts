import { authFetch } from './auth';

export type AgentApiKeyStorageMode = 'one_time' | 'stored';

export interface AgentRecord {
  agentId: string;
  name: string;
  apiKeyStorageMode: AgentApiKeyStorageMode;
  storedApiKeyAvailable: boolean;
  apiKeyPreview: string;
  allowedIps?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatedAgentRecord {
  agentId: string;
  name: string;
  apiKey: string;
  apiKeyStorageMode: AgentApiKeyStorageMode;
  storedApiKeyAvailable: boolean;
  apiKeyPreview: string;
}

export interface RevealedAgentApiKey {
  agentId: string;
  name: string;
  apiKey: string;
}

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
    // ignore malformed payloads
  }

  return fallback;
}

export async function fetchAgents(): Promise<AgentRecord[]> {
  const response = await authFetch('/api/agents');
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to load agents (${response.status})`));
  }

  return response.json() as Promise<AgentRecord[]>;
}

function parseAllowedIpsInput(raw: string): string[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return [...new Set(trimmed.split(',').map((ip) => ip.trim()).filter(Boolean))];
}

export async function createAgent(
  name: string,
  storeApiKey: boolean,
  allowedIpsInput = '',
): Promise<CreatedAgentRecord> {
  const allowedIps = parseAllowedIpsInput(allowedIpsInput);
  const response = await authFetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      storeApiKey,
      ...(allowedIps?.length ? { allowedIps } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to create agent (${response.status})`));
  }

  return response.json() as Promise<CreatedAgentRecord>;
}

export async function revealAgentApiKey(agentId: string): Promise<RevealedAgentApiKey> {
  const response = await authFetch(`/api/agents/${agentId}/api-key`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to reveal API key (${response.status})`));
  }

  return response.json() as Promise<RevealedAgentApiKey>;
}

export async function regenerateAgentApiKey(
  agentId: string,
  storeApiKey: boolean,
): Promise<CreatedAgentRecord> {
  const response = await authFetch(`/api/agents/${agentId}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeApiKey }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to regenerate API key (${response.status})`));
  }

  return response.json() as Promise<CreatedAgentRecord>;
}

export async function updateAgent(
  agentId: string,
  body: { name?: string; allowedIps?: string[] },
): Promise<AgentRecord> {
  const response = await authFetch(`/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to update agent (${response.status})`));
  }

  return response.json() as Promise<AgentRecord>;
}
