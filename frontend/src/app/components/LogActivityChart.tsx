import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatChartAxisCount } from '../lib/dashboardWidgets';

interface DataPoint {
  time: string;
  logs: number;
}

interface LogActivityChartProps {
  data: DataPoint[];
  isLoading?: boolean;
}

export function LogActivityChart({ data, isLoading = false }: LogActivityChartProps) {
  const gradId = useId().replace(/[:]/g, '');
  const total = data.reduce((sum, p) => sum + p.logs, 0);
  const hasBuckets = data.length > 0;

  const yDomainMax = (max: number) => {
    const m = Number(max);
    if (!Number.isFinite(m) || m <= 0) return 1;
    return Math.ceil(m * 1.08);
  };

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6 min-w-0">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div>
          <h3 className="text-lg font-medium text-white">Real-time log activity</h3>
          <p className="text-sm text-gray-400 mt-1">
            Volume from ingested logs (window adapts to your data; bucket size scales automatically)
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs text-gray-400">Live log stream</span>
          </div>
          {hasBuckets ? (
            <span className="text-[11px] text-gray-500">
              {total.toLocaleString()} logs in chart window
            </span>
          ) : null}
        </div>
      </div>

      {hasBuckets ? (
        <ResponsiveContainer className="min-h-[260px]" width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#252536" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a2a3a' }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a2a3a' }}
              width={44}
              allowDecimals={false}
              tickFormatter={formatChartAxisCount}
              domain={[0, yDomainMax]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#14141f',
                border: '1px solid #2a2a3a',
                borderRadius: '6px',
                color: '#f3f4f6',
              }}
              labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
              formatter={(value) => [
                Number(value ?? 0).toLocaleString(),
                'Logs in bucket',
              ]}
            />
            <Area
              type="monotone"
              dataKey="logs"
              stroke="#818cf8"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              activeDot={{ r: 5, stroke: '#a5b4fc', strokeWidth: 1, fill: '#4f46e5' }}
              isAnimationActive={data.length < 80}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[260px] flex items-center justify-center rounded border border-dashed border-[#2a2a3a] text-sm text-gray-500">
          No time buckets to render yet.
        </div>
      )}

      {isLoading ? (
        <p className="mt-3 text-xs text-gray-500">Loading log activity…</p>
      ) : !hasBuckets ? (
        <p className="mt-3 text-xs text-gray-500">
          Waiting for logs. After ingestion, volume appears here (timestamps must parse correctly).
        </p>
      ) : null}
    </div>
  );
}
