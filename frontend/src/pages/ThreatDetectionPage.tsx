import { useAlerts } from '../hooks/useAlerts';
import { EmptyState } from '../components/shared/EmptyState';

export default function ThreatDetectionPage() {
  const alertsQuery = useAlerts({
    severity: 'HIGH,CRITICAL',
    limit: 100,
    sort: '-trigger_time',
  });

  if (alertsQuery.isLoading) {
    return <div className="text-gray-300">Loading threat detections...</div>;
  }

  if (!alertsQuery.data || alertsQuery.data.data.length === 0) {
    return <EmptyState title="No high-severity threats" description="System currently has no HIGH/CRITICAL alerts." />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white">Threat Detection</h2>
      <div className="bg-[#0f0f17] border border-[#1f1f2e] divide-y divide-[#1f1f2e]">
        {alertsQuery.data.data.map((alert) => (
          <div key={alert.id} className="p-4">
            <div className="text-white">{alert.rule_name}</div>
            <div className="text-xs text-gray-400">
              {alert.severity} • {alert.source_ip || 'unknown'} • {new Date(alert.trigger_time).toLocaleString()}
            </div>
            <p className="text-sm text-gray-300 mt-2">{alert.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
