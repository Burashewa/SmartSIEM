  import { useCallback, useEffect, useMemo, useState } from 'react';
  import { Filter, Download, RefreshCw, AlertCircle, Shield, User, Server } from 'lucide-react';
  import { fetchAlerts, type BackendAlertRecord } from '../api/dashboard';

  type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low';
  type ThreatResourceType = 'user' | 'server' | 'network' | 'application';
  type ThreatStatus = 'New' | 'Acknowledged' | 'Resolved';

  interface ThreatAlert {
    alertId: string;
    severity: ThreatSeverity;
    timestamp: string;
    affectedResource: string;
    resourceType: ThreatResourceType;
    status: ThreatStatus;
    threatType: string;
    sourceIp?: string;
  }

  type StatusFilter = 'all' | ThreatStatus;
  type SeverityFilter = 'all' | ThreatSeverity;

  const readString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  const humanizeRule = (ruleId?: string): string => {
    if (!ruleId) return 'Unknown rule';
    return ruleId
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' ');
  };

  const toUiStatus = (status?: string): ThreatStatus => {
    const normalized = status?.toLowerCase().trim();
    if (normalized === 'investigating' || normalized === 'acknowledged') return 'Acknowledged';
    if (normalized === 'resolved' || normalized === 'false_positive') return 'Resolved';
    return 'New';
  };

  const readContextValue = (
    context: Record<string, unknown>,
    keys: string[],
  ): string | undefined => {
    for (const key of keys) {
      const value = readString(context[key]);
      if (value) return value;
    }
    return undefined;
  };

  const userKeys = ['user', 'username', 'account', 'email', 'userId'];
  const serverKeys = ['server', 'host', 'hostname', 'device', 'node'];
  const appKeys = ['application', 'app', 'service', 'endpoint', 'resource', 'target'];
  const networkKeys = ['network', 'gateway', 'subnet'];

  const resolveAffectedResource = (
    alert: BackendAlertRecord,
    context: Record<string, unknown>,
  ): string =>
    readContextValue(context, userKeys) ??
    readContextValue(context, serverKeys) ??
    readContextValue(context, appKeys) ??
    readContextValue(context, networkKeys) ??
    readString(alert.ip) ??
    'Unknown resource';

  const resolveResourceType = (context: Record<string, unknown>): ThreatResourceType => {
    if (readContextValue(context, userKeys)) return 'user';
    if (readContextValue(context, serverKeys)) return 'server';
    if (readContextValue(context, appKeys)) return 'application';
    return 'network';
  };

  const normalizeAlert = (alert: BackendAlertRecord): ThreatAlert => {
    const ruleId = readString(alert.rule_id) ?? readString(alert.ruleId) ?? readString(alert.alert_id);
    const ruleName = readString(alert.rule_name) ?? humanizeRule(ruleId);
    const context =
      typeof alert.context === 'object' && alert.context
        ? (alert.context as Record<string, unknown>)
        : {};

    const timestamp = alert.trigger_time ?? alert.triggeredAt ?? new Date().toISOString();

    return {
      alertId:
        readString(alert.alert_id) ??
        readString(alert._id) ??
        readString(alert.id) ??
        `${ruleId ?? 'alert'}-${timestamp}`,
      severity: (readString(alert.severity) ?? 'low').toLowerCase() as ThreatSeverity,
      timestamp,
      affectedResource: resolveAffectedResource(alert, context),
      resourceType: resolveResourceType(context),
      status: toUiStatus(readString(alert.status)),
      threatType: ruleName,
      sourceIp: readString(alert.ip) ?? readContextValue(context, ['ip', 'sourceIp']),
    };
  };

  export function ThreatDetectionPage() {
    const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
    const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
    const [timeRangeFilter, setTimeRangeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAlerts = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchAlerts();
        setAlerts(response.map(normalizeAlert));
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
          setAlerts(response.map(normalizeAlert));
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load alerts');
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };
      void run();
      return () => {
        cancelled = true;
      };
    }, []);

    const getSeverityColor = (severity: string) => {
      switch (severity) {
        case 'critical':
          return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
        case 'high':
          return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
        case 'medium':
          return 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30';
        case 'low':
          return 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30';
        default:
          return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
      }
    };

    const getSeverityGlow = (severity: string) => {
      switch (severity) {
        case 'critical':
          return 'shadow-[0_0_10px_rgba(239,68,68,0.3)]';
        case 'high':
          return 'shadow-[0_0_8px_rgba(245,158,11,0.2)]';
        default:
          return '';
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'New':
          return 'bg-[#ef4444]/20 text-[#ef4444]';
        case 'Acknowledged':
          return 'bg-[#f59e0b]/20 text-[#f59e0b]';
        case 'Resolved':
          return 'bg-[#10b981]/20 text-[#10b981]';
        default:
          return 'bg-gray-700/20 text-gray-400';
      }
    };

    const getResourceIcon = (type: string) => {
      switch (type) {
        case 'user':
          return <User className="size-4" />;
        case 'server':
          return <Server className="size-4" />;
        case 'network':
        case 'application':
          return <Shield className="size-4" />;
        default:
          return <AlertCircle className="size-4" />;
      }
    };

    const formatTimestamp = (timestamp: string) => {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    const filterByTimeRange = (alert: ThreatAlert) => {
      if (timeRangeFilter === 'all') return true;

      const now = Date.now();
      const alertTime = new Date(alert.timestamp).getTime();
      const diffHours = (now - alertTime) / (1000 * 60 * 60);

      switch (timeRangeFilter) {
        case '1h':
          return diffHours <= 1;
        case '24h':
          return diffHours <= 24;
        case '7d':
          return diffHours <= 168; // 7 days
        case '30d':
          return diffHours <= 720; // 30 days
        default:
          return true;
      }
    };

    const filteredAlerts = useMemo(
      () =>
        alerts.filter((alert) => {
          const severityMatch =
            severityFilter === 'all' || alert.severity === severityFilter;
          const timeMatch = filterByTimeRange(alert);
          const statusMatch = statusFilter === 'all' || alert.status === statusFilter;
          return severityMatch && timeMatch && statusMatch;
        }),
      [alerts, severityFilter, timeRangeFilter, statusFilter],
    );

    const severityCounts = useMemo(
      () => ({
        critical: alerts.filter((a) => a.severity === 'critical').length,
        high: alerts.filter((a) => a.severity === 'high').length,
        medium: alerts.filter((a) => a.severity === 'medium').length,
        low: alerts.filter((a) => a.severity === 'low').length,
      }),
      [alerts],
    );

    const statusCounts = useMemo(
      () => ({
        new: alerts.filter((a) => a.status === 'New').length,
        acknowledged: alerts.filter((a) => a.status === 'Acknowledged').length,
        resolved: alerts.filter((a) => a.status === 'Resolved').length,
      }),
      [alerts],
    );

    const handleExport = () => {
      const csv = [
        ['Alert ID', 'Severity', 'Timestamp', 'Affected Resource', 'Status', 'Threat Type', 'Source IP'],
        ...filteredAlerts.map((alert) => [
          alert.alertId,
          alert.severity.toUpperCase(),
          formatTimestamp(alert.timestamp),
          alert.affectedResource,
          alert.status,
          alert.threatType,
          alert.sourceIp || 'N/A',
        ]),
      ]
        .map((row) => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `threat_alerts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-white mb-2">Threat Detection</h1>
            <p className="text-gray-400">
              Monitor active and historical security threats • {filteredAlerts.length} of {alerts.length} alerts shown
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadAlerts}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] text-white rounded transition-colors border border-[#2a2a3a] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded transition-colors"
            >
              <Download className="size-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          <div className="bg-[#0f0f17] border border-[#ef4444]/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase">Critical</span>
              <div className="size-2 rounded-full bg-[#ef4444] animate-pulse" />
            </div>
            <p className="text-2xl text-[#ef4444] font-semibold">{severityCounts.critical}</p>
          </div>
          <div className="bg-[#0f0f17] border border-[#f59e0b]/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase">High</span>
              <div className="size-2 rounded-full bg-[#f59e0b]" />
            </div>
            <p className="text-2xl text-[#f59e0b] font-semibold">{severityCounts.high}</p>
          </div>
          <div className="bg-[#0f0f17] border border-[#eab308]/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase">Medium</span>
              <div className="size-2 rounded-full bg-[#eab308]" />
            </div>
            <p className="text-2xl text-[#eab308] font-semibold">{severityCounts.medium}</p>
          </div>
          <div className="bg-[#0f0f17] border border-[#3b82f6]/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase">Low</span>
              <div className="size-2 rounded-full bg-[#3b82f6]" />
            </div>
            <p className="text-2xl text-[#3b82f6] font-semibold">{severityCounts.low}</p>
          </div>
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-2">New</p>
            <p className="text-2xl text-white font-semibold">{statusCounts.new}</p>
          </div>
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-2">Acknowledged</p>
            <p className="text-2xl text-white font-semibold">{statusCounts.acknowledged}</p>
          </div>
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-2">Resolved</p>
            <p className="text-2xl text-white font-semibold">{statusCounts.resolved}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="size-5 text-gray-400" />
            <h3 className="text-white font-medium">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Severity Filter */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Severity Level</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Time Range</label>
              <select
                value={timeRangeFilter}
                onChange={(e) => setTimeRangeFilter(e.target.value)}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              >
                <option value="all">All Time</option>
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="size-10 text-gray-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-400">Loading alerts...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="size-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg text-white mb-2">Unable to load alerts</h3>
              <p className="text-gray-400 mb-4">{error}</p>
              <button
                onClick={loadAlerts}
                className="text-sm text-[#4f46e5] hover:text-[#6366f1] underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="size-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg text-white mb-2">No alerts found</h3>
              <p className="text-gray-400">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                    <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Alert ID
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Severity Level
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Detection Timestamp
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Affected Resource/User
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Threat Type
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f2e]">
                  {filteredAlerts.map((alert) => (
                    <tr
                      key={alert.alertId}
                      className="hover:bg-[#1a1a24] transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6">
                        <span className="text-sm font-mono text-white">{alert.alertId}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded ${getSeverityColor(
                            alert.severity
                          )} ${getSeverityGlow(alert.severity)}`}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {alert.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-300 font-mono">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="text-gray-400">
                            {getResourceIcon(alert.resourceType)}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">
                              {alert.affectedResource}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">
                              {alert.resourceType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-300">{alert.threatType}</span>
                        {alert.sourceIp && (
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            {alert.sourceIp}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-medium rounded ${getStatusColor(
                            alert.status
                          )}`}
                        >
                          {alert.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }
