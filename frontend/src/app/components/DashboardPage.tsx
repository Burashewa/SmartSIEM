import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from './KPICard';
import { LogActivityChart } from './LogActivityChart';
import { AlertsSeverityChart } from './AlertsSeverityChart';
import { EventsBySourceChart } from './EventsBySourceChart';
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
import { fetchAgents } from '../api/agents';
import {
  buildAttackLocations,
  buildAttackLocationsFromAlerts,
  buildEventsByUserAndAgent,
  buildLogActivitySeries,
  buildRecentAlerts,
  buildStreamEvents,
} from '../lib/dashboardWidgets';
import { normalizeAlertUiStatus } from '../lib/alertStatus';

const KPI_POLL_MS = 1000;
const FULL_REFRESH_MS = 10000;

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

  const [agentNamesById, setAgentNamesById] = useState<Record<string, string>>(
    {},
  );
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

    const loadAgents = async () => {
      try {
        const agents = await fetchAgents();

        if (!isMounted) return;

        setAgentNamesById(
          Object.fromEntries(agents.map((a) => [a.agentId, a.name])),
        );
      } catch {
        if (!isMounted) return;

        setAgentNamesById({});
      }
    };

    void Promise.all([
      loadKpi(),
      loadSummary(),
      loadLogs(),
      loadAlerts(),
      loadAgents(),
    ]);

    const kpiInterval = window.setInterval(() => {
      void loadKpi();
    }, KPI_POLL_MS);

    const fullInterval = window.setInterval(() => {
      void loadSummary();
      void loadLogs();
      void loadAlerts();
      void loadAgents();
    }, FULL_REFRESH_MS);

    return () => {
      isMounted = false;

      window.clearInterval(kpiInterval);
      window.clearInterval(fullInterval);
    };
  }, []);

  const metrics = liveMetrics ?? summary?.metrics;
  const charts = summary?.charts;

  const kpiLoading = isKpiLoading && !metrics;

  const alertAttackLocations = buildAttackLocationsFromAlerts(alerts);

  const attackLocations =
    alertAttackLocations.length > 0
      ? alertAttackLocations
      : buildAttackLocations(logs);

  const streamEvents = buildStreamEvents(logs);

  const recentAlerts = buildRecentAlerts(alerts);

  const activeAlertsCount = useMemo(() => {
    return alerts.filter(
      (alert) => normalizeAlertUiStatus(alert.status) === 'open',
    ).length;
  }, [alerts]);

  const logActivityFromLogs = useMemo(
    () =>
      buildLogActivitySeries(logs, {
        lookbackHours: 24,
        bucketMinutes: 60,
      }),
    [logs],
  );

  const logsByAccountAgent = useMemo(
    () => buildEventsByUserAndAgent(logs, 10, agentNamesById),
    [logs, agentNamesById],
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

      {/* Events by source */}
      <div className="min-w-0">
        <EventsBySourceChart
          data={logsByAccountAgent}
          isLoading={isActivityLoading}
        />
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
            isLoading={isActivityLoading}
            error={activityError}
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