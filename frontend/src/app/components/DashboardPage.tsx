import { useState, useEffect } from 'react';
import { KPICard } from './KPICard';
import { LogActivityChart } from './LogActivityChart';
import { AlertsSeverityChart } from './AlertsSeverityChart';
import { EventsBySourceChart } from './EventsBySourceChart';
import { GeographicMap } from './GeographicMap';
import { RecentAlertsTable } from './RecentAlertsTable';
import { TerminalStream } from './TerminalStream';
import { PriorityAIRecommendations } from './PriorityAIRecommendations';
import { TrendingUp, AlertTriangle, Shield, Activity } from 'lucide-react';

export function DashboardPage() {
  const [logsToday, setLogsToday] = useState(1247892);
  const [activeAlerts, setActiveAlerts] = useState(43);
  const [criticalThreats, setCriticalThreats] = useState(8);
  const [systemHealth, setSystemHealth] = useState(98.7);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLogsToday(prev => prev + Math.floor(Math.random() * 100));
      
      if (Math.random() > 0.7) {
        setActiveAlerts(prev => Math.max(0, prev + (Math.random() > 0.5 ? 1 : -1)));
      }
      
      if (Math.random() > 0.9) {
        setCriticalThreats(prev => Math.max(0, prev + (Math.random() > 0.6 ? 1 : -1)));
      }
      
      setSystemHealth(prev => Math.min(100, Math.max(95, prev + (Math.random() - 0.5) * 0.5)));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Logs Today"
          value={logsToday.toLocaleString()}
          trend="+12.3%"
          icon={TrendingUp}
          iconColor="text-[#4f46e5]"
          borderColor="border-l-[#4f46e5]"
        />
        <KPICard
          title="Active Alerts"
          value={activeAlerts.toString()}
          trend="+3"
          icon={AlertTriangle}
          iconColor="text-[#f59e0b]"
          borderColor="border-l-[#f59e0b]"
          pulsing={activeAlerts > 40}
        />
        <KPICard
          title="Critical Threats"
          value={criticalThreats.toString()}
          trend="-2"
          icon={Shield}
          iconColor="text-[#ef4444]"
          borderColor="border-l-[#ef4444]"
          pulsing={criticalThreats > 5}
        />
        <KPICard
          title="System Health"
          value={`${systemHealth.toFixed(1)}%`}
          trend="Normal"
          icon={Activity}
          iconColor="text-[#10b981]"
          borderColor="border-l-[#10b981]"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LogActivityChart />
        <AlertsSeverityChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <EventsBySourceChart />
        <GeographicMap />
        <TerminalStream />
      </div>

      {/* Recent Alerts Table */}
      <RecentAlertsTable />

      {/* Priority AI Recommendations */}
      <PriorityAIRecommendations />
    </div>
  );
}