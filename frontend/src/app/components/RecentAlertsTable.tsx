import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { AlertDeepDiveModal } from './AlertDeepDiveModal';
import {
  fetchAlerts,
  updateAlert,
  type Alert as LiveAlert,
  type AlertStatus,
} from '@/lib/smartsiemApi';

type RowSeverity = 'critical' | 'high' | 'medium' | 'low';
type RowStatus = 'New' | 'In-Progress' | 'Resolved';

interface Row {
  id: string;
  timestamp: string;
  severity: RowSeverity;
  sourceIp: string;
  destination: string;
  description: string;
  logSource: string;
  status: RowStatus;
}

const POLL_MS = 10_000;
const PAGE_LIMIT = 10;

function normalizeSeverity(severity?: string): RowSeverity {
  switch (String(severity || '').toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'low';
  }
}

function normalizeStatus(status?: string): RowStatus {
  switch (String(status || '').toUpperCase()) {
    case 'IN_PROGRESS':
      return 'In-Progress';
    case 'RESOLVED':
    case 'CLOSED':
    case 'FALSE_POSITIVE':
      return 'Resolved';
    default:
      return 'New';
  }
}

function uiStatusToApi(status: RowStatus): AlertStatus {
  if (status === 'In-Progress') return 'IN_PROGRESS';
  if (status === 'Resolved') return 'RESOLVED';
  return 'NEW';
}

function alertToRow(alert: LiveAlert): Row {
  const description =
    alert.description ||
    (alert.rule_name ? alert.rule_name : alert.event_type) ||
    'Detection alert';
  const dest = (alert as Record<string, unknown>).destination;
  const destination =
    typeof dest === 'string' ? dest : alert.event_type ? `event:${alert.event_type}` : '—';
  return {
    id: alert.alert_id,
    timestamp: alert.trigger_time || new Date().toISOString(),
    severity: normalizeSeverity(String(alert.severity)),
    sourceIp: alert.source_ip || '—',
    destination,
    description,
    logSource: alert.rule_id || alert.rule_name || 'detection-worker',
    status: normalizeStatus(String(alert.status)),
  };
}

function severityClass(severity: RowSeverity) {
  switch (severity) {
    case 'critical':
      return 'bg-[#ef4444] text-white';
    case 'high':
      return 'bg-[#f59e0b] text-white';
    case 'medium':
      return 'bg-[#eab308] text-black';
    case 'low':
      return 'bg-[#3b82f6] text-white';
  }
}

function statusClass(status: RowStatus) {
  switch (status) {
    case 'New':
      return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
    case 'In-Progress':
      return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
    case 'Resolved':
      return 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30';
  }
}

function formatTimestamp(timestamp: string) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return timestamp;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RecentAlertsTable() {
  const [alerts, setAlerts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Row | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAlerts({ limit: PAGE_LIMIT });
      setAlerts(res.items.map(alertToRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  const handleViewAlert = (alert: Row) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAlert(null);
  };

  const handleStatusChange = async (alertId: string, next: RowStatus) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: next } : a)));
    try {
      await updateAlert(alertId, { status: uiStatusToApi(next) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      void refresh();
    }
  };

  const totalForFooter = useMemo(() => alerts.length, [alerts]);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Recent Alerts</h3>
          <p className="text-sm text-gray-400 mt-1">
            Latest {totalForFooter} alerts from the detection-worker
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void refresh()}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <a
            href="/alerts"
            className="text-sm text-[#4f46e5] hover:text-[#6366f1] flex items-center gap-1"
          >
            View All
            <ChevronRight className="size-4" />
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/40 px-3 py-2">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1f1f2e]">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Timestamp</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Severity</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Source IP</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Destination</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Description</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Rule</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="py-8 px-4 text-center text-gray-500">
                  No alerts yet. Once the detection-worker raises something, it shows up here.
                </td>
              </tr>
            )}
            {alerts.map((alert) => (
              <tr
                key={alert.id}
                className="border-b border-[#1f1f2e] hover:bg-[#1a1a24] transition-colors"
              >
                <td className="py-3 px-4 text-sm font-mono text-gray-300">
                  {formatTimestamp(alert.timestamp)}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-xs font-medium px-2 py-1 uppercase ${severityClass(alert.severity)}`}
                  >
                    {alert.severity}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm font-mono text-gray-300">{alert.sourceIp}</td>
                <td className="py-3 px-4 text-sm font-mono text-gray-300">{alert.destination}</td>
                <td className="py-3 px-4 text-sm text-gray-300 max-w-md truncate">
                  {alert.description}
                </td>
                <td className="py-3 px-4 text-sm font-mono text-white">{alert.logSource}</td>
                <td className="py-3 px-4">
                  <select
                    value={alert.status}
                    onChange={(e) =>
                      void handleStatusChange(alert.id, e.target.value as RowStatus)
                    }
                    className={`text-xs font-medium px-2 py-1 border rounded cursor-pointer bg-transparent focus:outline-none focus:ring-1 focus:ring-[#4f46e5] ${statusClass(alert.status)}`}
                  >
                    <option value="New" className="bg-[#1a1a24] text-white">
                      New
                    </option>
                    <option value="In-Progress" className="bg-[#1a1a24] text-white">
                      In-Progress
                    </option>
                    <option value="Resolved" className="bg-[#1a1a24] text-white">
                      Resolved
                    </option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <button
                    className="text-[#4f46e5] hover:text-[#6366f1] text-sm"
                    onClick={() => handleViewAlert(alert)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedAlert && (
        <AlertDeepDiveModal
          alert={selectedAlert}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
