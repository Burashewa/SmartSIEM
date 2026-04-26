import { useEffect, useState } from 'react';
import { KPICard } from './KPICard';
import { LogActivityChart } from './LogActivityChart';
import { AlertsSeverityChart } from './AlertsSeverityChart';
import { EventsBySourceChart } from './EventsBySourceChart';
import { GeographicMap } from './GeographicMap';
import { RecentAlertsTable } from './RecentAlertsTable';
import { TerminalStream } from './TerminalStream';
import { PriorityAIRecommendations } from './PriorityAIRecommendations';
import { TrendingUp, AlertTriangle, Shield, Activity } from 'lucide-react';
import {
  fetchDashboardAlerts,
  fetchDashboardLogs,
  fetchDashboardSummary,
  type BackendAlertRecord,
  type BackendLogRecord,
  type DashboardSummaryResponse,
} from '../api/dashboard';
import {
  buildAttackLocations,
  buildRecentAlerts,
  buildStreamEvents,
} from '../lib/dashboardWidgets';

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<BackendLogRecord[]>([]);
  const [alerts, setAlerts] = useState<BackendAlertRecord[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      try {
        const nextSummary = await fetchDashboardSummary();
        if (!isMounted) return;
        setSummary(nextSummary);
        setError(null);
      } catch (loadError) {
        if (!isMounted) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Failed to load dashboard summary';
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const loadLogs = async () => {
      try {
        const nextLogs = await fetchDashboardLogs();
        if (!isMounted) return;
        setLogs(nextLogs);
        setActivityError(null);
      } catch (loadError) {
        if (!isMounted) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Failed to load dashboard activity';
        setActivityError(message);
      } finally {
        if (isMounted) {
          setIsActivityLoading(false);
        }
      }
    };

    const loadAlerts = async () => {
      try {
        const nextAlerts = await fetchDashboardAlerts();
        if (!isMounted) return;
        setAlerts(nextAlerts);
        setAlertsError(null);
      } catch (loadError) {
        if (!isMounted) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Failed to load dashboard alerts';
        setAlertsError(message);
      } finally {
        if (isMounted) {
          setIsAlertsLoading(false);
        }
      }
    };

    void loadSummary();
    void loadLogs();
    void loadAlerts();
    const interval = window.setInterval(() => {
      void loadSummary();
      void loadLogs();
      void loadAlerts();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const metrics = summary?.metrics;
  const charts = summary?.charts;
  const attackLocations = buildAttackLocations(logs);
  const streamEvents = buildStreamEvents(logs);
  const recentAlerts = buildRecentAlerts(alerts);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Logs Today"
          value={metrics ? metrics.logsToday.value.toLocaleString() : isLoading ? '...' : '0'}
          trend={metrics?.logsToday.trend ?? (isLoading ? 'Loading' : '0%')}
          trendLabel={metrics?.logsToday.trendLabel ?? 'vs yesterday'}
          trendTone={metrics?.logsToday.trendTone ?? 'neutral'}
          icon={TrendingUp}
          iconColor="text-[#4f46e5]"
          borderColor="border-l-[#4f46e5]"
        />
        <KPICard
          title="Active Alerts"
          value={metrics ? metrics.activeAlerts.value.toString() : isLoading ? '...' : '0'}
          trend={metrics?.activeAlerts.trend ?? (isLoading ? 'Loading' : '0 new')}
          trendLabel={metrics?.activeAlerts.trendLabel ?? 'today'}
          trendTone={metrics?.activeAlerts.trendTone ?? 'neutral'}
          icon={AlertTriangle}
          iconColor="text-[#f59e0b]"
          borderColor="border-l-[#f59e0b]"
          pulsing={(metrics?.activeAlerts.value ?? 0) > 0}
        />
        <KPICard
          title="Critical Threats"
          value={metrics ? metrics.criticalThreats.value.toString() : isLoading ? '...' : '0'}
          trend={metrics?.criticalThreats.trend ?? (isLoading ? 'Loading' : '0 triggered')}
          trendLabel={metrics?.criticalThreats.trendLabel ?? 'today'}
          trendTone={metrics?.criticalThreats.trendTone ?? 'neutral'}
          icon={Shield}
          iconColor="text-[#ef4444]"
          borderColor="border-l-[#ef4444]"
          pulsing={(metrics?.criticalThreats.value ?? 0) > 0}
        />
        <KPICard
          title="System Health"
          value={
            metrics ? `${metrics.systemHealth.value.toFixed(1)}%` : isLoading ? '...' : '0.0%'
          }
          trend={metrics?.systemHealth.trend ?? (isLoading ? 'Loading' : 'Unavailable')}
          trendLabel={metrics?.systemHealth.trendLabel ?? 'overall status'}
          trendTone={metrics?.systemHealth.trendTone ?? 'neutral'}
          icon={Activity}
          iconColor="text-[#10b981]"
          borderColor="border-l-[#10b981]"
        />
      </div>

      {error ? (
        <div className="border border-[#7f1d1d] bg-[#1f1014] px-4 py-3 text-sm text-[#fca5a5]">
          Dashboard summary is using fallback values right now: {error}
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LogActivityChart data={charts?.logActivity ?? []} isLoading={isLoading} />
        <AlertsSeverityChart data={charts?.alertsBySeverity ?? []} isLoading={isLoading} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <EventsBySourceChart data={charts?.eventsBySource ?? []} isLoading={isLoading} />
        <GeographicMap
          attacks={attackLocations}
          isLoading={isActivityLoading}
          error={activityError}
        />
        <TerminalStream
          events={streamEvents}
          isLoading={isActivityLoading}
          error={activityError}
        />
      </div>

      {/* Recent Alerts Table */}
      <RecentAlertsTable
        alerts={recentAlerts}
        isLoading={isAlertsLoading}
        error={alertsError}
      />

      {/* Priority AI Recommendations */}
      <PriorityAIRecommendations />
    </div>
  );
}
