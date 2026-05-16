/**
 * Browser calls go to Vite dev proxy paths (/api/worker, /api/collector).
 * Configure targets in .env.development (VITE_PROXY_* used by vite.config.ts).
 */

const workerBase = '/api/worker';
const collectorBase = '/api/collector';

// ---------- Health/stats (existing) ----------

export type CollectorHealth = {
  status: string;
};

export type WorkerHealth = {
  status: string;
  uptime?: number;
  mongodb?: { connected: boolean };
  kafka?: { consumerLag?: Record<string, unknown> };
  timestamp?: string;
};

export type WorkerStats = {
  totalEventsProcessed: number;
  totalAlertsGenerated: number;
  activeRules: number;
  uptime: number;
};

// ---------- Alerts ----------

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type AlertStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'FALSE_POSITIVE';

export type Alert = {
  alert_id: string;
  rule_id?: string;
  rule_name?: string;
  severity?: AlertSeverity | string;
  event_type?: string;
  trigger_time?: string;
  source_ip?: string;
  destination?: string;
  user_id?: string;
  description?: string;
  recommendation?: unknown;
  status?: AlertStatus | string;
  linked_events?: unknown[];
  assignee?: string | null;
  notes?: string | null;
  updated_at?: string;
  [key: string]: unknown;
};

export type AlertListParams = {
  limit?: number;
  offset?: number;
  severity?: AlertSeverity[] | string[];
  status?: AlertStatus[] | string[];
  rule_id?: string;
  event_type?: string;
  source_ip?: string;
  user_id?: string;
  q?: string;
  since?: string;
  until?: string;
};

export type AlertListResponse = {
  items: Alert[];
  total: number;
  limit: number;
  offset: number;
};

export type AlertSummary = {
  total: number;
  open: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  recent: Alert[];
};

// ---------- Logs ----------

export type LogEventDoc = {
  event_id?: string;
  timestamp?: string;
  source_ip?: string;
  user_id?: string;
  host?: string;
  event_type?: string;
  raw_data?: Record<string, unknown>;
  smartsiem?: Record<string, unknown>;
  /** Lifted by /api/worker/logs from `smartsiem.agent_id`. */
  agent_id?: string | null;
  /** Lifted by /api/worker/logs from `smartsiem.agent_name`. */
  agent_name?: string | null;
  /** Lifted by /api/worker/logs from `smartsiem.user_id` (the SmartSIEM owner). */
  owner_user_id?: string | null;
  [key: string]: unknown;
};

export type LogListParams = {
  limit?: number;
  offset?: number;
  event_type?: string[];
  source_ip?: string;
  user_id?: string;
  host?: string;
  agent_id?: string;
  agent_name?: string;
  owner_user_id?: string;
  q?: string;
  since?: string;
  until?: string;
};

export type LogListResponse = {
  items: LogEventDoc[];
  total: number;
  total_capped: boolean;
  limit: number;
  offset: number;
};

export type LogSourcesResponse = {
  items: Array<{ event_type: string; count: number }>;
};

export type LogAgent = {
  agent_id: string | null;
  agent_name: string | null;
  count: number;
  last_seen?: string;
};

export type LogAgentsResponse = { items: LogAgent[] };

// ---------- Rules ----------

export type RuleType = 'threshold' | 'pattern' | 'statistical' | 'sequence';
export type RuleStatus = 'ACTIVE' | 'DISABLED';

export type DetectionRule = {
  rule_id: string;
  name: string;
  description?: string;
  type: RuleType;
  severity: AlertSeverity | string;
  event_type?: string;
  status: RuleStatus | string;
  config?: Record<string, unknown>;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
};

export type RuleListResponse = { items: DetectionRule[]; total: number };

export type RuleUpsert = Omit<Partial<DetectionRule>, 'created_at' | 'updated_at'>;

// ---------- Stats ----------

export type StatsBucket = {
  period: string;
  timestamp: string;
  total_logs: number;
  total_alerts: number;
  alerts_by_severity: Record<string, number>;
  top_source_ips: Array<{ ip: string; count: number }>;
  top_event_types: Array<{ type: string; count: number }>;
};

export type StatsTimeseriesResponse = { period: string; items: StatsBucket[] };
export type StatsSummaryResponse = { period: string; latest: StatsBucket | null };

export type Recommendation = Record<string, unknown>;
export type RecommendationListResponse = { items: Recommendation[]; total: number };

// ---------- Collector metrics & recent logs ----------

export type CollectorMetrics = {
  status: string;
  queue_output: string;
  kafka_topic: string;
  require_ingest_auth: boolean;
  started_at: number;
  uptime_seconds: number;
  counters: Record<string, number>;
  per_source: Record<string, number>;
};

export type CollectorRecentLogs = {
  items: LogEventDoc[];
  limit: number;
};

// ---------- Helpers ----------

async function parseJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const LS_ACCESS = 'smartsiem_access_token';

function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(LS_ACCESS);
  } catch {
    return null;
  }
}

function mergeWorkerAuthHeaders(init?: RequestInit): Headers {
  const h = new Headers(init?.headers);
  if (!h.has('Authorization')) {
    const t = getStoredAccessToken();
    if (t) h.set('Authorization', `Bearer ${t}`);
  }
  return h;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const isWorker = input.startsWith(workerBase);
  const headers = isWorker ? mergeWorkerAuthHeaders(init) : new Headers(init?.headers);
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      detail = body?.error || body?.detail || '';
    } catch {
      try {
        detail = await res.text();
      } catch {
        // ignore
      }
    }
    throw new Error(detail || `Request failed with ${res.status}`);
  }
  if (res.status === 204) {
    return null as unknown as T;
  }
  return (await res.json()) as T;
}

function buildQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      usp.set(key, value.join(','));
    } else {
      usp.set(key, String(value));
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

// ---------- Health/stats (existing) ----------

export async function fetchCollectorHealth(): Promise<CollectorHealth | null> {
  try {
    const res = await fetch(`${collectorBase}/health`, { cache: 'no-store' });
    return parseJson<CollectorHealth>(res);
  } catch {
    return null;
  }
}

export async function fetchWorkerHealth(): Promise<WorkerHealth | null> {
  try {
    const res = await fetch(`${workerBase}/health`, { cache: 'no-store' });
    return parseJson<WorkerHealth>(res);
  } catch {
    return null;
  }
}

export async function fetchWorkerStats(): Promise<WorkerStats | null> {
  try {
    const res = await fetch(`${workerBase}/stats`, { cache: 'no-store' });
    return parseJson<WorkerStats>(res);
  } catch {
    return null;
  }
}

export function isWorkerKafkaHealthy(h: WorkerHealth | null): boolean {
  if (!h?.kafka?.consumerLag || typeof h.kafka.consumerLag !== 'object') return true;
  return !('error' in h.kafka.consumerLag);
}

export function isOverallHealthy(
  collector: CollectorHealth | null,
  worker: WorkerHealth | null
): boolean {
  const collectorOk = collector?.status === 'ok';
  const workerOk =
    worker?.status === 'ok' &&
    worker?.mongodb?.connected === true &&
    isWorkerKafkaHealthy(worker);
  return Boolean(collectorOk && workerOk);
}

export function systemHealthPercent(
  collector: CollectorHealth | null,
  worker: WorkerHealth | null
): number {
  if (isOverallHealthy(collector, worker)) return 100;
  let p = 50;
  if (collector?.status === 'ok') p += 20;
  if (worker?.mongodb?.connected) p += 15;
  if (worker && isWorkerKafkaHealthy(worker)) p += 15;
  return Math.min(99, Math.max(48, p));
}

// ---------- Alerts ----------

export function fetchAlerts(params?: AlertListParams): Promise<AlertListResponse> {
  return requestJson<AlertListResponse>(`${workerBase}/alerts${buildQuery(params)}`);
}

export function fetchAlertSummary(since?: string): Promise<AlertSummary> {
  return requestJson<AlertSummary>(`${workerBase}/alerts/summary${buildQuery({ since })}`);
}

export function fetchAlert(id: string): Promise<Alert> {
  return requestJson<Alert>(`${workerBase}/alerts/${encodeURIComponent(id)}`);
}

export function updateAlert(
  id: string,
  patch: { status?: AlertStatus | string; assignee?: string | null; notes?: string | null }
): Promise<Alert> {
  return requestJson<Alert>(`${workerBase}/alerts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ---------- Logs ----------

export function fetchLogs(params?: LogListParams): Promise<LogListResponse> {
  return requestJson<LogListResponse>(`${workerBase}/logs${buildQuery(params)}`);
}

export function fetchLogSources(): Promise<LogSourcesResponse> {
  return requestJson<LogSourcesResponse>(`${workerBase}/logs/sources`);
}

export function fetchLogAgents(): Promise<LogAgentsResponse> {
  return requestJson<LogAgentsResponse>(`${workerBase}/logs/agents`);
}

// ---------- Rules ----------

export function fetchRules(opts?: { includeInactive?: boolean }): Promise<RuleListResponse> {
  return requestJson<RuleListResponse>(
    `${workerBase}/rules${buildQuery({ include_inactive: opts?.includeInactive })}`
  );
}

export function fetchRule(id: string): Promise<DetectionRule> {
  return requestJson<DetectionRule>(`${workerBase}/rules/${encodeURIComponent(id)}`);
}

export function createRule(rule: RuleUpsert): Promise<DetectionRule> {
  return requestJson<DetectionRule>(`${workerBase}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export function updateRule(id: string, rule: RuleUpsert): Promise<DetectionRule> {
  return requestJson<DetectionRule>(`${workerBase}/rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(rule),
  });
}

export function deleteRule(id: string): Promise<{ status: string; rule_id: string }> {
  return requestJson<{ status: string; rule_id: string }>(
    `${workerBase}/rules/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

export function reloadRules(): Promise<{ status: string; count: number }> {
  return requestJson(`${workerBase}/rules/reload`, { method: 'POST' });
}

// ---------- Stats / Recommendations ----------

export function fetchStatsTimeseries(opts?: {
  period?: string;
  points?: number;
}): Promise<StatsTimeseriesResponse> {
  return requestJson<StatsTimeseriesResponse>(`${workerBase}/stats/timeseries${buildQuery(opts)}`);
}

export function fetchStatsSummary(opts?: { period?: string }): Promise<StatsSummaryResponse> {
  return requestJson<StatsSummaryResponse>(`${workerBase}/stats/summary${buildQuery(opts)}`);
}

export function fetchRecommendations(limit?: number): Promise<RecommendationListResponse> {
  return requestJson<RecommendationListResponse>(
    `${workerBase}/recommendations${buildQuery({ limit })}`
  );
}

// ---------- Collector metrics + recent logs ----------

export async function fetchCollectorMetrics(): Promise<CollectorMetrics | null> {
  try {
    const res = await fetch(`${collectorBase}/metrics`, { cache: 'no-store' });
    return parseJson<CollectorMetrics>(res);
  } catch {
    return null;
  }
}

export function fetchCollectorRecentLogs(
  params?: { limit?: number; event_type?: string; source_ip?: string; q?: string }
): Promise<CollectorRecentLogs> {
  return requestJson<CollectorRecentLogs>(`${collectorBase}/logs/recent${buildQuery(params)}`);
}

// ---------- Collector ingestion (test helper) ----------

export async function postToCollectorIngest(
  payload: unknown,
  apiKey?: string
): Promise<{ status: string } | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      // Support both Authorization Bearer and X-API-Key for collector compatibility.
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }
    const res = await fetch(`${collectorBase}/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let detail = await res.text().catch(() => res.statusText || 'error');
      throw new Error(detail || `Request failed with ${res.status}`);
    }
    return { status: 'accepted' };
  } catch (err) {
    throw err;
  }
}
