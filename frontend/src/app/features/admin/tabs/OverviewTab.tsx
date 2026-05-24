import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi, isAbortError, type AdminOverview } from '../api/adminApi';
import { cardCls, ErrorBanner, KPICard, mutedText, OutcomeBadge, relTime, SkeletonRow } from '../components/shared';

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const POLL_INTERVAL_MS = 30_000;

export default function OverviewTab({
  refreshKey,
  onGoToAgents,
  onGoToAudit,
  onLoaded,
}: {
  refreshKey: number;
  onGoToAgents: () => void;
  onGoToAudit: () => void;
  onLoaded: (ts: string) => void;
}) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keep onLoaded stable inside the polling interval without adding it as a dep
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);

  // Triggered fetch — runs on manual refresh (refreshKey change)
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    adminApi
      .getOverview(controller.signal)
      .then((next) => {
        setData(next);
        onLoadedRef.current(next.generatedAt);
      })
      .catch((e: unknown) => {
        if (!isAbortError(e)) {
          setError(e instanceof Error ? e.message : 'Failed to load overview');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey]);

  // Background polling — independent of manual refresh, never resets on refreshKey
  useEffect(() => {
    const poll = () => {
      adminApi
        .getOverview()
        .then((next) => {
          setData(next);
          onLoadedRef.current(next.generatedAt);
        })
        .catch(() => {
          // Silent background poll; errors show only on manual load
        });
    };
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  if (error) return <ErrorBanner error={error} onRetry={() => setLoading(true)} />;

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${cardCls} h-28 animate-pulse`} />
          ))}
        </div>
        <div className={`${cardCls} p-4`}>
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const sevData = Object.entries(data.alerts.bySeverity)
    .filter(([name]) => ['critical', 'high', 'medium', 'low'].includes(name))
    .map(([name, value]) => ({
      name,
      value,
      color: SEV_COLORS[name] ?? '#6b7280',
    }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard
          label="Total Users"
          value={data.users.total}
          subtext={`${data.users.active} active · ${data.users.locked} locked · ${data.users.disabled} disabled`}
        />
        <KPICard
          label="Ingestion EPS"
          value={data.ingestion.eps.toLocaleString()}
          subtext={`${data.ingestion.logsLast24h.toLocaleString()} logs / 24 h`}
        />
        <KPICard
          label="Open Alerts"
          value={data.alerts.open}
          subtext={`${data.alerts.critical} critical`}
          tone={data.alerts.critical > 0 ? 'danger' : 'default'}
        />
        <KPICard
          label="Failed Logins (24 h)"
          value={data.security.failedLogins24h}
          tone={data.security.failedLogins24h > 0 ? 'warning' : 'default'}
        />
        <KPICard
          label="Detection Rules"
          value={`${data.rules.enabled} / ${data.rules.total}`}
          subtext="enabled"
        />
        <KPICard
          label="Agents"
          value={data.agents.total}
          subtext="View →"
          onClick={onGoToAgents}
        />
      </div>

      {/* Health bar */}
      <div className={`${cardCls} flex flex-wrap items-center gap-6 p-4`}>
        <HealthDot
          label="MongoDB"
          value={data.system.mongoStatus ?? 'unknown'}
          ok={data.system.mongoStatus === 'connected'}
        />
        <HealthDot
          label="System Status"
          value={data.system.systemStatus.status}
          ok={data.system.systemStatus.status === 'healthy'}
        />
        <div className="text-sm">
          <span className={mutedText}>Active Alerts: </span>
          <span className="text-white">{data.system.activeAlerts}</span>
        </div>
        <div className="text-sm">
          <span className={mutedText}>Critical Threats: </span>
          <span className={data.system.criticalThreats ?? 0 > 0 ? 'text-red-400' : 'text-white'}>
            {data.system.criticalThreats}
          </span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${cardCls} p-5`}>
          <h3 className="mb-4 text-sm font-semibold text-white">Alerts by Severity</h3>
          {sevData.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>No alert data available.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sevData} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <XAxis type="number" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#6b7280"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f0f17',
                      border: '1px solid #1f1f2e',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                    cursor={{ fill: '#1a1a24' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sevData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className={`${cardCls} p-5`}>
          <h3 className="mb-4 text-sm font-semibold text-white">Detection Rules</h3>
          <p className={`text-sm ${mutedText}`}>
            <span className="text-white font-medium">{data.rules.enabled}</span> of{' '}
            <span className="text-white font-medium">{data.rules.total}</span> rules are currently
            enabled.
          </p>
          {data.rules.total > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-[#6b7280]">
                <span>Coverage</span>
                <span>{Math.round((data.rules.enabled / data.rules.total) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1f1f2e]">
                <div
                  className="h-full rounded-full bg-[#4f46e5] transition-all"
                  style={{ width: `${(data.rules.enabled / data.rules.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <p className={`mt-3 text-xs ${mutedText}`}>
            Detection rules are managed by security analysts.
          </p>
        </div>
      </div>

      {/* Recent audit */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#1f1f2e] p-4">
          <h3 className="text-sm font-semibold text-white">Recent Audit Activity</h3>
          <button
            type="button"
            onClick={onGoToAudit}
            className="text-sm text-[#818cf8] hover:underline"
          >
            View full audit log →
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className={`${mutedText} text-left text-xs uppercase`}>
            <tr className="border-b border-[#1f1f2e]">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Outcome</th>
              <th className="px-4 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {data.recentAudit.length === 0 ? (
              <tr>
                <td colSpan={5} className={`p-6 text-center text-sm ${mutedText}`}>
                  No recent audit events.
                </td>
              </tr>
            ) : (
              data.recentAudit.map((entry) => (
                <tr
                  key={entry.id ?? `${entry.timestamp}-${entry.username}-${entry.action}`}
                  className="border-b border-[#1f1f2e] last:border-0 hover:bg-[#1a1a24]"
                >
                  <td className={`px-4 py-2 ${mutedText}`}>{relTime(entry.timestamp)}</td>
                  <td className="px-4 py-2 font-mono text-white">{entry.username}</td>
                  <td className="px-4 py-2 text-white">{entry.action}</td>
                  <td className="px-4 py-2">
                    <OutcomeBadge outcome={entry.outcome} />
                  </td>
                  <td className={`px-4 py-2 ${mutedText}`}>{entry.sourceIp || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HealthDot({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={mutedText}>{label}:</span>
      <span className={ok ? 'text-green-400' : 'text-red-400'}>{value}</span>
    </div>
  );
}
