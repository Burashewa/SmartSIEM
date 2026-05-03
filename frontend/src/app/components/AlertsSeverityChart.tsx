import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface AlertData {
  name: string;
  value: number;
  color: string;
}

export function AlertsSeverityChart() {
  const [data, setData] = useState<AlertData[]>([
    { name: 'Critical', value: 8, color: '#ef4444' },
    { name: 'High', value: 15, color: '#f59e0b' },
    { name: 'Medium', value: 28, color: '#eab308' },
    { name: 'Low', value: 42, color: '#3b82f6' },
    { name: 'Info', value: 67, color: '#6b7280' },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => {
        return prevData.map(item => ({
          ...item,
          value: Math.max(0, item.value + Math.floor((Math.random() - 0.4) * 3))
        }));
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

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
