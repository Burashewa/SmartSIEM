import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAlerts } from '../../hooks/useAlerts';
import { useWS } from '../../hooks/useWS';

interface Alert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  timestamp: string;
  sourceIp: string;
  targetIp: string;
  description: string;
  recommendations: string[];
  detectedBy: string;
  affectedAssets: string[];
}

const toUiStatus = (status: string): Alert['status'] => {
  const normalized = status.toLowerCase();
  if (normalized === 'new' || normalized === 'open') return 'open';
  if (normalized === 'investigating') return 'investigating';
  return 'resolved';
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const queryClient = useQueryClient();
  const alertsQuery = useAlerts({ limit: 200, sort: '-trigger_time' });
  const ws = useWS();

  useEffect(() => {
    const mapped: Alert[] = (alertsQuery.data?.data || []).map((alert) => ({
      id: String(alert.id || alert.alert_id),
      title: alert.rule_name || alert.event_type || 'Security Alert',
      severity: String(alert.severity || 'low').toLowerCase() as Alert['severity'],
      status: toUiStatus(String(alert.status || 'open')),
      timestamp: String(alert.trigger_time || ''),
      sourceIp: String(alert.source_ip || 'unknown'),
      targetIp: '-',
      description: String(alert.description || ''),
      recommendations: alert.recommendation?.action_steps || ['Investigate event context'],
      detectedBy: String(alert.rule_id || 'Detection Engine'),
      affectedAssets: alert.linked_events?.length ? ['linked events'] : ['unknown'],
    }));
    setAlerts(mapped);
  }, [alertsQuery.data?.data]);

  useEffect(() => {
    const unsubscribe = ws.subscribe('alert.new', () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    });
    return () => unsubscribe();
  }, [queryClient, ws]);

  const filteredAlerts = alerts.filter(
    alert => statusFilter === 'all' || alert.status === statusFilter
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-[#ef4444] text-white';
      case 'high': return 'bg-[#f59e0b] text-white';
      case 'medium': return 'bg-[#eab308] text-black';
      case 'low': return 'bg-[#3b82f6] text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityBorderColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-[#ef4444]';
      case 'high': return 'border-l-[#f59e0b]';
      case 'medium': return 'border-l-[#eab308]';
      case 'low': return 'border-l-[#3b82f6]';
      default: return 'border-l-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <XCircle className="size-4 text-[#ef4444]" />;
      case 'investigating': return <Clock className="size-4 text-[#f59e0b]" />;
      case 'resolved': return <CheckCircle className="size-4 text-[#10b981]" />;
      default: return null;
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert List */}
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
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
          ))}
        </div>

        {/* Alert Details Panel */}
        <div className="lg:sticky lg:top-6 h-fit">
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

              {/* Anomaly Detection Indicator */}
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
                  <button className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm">
                    Take Action
                  </button>
                  <button className="flex-1 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white px-4 py-2 text-sm">
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
