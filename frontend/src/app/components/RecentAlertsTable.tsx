import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AlertDeepDiveModal } from './AlertDeepDiveModal';
import { buildRecentAlerts, type RecentAlertRecord } from '../lib/dashboardWidgets';
import { fetchAlertById } from '../api/dashboard';
import {
  getAlertStatusColor,
  getAlertStatusLabel,
  normalizeAlertUiStatus,
} from '../lib/alertStatus';

interface RecentAlertsTableProps {
  alerts: RecentAlertRecord[];
  isLoading?: boolean;
  error?: string | null;
}

export function RecentAlertsTable({
  alerts,
  isLoading = false,
  error = null,
}: RecentAlertsTableProps) {
  const [selectedAlert, setSelectedAlert] =
    useState<RecentAlertRecord | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingAlertId, setLoadingAlertId] = useState<string | null>(null);

  const handleViewAlert = async (alert: RecentAlertRecord) => {
    if (loadingAlertId) return;

    const alertId = alert.alertId ?? alert.id;

    setLoadingAlertId(alertId);

    try {
      const freshAlert = await fetchAlertById(alertId);
      const normalized = buildRecentAlerts([freshAlert])[0];

      if (!normalized) {
        throw new Error(`Alert ${alertId} could not be normalized`);
      }

      setSelectedAlert(normalized);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to load alert details', err);
    } finally {
      setLoadingAlertId(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAlert(null);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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
  };

  const getStatusColor = (status?: string) => {
    const uiStatus = normalizeAlertUiStatus(status);
    return `${getAlertStatusColor(uiStatus)} border`;
  };

  const getStatusLabel = (status?: string) => {
    const uiStatus = normalizeAlertUiStatus(status);
    return uiStatus === 'open' ? 'Open' : getAlertStatusLabel(uiStatus);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">
            Recent Alerts
          </h3>

          <p className="text-sm text-gray-400 mt-1">
            Latest security events
          </p>
        </div>

        <button className="text-sm text-[#4f46e5] hover:text-[#6366f1] flex items-center gap-1">
          {alerts.length} Loaded
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1f1f2e]">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Timestamp
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Severity
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Source IP
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Destination / Resource
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Rule Name
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Hits
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Log Source
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Status
              </th>

              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading recent alerts from the backend...
                </td>
              </tr>
            ) : null}

            {!isLoading && error ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-[#fca5a5]"
                >
                  {error}
                </td>
              </tr>
            ) : null}

            {!isLoading && !error && alerts.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No alerts have been triggered yet.
                </td>
              </tr>
            ) : null}

            {!isLoading && !error
              ? alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="border-b border-[#1f1f2e] hover:bg-[#1a1a24] transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-mono text-gray-300">
                      {formatTimestamp(alert.timestamp)}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 uppercase ${getSeverityColor(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-sm font-mono text-gray-300">
                      {alert.sourceIp}
                    </td>

                    <td className="py-3 px-4 text-sm font-mono text-gray-300">
                      {alert.destination}
                    </td>

                    <td className="py-3 px-4 text-sm text-gray-300 max-w-[240px]">
                      <div
                        className="font-medium truncate"
                        title={alert.ruleName}
                      >
                        {alert.ruleName}
                      </div>

                      {alert.description &&
                      alert.description !== alert.ruleName ? (
                        <div
                          className="text-xs text-gray-500 truncate mt-0.5"
                          title={alert.description}
                        >
                          {alert.description}
                        </div>
                      ) : null}
                    </td>

                    <td className="py-3 px-4 text-sm text-gray-300">
                      {typeof alert.occurrenceCount === 'number' &&
                      alert.occurrenceCount >= 2 ? (
                        <span
                          className="inline-flex items-center rounded bg-[#4f46e5]/20 px-2 py-0.5 text-xs font-mono text-[#a5b4fc] border border-[#4f46e5]/30"
                          title={`${alert.occurrenceCount} grouped events (dedup)`}
                        >
                          ×{alert.occurrenceCount}
                        </span>
                      ) : (
                        <span className="text-gray-600">1</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-sm font-mono text-white">
                      {alert.logSource}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex text-xs font-medium px-2 py-1 border ${getStatusColor(
                          alert.status,
                        )}`}
                      >
                        {getStatusLabel(alert.status)}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <button
                        className="text-[#4f46e5] hover:text-[#6366f1] text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => void handleViewAlert(alert)}
                        disabled={Boolean(loadingAlertId)}
                      >
                        {loadingAlertId === alert.id ? 'Loading...' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedAlert ? (
        <AlertDeepDiveModal
          alert={selectedAlert}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      ) : null}
    </div>
  );
}