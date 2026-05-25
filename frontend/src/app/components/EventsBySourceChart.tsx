import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatChartAxisCount } from '../lib/dashboardWidgets';

export interface SourceDatum {
  source: string;
  events: number;
}

interface EventsBySourceChartProps {
  data: SourceDatum[];
  isLoading?: boolean;
}

function truncateLabel(value: string, max = 40): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function EventsBySourceChart({ data, isLoading = false }: EventsBySourceChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.events > 0);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6 min-w-0">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Logs by agent</h3>
        <p className="text-sm text-gray-400 mt-1">
          Top collectors by ingested log volume (registered agent names).
        </p>
      </div>

      <ResponsiveContainer className="min-h-[280px]" width="100%" height={280}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#252536" horizontal />
            <XAxis
              type="number"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a2a3a' }}
              allowDecimals={false}
              tickFormatter={formatChartAxisCount}
            />
            <YAxis
              type="category"
              dataKey="source"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#2a2a3a' }}
              width={220}
              tickFormatter={truncateLabel}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#14141f',
                border: '1px solid #2a2a3a',
                borderRadius: '6px',
                color: '#f3f4f6',
                maxWidth: 360,
              }}
              formatter={(value) => [
                Number(value ?? 0).toLocaleString(),
                'Log events',
              ]}
              labelFormatter={(_, payload) => {
                const raw = payload?.[0]?.payload as SourceDatum | undefined;
                return raw?.source ?? '';
              }}
            />
            <Bar dataKey="events" fill="#a78bfa" radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>

      {isLoading ? (
        <p className="mt-3 text-xs text-gray-500">Loading breakdown…</p>
      ) : !hasData ? (
        <p className="mt-3 text-xs text-gray-500">
          No ingested logs yet, or agent IDs are missing on events.
        </p>
      ) : null}
    </div>
  );
}
