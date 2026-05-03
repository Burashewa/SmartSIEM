import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';

export function SystemStatus() {
  const [ingestionRate, setIngestionRate] = useState(450);
  const [isConnected, setIsConnected] = useState(true);

  // Simulate real-time ingestion rate updates
  useEffect(() => {
    const interval = setInterval(() => {
      setIngestionRate(prev => {
        const change = Math.floor(Math.random() * 100) - 50;
        return Math.max(200, Math.min(800, prev + change));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a]">
      {/* Ingestion Rate */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <div className="absolute inset-0 size-2 rounded-full bg-[#10b981] animate-ping opacity-75" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-gray-400">Ingestion Rate:</span>
          <span className="text-sm text-[#10b981] font-mono font-semibold tracking-tight">
            {ingestionRate} EPS
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-[#2a2a3a]" />

      {/* Database Connection */}
      <div className="flex items-center gap-2">
        <Database className="size-3.5 text-[#10b981]" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-gray-400">Database:</span>
          <span className={`text-sm font-mono font-semibold tracking-tight ${
            isConnected ? 'text-[#10b981]' : 'text-[#ef4444]'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            (MongoDB)
          </span>
        </div>
      </div>
    </div>
  );
}
