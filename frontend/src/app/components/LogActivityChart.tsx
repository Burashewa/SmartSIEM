import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: string;
  logs: number;
}

export function LogActivityChart() {
  const [data, setData] = useState<DataPoint[]>([
    { time: '00:00', logs: 45230 },
    { time: '04:00', logs: 32100 },
    { time: '08:00', logs: 67890 },
    { time: '12:00', logs: 89234 },
    { time: '16:00', logs: 102456 },
    { time: '20:00', logs: 95432 },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => {
        const newData = [...prevData];
        const lastValue = newData[newData.length - 1].logs;
        const newValue = Math.max(0, lastValue + Math.floor((Math.random() - 0.3) * 10000));
        
        newData.shift();
        const now = new Date();
        newData.push({
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          logs: newValue,
        });
        
        return newData;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Real-time Log Activity</h3>
          <p className="text-sm text-gray-400 mt-1">Events per hour</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-gray-400">Live</span>
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
            formatter={(value: number) => [value.toLocaleString(), 'Logs']}
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
    </div>
  );
}
