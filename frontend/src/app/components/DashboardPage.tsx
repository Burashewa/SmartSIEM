import { useState, useEffect, useCallback } from 'react';
import { KPICard } from './KPICard';
import { LogActivityChart } from './LogActivityChart';
import { AlertsSeverityChart } from './AlertsSeverityChart';
import { EventsBySourceChart } from './EventsBySourceChart';
import { GeographicMap } from './GeographicMap';
import { RecentAlertsTable } from './RecentAlertsTable';
import { TerminalStream, type LogEvent } from './TerminalStream';
import { PriorityAIRecommendations } from './PriorityAIRecommendations';
import { TrendingUp, AlertTriangle, Shield, Activity, Server } from 'lucide-react';
import {
  fetchCollectorHealth,
  fetchWorkerHealth,
  fetchWorkerStats,
  isOverallHealthy,
  isWorkerKafkaHealthy,
  systemHealthPercent,
  type CollectorHealth,
  type WorkerHealth,
  type WorkerStats,
} from '@/lib/smartsiemApi';

const POLL_MS = 5000;

function buildTerminalEvents(
  collector: CollectorHealth | null,
  worker: WorkerHealth | null,
  stats: WorkerStats | null,
  fetchOk: boolean
): LogEvent[] {
  const ts = () =>
    new Date().toLocaleTimeString('en-US', { hour12: false });
  const id = () => `be-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!fetchOk) {
    return [
      {
        id: id(),
        timestamp: ts(),
        type: 'warning',
        message:
          'Could not reach SmartSIEM-Collector or detection-worker via /api/collector and /api/worker (is Vite dev server running with backends up?)',
      },
    ];
  }

  const lines: LogEvent[] = [];

  if (collector?.status === 'ok') {
    lines.push({
      id: id(),
      timestamp: ts(),
      type: 'success',
      message: `SmartSIEM-Collector HTTP: healthy (status=${collector.status})`,
    });
  } else {
    lines.push({
      id: id(),
      timestamp: ts(),
      type: 'critical',
      message: `SmartSIEM-Collector: unreachable or unhealthy (last=${collector ? JSON.stringify(collector) : 'null'})`,
    });
  }

  const kafkaOk = isWorkerKafkaHealthy(worker);
  const mongoOk = worker?.mongodb?.connected === true;
  const workerState = worker?.status ?? 'unknown';

  if (worker && mongoOk && kafkaOk && workerState === 'ok') {
    lines.push({
      id: id(),
      timestamp: ts(),
      type: 'success',
      message: `Detection-worker: healthy (MongoDB connected, Kafka consumer OK)`,
    });
  } else {
    lines.push({
      id: id(),
      timestamp: ts(),
      type: worker ? 'warning' : 'critical',
      message: `Detection-worker: ${worker ? `status=${workerState}, mongo=${mongoOk}, kafka_ok=${kafkaOk}` : 'no response'}`,
    });
  }

  if (stats) {
    lines.push({
      id: id(),
      timestamp: ts(),
      type: 'info',
      message: `Worker stats — processed=${stats.totalEventsProcessed}, alerts=${stats.totalAlertsGenerated}, rules=${stats.activeRules}, uptime=${Math.floor(stats.uptime)}s`,
    });
  }

  return lines;
}

export interface DashboardPageProps {
  onSystemStatus?: (status: 'healthy' | 'critical') => void;
}

export function DashboardPage({ onSystemStatus }: DashboardPageProps) {
  const [collector, setCollector] = useState<CollectorHealth | null>(null);
  const [worker, setWorker] = useState<WorkerHealth | null>(null);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [pollOk, setPollOk] = useState(true);
  const [terminalPriority, setTerminalPriority] = useState<LogEvent[]>([]);

  const refresh = useCallback(async () => {
    const [c, w, s] = await Promise.all([
      fetchCollectorHealth(),
      fetchWorkerHealth(),
      fetchWorkerStats(),
    ]);
    const anyResponded = c !== null || w !== null || s !== null;
    setPollOk(anyResponded);
    setCollector(c);
    setWorker(w);
    setStats(s);

    const healthy = isOverallHealthy(c, w);
    onSystemStatus?.(healthy ? 'healthy' : 'critical');

    setTerminalPriority(buildTerminalEvents(c, w, s, anyResponded));
  }, [onSystemStatus]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh]);

  const eventsProcessed = stats?.totalEventsProcessed ?? 0;
  const alertsGenerated = stats?.totalAlertsGenerated ?? 0;
  const activeRules = stats?.activeRules ?? 0;
  const healthPct = systemHealthPercent(collector, worker);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#1f1f2e] bg-[#0f0f17] px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Server className="size-4 text-[#4f46e5]" />
          <span>
            Dashboard wired to{' '}
            <span className="font-mono text-white">SmartSIEM-Collector</span> (HTTP) and{' '}
            <span className="font-mono text-white">detection-worker</span> (health + stats). Poll
            every {POLL_MS / 1000}s via Vite proxy.
          </span>
        </div>
        {!pollOk && (
          <span className="text-xs text-amber-400">No backend responses — check ports 8080 / 4000</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Events processed"
          value={eventsProcessed.toLocaleString()}
          trend="Live · worker"
          icon={TrendingUp}
          iconColor="text-[#4f46e5]"
          borderColor="border-l-[#4f46e5]"
        />
        <KPICard
          title="Alerts generated"
          value={alertsGenerated.toLocaleString()}
          trend="Live · worker"
          icon={AlertTriangle}
          iconColor="text-[#f59e0b]"
          borderColor="border-l-[#f59e0b]"
          pulsing={alertsGenerated > 0 && !isOverallHealthy(collector, worker)}
        />
        <KPICard
          title="Active detection rules"
          value={activeRules.toString()}
          trend="Live · worker"
          icon={Shield}
          iconColor="text-[#ef4444]"
          borderColor="border-l-[#ef4444]"
        />
        <KPICard
          title="Pipeline health"
          value={`${healthPct.toFixed(0)}%`}
          trend={isOverallHealthy(collector, worker) ? 'Collector + worker' : 'Degraded'}
          icon={Activity}
          iconColor="text-[#10b981]"
          borderColor="border-l-[#10b981]"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LogActivityChart />
        <AlertsSeverityChart />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <EventsBySourceChart />
        <GeographicMap />
        <TerminalStream priorityEvents={terminalPriority} />
      </div>

      <RecentAlertsTable />

      <PriorityAIRecommendations />
    </div>
  );
}
