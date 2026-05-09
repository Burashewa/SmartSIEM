import { useEffect, useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchAlertSummary } from '@/lib/smartsiemApi';

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#6b7280',
};

interface AlertData {
  name: string;
  value: number;
  color: string;
}

const POLL_MS = 15_000;

export function AlertsSeverityChart() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const summary = await fetchAlertSummary();
        if (cancelled) return;
        setCounts(summary.bySeverity || {});
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load alerts summary');
      }
    }
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const data = useMemo<AlertData[]>(() => {
    return SEVERITY_ORDER.map((s) => ({
      name: s.charAt(0) + s.slice(1).toLowerCase(),
      value: counts[s] || 0,
      color: SEVERITY_COLORS[s],
    })).filter((d) => d.value > 0);
  }, [counts]);

  const totalValue = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Alerts by Severity</h3>
        <p className="text-sm text-gray-400 mt-1">
          {totalValue.toLocaleString()} total alerts on record
        </p>
      </div>

      {error && (
        <div className="mb-3 text-xs text-amber-400">
          {error}
        </div>
      )}

      {data.length === 0 ? (
        <div className="h-[250px] flex items-center justify-center text-sm text-gray-500">
          No alerts yet — waiting for the detection-worker.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) =>
                  percent != null ? `${name} ${(percent * 100).toFixed(0)}%` : name
                }
                labelStyle={{ fontSize: '12px', fill: '#fff' }}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a24',
                  border: '1px solid #2a2a3a',
                  borderRadius: '0',
                  color: '#fff',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="size-3" style={{ backgroundColor: item.color }} />
                <div>
                  <div className="text-xs text-gray-400">{item.name}</div>
                  <div className="text-sm font-mono text-white">{item.value.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
