import type { BackendAlertRecord, BackendLogRecord } from '../api/dashboard';

export type WidgetSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AttackLocation {
  id: string;
  label: string;
  count: number;
  lat: number;
  lng: number;
  severity: WidgetSeverity;
  sourceIp?: string;
}

export interface StreamEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  message: string;
  source: string;
}

export interface RecentAlertRecord {
  id: string;
  timestamp: string;
  severity: WidgetSeverity;
  sourceIp: string;
  destination: string;
  /** Short narrative (table / modal); includes backend rollup message when deduped. */
  description: string;
  /** Backend alert.message (may be “IP triggered rule N times…” when deduped). */
  message?: string;
  occurrenceCount?: number;
  firstTriggeredAt?: string;
  logSource: string;
  status: 'New' | 'In-Progress' | 'Resolved';
  ruleId: string;
  ruleName: string;
  attackerLocation: string;
  attackerGeo?: {
    city?: string;
    region?: string;
    country?: string;
    lat?: number;
    lng?: number;
    isp?: string;
    source?: string;
  };
}

export function buildAttackLocationsFromAlerts(alerts: BackendAlertRecord[]): AttackLocation[] {
  const clusters = new Map<
    string,
    {
      latTotal: number;
      lngTotal: number;
      count: number;
      severity: WidgetSeverity;
      label: string;
      sourceIp?: string;
    }
  >();

  for (const alert of alerts) {
    const lat = readNumber(alert.geo?.lat);
    const lng = readNumber(alert.geo?.lng);

    if (lat === undefined || lng === undefined || !isValidGeoPoint(lat, lng)) {
      continue;
    }

    const key = `${lat.toFixed(1)}:${lng.toFixed(1)}`;
    const existing = clusters.get(key);
    const severity = normalizeSeverity(alert.severity);
    const label = formatGeoLabel(alert.geo) ?? alert.attackerLocation ?? describeGeoRegion(lat, lng);

    if (existing) {
      existing.latTotal += lat;
      existing.lngTotal += lng;
      existing.count += 1;
      existing.severity = higherSeverity(existing.severity, severity);
      continue;
    }

    clusters.set(key, {
      latTotal: lat,
      lngTotal: lng,
      count: 1,
      severity,
      label,
      sourceIp: readString(alert.ip) ?? readString(alert.geo?.ip),
    });
  }

  return Array.from(clusters.entries())
    .map(([id, cluster]) => ({
      id,
      label: cluster.label,
      count: cluster.count,
      lat: roundToSingleDecimal(cluster.latTotal / cluster.count),
      lng: roundToSingleDecimal(cluster.lngTotal / cluster.count),
      severity: cluster.severity,
      sourceIp: cluster.sourceIp,
    }))
    .sort((left, right) => {
      const severityDelta = severityWeight(right.severity) - severityWeight(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return right.count - left.count;
    })
    .slice(0, 6);
}

export function buildAttackLocations(logs: BackendLogRecord[]): AttackLocation[] {
  const clusters = new Map<
    string,
    {
      latTotal: number;
      lngTotal: number;
      count: number;
      severity: WidgetSeverity;
      label: string;
    }
  >();

  for (const log of logs) {
    const lat = readNumber(log.latitude);
    const lng = readNumber(log.longitude);

    if (lat === undefined || lng === undefined || !isValidGeoPoint(lat, lng)) {
      continue;
    }

    const key = `${lat.toFixed(1)}:${lng.toFixed(1)}`;
    const existing = clusters.get(key);
    const severity = normalizeSeverity(log.severity);
    const label = resolveGeoLabel(log, lat, lng);

    if (existing) {
      existing.latTotal += lat;
      existing.lngTotal += lng;
      existing.count += 1;
      existing.severity = higherSeverity(existing.severity, severity);
      continue;
    }

    clusters.set(key, {
      latTotal: lat,
      lngTotal: lng,
      count: 1,
      severity,
      label,
    });
  }

  return Array.from(clusters.entries())
    .map(([id, cluster]) => ({
      id,
      label: cluster.label,
      count: cluster.count,
      lat: roundToSingleDecimal(cluster.latTotal / cluster.count),
      lng: roundToSingleDecimal(cluster.lngTotal / cluster.count),
      severity: cluster.severity,
    }))
    .sort((left, right) => {
      const severityDelta =
        severityWeight(right.severity) - severityWeight(left.severity);

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return right.count - left.count;
    })
    .slice(0, 6);
}

export function buildStreamEvents(logs: BackendLogRecord[]): StreamEvent[] {
  return [...logs]
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
    .slice(0, 40)
    .map((log, index) => ({
      id:
        readString(log._id) ??
        readString(log.id) ??
        `${log.timestamp}-${log.source}-${index}`,
      timestamp: log.timestamp,
      type: resolveStreamType(log),
      message: buildStreamMessage(log),
      source: log.source || 'Unknown source',
    }));
}

export function buildRecentAlerts(alerts: BackendAlertRecord[]): RecentAlertRecord[] {
  return [...alerts]
    .sort(
      (left, right) =>
        new Date(readAlertTimestamp(right)).getTime() - new Date(readAlertTimestamp(left)).getTime(),
    )
    .slice(0, 10)
    .map((alert, index) => {
      const context = asRecord(alert.context);
      const normalizedRuleId =
        readString(alert.rule_id) ?? readString(alert.ruleId) ?? readString(alert.alert_id) ?? `alert-${index}`;
      const ruleName =
        readString(alert.rule_name) ?? humanizeRuleId(normalizedRuleId);

      // Build a more descriptive alert message
      const alertDetails: string[] = [];
      if (readString(alert.ip)) {
        alertDetails.push(`IP: ${alert.ip}`);
      }
      if (context && readString(context.endpoint)) {
        alertDetails.push(`Endpoint: ${context.endpoint}`);
      }
      if (context && readString(context.user)) {
        alertDetails.push(`User: ${context.user}`);
      }
      if (context && readString(context.action)) {
        alertDetails.push(`Action: ${context.action}`);
      }

      const rollup = readPositiveInt(alert.occurrenceCount);
      const backendMessage = readString(alert.message);
      const narrative =
        backendMessage ??
        (alertDetails.length > 0 ? `${ruleName} - ${alertDetails.join(', ')}` : ruleName);

      return {
        id:
          readString(alert._id) ??
          readString(alert.id) ??
          readString(alert.alert_id) ??
          `${normalizedRuleId}-${readAlertTimestamp(alert)}-${index}`,
        timestamp: readAlertTimestamp(alert),
        severity: normalizeSeverity(alert.severity),
        sourceIp:
          readString(alert.ip) ??
          readString(context?.ip) ??
          readString(context?.sourceIp) ??
          'Unknown',
        destination:
          readString(context?.endpoint) ??
          readString(context?.resource) ??
          readString(context?.destination) ??
          readString(context?.target) ??
          readString(context?.targetIp) ??
          readString(context?.path) ??
          'N/A',
        description: narrative,
        message: backendMessage,
        occurrenceCount: rollup,
        firstTriggeredAt: readString(alert.firstTriggeredAt),
        logSource:
          readString(context?.source) ??
          readString(context?.logSource) ??
          humanizeRuleId(normalizedRuleId),
        status: normalizeAlertStatus(alert.status),
        ruleId: normalizedRuleId,
        ruleName,
        attackerLocation:
          readString(alert.attackerLocation) ??
          formatGeoLabel(alert.geo) ??
          'Location unavailable',
        attackerGeo: alert.geo,
      };
    });
}

function readAlertTimestamp(alert: BackendAlertRecord): string {
  return readString(alert.trigger_time) ?? readString(alert.triggeredAt) ?? new Date().toISOString();
}

function formatGeoLabel(
  geo?: BackendAlertRecord['geo'],
): string | undefined {
  if (!geo) return undefined;
  const city = readString(geo.city);
  const region = readString(geo.region);
  const country = readString(geo.country);
  const parts = [city, region, country].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (geo.source === 'private') return 'Private network';
  return undefined;
}

function buildStreamMessage(log: BackendLogRecord): string {
  const eventLabel = humanizeEvent(log.event);
  const details: string[] = [];

  if (readString(log.ip)) {
    details.push(`src ${log.ip}`);
  }

  if (readString(log.endpoint)) {
    details.push(`dst ${log.endpoint}`);
  } else if (readString(log.resource)) {
    details.push(`dst ${log.resource}`);
  }

  if (readString(log.user)) {
    details.push(`user ${log.user}`);
  }

  if (readString(log.action)) {
    details.push(`action ${String(log.action).toLowerCase()}`);
  }

  if (readString(log.status)) {
    details.push(`status ${String(log.status).toLowerCase()}`);
  }

  return details.length > 0
    ? `${log.source}: ${eventLabel} | ${details.join(' | ')}`
    : `${log.source}: ${eventLabel}`;
}

function resolveStreamType(log: BackendLogRecord): StreamEvent['type'] {
  const status = `${log.status ?? ''}`.toLowerCase();
  const action = `${log.action ?? ''}`.toLowerCase();
  const severity = normalizeSeverity(log.severity);

  if (
    status.includes('success') ||
    action.includes('allow') ||
    action.includes('resolved') ||
    action.includes('updated')
  ) {
    return 'success';
  }

  if (severity === 'critical') {
    return 'critical';
  }

  if (severity === 'high' || severity === 'medium') {
    return 'warning';
  }

  return 'info';
}

function resolveGeoLabel(log: BackendLogRecord, lat: number, lng: number): string {
  const raw = asRecord(log.raw);
  const metadata = asRecord(log.metadata);
  const rawLocation = asRecord(raw?.location);
  const rawGeo = asRecord(raw?.geo);
  const metadataLocation = asRecord(metadata?.location);
  const metadataGeo = asRecord(metadata?.geo);
  const candidates = [
    joinLocation(readString(rawLocation?.city) ?? readString(rawGeo?.city), readString(rawLocation?.country) ?? readString(rawGeo?.country)),
    joinLocation(readString(metadataLocation?.city) ?? readString(metadataGeo?.city), readString(metadataLocation?.country) ?? readString(metadataGeo?.country)),
    readString(rawLocation?.country),
    readString(rawGeo?.country),
    readString(metadataLocation?.country),
    readString(metadataGeo?.country),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return describeGeoRegion(lat, lng);
}

function joinLocation(city?: string, country?: string): string | undefined {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country;
}

function describeGeoRegion(lat: number, lng: number): string {
  if (matchesBounds(lat, lng, 24, 49, -125, -66)) return 'United States';
  if (matchesBounds(lat, lng, 42, 83, -141, -52)) return 'Canada';
  if (matchesBounds(lat, lng, -34, 6, -74, -34)) return 'Brazil';
  if (matchesBounds(lat, lng, 47, 55, 5, 16)) return 'Germany';
  if (matchesBounds(lat, lng, 41, 52, -5, 9)) return 'France';
  if (matchesBounds(lat, lng, 49, 61, -8, 2)) return 'United Kingdom';
  if (matchesBounds(lat, lng, 18, 54, 73, 135)) return 'China';
  if (matchesBounds(lat, lng, 6, 37, 68, 97)) return 'India';
  if (matchesBounds(lat, lng, 41, 82, 19, 180)) return 'Russia';
  if (matchesBounds(lat, lng, 30, 46, 129, 146)) return 'Japan';
  if (matchesBounds(lat, lng, -44, -10, 112, 154)) return 'Australia';
  if (matchesBounds(lat, lng, -35, -22, 16, 33)) return 'South Africa';
  if (matchesBounds(lat, lng, 29, 34, 34, 36)) return 'Israel';
  if (matchesBounds(lat, lng, 22, 27, 51, 57)) return 'United Arab Emirates';

  if (lat >= 15 && lng >= -170 && lng <= -30) return 'North America';
  if (lat < 15 && lat >= -60 && lng >= -90 && lng <= -30) return 'South America';
  if (lat >= 35 && lng >= -15 && lng <= 40) return 'Europe';
  if (lat >= -35 && lat < 35 && lng >= -20 && lng <= 55) return 'Africa';
  if (lat >= -10 && lng >= 40 && lng <= 180) return 'Asia-Pacific';

  return 'Global';
}

function normalizeSeverity(value: unknown): WidgetSeverity {
  const severity = `${value ?? ''}`.toLowerCase();

  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function normalizeAlertStatus(value: unknown): RecentAlertRecord['status'] {
  const status = `${value ?? ''}`.toLowerCase();

  if (status === 'resolved') return 'Resolved';
  if (status === 'investigating') return 'In-Progress';
  return 'New';
}

function humanizeEvent(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function humanizeRuleId(rule_id?: string): string {
  if (!rule_id?.trim()) {
    return 'Unknown rule';
  }

  return humanizeEvent(rule_id.replace(/\./g, '-'));
}

function severityWeight(severity: WidgetSeverity): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function higherSeverity(left: WidgetSeverity, right: WidgetSeverity): WidgetSeverity {
  return severityWeight(left) >= severityWeight(right) ? left : right;
}

function matchesBounds(
  lat: number,
  lng: number,
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): boolean {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

function isValidGeoPoint(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function readPositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = parseInt(value.trim(), 10);
    return n >= 1 ? n : undefined;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Recharts axis ticks: never show `0K` for small integers. */
export function formatChartAxisCount(value: number): string {
  const v = Math.abs(Number(value));
  if (!Number.isFinite(v)) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(Math.round(v));
}

export interface LogActivitySeriesPoint {
  time: string;
  logs: number;
}

/** Parse log timestamps from API (ISO string, millis number, or rare `$date` shapes). */
export function parseLogTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    const nested = rec.$date;
    if (typeof nested === 'string' || typeof nested === 'number') {
      const t = Date.parse(String(nested));
      if (!Number.isNaN(t)) return t;
    }
  }
  return undefined;
}

/**
 * Bucket logs into time buckets. Expands the window to include actual log timestamps (so old data
 * still draws) and widens bucket size when the span is long.
 */
export function buildLogActivitySeries(
  logs: BackendLogRecord[],
  opts?: { lookbackHours?: number; bucketMinutes?: number; maxBuckets?: number },
): LogActivitySeriesPoint[] {
  const lookbackHours = opts?.lookbackHours ?? 24;
  const maxBuckets = opts?.maxBuckets ?? 40;
  const preferredBucketMin = Math.max(5, Math.min(opts?.bucketMinutes ?? 60, 1440));
  let bucketMs = preferredBucketMin * 60 * 1000;

  const now = Date.now();
  const defaultStart = now - lookbackHours * 60 * 60 * 1000;

  const parsed = logs
    .map((l) => parseLogTimestamp(l.timestamp))
    .filter((t): t is number => t !== undefined);

  let start = defaultStart;
  let end = now;
  if (parsed.length > 0) {
    const minTs = Math.min(...parsed);
    const maxTs = Math.max(...parsed);
    start = Math.min(defaultStart, minTs);
    end = Math.max(now, maxTs);
    const cap = 30 * 24 * 60 * 60 * 1000;
    start = Math.max(start, end - cap);
  }

  let span = end - start;
  if (span < bucketMs) {
    start = end - bucketMs;
    span = bucketMs;
  }

  while (span / bucketMs > maxBuckets) {
    bucketMs *= 2;
  }

  const bucketMinutesResolved = bucketMs / 60_000;
  const firstBucket = Math.floor(start / bucketMs) * bucketMs;
  const buckets = new Map<number, number>();

  for (let t = firstBucket; t <= end; t += bucketMs) {
    buckets.set(t, 0);
  }

  for (const log of logs) {
    const ts = parseLogTimestamp(log.timestamp);
    if (ts === undefined || ts < firstBucket || ts > end + bucketMs) continue;
    const b = Math.floor(ts / bucketMs) * bucketMs;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, count]) => ({
      time: formatActivityBucketLabel(t, bucketMinutesResolved),
      logs: count,
    }));
}

function formatActivityBucketLabel(ts: number, bucketMinutes: number): string {
  const d = new Date(ts);
  if (bucketMinutes >= 1440) {
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: bucketMinutes < 60 ? '2-digit' : undefined,
  });
}

export interface EventsByUserAgentDatum {
  /** Display key: account · agent */
  source: string;
  events: number;
}

/**
 * Count logs by analyst account (`user`, often an email) and collecting `agentId`.
 */
export function buildEventsByUserAndAgent(
  logs: BackendLogRecord[],
  topN = 10,
  /** `agentId` → display name from GET /api/agents */
  agentNamesById?: Record<string, string>,
): EventsByUserAgentDatum[] {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const accountRaw = readString(log.user);
    const account =
      accountRaw ??
      extractEmailFromRaw(log.raw) ??
      extractEmailFromRaw(log.payload as Record<string, unknown> | undefined) ??
      'Unknown account';
    const agentId = readString(log.agentId);
    const registeredName = agentId ? agentNamesById?.[agentId]?.trim() : undefined;
    const agentLabel = registeredName
      ? registeredName
      : agentId
        ? `Agent ${agentId}`
        : 'Unknown agent';
    const key = `${account} · ${agentLabel}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([source, events]) => ({ source, events }));
}

function extractEmailFromRaw(raw?: Record<string, unknown>): string | undefined {
  const r = raw;
  if (!r) return undefined;

  const ctx =
    asRecord(asRecord(r.rawEvent)?.context) ??
    asRecord(r.context);
  const fromCtx = readString(ctx?.email) ?? readString(asRecord(ctx?.body)?.email);
  if (fromCtx?.includes('@')) return fromCtx;

  const events = Array.isArray(r.events) ? r.events : [];
  for (const ev of events) {
    const c = asRecord(ev)?.context;
    const em = readString(c?.email) ?? readString(asRecord(c?.body)?.email);
    if (em?.includes('@')) return em;
  }
  return undefined;
}
