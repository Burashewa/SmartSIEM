import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Clock, CheckCircle, XCircle, Eye,
  Filter, Download, RefreshCw, AlertCircle, Shield,
  User, Server, LayoutList, Table2,
} from 'lucide-react';
import { fetchAlerts, patchAlertStatus, type BackendAlertRecord } from '../api/dashboard';
import {
  type AlertUiStatus,
  type AnalystAlertStatus,
  getAlertStatusColor,
  getAlertStatusLabel,
  normalizeAlertUiStatus,
} from '../lib/alertStatus';

// ─── Types ─────────────────────────────────────────────────────────────────

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
  resourceType: 'user' | 'server' | 'network' | 'application';
}

type StatusFilter = 'all' | AlertUiStatus;
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortBy = 'newest' | 'oldest' | 'severity';
type ViewMode = 'list' | 'table';

// ─── Normalizer helpers ────────────────────────────────────────────────────

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const humanizeRule = (ruleId: string | undefined): string => {
  if (!ruleId) return 'Unknown rule';
  return ruleId
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
    .join(' ');
};

const formatGeoLabel = (geo: BackendAlertRecord['geo']): string | undefined => {
  if (!geo) return undefined;
  const parts = [readString(geo.city), readString(geo.region), readString(geo.country)].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (geo.source === 'private') return 'Private network';
  return undefined;
};

const deriveResourceType = (title: string, description: string): AlertItem['resourceType'] => {
  const t = (title + ' ' + description).toLowerCase();
  if (t.includes('login') || t.includes('auth') || t.includes('user') || t.includes('account')) return 'user';
  if (t.includes('server') || t.includes('host') || t.includes('database')) return 'server';
  if (t.includes('network') || t.includes('firewall') || t.includes('gateway')) return 'network';
  return 'application';
};

const normalizeAlert = (alert: BackendAlertRecord): AlertItem => {
  const ruleId =
    readString(alert.rule_id) ?? readString(alert.ruleId) ?? readString(alert.alert_id) ?? 'unknown-rule';
  const ruleName = readString(alert.rule_name) ?? humanizeRule(ruleId);
  const context =
    typeof alert.context === 'object' && alert.context
      ? (alert.context as Record<string, unknown>)
      : {};

  const sourceIp = readString(alert.ip) ?? readString(context.ip as string) ?? 'Unknown';
  const targetIp =
    readString(context.endpoint as string) ??
    readString(context.destination as string) ??
    readString(context.targetIp as string) ??
    'N/A';

  const recommendations = Array.isArray(context.recommendations)
    ? (context.recommendations as string[])
    : ['Investigate event context'];

  const affectedAssets = Array.isArray(context.affectedAssets)
    ? (context.affectedAssets as string[])
    : [];

  const description = readString(alert.message) ?? `${ruleName} triggered`;

  return {
    id: alert._id ?? alert.alert_id ?? `${ruleId}-${alert.trigger_time}`,
    title: ruleName,
    severity: (readString(alert.severity) ?? 'low').toLowerCase() as AlertItem['severity'],
    status: normalizeAlertUiStatus(readString(alert.status) ?? 'open'),
    timestamp: new Date(alert.trigger_time ?? alert.triggeredAt ?? Date.now()).toLocaleString(),
    firstTriggeredAt: alert.firstTriggeredAt
      ? new Date(alert.firstTriggeredAt).toLocaleString()
      : undefined,
    occurrenceCount:
      typeof alert.occurrenceCount === 'number' && alert.occurrenceCount >= 1
        ? Math.floor(alert.occurrenceCount)
        : undefined,
    sourceIp,
    targetIp,
    description,
    recommendations,
    detectedBy: readString(context.source as string) ?? humanizeRule(ruleId),
    affectedAssets,
    attackerLocation:
      readString(alert.attackerLocation) ?? formatGeoLabel(alert.geo) ?? 'Location unavailable',
    attackerIsp: readString(alert.geo?.isp),
    resourceType: deriveResourceType(ruleName, description),
  };
};

// ─── Style helpers ─────────────────────────────────────────────────────────

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-[#ef4444] text-white';
    case 'high':     return 'bg-[#f59e0b] text-white';
    case 'medium':   return 'bg-[#eab308] text-black';
    case 'low':      return 'bg-[#3b82f6] text-white';
    default:         return 'bg-gray-500 text-white';
  }
};

const getSeverityBadgeColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
    case 'high':     return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
    case 'medium':   return 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30';
    case 'low':      return 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30';
    default:         return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
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

const getSeverityGlow = (severity: string) => {
  switch (severity) {
    case 'critical': return 'shadow-[0_0_10px_rgba(239,68,68,0.3)]';
    case 'high':     return 'shadow-[0_0_8px_rgba(245,158,11,0.2)]';
    default:         return '';
  }
};

const getStatusColor = (status: AlertUiStatus) => getAlertStatusColor(status);
const getStatusLabel = (status: AlertUiStatus) =>
  status === 'open' ? 'New' : getAlertStatusLabel(status);

const getStatusIcon = (status: AlertUiStatus) => {
  switch (status) {
    case 'open':          return <XCircle className="size-4 text-[#ef4444]" />;
    case 'investigating': return <Clock className="size-4 text-[#f59e0b]" />;
    case 'threat':        return <AlertTriangle className="size-4 text-[#f87171]" />;
    case 'resolved':      return <CheckCircle className="size-4 text-[#10b981]" />;
    default:              return null;
  }
};

const getResourceIcon = (type: string) => {
  switch (type) {
    case 'user':        return <User className="size-4" />;
    case 'server':      return <Server className="size-4" />;
    case 'network':
    case 'application': return <Shield className="size-4" />;
    default:            return <AlertCircle className="size-4" />;
  }
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

// ─── Component ─────────────────────────────────────────────────────────────

export function AlertsAndThreatPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  // ─── Data fetching ────────────────────────────────────────────────────

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

  // TODO: wire ws.subscribe('alert.new') for real-time updates

  // ─── Derived data ─────────────────────────────────────────────────────

  const filteredAlerts = useMemo(
    () =>
      alerts
        .filter(
          (a) =>
            (statusFilter === 'all' || a.status === statusFilter) &&
            (severityFilter === 'all' || a.severity === severityFilter),
        )
        .sort((a, b) => {
          if (sortBy === 'oldest')
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          if (sortBy === 'severity')
            return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }),
    [alerts, statusFilter, severityFilter, sortBy],
  );

  const counts = useMemo(() => ({
    severity: {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      high:     alerts.filter((a) => a.severity === 'high').length,
      medium:   alerts.filter((a) => a.severity === 'medium').length,
      low:      alerts.filter((a) => a.severity === 'low').length,
    },
    status: {
      open:          alerts.filter((a) => a.status === 'open').length,
      investigating: alerts.filter((a) => a.status === 'investigating').length,
      threat:        alerts.filter((a) => a.status === 'threat').length,
      resolved:      alerts.filter((a) => a.status === 'resolved').length,
      false_positive:alerts.filter((a) => a.status === 'false_positive').length,
    },
  }), [alerts]);

  // ─── Status update ────────────────────────────────────────────────────

  const updateAlertStatus = async (
    newStatus: AnalystAlertStatus,
  ) => {
    if (!selectedAlert || isUpdating) return;
    setIsUpdating(true);
    const previousAlerts = alerts;
    const previousSelected = selectedAlert;

    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === selectedAlert.id ? { ...a, status: newStatus } : a)),
    );
    setSelectedAlert((prev) => (prev ? { ...prev, status: newStatus } : null));

    try {
      await patchAlertStatus(selectedAlert.id, newStatus);
    } catch (err) {
      console.error('Failed to update alert status:', err);
      setAlerts(previousAlerts);
      setSelectedAlert(previousSelected);
    } finally {
      setIsUpdating(false);
    }
  };

  // ─── Export ───────────────────────────────────────────────────────────

  const handleExport = () => {
    const csv = [
      ['Alert ID', 'Severity', 'Timestamp', 'Source IP', 'Status', 'Threat Type', 'Detected By'],
      ...filteredAlerts.map((a) => [
        a.id,
        a.severity.toUpperCase(),
        a.timestamp,
        a.sourceIp,
        getStatusLabel(a.status),
        a.title,
        a.detectedBy,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartsiem-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Detail panel (shared between both views) ────────────────────────

  const DetailPanel = () => {
    if (!selectedAlert) {
      return (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] p-12 text-center">
          <AlertTriangle className="size-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Select an alert to view details</p>
        </div>
      );
    }

    return (
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        {/* Title row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-xl text-white font-medium">{selectedAlert.title}</h3>
              {typeof selectedAlert.occurrenceCount === 'number' &&
                selectedAlert.occurrenceCount > 1 && (
                  <span className="text-xs font-semibold px-2 py-1 bg-[#4f46e5]/25 text-[#a5b4fc] border border-[#4f46e5]/35">
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

        {/* Detection Rule panel — replaces the fake anomaly panel */}
        <div className="bg-[#1a1a24] border border-[#4f46e5] p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-2 rounded-full bg-[#4f46e5] animate-pulse" />
            <span className="text-sm font-medium text-[#4f46e5]">Detection Rule Matched</span>
          </div>
          <p className="text-xs text-gray-400">
            Rule: <span className="text-white font-mono">{selectedAlert.detectedBy}</span>
            &nbsp;|&nbsp;Source IP: <span className="text-white font-mono">{selectedAlert.sourceIp}</span>
          </p>
        </div>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Description</h4>
            <p className="text-sm text-gray-400">{selectedAlert.description}</p>
          </div>

          {/* Deduplication */}
          {typeof selectedAlert.occurrenceCount === 'number' &&
            selectedAlert.occurrenceCount > 1 && (
              <div className="border border-[#2f2f3e] bg-[#1a1a24] px-4 py-3">
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
              </div>
            )}

          {/* Grid details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Source IP</h4>
              <p className="text-sm text-gray-400 font-mono">{selectedAlert.sourceIp}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Attacker Location</h4>
              <p className="text-sm text-gray-400">{selectedAlert.attackerLocation}</p>
              {selectedAlert.attackerIsp && (
                <p className="text-xs text-gray-500 mt-1">{selectedAlert.attackerIsp}</p>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Target IP</h4>
              <p className="text-sm text-gray-400 font-mono">{selectedAlert.targetIp}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Status</h4>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedAlert.status)}
                <span className="text-sm text-gray-400 capitalize">
                  {getStatusLabel(selectedAlert.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Affected assets */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Affected Assets</h4>
            <div className="flex flex-wrap gap-2">
              {selectedAlert.affectedAssets.length > 0 ? (
                selectedAlert.affectedAssets.map((asset) => (
                  <span
                    key={asset}
                    className="bg-[#1a1a24] border border-[#2a2a3a] px-2 py-1 text-xs text-gray-400 font-mono"
                  >
                    {asset}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-sm">No affected assets listed.</span>
              )}
            </div>
          </div>

          {/* Recommendations (F3.0 / F4.3) */}
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

          {/* Action buttons */}
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
              className="flex-1 min-w-[7rem] bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-medium text-white">Alerts & Threat Detection</h2>
            <p className="text-sm text-gray-400 mt-1">
              Monitor, investigate and resolve security incidents
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-[#ef4444] animate-pulse" />
              <span className="text-sm text-gray-400">
                {counts.status.open} Open Alerts
              </span>
            </div>
            {/* View mode toggle */}
            <div className="flex border border-[#2a2a3a]">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'}`}
                title="List view"
              >
                <LayoutList className="size-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'}`}
                title="Table view"
              >
                <Table2 className="size-4" />
              </button>
            </div>
            {/* Refresh */}
            <button
              onClick={loadAlerts}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] text-white border border-[#2a2a3a] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm"
            >
              <Download className="size-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'all', label: `All (${alerts.length})` },
              { key: 'open', label: `Open (${counts.status.open})` },
              { key: 'investigating', label: `Investigating (${counts.status.investigating})` },
              { key: 'threat', label: `Threat (${counts.status.threat})` },
              { key: 'resolved', label: `Resolved (${counts.status.resolved})` },
              { key: 'false_positive', label: `False Positive (${counts.status.false_positive})` },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 text-sm ${
                statusFilter === key
                  ? key === 'false_positive'
                    ? 'bg-[#1a1a24] border border-[#ef4444] text-[#ef4444]'
                    : 'bg-[#4f46e5] text-white'
                  : 'bg-[#1a1a24] text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Severity filter row */}
        <div className="flex flex-wrap gap-2 mt-3">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-4 py-2 text-sm ${
                severityFilter === s
                  ? s === 'all'
                    ? 'bg-[#4f46e5] text-white'
                    : getSeverityColor(s)
                  : 'bg-[#1a1a24] text-gray-400 hover:text-white'
              }`}
            >
              {s === 'all' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-gray-500">Sort by:</span>
          {(['newest', 'oldest', 'severity'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-1 text-xs ${
                sortBy === opt ? 'bg-[#4f46e5] text-white' : 'bg-[#1a1a24] text-gray-400 hover:text-white'
              }`}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-500">
            {filteredAlerts.length} of {alerts.length} alerts
          </span>
        </div>
      </div>

      {/* ── Stats Overview ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
        {[
          { label: 'Critical', count: counts.severity.critical, color: '#ef4444', pulse: true },
          { label: 'High',     count: counts.severity.high,     color: '#f59e0b', pulse: false },
          { label: 'Medium',   count: counts.severity.medium,   color: '#eab308', pulse: false },
          { label: 'Low',      count: counts.severity.low,      color: '#3b82f6', pulse: false },
        ].map(({ label, count, color, pulse }) => (
          <div
            key={label}
            className="bg-[#0f0f17] border rounded-lg p-4"
            style={{ borderColor: `${color}4d` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase">{label}</span>
              <div
                className={`size-2 rounded-full ${pulse ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: color }}
              />
            </div>
            <p className="text-2xl font-semibold" style={{ color }}>{count}</p>
          </div>
        ))}
        {[
          { label: 'Open',          count: counts.status.open },
          { label: 'Investigating', count: counts.status.investigating },
          { label: 'Resolved',      count: counts.status.resolved },
        ].map(({ label, count }) => (
          <div key={label} className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-2">{label}</p>
            <p className="text-2xl text-white font-semibold">{count}</p>
          </div>
        ))}
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alert cards */}
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[160px] animate-pulse bg-[#1a1a24] border border-[#1f1f2e]" />
              ))
            ) : error ? (
              <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
                <p className="text-sm text-[#fca5a5]">{error}</p>
                <button
                  onClick={loadAlerts}
                  className="mt-3 text-xs bg-[#4f46e5] text-white px-3 py-1"
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
                          {typeof alert.occurrenceCount === 'number' &&
                            alert.occurrenceCount > 1 && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#4f46e5]/25 text-[#a5b4fc] border border-[#4f46e5]/35">
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
                        <span className="text-gray-400">{getStatusLabel(alert.status)}</span>
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

          {/* Detail panel — sticky */}
          <div className="lg:sticky lg:top-6 h-fit">
            <DetailPanel />
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ─────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg overflow-hidden">
            {isLoading ? (
              <table className="w-full">
                <tbody className="divide-y divide-[#1f1f2e]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="py-4 px-6">
                          <div className="h-4 animate-pulse bg-[#1a1a24] rounded" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="size-12 text-gray-600 mx-auto mb-4" />
                <p className="text-[#fca5a5] mb-4">{error}</p>
                <button
                  onClick={loadAlerts}
                  className="px-4 py-2 bg-[#4f46e5] text-white text-sm"
                >
                  Retry
                </button>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="size-12 text-gray-600 mx-auto mb-4" />
                <p className="text-white mb-1">No alerts found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                      {['Alert ID', 'Severity', 'Timestamp', 'Affected Resource', 'Threat Type', 'Status'].map((h) => (
                        <th
                          key={h}
                          className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f2e]">
                    {filteredAlerts.map((alert) => (
                      <tr
                        key={alert.id}
                        onClick={() => setSelectedAlert(alert)}
                        className={`hover:bg-[#1a1a24] transition-colors cursor-pointer ${
                          selectedAlert?.id === alert.id ? 'bg-[#1a1a24] ring-1 ring-[#4f46e5] ring-inset' : ''
                        }`}
                      >
                        <td className="py-4 px-6">
                          <span className="text-sm font-mono text-white">{alert.id}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded ${getSeverityBadgeColor(alert.severity)} ${getSeverityGlow(alert.severity)}`}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {alert.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-300 font-mono">{alert.timestamp}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="text-gray-400">{getResourceIcon(alert.resourceType)}</div>
                            <div>
                              <p className="text-sm text-white font-medium">{alert.sourceIp}</p>
                              <p className="text-xs text-gray-400 capitalize">{alert.resourceType}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-gray-300">{alert.title}</span>
                          {alert.sourceIp && (
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{alert.sourceIp}</p>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded ${getStatusColor(alert.status)}`}>
                            {getStatusLabel(alert.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detail panel below table when a row is selected */}
          {selectedAlert && (
            <div className="border-t border-[#1f1f2e] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="size-4 text-gray-400" />
                <span className="text-sm text-gray-400">
                  Alert Details — <span className="text-white font-mono">{selectedAlert.id}</span>
                </span>
              </div>
              <DetailPanel />
            </div>
          )}
        </div>
      )}
    </div>
  );
}