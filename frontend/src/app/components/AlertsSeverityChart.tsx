import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface AlertData {
  name: string;
  value: number;
  color: string;
}

interface AlertsSeverityChartProps {
  data: AlertData[];
  isLoading?: boolean;
}

export function AlertsSeverityChart({ data, isLoading = false }: AlertsSeverityChartProps) {
  const totalAlerts = data.reduce((sum, item) => sum + item.value, 0);
  const pieData = totalAlerts > 0 ? data.filter((item) => item.value > 0) : [];

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Alerts by Severity</h3>
        <p className="text-sm text-gray-400 mt-1">Distribution of alert types</p>
      </div>
      
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a24', 
              border: '1px solid #2a2a3a',
              borderRadius: '0',
              color: '#fff'
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {isLoading ? (
        <p className="mt-3 text-xs text-gray-500">Loading alert severity distribution...</p>
      ) : totalAlerts === 0 ? (
        <p className="mt-3 text-xs text-gray-500">No alerts are available for this distribution yet.</p>
      ) : null}

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="size-3" style={{ backgroundColor: item.color }} />
            <div>
              <div className="text-xs text-gray-400">{item.name}</div>
              <div className="text-sm font-mono text-white">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
