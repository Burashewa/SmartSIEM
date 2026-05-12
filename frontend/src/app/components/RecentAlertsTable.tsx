import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AlertDeepDiveModal } from './AlertDeepDiveModal';
import { alertsService } from '../../api/services/alerts.service';
import { useWS } from '../../hooks/useWS';

interface Alert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sourceIp: string;
  destination: string;
  description: string;
  logSource: string;
  status: 'New' | 'In-Progress' | 'Resolved';
}

export function RecentAlertsTable() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const ws = useWS();

  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewAlert = (alert: Alert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAlert(null);
  };

  useEffect(() => {
    void alertsService.list({ limit: 10, sort: '-trigger_time' }).then((response) => {
      const mapped = response.data.map((item) => ({
        id: item.id,
        timestamp: item.trigger_time,
        severity: item.severity.toLowerCase() as Alert['severity'],
        sourceIp: item.source_ip || 'unknown',
        destination: '-',
        description: item.description,
        logSource: item.rule_name,
        status: item.status === 'NEW' ? 'New' : item.status === 'INVESTIGATING' ? 'In-Progress' : 'Resolved',
      }));
      setAlerts(mapped);
    });
    const unsubscribe = ws.subscribe('alert.new', (event) => {
      const incoming: Alert = {
        id: event.data.id,
        timestamp: event.data.trigger_time,
        severity: event.data.severity.toLowerCase() as Alert['severity'],
        sourceIp: event.data.source_ip || 'unknown',
        destination: '-',
        description: event.data.description,
        logSource: event.data.rule_name,
        status: event.data.status === 'NEW' ? 'New' : event.data.status === 'INVESTIGATING' ? 'In-Progress' : 'Resolved',
      };
      setAlerts((prev) => [incoming, ...prev].slice(0, 10));
    });
    return () => unsubscribe();
  }, [ws]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-[#ef4444] text-white';
      case 'high': return 'bg-[#f59e0b] text-white';
      case 'medium': return 'bg-[#eab308] text-black';
      case 'low': return 'bg-[#3b82f6] text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
      case 'In-Progress': return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
      case 'Resolved': return 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30';
      default: return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
    }
  };

  const handleStatusChange = (alertId: string, newStatus: Alert['status']) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, status: newStatus } : alert
      )
    );
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
          <h3 className="text-lg font-medium text-white">Recent Alerts</h3>
          <p className="text-sm text-gray-400 mt-1">Latest security events</p>
        </div>
        <button className="text-sm text-[#4f46e5] hover:text-[#6366f1] flex items-center gap-1">
          View All
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1f1f2e]">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Timestamp</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Severity</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Source IP</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Destination</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Description</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Log Source</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr 
                key={alert.id} 
                className="border-b border-[#1f1f2e] hover:bg-[#1a1a24] transition-colors"
              >
                <td className="py-3 px-4 text-sm font-mono text-gray-300">
                  {formatTimestamp(alert.timestamp)}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-medium px-2 py-1 uppercase ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm font-mono text-gray-300">
                  {alert.sourceIp}
                </td>
                <td className="py-3 px-4 text-sm font-mono text-gray-300">
                  {alert.destination}
                </td>
                <td className="py-3 px-4 text-sm text-gray-300">
                  {alert.description}
                </td>
                <td className="py-3 px-4 text-sm font-mono text-white">
                  {alert.logSource}
                </td>
                <td className="py-3 px-4">
                  <select
                    value={alert.status}
                    onChange={(e) => handleStatusChange(alert.id, e.target.value as Alert['status'])}
                    className={`text-xs font-medium px-2 py-1 border rounded cursor-pointer bg-transparent focus:outline-none focus:ring-1 focus:ring-[#4f46e5] ${getStatusColor(alert.status)}`}
                  >
                    <option value="New" className="bg-[#1a1a24] text-white">New</option>
                    <option value="In-Progress" className="bg-[#1a1a24] text-white">In-Progress</option>
                    <option value="Resolved" className="bg-[#1a1a24] text-white">Resolved</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <button className="text-[#4f46e5] hover:text-[#6366f1] text-sm" onClick={() => handleViewAlert(alert)}>
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