import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SourceData {
  source: string;
  events: number;
}

export function EventsBySourceChart() {
  const [data, setData] = useState<SourceData[]>([
    { source: 'Firewall', events: 12453 },
    { source: 'IDS/IPS', events: 8932 },
    { source: 'Web Server', events: 15672 },
    { source: 'Database', events: 4521 },
    { source: 'VPN', events: 3214 },
    { source: 'Email', events: 6789 },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => {
        return prevData.map(item => ({
          ...item,
          events: Math.max(0, item.events + Math.floor((Math.random() - 0.3) * 500))
        }));
      });
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">Events by Source</h3>
        <p className="text-sm text-gray-400 mt-1">Top event sources</p>
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
            formatter={(value: number) => [value.toLocaleString(), 'Events']}
          />
          <Bar dataKey="events" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
