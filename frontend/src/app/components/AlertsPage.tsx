  import { useEffect, useMemo, useState } from 'react';
  import { AlertTriangle, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
  import { useQueryClient } from '@tanstack/react-query';
  import { useAlerts } from '../../hooks/useAlerts';
  import { useWS } from '../../hooks/useWS';
  import { alertsService } from '../../api/services/alerts.service';

  interface Alert {
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'open' | 'investigating' | 'resolved' | 'false_positive';
    timestamp: string;
    sourceIp: string;
    targetIp: string;
    description: string;
    recommendations: string[];
    detectedBy: string;
    ruleCondition: string;
    affectedAssets: string[];
  }

  const toUiStatus = (status: string): Alert['status'] => {
    const normalized = status.toLowerCase().trim();

    if (normalized === 'new' || normalized === 'open') {
      return 'open';
    }

    if (normalized === 'investigating') {
      return 'investigating';
    }

    if (normalized === 'resolved') {
      return 'resolved';
    }

    if (normalized === 'false_positive') {
      return 'false_positive';
    }

    return 'open';
  };

  export function AlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

    const [statusFilter, setStatusFilter] = useState<
      'all' | 'open' | 'investigating' | 'resolved' | 'false_positive'
    >('all');

    const [severityFilter, setSeverityFilter] = useState<
      'all' | 'critical' | 'high' | 'medium' | 'low'
    >('all');

    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'severity'>('newest');
    const [isUpdating, setIsUpdating] = useState(false);

    const queryClient = useQueryClient();
    const alertsQuery = useAlerts({ limit: 200, sort: '-trigger_time' });
    const ws = useWS();

    useEffect(() => {
      const mapped: Alert[] = (alertsQuery.data?.data || []).map((alert: any) => ({
        id: String(alert.id || alert.alert_id),
        title: alert.rule_name || alert.event_type || 'Security Alert',
        severity: String(alert.severity || 'low').toLowerCase() as Alert['severity'],
        status: toUiStatus(String(alert.status || 'open')),
        timestamp: String(alert.trigger_time || ''),
        sourceIp: String(alert.source_ip || 'unknown'),
        targetIp: String(alert.destination_ip || alert.target_ip || '-'),
        description: String(alert.description || ''),
        recommendations: alert.recommendation?.action_steps || ['Investigate event context'],
        detectedBy: String(alert.rule_name || alert.rule_id || 'Detection Engine'),
        ruleCondition: String(
          (alert as any).condition_script || (alert as any).rule?.condition || 'Rule condition not available',
        ),
        affectedAssets: alert.linked_events?.length
          ? alert.linked_events.map((event) => String(event))
          : ['No linked events'],
      }));

      setAlerts(mapped);
    }, [alertsQuery.data?.data]);

    useEffect(() => {
      const unsubscribe = ws.subscribe('alert.new', () => {
        void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      });

      return () => unsubscribe();
    }, [queryClient, ws]);

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
              const order = ['critical', 'high', 'medium', 'low'];

              return order.indexOf(a.severity) - order.indexOf(b.severity);
            }

            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          }),
      [alerts, statusFilter, severityFilter, sortBy],
    );

    const updateAlertStatus = async (
      newStatus: 'investigating' | 'resolved' | 'false_positive',
    ) => {
      if (!selectedAlert || isUpdating) {
        return;
      }

      setIsUpdating(true);

      try {
        await alertsService.patchStatus(selectedAlert.id, newStatus);

        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === selectedAlert.id
              ? { ...alert, status: newStatus }
              : alert,
          ),
        );

        setSelectedAlert((prev) =>
          prev ? { ...prev, status: newStatus } : null,
        );

        void queryClient.invalidateQueries({
          queryKey: ['alerts'],
        });
      } catch (err) {
        console.error('Failed to update alert status:', err);

        void queryClient.invalidateQueries({
          queryKey: ['alerts'],
        });
      } finally {
        setIsUpdating(false);
      }
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

    const getSeverityBorderColor = (severity: string) => {
      switch (severity) {
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
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'open':
          return <XCircle className="size-4 text-[#ef4444]" />;

        case 'investigating':
          return <Clock className="size-4 text-[#f59e0b]" />;

        case 'resolved':
          return <CheckCircle className="size-4 text-[#10b981]" />;

        default:
          return null;
      }
    };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-medium text-white">Security Alerts</h2>
            <p className="text-sm text-gray-400 mt-1">Monitor and manage security incidents</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-[#ef4444] animate-pulse" />
            <span className="text-sm text-gray-400">
              {alerts.filter(a => a.status === 'open').length} Open Alerts
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'all'
                ? 'bg-[#4f46e5] text-white'
                : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'open'
                ? 'bg-[#4f46e5] text-white'
                : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            Open ({alerts.filter(a => a.status === 'open').length})
          </button>
          <button
            onClick={() => setStatusFilter('investigating')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'investigating'
                ? 'bg-[#4f46e5] text-white'
                : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            Investigating ({alerts.filter(a => a.status === 'investigating').length})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'resolved'
                ? 'bg-[#4f46e5] text-white'
                : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            Resolved ({alerts.filter(a => a.status === 'resolved').length})
          </button>
          <button
            onClick={() => setStatusFilter('false_positive')}
            className={`px-4 py-2 text-sm ${
              statusFilter === 'false_positive'
                ? 'bg-[#1a1a24] border border-[#ef4444] text-[#ef4444]'
                : 'bg-[#1a1a24] text-gray-400 hover:text-white'
            }`}
          >
            False Positive ({alerts.filter(a => a.status === 'false_positive').length})
          </button>
        </div>

        <div className="flex gap-2 mt-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-240px)] lg:overflow-hidden">
        {/* Alert List */}
        <div className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Sort by:</span>
            <div className="flex gap-2">
              {(['newest', 'oldest', 'severity'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-3 py-1 text-xs ${
                    sortBy === option
                      ? 'bg-[#4f46e5] text-white'
                      : 'bg-[#1a1a24] text-gray-400 hover:text-white'
                  }`}
                >
                  {option === 'newest' ? 'Newest' : option === 'oldest' ? 'Oldest' : 'Severity'}
                </button>
              ))}
            </div>
          </div>

          {alertsQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`alert-skeleton-${index}`}
                  className="h-[160px] animate-pulse bg-[#1a1a24] border border-[#1f1f2e]"
                />
              ))}
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
                      <h3 className="text-white font-medium">{alert.title}</h3>
                      <p className="text-xs text-gray-500 font-mono mt-1">{alert.id}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 uppercase ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                </div>

                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                  {alert.description}
                </p>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 font-mono">{alert.timestamp}</span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(alert.status)}
                      <span className="text-gray-400 capitalize">{alert.status}</span>
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

        {/* Alert Details Panel */}
        <div className="h-fit lg:sticky lg:top-6 lg:h-full lg:overflow-y-auto lg:pr-1">
          {selectedAlert ? (
            <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl text-white font-medium mb-2">{selectedAlert.title}</h3>
                  <p className="text-sm text-gray-400 font-mono">{selectedAlert.id}</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1.5 uppercase ${getSeverityColor(selectedAlert.severity)}`}>
                  {selectedAlert.severity}
                </span>
              </div>

              {/* Detection Rule Indicator */}
              <div className="bg-[#1a1a24] border border-[#4f46e5] p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-2 rounded-full bg-[#4f46e5] animate-pulse" />
                  <span className="text-sm font-medium text-[#4f46e5]">Detection Rule Matched</span>
                </div>
                <p className="text-xs text-gray-400">
                  Rule ID: {selectedAlert.detectedBy}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Rule condition: {selectedAlert.ruleCondition}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Description</h4>
                  <p className="text-sm text-gray-400">{selectedAlert.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Source IP</h4>
                    <p className="text-sm text-gray-400 font-mono">{selectedAlert.sourceIp}</p>
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
                      <span className="text-sm text-gray-400 capitalize">{selectedAlert.status}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Affected Assets</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAlert.affectedAssets.map((asset, idx) => (
                      <span key={idx} className="bg-[#1a1a24] border border-[#2a2a3a] px-2 py-1 text-xs text-gray-400 font-mono">
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {selectedAlert.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                        <span className="text-[#4f46e5] mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2 pt-4 border-t border-[#1f1f2e]">
                  <button
                    onClick={() => updateAlertStatus('investigating')}
                    disabled={isUpdating || selectedAlert.status === 'investigating'}
                    className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Investigate
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
                    Mark False Positive
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
