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
  source: string;
  severity: BackendSeverity | string;
  event: string;
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
  alert_id?: string;
  rule_id?: string;
  rule_name?: string;
  message?: string;
  severity: BackendSeverity | string;
  trigger_time: string;
  ip?: string;
  status: BackendAlertStatus | string;
  context?: Record<string, unknown>;
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

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const response = await fetch('/api/dashboard/summary');

  if (!response.ok) {
    throw new Error(`Failed to load dashboard summary (${response.status})`);
  }

  return response.json() as Promise<DashboardSummaryResponse>;
}

export async function fetchDashboardLogs(): Promise<BackendLogRecord[]> {
  const response = await fetch('/api/logs');

  if (!response.ok) {
    throw new Error(`Failed to load dashboard logs (${response.status})`);
  }

  return response.json() as Promise<BackendLogRecord[]>;
}

export async function fetchDashboardAlerts(): Promise<BackendAlertRecord[]> {
  const response = await fetch('/api/alerts');

  if (!response.ok) {
    throw new Error(`Failed to load dashboard alerts (${response.status})`);
  }

  return response.json() as Promise<BackendAlertRecord[]>;
}

export async function fetchLogs(): Promise<BackendLogRecord[]> {
  const response = await fetch('/api/logs');

  if (!response.ok) {
    throw new Error(`Failed to load logs (${response.status})`);
  }

  return response.json() as Promise<BackendLogRecord[]>;
}

export async function fetchAlerts(): Promise<BackendAlertRecord[]> {
  const response = await fetch('/api/alerts');

  if (!response.ok) {
    throw new Error(`Failed to load alerts (${response.status})`);
  }

  return response.json() as Promise<BackendAlertRecord[]>;
}
