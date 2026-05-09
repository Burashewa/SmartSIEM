import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchStatsTimeseries, type StatsBucket } from '@/lib/smartsiemApi';

interface SourceData {
  source: string;
  events: number;
}

const POLL_MS = 20_000;

function aggregateTopEventTypes(items: StatsBucket[]): SourceData[] {
  const map = new Map<string, number>();
  for (const bucket of items) {
    for (const row of bucket.top_event_types || []) {
      if (!row || typeof row !== 'object') continue;
      const key = String(row.type || 'unknown');
      map.set(key, (map.get(key) || 0) + Number(row.count || 0));
    }
  }
  return Array.from(map.entries())
    .map(([source, events]) => ({ source, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 8);
}

export function EventsBySourceChart() {
  const [items, setItems] = useState<StatsBucket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchStatsTimeseries({ period: '10min', points: 12 });
        if (cancelled) return;
        setItems(res.items);
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

  const data = useMemo(() => aggregateTopEventTypes(items), [items]);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Events by Source</h3>
        <p className="text-sm text-gray-400 mt-1">Top event types over the last buckets</p>
      </div>

      {error && (
        <div className="mb-3 text-xs text-amber-400">{error}</div>
      )}

      {data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-gray-500">
          No event-type breakdown available yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
            <XAxis
              type="number"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value: number) =>
                value >= 1000 ? `${(value / 1000).toFixed(0)}K` : `${value}`
              }
            />
            <YAxis
              type="category"
              dataKey="source"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a24',
                border: '1px solid #2a2a3a',
                borderRadius: '0',
                color: '#fff',
              }}
              formatter={(value: number) => [value.toLocaleString(), 'Events']}
            />
            <Bar dataKey="events" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
