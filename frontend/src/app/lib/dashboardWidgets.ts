import type { BackendAlertRecord, BackendLogRecord } from '../api/dashboard';

export type WidgetSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AttackLocation {
  id: string;
  label: string;
  count: number;
  lat: number;
  lng: number;
  severity: WidgetSeverity;
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
  description: string;
  logSource: string;
  status: 'New' | 'In-Progress' | 'Resolved';
  ruleId: string;
  ruleName: string;
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
        new Date(right.trigger_time).getTime() - new Date(left.trigger_time).getTime(),
    )
    .slice(0, 10)
    .map((alert, index) => {
      const context = asRecord(alert.context);
      const normalizedRuleId =
        readString(alert.rule_id) ?? readString(alert.alert_id) ?? `alert-${index}`;
      const ruleName = readString(alert.rule_name) ?? 'Unknown rule';

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

      const description = alertDetails.length > 0
        ? `${ruleName} - ${alertDetails.join(', ')}`
        : ruleName;

      return {
        id:
          readString(alert._id) ??
          readString(alert.alert_id) ??
          `${normalizedRuleId}-${alert.trigger_time}-${index}`,
        timestamp: alert.trigger_time,
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
        description,
        logSource:
          readString(context?.source) ??
          readString(context?.logSource) ??
          humanizeRuleId(normalizedRuleId),
        status: normalizeAlertStatus(alert.status),
        ruleId: normalizedRuleId,
        ruleName,
      };
    });
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
