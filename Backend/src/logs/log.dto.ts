export class CreateLogDto {
  timestamp?: string;
  source?: string;
  severity?: string;
  event?: string;
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

  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lon?: number | string;

  tags?: string[];

  metadata?: Record<string, unknown>;

  raw?: Record<string, unknown>;

  message?: string;
  log?: string;
  line?: string;
  rawLine?: string;

  [key: string]: unknown;
}
