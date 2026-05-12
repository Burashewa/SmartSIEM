import { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../../api/services/dashboard.service';

interface AlertData {
  name: string;
  value: number;
  color: string;
}

function AlertsSeverityChartImpl() {
  const query = useQuery({
    queryKey: ['dashboard', 'alertsChart'],
    queryFn: dashboardService.alertsChart,
    refetchInterval: 15000,
  });
  const palette: Record<string, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f59e0b',
    MEDIUM: '#eab308',
    LOW: '#3b82f6',
    INFO: '#6b7280',
  };
  const data: AlertData[] =
    query.data?.series?.map((item) => {
      const key = item.severity.toUpperCase();
      return {
        name: key[0] + key.slice(1).toLowerCase(),
        value: item.count,
        color: palette[key] || '#6b7280',
      };
    }) || [];

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Alerts by Severity</h3>
        <p className="text-sm text-gray-400 mt-1">Distribution of alert types</p>
      </div>
      
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelStyle={{ fontSize: '12px', fill: '#fff' }}
          >
            {data.map((entry, index) => (
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

export const AlertsSeverityChart = memo(AlertsSeverityChartImpl);
