import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from './KPICard';
import { LogActivityChart } from './LogActivityChart';
import { AlertsSeverityChart } from './AlertsSeverityChart';
import { GeographicMap } from './GeographicMap';
import { RecentAlertsTable } from './RecentAlertsTable';
import { TerminalStream } from './TerminalStream';
import { TrendingUp, AlertTriangle, Shield, Activity } from 'lucide-react';
import {
  fetchDashboardAlerts,
  fetchDashboardKpi,
  fetchDashboardLogs,
  fetchDashboardSummary,
  type BackendAlertRecord,
  type BackendLogRecord,
  type DashboardSummaryResponse,
} from '../api/dashboard';
import {
  buildAttackLocations,
  buildAttackLocationsFromAlerts,
  buildLogActivitySeries,
  buildRecentAlerts,
  buildLiveStreamEvents,
} from '../lib/dashboardWidgets';
import { normalizeAlertUiStatus } from '../lib/alertStatus';

const KPI_POLL_MS = 1000;
const FULL_REFRESH_MS = 10000;
const STREAM_POLL_MS = 5000;

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [liveMetrics, setLiveMetrics] =
    useState<DashboardSummaryResponse['metrics'] | null>(null);

  const [isChartsLoading, setIsChartsLoading] = useState(true);
  const [isKpiLoading, setIsKpiLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [logs, setLogs] = useState<BackendLogRecord[]>([]);
  const [alerts, setAlerts] = useState<BackendAlertRecord[]>([]);

  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);

  const [activityError, setActivityError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const loadKpi = async () => {
      try {
        const kpi = await fetchDashboardKpi();

        if (!isMounted) return;

        setLiveMetrics(kpi.metrics);
        setKpiError(null);
      } catch (loadError) {
        if (!isMounted) return;

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load dashboard KPI';

        setKpiError(message);
      } finally {
        if (isMounted) {
          setIsKpiLoading(false);
        }
      }
    };

    const loadSummary = async () => {
      try {
        const nextSummary = await fetchDashboardSummary();

        if (!isMounted) return;

        setSummary(nextSummary);
        setError(null);
      } catch (loadError) {
        if (!isMounted) return;

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load dashboard summary';

        setError(message);
      } finally {
        if (isMounted) {
          setIsChartsLoading(false);
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
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load dashboard activity';

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
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load dashboard alerts';

        setAlertsError(message);
      } finally {
        if (isMounted) {
          setIsAlertsLoading(false);
        }
      }
    };

    void Promise.all([loadKpi(), loadSummary(), loadLogs(), loadAlerts()]);

    const kpiInterval = window.setInterval(() => {
      void loadKpi();
    }, KPI_POLL_MS);

    const fullInterval = window.setInterval(() => {
      void loadSummary();
      void loadLogs();
      void loadAlerts();
    }, FULL_REFRESH_MS);

    const streamInterval = window.setInterval(() => {
      void loadLogs();
      void loadAlerts();
    }, STREAM_POLL_MS);

    return () => {
      isMounted = false;

      window.clearInterval(kpiInterval);
      window.clearInterval(fullInterval);
      window.clearInterval(streamInterval);
    };
  }, []);

  const metrics = liveMetrics ?? summary?.metrics;
  const charts = summary?.charts;

  const kpiLoading = isKpiLoading && !metrics;

  const dashboardAlerts = useMemo(
    () => alerts.filter(
      (alert) => normalizeAlertUiStatus(alert.status) !== 'false_positive',
    ),
    [alerts],
  );

  const alertAttackLocations = buildAttackLocationsFromAlerts(dashboardAlerts);

  const attackLocations =
    alertAttackLocations.length > 0
      ? alertAttackLocations
      : buildAttackLocations(logs);

  const streamEvents = useMemo(
    () => buildLiveStreamEvents(logs, dashboardAlerts, 50),
    [logs, dashboardAlerts],
  );

  const streamError = activityError ?? alertsError;
  const isStreamLoading = isActivityLoading || isAlertsLoading;

  const recentAlerts = buildRecentAlerts(dashboardAlerts);

  const activeAlertsCount = useMemo(() => {
    return dashboardAlerts.filter((alert) => {
      const status = normalizeAlertUiStatus(alert.status);
      return status === 'open' || status === 'investigating' || status === 'threat';
    }).length;
  }, [dashboardAlerts]);

  const statusCounts = useMemo(() => {
    const counts = {
      open: 0,
      investigating: 0,
      threat: 0,
      resolved: 0,
    };

    for (const alert of dashboardAlerts) {
      const status = normalizeAlertUiStatus(alert.status);
      if (status in counts) {
        (counts as Record<string, number>)[status] += 1;
      }
    }

    return counts;
  }, [dashboardAlerts]);

  const logActivityFromLogs = useMemo(
    () =>
      buildLogActivitySeries(logs, {
        lookbackHours: 24,
        bucketMinutes: 60,
      }),
    [logs],
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Logs Today"
          value={
            metrics
              ? metrics.logsToday.value.toLocaleString()
              : kpiLoading
                ? '...'
                : '0'
          }
          trend={metrics?.logsToday.trend ?? (kpiLoading ? 'Loading' : '0%')}
          trendLabel={metrics?.logsToday.trendLabel ?? 'vs yesterday'}
          trendTone={metrics?.logsToday.trendTone ?? 'neutral'}
          icon={TrendingUp}
          iconColor="text-[#4f46e5]"
          borderColor="border-l-[#4f46e5]"
          onClick={() => navigate('/logs')}
        />

        <KPICard
          title="Active Alerts"
          value={
            isAlertsLoading && alerts.length === 0
              ? '...'
              : activeAlertsCount.toString()
          }
          subtext={
            `Open ${statusCounts.open} · Investigating ${statusCounts.investigating} · Threat ${statusCounts.threat} · Resolved ${statusCounts.resolved}`
          }
          trend={
            metrics?.activeAlerts.trend ??
            (kpiLoading ? 'Loading' : '0 new')
          }
          trendLabel={metrics?.activeAlerts.trendLabel ?? 'today'}
          trendTone={metrics?.activeAlerts.trendTone ?? 'neutral'}
          icon={AlertTriangle}
          iconColor="text-[#f59e0b]"
          borderColor="border-l-[#f59e0b]"
          pulsing={activeAlertsCount > 0}
          onClick={() => navigate('/alerts-and-threats')}
        />

        <KPICard
          title="Critical Threats"
          value={
            metrics
              ? metrics.criticalThreats.value.toString()
              : kpiLoading
                ? '...'
                : '0'
          }
          trend={
            metrics?.criticalThreats.trend ??
            (kpiLoading ? 'Loading' : '0 triggered')
          }
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
            metrics
              ? `${metrics.systemHealth.value.toFixed(1)}%`
              : kpiLoading
                ? '...'
                : '0.0%'
          }
          trend={
            metrics?.systemHealth.trend ??
            (kpiLoading ? 'Loading' : 'Unavailable')
          }
          trendLabel={metrics?.systemHealth.trendLabel ?? 'overall status'}
          trendTone={metrics?.systemHealth.trendTone ?? 'neutral'}
          icon={Activity}
          iconColor="text-[#10b981]"
          borderColor="border-l-[#10b981]"
        />
      </div>

      {(kpiError || error) && (
        <div className="border border-[#7f1d1d] bg-[#1f1014] px-4 py-3 text-sm text-[#fca5a5]">
          {kpiError ? `KPI realtime: ${kpiError}` : null}
          {kpiError && error ? ' · ' : null}
          {error ? `Charts: ${error}` : null}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="min-w-0">
          <LogActivityChart
            data={logActivityFromLogs}
            isLoading={isActivityLoading}
          />
        </div>

        <div className="min-w-0">
          <AlertsSeverityChart
            data={charts?.alertsBySeverity ?? []}
            isLoading={isChartsLoading}
          />
        </div>
      </div>

      {/* Map + terminal */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="min-w-0">
          <GeographicMap
            attacks={attackLocations}
            isLoading={isActivityLoading || isAlertsLoading}
            error={alertsError ?? activityError}
          />
        </div>

        <div className="min-w-0">
          <TerminalStream
            events={streamEvents}
            isLoading={isStreamLoading}
            error={streamError}
          />
        </div>
      </div>

      {/* Recent Alerts */}
      <RecentAlertsTable
        alerts={recentAlerts}
        isLoading={isAlertsLoading}
        error={alertsError}
      />
    </div>
  );
}