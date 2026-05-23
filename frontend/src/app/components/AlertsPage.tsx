import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { fetchAlerts, patchAlertStatus, type BackendAlertRecord } from '../api/dashboard';
import {
  type AlertUiStatus,
  type AnalystAlertStatus,
  normalizeAlertUiStatus,
} from '../lib/alertStatus';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: AlertUiStatus;
  timestamp: string;
  firstTriggeredAt?: string;
  occurrenceCount?: number;
  sourceIp: string;
  targetIp: string;
  description: string;
  recommendations: string[];
  detectedBy: string;
  affectedAssets: string[];
  attackerLocation: string;
  attackerIsp?: string;
}

type StatusFilter = 'all' | AlertUiStatus;
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortBy = 'newest' | 'oldest' | 'severity';

// ─── Normalizer helpers ───────────────────────────────────────────────────────

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const humanizeRule = (ruleId: string | undefined): string => {
  if (!ruleId) return 'Unknown rule';
  return ruleId
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
};

const formatGeoLabel = (geo: BackendAlertRecord['geo']): string | undefined => {
  if (!geo) return undefined;
  const parts = [readString(geo.city), readString(geo.region), readString(geo.country)].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (geo.source === 'private') return 'Private network';
  return undefined;
};

const normalizeAlert = (alert: BackendAlertRecord): AlertItem => {
  const ruleId =
    readString(alert.rule_id) ?? readString(alert.ruleId) ?? readString(alert.alert_id) ?? 'unknown-rule';
  const ruleName = readString(alert.rule_name) ?? humanizeRule(ruleId);
  const context =
    typeof alert.context === 'object' && alert.context
      ? (alert.context as Record<string, unknown>)
      : {};

  const sourceIp = readString(alert.ip) ?? readString(context.ip) ?? 'Unknown';

  const targetIp =
    readString(context.endpoint) ??
    readString(context.resource) ??
    readString(context.destination) ??
    readString(context.target) ??
    readString(context.targetIp) ??
    'N/A';

  const recommendations = Array.isArray(context.recommendations)
    ? (context.recommendations as string[])
    : ['Investigate event context'];

  const affectedAssets = Array.isArray(context.affectedAssets)
    ? (context.affectedAssets as string[])
    : [];

  const occ =
    typeof alert.occurrenceCount === 'number' && alert.occurrenceCount >= 1
      ? Math.floor(alert.occurrenceCount)
      : undefined;

  return {
    id: alert._id ?? alert.alert_id ?? `${ruleId}-${alert.trigger_time}`,
    title: ruleName,
    severity: (readString(alert.severity) ?? 'low').toLowerCase() as AlertItem['severity'],
    status: normalizeAlertUiStatus(readString(alert.status) ?? 'open'),
    timestamp: new Date(alert.trigger_time ?? alert.triggeredAt ?? Date.now()).toLocaleString(),
    firstTriggeredAt: alert.firstTriggeredAt
      ? new Date(alert.firstTriggeredAt).toLocaleString()
      : undefined,
    occurrenceCount: occ,
    sourceIp,
    targetIp,
    description: readString(alert.message) ?? `${ruleName} triggered`,
    recommendations,
    detectedBy: readString(context.source) ?? 'Unknown detection source',
    affectedAssets,
    attackerLocation:
      readString(alert.attackerLocation) ??
      formatGeoLabel(alert.geo) ??
      'Location unavailable',
    attackerIsp: readString(alert.geo?.isp),
  };
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-[#ef4444] text-white';
    case 'high':     return 'bg-[#f59e0b] text-white';
    case 'medium':   return 'bg-[#eab308] text-black';
    case 'low':      return 'bg-[#3b82f6] text-white';
    default:         return 'bg-gray-500 text-white';
  }
};

const getSeverityBorderColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'border-l-[#ef4444]';
    case 'high':     return 'border-l-[#f59e0b]';
    case 'medium':   return 'border-l-[#eab308]';
    case 'low':      return 'border-l-[#3b82f6]';
    default:         return 'border-l-gray-500';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open':          return <XCircle className="size-4 text-[#ef4444]" />;
    case 'investigating': return <Clock className="size-4 text-[#f59e0b]" />;
    case 'resolved':      return <CheckCircle className="size-4 text-[#10b981]" />;
    default:              return null;
  }
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Mirrors reference filter shape exactly
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  // ─── Data fetching ──────────────────────────────────────────────────────

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAlerts();
      const normalized = response.map(normalizeAlert);
      setAlerts(normalized);
      if (normalized.length > 0) setSelectedAlert(normalized[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchAlerts();
        if (cancelled) return;
        const normalized = response.map(normalizeAlert);
        setAlerts(normalized);
        if (normalized.length > 0) setSelectedAlert(normalized[0]);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  // ─── Filtering + sorting (mirrors reference useMemo exactly) ───────────

  const filteredAlerts = useMemo(
    () =>
      alerts
        .filter(
          (alert) =>
            (statusFilter === 'all' || alert.status === statusFilter) &&
            (severityFilter === 'all' || alert.severity === severityFilter),
        )
        .sort((a, b) => {
          if (sortBy === 'oldest') {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          }
          if (sortBy === 'severity') {
            return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
          }
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }),
    [alerts, statusFilter, severityFilter, sortBy],
  );

  // ─── Status update (mirrors reference updateAlertStatus pattern) ────────

  const updateAlertStatus = async (
    newStatus: AnalystAlertStatus,
  ) => {
    if (!selectedAlert || isUpdating) return;
    setIsUpdating(true);

    // Snapshot for rollback
    const previousAlerts = alerts;
    const previousSelected = selectedAlert;

    // Optimistic update
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === selectedAlert.id ? { ...alert, status: newStatus } : alert,
      ),
    );
    setSelectedAlert((prev) => (prev ? { ...prev, status: newStatus } : null));

    try {
      await patchAlertStatus(selectedAlert.id, newStatus);
    } catch (err) {
      console.error('Failed to update alert status:', err);
      // Rollback on failure
      setAlerts(previousAlerts);
      setSelectedAlert(previousSelected);
    } finally {
      setIsUpdating(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header + Filters ──────────────────────────────────────────── */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-medium text-white">Security Alerts</h2>
            <p className="text-sm text-gray-400 mt-1">Monitor and manage security incidents</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-[#ef4444] animate-pulse" />
            <span className="text-sm text-gray-400">
              {alerts.filter((a) => a.status === 'open').length} Open Alerts
            </span>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'all' ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'open' ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            Open ({alerts.filter((a) => a.status === 'open').length})
          </button>
          <button
            onClick={() => setStatusFilter('investigating')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'investigating' ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            Investigating ({alerts.filter((a) => a.status === 'investigating').length})
          </button>
          <button
            onClick={() => setStatusFilter('threat')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'threat' ? 'bg-[#dc2626]/30 text-[#fca5a5] border border-[#ef4444]/40' : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            Threat ({alerts.filter((a) => a.status === 'threat').length})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'resolved' ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            Resolved ({alerts.filter((a) => a.status === 'resolved').length})
          </button>
          <button
            onClick={() => setStatusFilter('false_positive')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'false_positive'
                ? 'bg-[#1a1a24] border border-[#ef4444] text-[#ef4444]'
                : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            False Positive ({alerts.filter((a) => a.status === 'false_positive').length})
          </button>
        </div>

        {/* Severity filter row */}
        <div className="flex flex-wrap gap-2 mt-3">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
            <button
              key={severity}
              onClick={() => setSeverityFilter(severity)}
              className={`px-4 py-2 text-sm ${
                severityFilter === severity
                  ? getSeverityColor(severity)
                  : 'bg-[#1a1a24] text-gray-400 hover:text-white'
              }`}
            >
              {severity === 'all' ? 'All' : severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── List + Detail ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-240px)] lg:overflow-hidden">

        {/* Alert list */}
        <div className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">

          {/* Sort controls */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Sort by:</span>
            <div className="flex gap-2">
              {(['newest', 'oldest', 'severity'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-3 py-1 text-xs ${
                    sortBy === option ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'
                  }`}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* States: loading / error / empty / list */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="h-[160px] animate-pulse bg-[#1a1a24] border border-[#1f1f2e]" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
              <p className="text-sm text-[#fca5a5]">{error}</p>
              <button
                onClick={loadAlerts}
                className="mt-3 text-xs text-[#4f46e5] hover:text-[#6366f1] underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-12 text-center">
              <AlertTriangle className="size-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No alerts match the current filters</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`bg-[#0f0f17] border border-[#1f1f2e] border-l-4 ${getSeverityBorderColor(alert.severity)} p-6 cursor-pointer hover:border-[#2f2f3e] transition-all ${
                  selectedAlert?.id === alert.id ? 'ring-2 ring-[#4f46e5]' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="size-5 text-[#ef4444]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-white font-medium">{alert.title}</h3>
                        {typeof alert.occurrenceCount === 'number' && alert.occurrenceCount > 1 && (
                          <span
                            title="Grouped emissions in the SIEM dedup window"
                            className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-[#4f46e5]/25 text-[#a5b4fc] border border-[#4f46e5]/35"
                          >
                            ×{alert.occurrenceCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-1">{alert.id}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 uppercase ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                </div>

                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{alert.description}</p>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 font-mono">{alert.timestamp}</span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(alert.status)}
                      <span className="text-gray-400 capitalize">{alert.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <button className="text-[#4f46e5] hover:text-[#6366f1] flex items-center gap-1">
                    <Eye className="size-3" />
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="h-fit lg:sticky lg:top-6 lg:h-full lg:overflow-y-auto lg:pr-1">
          {selectedAlert ? (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-xl text-white font-medium">{selectedAlert.title}</h3>
                    {typeof selectedAlert.occurrenceCount === 'number' && selectedAlert.occurrenceCount > 1 && (
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-[#4f46e5]/25 text-[#a5b4fc] border border-[#4f46e5]/35">
                        {selectedAlert.occurrenceCount} grouped hits
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 font-mono">{selectedAlert.id}</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1.5 uppercase ${getSeverityColor(selectedAlert.severity)}`}>
                  {selectedAlert.severity}
                </span>
              </div>

              {/* Anomaly indicator — kept from new page theme */}
              <div className="bg-[#1a1a24] border border-[#f59e0b] p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-2 rounded-full bg-[#f59e0b] animate-pulse" />
                  <span className="text-sm font-medium text-[#f59e0b]">Anomaly Detected</span>
                </div>
                <p className="text-xs text-gray-400">
                  Pattern matching confidence: 94.7% | Risk score: High
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Description</h4>
                  <p className="text-sm text-gray-400">{selectedAlert.description}</p>
                </div>

                {/* Deduplication block */}
                {typeof selectedAlert.occurrenceCount === 'number' && selectedAlert.occurrenceCount > 1 && (
                  <div className="rounded border border-[#2f2f3e] bg-[#1a1a24] px-4 py-3">
                    <h4 className="text-sm font-medium text-white mb-2">Deduplication</h4>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-gray-500">Occurrences</dt>
                        <dd className="text-gray-200 font-mono">{selectedAlert.occurrenceCount}</dd>
                      </div>
                      {selectedAlert.firstTriggeredAt && (
                        <div>
                          <dt className="text-gray-500">First seen</dt>
                          <dd className="text-gray-200">{selectedAlert.firstTriggeredAt}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-gray-500">Last seen</dt>
                        <dd className="text-gray-200">{selectedAlert.timestamp}</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-gray-500 mt-2">
                      Multiple emissions for the same IP and rule within the backend time window roll into one alert row.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Source IP</h4>
                    <p className="text-sm text-gray-400 font-mono">{selectedAlert.sourceIp}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Attacker Location</h4>
                    <p className="text-sm text-gray-400">{selectedAlert.attackerLocation}</p>
                    {selectedAlert.attackerIsp && (
                      <p className="text-xs text-gray-500 mt-1">{selectedAlert.attackerIsp}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Target IP</h4>
                    <p className="text-sm text-gray-400 font-mono">{selectedAlert.targetIp}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Detected By</h4>
                    <p className="text-sm text-gray-400">{selectedAlert.detectedBy}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Status</h4>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedAlert.status)}
                      <span className="text-sm text-gray-400 capitalize">
                        {selectedAlert.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Affected Assets</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAlert.affectedAssets.length > 0 ? (
                      selectedAlert.affectedAssets.map((asset) => (
                        <span key={asset} className="bg-[#1a1a24] border border-[#2a2a3a] px-2 py-1 text-xs text-gray-400 font-mono">
                          {asset}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">No affected assets listed.</span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {selectedAlert.recommendations.length > 0 ? (
                      selectedAlert.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                          <span className="text-[#4f46e5] mt-1">•</span>
                          {rec}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-400">No recommendations available.</li>
                    )}
                  </ul>
                </div>

                {/* Action buttons — wired to updateAlertStatus with disabled states */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-[#1f1f2e]">
                  <button
                    onClick={() => updateAlertStatus('investigating')}
                    disabled={isUpdating || selectedAlert.status === 'investigating'}
                    className="flex-1 min-w-[7rem] bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Investigate
                  </button>
                  <button
                    onClick={() => updateAlertStatus('threat')}
                    disabled={isUpdating || selectedAlert.status === 'threat'}
                    className="flex-1 min-w-[7rem] bg-[#dc2626]/20 hover:bg-[#dc2626]/35 border border-[#ef4444]/50 text-[#fca5a5] px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Threat
                  </button>
                  <button
                    onClick={() => updateAlertStatus('resolved')}
                    disabled={isUpdating || selectedAlert.status === 'resolved'}
                    className="flex-1 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => updateAlertStatus('false_positive')}
                    disabled={isUpdating || selectedAlert.status === 'false_positive'}
                    className="bg-[#1a1a24] border border-[#ef4444] text-[#ef4444] px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    False Positive
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-12 text-center">
              <AlertTriangle className="size-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Select an alert to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}