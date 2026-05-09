import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-react';
import {
  fetchAlerts,
  updateAlert,
  type Alert,
  type AlertListResponse,
  type AlertStatus,
} from '@/lib/smartsiemApi';

type StatusFilter = 'all' | 'open' | 'investigating' | 'resolved';

const STATUS_FILTER_TO_API: Record<Exclude<StatusFilter, 'all'>, AlertStatus[]> = {
  open: ['NEW'],
  investigating: ['IN_PROGRESS'],
  resolved: ['RESOLVED', 'CLOSED', 'FALSE_POSITIVE'],
};

const POLL_MS = 10_000;

function severityClass(severity?: string) {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'bg-[#ef4444] text-white';
    case 'high':
      return 'bg-[#f59e0b] text-white';
    case 'medium':
      return 'bg-[#eab308] text-black';
    case 'low':
      return 'bg-[#3b82f6] text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

function severityBorderClass(severity?: string) {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'border-l-[#ef4444]';
    case 'high':
      return 'border-l-[#f59e0b]';
    case 'medium':
      return 'border-l-[#eab308]';
    case 'low':
      return 'border-l-[#3b82f6]';
    default:
      return 'border-l-gray-500';
  }
}

function statusIcon(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'NEW') return <XCircle className="size-4 text-[#ef4444]" />;
  if (s === 'IN_PROGRESS') return <Clock className="size-4 text-[#f59e0b]" />;
  if (s === 'RESOLVED' || s === 'CLOSED' || s === 'FALSE_POSITIVE')
    return <CheckCircle className="size-4 text-[#10b981]" />;
  return null;
}

function statusLabel(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'IN_PROGRESS') return 'investigating';
  if (s === 'NEW') return 'open';
  if (s === 'FALSE_POSITIVE') return 'false positive';
  return s.toLowerCase() || 'unknown';
}

function formatTimestamp(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof fetchAlerts>[0] = { limit: 100 };
      if (statusFilter !== 'all') params.status = STATUS_FILTER_TO_API[statusFilter];
      const res: AlertListResponse = await fetchAlerts(params);
      setAlerts(res.items);
      setTotal(res.total);
      // Refresh selected alert from new list (preserve selection if still present).
      setSelectedAlert((prev) =>
        prev ? res.items.find((a) => a.alert_id === prev.alert_id) ?? null : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  const counts = useMemo(() => {
    let openN = 0;
    let invN = 0;
    let resN = 0;
    for (const a of alerts) {
      const s = String(a.status || '').toUpperCase();
      if (s === 'NEW') openN += 1;
      else if (s === 'IN_PROGRESS') invN += 1;
      else if (s === 'RESOLVED' || s === 'CLOSED' || s === 'FALSE_POSITIVE') resN += 1;
    }
    return { all: alerts.length, openN, invN, resN };
  }, [alerts]);

  const handleStatusChange = async (alertId: string, next: AlertStatus) => {
    setUpdatingId(alertId);
    try {
      const updated = await updateAlert(alertId, { status: next });
      setAlerts((prev) => prev.map((a) => (a.alert_id === alertId ? { ...a, ...updated } : a)));
      setSelectedAlert((prev) => (prev?.alert_id === alertId ? { ...prev, ...updated } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alert');
    } finally {
      setUpdatingId(null);
    }
  };

  const recommendationItems = useMemo(() => {
    const rec = selectedAlert?.recommendation;
    if (!rec) return [];
    if (Array.isArray(rec)) {
      return rec.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
    }
    if (typeof rec === 'object') {
      const obj = rec as Record<string, unknown>;
      const arr = obj.steps || obj.actions || obj.suggestions;
      if (Array.isArray(arr)) {
        return arr.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
      }
      if (typeof obj.summary === 'string') return [obj.summary];
    }
    return [String(rec)];
  }, [selectedAlert]);

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-medium text-white">Security Alerts</h2>
            <p className="text-sm text-gray-400 mt-1">
              Live data from detection-worker • {total.toLocaleString()} matched
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void refresh()}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-1.5 border border-[#2a2a3a] hover:border-[#4f46e5]"
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-[#ef4444] animate-pulse" />
              <span className="text-sm text-gray-400">{counts.openN} Open</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/40 px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {(
            [
              { key: 'all', label: 'All', count: counts.all },
              { key: 'open', label: 'Open', count: counts.openN },
              { key: 'investigating', label: 'Investigating', count: counts.invN },
              { key: 'resolved', label: 'Resolved', count: counts.resN },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`px-4 py-2 text-sm ${
                statusFilter === opt.key
                  ? 'bg-[#4f46e5] text-white'
                  : 'bg-[#1a1a24] text-gray-400 hover:text-white'
              }`}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {alerts.length === 0 && !loading && (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-12 text-center text-gray-400">
              No alerts match the current filter.
            </div>
          )}

          {alerts.map((alert) => (
            <div
              key={alert.alert_id}
              onClick={() => setSelectedAlert(alert)}
              className={`bg-[#0f0f17] border border-[#1f1f2e] border-l-4 ${severityBorderClass(
                String(alert.severity)
              )} p-6 cursor-pointer hover:border-[#2f2f3e] transition-all ${
                selectedAlert?.alert_id === alert.alert_id ? 'ring-2 ring-[#4f46e5]' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-5 text-[#ef4444]" />
                  <div>
                    <h3 className="text-white font-medium">
                      {alert.rule_name || alert.event_type || 'Unnamed alert'}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">{alert.alert_id}</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 uppercase ${severityClass(
                    String(alert.severity)
                  )}`}
                >
                  {String(alert.severity || 'unknown').toLowerCase()}
                </span>
              </div>

              <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                {alert.description || alert.rule_id || ''}
              </p>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 font-mono">
                    {formatTimestamp(alert.trigger_time)}
                  </span>
                  <div className="flex items-center gap-1">
                    {statusIcon(alert.status)}
                    <span className="text-gray-400 capitalize">{statusLabel(alert.status)}</span>
                  </div>
                </div>
                <button className="text-[#4f46e5] hover:text-[#6366f1] flex items-center gap-1">
                  <Eye className="size-3" />
                  View
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-6 h-fit">
          {selectedAlert ? (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl text-white font-medium mb-2">
                    {selectedAlert.rule_name || selectedAlert.event_type || 'Unnamed alert'}
                  </h3>
                  <p className="text-sm text-gray-400 font-mono">{selectedAlert.alert_id}</p>
                </div>
                <span
                  className={`text-xs font-medium px-3 py-1.5 uppercase ${severityClass(
                    String(selectedAlert.severity)
                  )}`}
                >
                  {String(selectedAlert.severity || 'unknown').toLowerCase()}
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Description</h4>
                  <p className="text-sm text-gray-400">
                    {selectedAlert.description || 'No description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Source IP</h4>
                    <p className="text-sm text-gray-400 font-mono">
                      {selectedAlert.source_ip || '—'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">User</h4>
                    <p className="text-sm text-gray-400 font-mono">
                      {selectedAlert.user_id || '—'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Rule</h4>
                    <p className="text-sm text-gray-400 font-mono break-all">
                      {selectedAlert.rule_id || '—'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Status</h4>
                    <div className="flex items-center gap-2">
                      {statusIcon(selectedAlert.status)}
                      <span className="text-sm text-gray-400 capitalize">
                        {statusLabel(selectedAlert.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {recommendationItems.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Recommendations</h4>
                    <ul className="space-y-2">
                      {recommendationItems.map((rec, idx) => (
                        <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                          <span className="text-[#4f46e5] mt-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-[#1f1f2e]">
                  <button
                    className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm disabled:opacity-50"
                    disabled={updatingId === selectedAlert.alert_id}
                    onClick={() => void handleStatusChange(selectedAlert.alert_id, 'IN_PROGRESS')}
                  >
                    {updatingId === selectedAlert.alert_id ? 'Updating…' : 'Take Action'}
                  </button>
                  <button
                    className="flex-1 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white px-4 py-2 text-sm disabled:opacity-50"
                    disabled={updatingId === selectedAlert.alert_id}
                    onClick={() => void handleStatusChange(selectedAlert.alert_id, 'RESOLVED')}
                  >
                    Mark Resolved
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
