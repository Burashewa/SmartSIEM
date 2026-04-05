export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface NormalizedLog {
  timestamp: Date;
  source: string;
  severity: Severity;
  /** Canonical event name used by detection rules (may be derived from event+action+status). */
  event: string;

  action?: string;
  status?: string;

  user?: string;
  role?: string;

  ip?: string;

  deviceId?: string;
  sessionId?: string;

  endpoint?: string;
  method?: string;

  resource?: string | null;

  payload?: Record<string, unknown>;

  userAgent?: string;

  latitude?: number;
  longitude?: number;

  tags?: string[];

  metadata?: Record<string, unknown>;

  raw?: Record<string, unknown>;
}
