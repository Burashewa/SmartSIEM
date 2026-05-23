import { Database } from 'lucide-react';

interface SystemStatusProps {
  ingestionRate: number | null;
  databaseConnected: boolean;
  databaseProvider: string;
}

export function SystemStatus({
  ingestionRate,
  databaseConnected,
  databaseProvider,
}: SystemStatusProps) {
  const displayRate = ingestionRate === null ? '--' : `${ingestionRate} EPS`;

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
            {displayRate}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-[#2a2a3a]" />

      {/* Database Connection */}
      <div className="flex items-center gap-2">
        <Database className={`size-3.5 ${databaseConnected ? 'text-[#10b981]' : 'text-[#ef4444]'}`} />
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-gray-400">Database:</span>
          <span className={`text-sm font-mono font-semibold tracking-tight ${
            databaseConnected ? 'text-[#10b981]' : 'text-[#ef4444]'
          }`}>
            {databaseConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            ({databaseProvider})
          </span>
        </div>
      </div>
    </div>
  );
}
