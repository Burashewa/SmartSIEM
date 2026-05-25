import type { BackendAlertRecord, BackendLogRecord } from '../api/dashboard';

export type CaseStatus = 'open' | 'in_progress' | 'pending_review' | 'closed';
export type CasePriority = 'critical' | 'high' | 'medium' | 'low';

export interface TimelineEntry {
  id: string;
  actor: string;
  action: string;
  detail?: string;
  timestamp: string;
}

export interface CaseNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface InvestigationCase {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  assignee: string;
  createdAt: string;
  updatedAt: string;
  ruleKey: string;
  ruleName: string;
  sourceIps: string[];
  alerts: BackendAlertRecord[];
  notes: CaseNote[];
  timeline: TimelineEntry[];
  tags: string[];
}

const readString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

export const humanizeRule = (id?: string): string => {
  if (!id) return 'Security Alert';
  return id
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export const getAlertId = (alert: BackendAlertRecord): string =>
  readString(alert._id) ??
  readString(alert.id) ??
  readString(alert.alert_id) ??
  'unknown';

export const getAlertTimestamp = (alert: BackendAlertRecord): string =>
  readString(alert.trigger_time) ?? readString(alert.triggeredAt) ?? new Date().toISOString();

export const getAlertRuleKey = (alert: BackendAlertRecord): string =>
  readString(alert.rule_id) ?? readString(alert.ruleId) ?? readString(alert.rule_name) ?? 'unknown';

export const getAlertIp = (alert: BackendAlertRecord): string => {
  const ctx =
    typeof alert.context === 'object' && alert.context
      ? (alert.context as Record<string, unknown>)
      : {};
  return readString(alert.ip) ?? readString(ctx.ip) ?? 'Unknown';
};

export function buildCasesFromAlerts(alerts: BackendAlertRecord[]): InvestigationCase[] {
  const groupMap = new Map<string, BackendAlertRecord[]>();
  const timeWindowMs = 15 * 60 * 1000; // group alerts from the same IP in the same 15-minute window

  for (const alert of alerts) {
    const ip = getAlertIp(alert);
    const timestamp = new Date(getAlertTimestamp(alert)).getTime();
    const bucket = ip !== 'Unknown' ? Math.floor(timestamp / timeWindowMs) * timeWindowMs : undefined;
    const key = ip !== 'Unknown'
      ? `ip|${ip}|${bucket}`
      : `rule|${getAlertRuleKey(alert)}`;
    const arr = groupMap.get(key) ?? [];
    arr.push(alert);
    groupMap.set(key, arr);
  }

  const cases: InvestigationCase[] = [];
  let idx = 1;

  for (const [ruleKey, group] of groupMap.entries()) {
    const sorted = [...group].sort(
      (a, b) => new Date(getAlertTimestamp(b)).getTime() - new Date(getAlertTimestamp(a)).getTime(),
    );
    const first = sorted[0];
    const oldest = sorted[sorted.length - 1];

    const severities = group.map((a) => (readString(a.severity) ?? 'low').toLowerCase());
    const priority: CasePriority = severities.includes('critical')
      ? 'critical'
      : severities.includes('high')
        ? 'high'
        : severities.includes('medium')
          ? 'medium'
          : 'low';

    const statuses = group.map((a) => (readString(a.status) ?? 'open').toLowerCase());
    const hasInvestigating = statuses.includes('investigating');
    const hasThreat = statuses.includes('threat');
    const allClosed = statuses.every((s) => s === 'resolved' || s === 'false_positive' || s === 'closed');

    const status: CaseStatus =
      hasInvestigating
        ? 'in_progress'
        : hasThreat
          ? 'pending_review'
          : allClosed
            ? 'closed'
            : 'open';

    const ruleNames = [
      ...new Set(group.map((a) => readString(a.rule_name) ?? humanizeRule(getAlertRuleKey(a)))),
    ];
    const ruleName = ruleNames.length === 1 ? ruleNames[0] : 'Multiple rules';
    const caseId = `CASE-${String(idx).padStart(4, '0')}`;
    const sourceIps = [
      ...new Set(group.map((a) => getAlertIp(a)).filter((ip) => ip !== 'Unknown')),
    ];
    const ipLabel = sourceIps.length === 1 ? sourceIps[0] : 'Multiple IPs';

    const createdAt = getAlertTimestamp(oldest);
    const updatedAt = getAlertTimestamp(first);

    const timeline: TimelineEntry[] = [
      {
        id: `${caseId}-t1`,
        actor: 'Detection Engine',
        action: 'Case auto-created from grouped alerts',
        detail: `${group.length} alert(s) matched rule: ${ruleName}`,
        timestamp: createdAt,
      },
      ...sorted.slice(0, 8).map((a, i) => ({
        id: `${caseId}-alert-${i}`,
        actor: 'Alert Engine',
        action: `Alert fired: ${ruleName}`,
        detail: readString(a.message) ?? getAlertIp(a),
        timestamp: getAlertTimestamp(a),
      })),
      ...(status === 'in_progress'
        ? [
            {
              id: `${caseId}-t2`,
              actor: 'System Analyst',
              action: 'Status changed to In Progress',
              timestamp: updatedAt,
            },
          ]
        : []),
      ...(status === 'closed'
        ? [
            {
              id: `${caseId}-t3`,
              actor: 'System Analyst',
              action: 'Case closed',
              timestamp: updatedAt,
            },
          ]
        : []),
    ];

    cases.push({
      id: caseId,
      title: sourceIps.length > 0
        ? `${ipLabel} — ${group.length} alert${group.length > 1 ? 's' : ''}`
        : `${ruleName} — ${group.length} alert${group.length > 1 ? 's' : ''}`,
      description: `Investigation for ${sourceIps.length > 0 ? `IP ${ipLabel}` : `rule ${ruleName}`}. ${group.length} alert(s) ${ruleNames.length === 1 ? `matched rule "${ruleNames[0]}"` : `across ${ruleNames.length} rules`}. Review related logs and alert history below.`,
      status,
      priority,
      assignee: 'Unassigned',
      createdAt,
      updatedAt,
      ruleKey,
      ruleName,
      sourceIps,
      alerts: sorted,
      notes: [],
      timeline,
      tags: [ruleName.split(' ')[0], priority],
    });

    idx++;
  }

  return cases.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

const LOG_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const LOG_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;

export function getCaseTimeWindow(case_: InvestigationCase): { start: number; end: number } {
  const start = new Date(case_.createdAt).getTime() - LOG_LOOKBACK_MS;
  const end = Math.max(
    Date.now() + LOG_LOOKAHEAD_MS,
    new Date(case_.updatedAt).getTime() + LOG_LOOKAHEAD_MS,
  );
  return { start, end };
}

export function getRelatedLogs(
  logs: BackendLogRecord[],
  case_: InvestigationCase,
): BackendLogRecord[] {
  const ips = new Set(case_.sourceIps);
  const { start, end } = getCaseTimeWindow(case_);

  return logs
    .filter((log) => {
      const ts = new Date(log.timestamp).getTime();
      if (Number.isNaN(ts) || ts < start || ts > end) return false;

      const logIp = readString(log.ip);
      if (logIp && ips.has(logIp)) return true;

      const event = (readString(log.event) ?? '').toLowerCase();
      const ruleHint = case_.ruleKey.toLowerCase();
      if (ruleHint.includes('login') && (event.includes('login') || event.includes('auth'))) {
        return true;
      }
      if (ruleHint.includes('sql') && event.includes('sql')) return true;
      if (ruleHint.includes('xss') && event.includes('xss')) return true;
      if (ruleHint.includes('path') && (event.includes('path') || event.includes('file'))) {
        return true;
      }

      return false;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getIpAlertHistory(
  allAlerts: BackendAlertRecord[],
  case_: InvestigationCase,
): BackendAlertRecord[] {
  const ips = new Set(case_.sourceIps);
  const caseAlertIds = new Set(case_.alerts.map(getAlertId));

  return allAlerts
    .filter((alert) => {
      const id = getAlertId(alert);
      if (caseAlertIds.has(id)) return false;
      const ip = getAlertIp(alert);
      return ip !== 'Unknown' && ips.has(ip);
    })
    .sort(
      (a, b) =>
        new Date(getAlertTimestamp(b)).getTime() - new Date(getAlertTimestamp(a)).getTime(),
    );
}

export function collectRecommendations(case_: InvestigationCase): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const alert of case_.alerts) {
    const ctx =
      typeof alert.context === 'object' && alert.context
        ? (alert.context as Record<string, unknown>)
        : {};
    const recs = ctx.recommendations;
    if (!Array.isArray(recs)) continue;
    for (const item of recs) {
      const text = readString(item) ?? (typeof item === 'string' ? item : '');
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }

  return out;
}

export function getCaseSummaryStats(case_: InvestigationCase, relatedLogCount: number) {
  const openAlerts = case_.alerts.filter(
    (a) => (readString(a.status) ?? 'open').toLowerCase() === 'open',
  ).length;
  const investigating = case_.alerts.filter(
    (a) => (readString(a.status) ?? '').toLowerCase() === 'investigating',
  ).length;
  const confirmedThreats = case_.alerts.filter(
    (a) => (readString(a.status) ?? '').toLowerCase() === 'threat',
  ).length;

  return {
    totalAlerts: case_.alerts.length,
    openAlerts,
    investigating,
    confirmedThreats,
    uniqueIps: case_.sourceIps.length,
    relatedLogs: relatedLogCount,
    firstSeen: case_.createdAt,
    lastSeen: case_.updatedAt,
  };
}
