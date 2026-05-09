import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchStatsTimeseries, type StatsBucket } from '@/lib/smartsiemApi';

interface DataPoint {
  time: string;
  logs: number;
  alerts: number;
}

const POLL_MS = 15_000;
const POINTS = 24;

function bucketsToPoints(items: StatsBucket[]): DataPoint[] {
  return items.map((b) => {
    const d = new Date(b.timestamp);
    const time = Number.isNaN(d.getTime())
      ? b.timestamp
      : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return {
      time,
      logs: Number(b.total_logs || 0),
      alerts: Number(b.total_alerts || 0),
    };
  });
}

export function LogActivityChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchStatsTimeseries({ period: '10min', points: POINTS });
        if (cancelled) return;
        setData(bucketsToPoints(res.items));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load timeseries');
      }
    }
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Log Activity (10 min buckets)</h3>
          <p className="text-sm text-gray-400 mt-1">
            Events and alerts ingested over the last {POINTS} buckets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-amber-400">
          {error} — showing empty chart until backend is reachable.
        </div>
      )}

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
          <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '12px' }} />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a24',
              border: '1px solid #2a2a3a',
              borderRadius: '0',
              color: '#fff',
            }}
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === 'logs' ? 'Logs' : 'Alerts',
            ]}
          />
          <Line type="monotone" dataKey="logs" stroke="#4f46e5" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="alerts" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
