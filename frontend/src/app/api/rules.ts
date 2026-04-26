export interface BackendRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  triggerCount: number;
  lastTriggered: string | null;
}

export async function fetchRules(): Promise<BackendRule[]> {
  const response = await fetch('/api/rules');

  if (!response.ok) {
    throw new Error(`Failed to load rules (${response.status})`);
  }

  return response.json() as Promise<BackendRule[]>;
}

export async function toggleRule(id: string, enabled: boolean): Promise<{ id: string; enabled: boolean }> {
  const response = await fetch(`/api/rules/${id}/toggle`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    throw new Error(`Failed to toggle rule (${response.status})`);
  }

  return response.json();
}