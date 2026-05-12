export interface ApiListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type AlertStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface LogEntry {
  id: string;
  timestamp: string;
  event: {
    id: string;
    category: string;
    type: string;
    action: string;
    outcome: string;
    severity: string;
  };
  source: {
    ip?: string | null;
    port?: number | null;
    host?: { name?: string | null } | null;
    geo?: {
      country_name?: string | null;
      city_name?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  };
  destination?: {
    ip?: string | null;
    port?: number | null;
    host?: { name?: string | null } | null;
  };
  user?: {
    name?: string | null;
    domain?: string | null;
  };
  network?: {
    transport?: string | null;
  };
  process?: {
    command_line?: string | null;
  };
  message: string;
  raw_log: string;
  deviceId?: string;
}

export interface Alert {
  id: string;
  alert_id: string;
  rule_id: string;
  rule_name: string;
  severity: AlertSeverity;
  event_type: string;
  trigger_time: string;
  source_ip?: string | null;
  user_id?: string | null;
  description: string;
  linked_events: unknown[];
  recommendation?: {
    summary?: string;
    action_steps?: string[];
  } | null;
  status: AlertStatus;
}

export interface DetectionRule {
  id: string;
  rule_id: string;
  name: string;
  type: string;
  severity: string;
  event_type: string;
  config: Record<string, unknown>;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface Agent {
  id?: string;
  agent_id: string;
  hostname?: string | null;
  ip?: string | null;
  status: string;
  last_seen?: string | null;
}

export interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  description: string;
  created_at: string;
}

export interface Report {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface DashboardKpis {
  total_events: number;
  total_alerts: number;
  total_agents: number;
  open_alerts: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
