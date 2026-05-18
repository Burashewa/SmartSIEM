import { authFetch } from './auth';

export interface DashboardMetric {
  value: number;
  trend: string;
  trendLabel: string;
  trendTone: 'positive' | 'negative' | 'neutral';
}

export type BackendSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BackendAlertStatus = 'open' | 'investigating' | 'resolved';

export interface BackendLogRecord {
  _id?: string;
  id?: string;
  event_id?: string;
  timestamp: string;
  agentId?: string;
  userId?: string;
  source: string;
  level?: string;
  severity: BackendSeverity | string;
  event: string;
  message?: string;
  action?: string;
  status?: string;
  user?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  resource?: string | null;
  latitude?: number;
  longitude?: number;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface BackendAlertRecord {
  _id?: string;
  id?: string;
  alert_id?: string;
  rule_id?: string;
  ruleId?: string;
  rule_name?: string;
  ruleName?: string;
  message?: string;
  severity: BackendSeverity | string;
  trigger_time?: string;
  triggeredAt?: string;
  /** Dedup rollup: total fires merged into this row (defaults to 1 if absent). */
  occurrenceCount?: number;
  /** First fire in this dedupe group (Mongo). */
  firstTriggeredAt?: string;
  dedupeGroupKey?: string;
  ip?: string;
  status: BackendAlertStatus | string;
  context?: Record<string, unknown>;
  attackerLocation?: string;
  geo?: {
    ip: string;
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
    isp?: string;
    source: 'context' | 'ip-api' | 'ipwho' | 'private' | 'unknown';
  };
}

export interface DashboardSummaryResponse {
  generatedAt: string;
  metrics: {
    logsToday: DashboardMetric;
    activeAlerts: DashboardMetric;
    criticalThreats: DashboardMetric;
    systemHealth: DashboardMetric;
  };
  charts: {
    logActivity: Array<{
      time: string;
      logs: number;
    }>;
    alertsBySeverity: Array<{
      name: string;
      value: number;
      color: string;
    }>;
    eventsBySource: Array<{
      source: string;
      events: number;
    }>;
  };
}

/** Subset of summary used for frequent KPI polling. */
export type DashboardKpiResponse = Pick<DashboardSummaryResponse, 'generatedAt' | 'metrics'>;

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const response = await authFetch('/api/dashboard/summary');

  if (!response.ok) {
    throw new Error(`Failed to load dashboard summary (${response.status})`);
  }

  return response.json() as Promise<DashboardSummaryResponse>;
}

/** Lightweight KPI metrics (~7 count queries only). Poll often for realtime top row. */
export async function fetchDashboardKpi(): Promise<DashboardKpiResponse> {
  const response = await authFetch('/api/dashboard/kpi');

  if (!response.ok) {
    throw new Error(`Failed to load dashboard KPI (${response.status})`);
  }

  return response.json() as Promise<DashboardKpiResponse>;
}

export async function fetchDashboardLogs(): Promise<BackendLogRecord[]> {
  const response = await authFetch('/api/logs');

  if (!response.ok) {
    throw new Error(`Failed to load dashboard logs (${response.status})`);
  }

  return response.json() as Promise<BackendLogRecord[]>;
}

export async function fetchDashboardAlerts(): Promise<BackendAlertRecord[]> {
  const response = await authFetch('/api/alerts');

  if (!response.ok) {
    throw new Error(`Failed to load dashboard alerts (${response.status})`);
  }

  return response.json() as Promise<BackendAlertRecord[]>;
}

export async function fetchLogs(): Promise<BackendLogRecord[]> {
  const response = await authFetch('/api/logs');

  if (!response.ok) {
    throw new Error(`Failed to load logs (${response.status})`);
  }

  return response.json() as Promise<BackendLogRecord[]>;
}

export async function deleteLog(id: string): Promise<void> {
  const response = await authFetch(`/api/logs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete log ${id} (${response.status})`);
  }
}

export async function fetchAlerts(): Promise<BackendAlertRecord[]> {
  const response = await authFetch('/api/alerts');

  if (!response.ok) {
    throw new Error(`Failed to load alerts (${response.status})`);
  }

  return response.json() as Promise<BackendAlertRecord[]>;
}

export async function fetchAlertById(id: string): Promise<BackendAlertRecord> {
  const response = await authFetch(`/api/alerts/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Failed to load alert ${id} (${response.status})`);
  }

  return response.json() as Promise<BackendAlertRecord>;
}

export async function patchAlertStatus(
  id: string,
  status: 'investigating' | 'resolved' | 'false_positive',
): Promise<void> {
  const response = await authFetch(`/api/alerts/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update alert status (${response.status})`);
  }
}
