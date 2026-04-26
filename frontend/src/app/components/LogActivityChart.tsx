import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: string;
  logs: number;
}

interface LogActivityChartProps {
  data: DataPoint[];
  isLoading?: boolean;
}

export function LogActivityChart({ data, isLoading = false }: LogActivityChartProps) {
  const hasData = data.some((point) => point.logs > 0);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Real-time Log Activity</h3>
          <p className="text-sm text-gray-400 mt-1">Log volume across the last 24 hours</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-gray-400">Live data</span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
          <XAxis 
            dataKey="time" 
            stroke="#6b7280" 
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280" 
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a24', 
              border: '1px solid #2a2a3a',
              borderRadius: '0',
              color: '#fff'
            }}
            formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Logs']}
          />
          <Line 
            type="monotone" 
            dataKey="logs" 
            stroke="#4f46e5" 
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>

      {isLoading ? (
        <p className="mt-3 text-xs text-gray-500">Loading log activity...</p>
      ) : !hasData ? (
        <p className="mt-3 text-xs text-gray-500">No log activity recorded in the current window.</p>
      ) : null}
    </div>
  );
}
