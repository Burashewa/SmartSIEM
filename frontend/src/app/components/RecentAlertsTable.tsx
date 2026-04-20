import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { AlertDeepDiveModal } from './AlertDeepDiveModal';

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

const generateRandomIP = () => {
  return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
};

const alertDescriptions = [
  'SQL Injection attempt detected',
  'Brute force attack on SSH port',
  'Malware signature detected',
  'Unauthorized access attempt',
  'Port scanning activity',
  'Suspicious file download',
  'DDoS attack indicators',
  'Data exfiltration attempt',
];

const logSources = [
  'Firewall-01',
  'Firewall-02',
  'AWS-CloudTrail',
  'Azure-Monitor',
  'IDS-Primary',
  'Web-Server-01',
  'AD-Controller',
  'VPN-Gateway',
];

export function RecentAlertsTable() {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      timestamp: new Date().toISOString(),
      severity: 'critical',
      sourceIp: '203.45.67.89',
      destination: '10.0.1.45:443',
      description: 'SQL Injection attempt detected',
      logSource: 'Web-Server-01',
      status: 'New',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      severity: 'high',
      sourceIp: '192.168.1.100',
      destination: '10.0.1.23:22',
      description: 'Brute force attack on SSH port',
      logSource: 'Firewall-01',
      status: 'In-Progress',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      severity: 'medium',
      sourceIp: '172.16.0.45',
      destination: '10.0.1.67:80',
      description: 'Suspicious file download',
      logSource: 'AWS-CloudTrail',
      status: 'In-Progress',
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      severity: 'high',
      sourceIp: '198.51.100.42',
      destination: '10.0.1.12:3306',
      description: 'Unauthorized access attempt',
      logSource: 'AD-Controller',
      status: 'Resolved',
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      severity: 'low',
      sourceIp: '10.0.5.23',
      destination: '10.0.1.89:443',
      description: 'Port scanning activity',
      logSource: 'IDS-Primary',
      status: 'Resolved',
    },
  ]);

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
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const severities: Alert['severity'][] = ['critical', 'high', 'medium', 'low'];
        const newAlert: Alert = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          severity: severities[Math.floor(Math.random() * severities.length)],
          sourceIp: generateRandomIP(),
          destination: `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}:${Math.floor(Math.random() * 9000) + 1000}`,
          description: alertDescriptions[Math.floor(Math.random() * alertDescriptions.length)],
          logSource: logSources[Math.floor(Math.random() * logSources.length)],
          status: 'New',
        };

        setAlerts(prev => [newAlert, ...prev].slice(0, 10));
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

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