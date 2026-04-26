import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SourceData {
  source: string;
  events: number;
}

interface EventsBySourceChartProps {
  data: SourceData[];
  isLoading?: boolean;
}

export function EventsBySourceChart({ data, isLoading = false }: EventsBySourceChartProps) {
  const hasData = data.length > 0;

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Events by Source</h3>
        <p className="text-sm text-gray-400 mt-1">Top event sources from the last 24 hours</p>
      </div>
      
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
          <XAxis 
            type="number" 
            stroke="#6b7280" 
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <YAxis 
            type="category" 
            dataKey="source" 
            stroke="#6b7280" 
            style={{ fontSize: '12px' }}
            width={80}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a24', 
              border: '1px solid #2a2a3a',
              borderRadius: '0',
              color: '#fff'
            }}
            formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Events']}
          />
          <Bar dataKey="events" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>

      {isLoading ? (
        <p className="mt-3 text-xs text-gray-500">Loading source breakdown...</p>
      ) : !hasData ? (
        <p className="mt-3 text-xs text-gray-500">No source activity is available yet.</p>
      ) : null}
    </div>
  );
}
