import { useEffect, useRef } from 'react';
import { Terminal, AlertCircle, Shield, Activity } from 'lucide-react';
import type { StreamEvent } from '../lib/dashboardWidgets';

interface TerminalStreamProps {
  events: StreamEvent[];
  isLoading?: boolean;
  error?: string | null;
}

export function TerminalStream({
  events,
  isLoading = false,
  error = null,
}: TerminalStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="size-3" />;
      case 'warning':
        return <Shield className="size-3" />;
      case 'success':
        return <Activity className="size-3" />;
      default:
        return <Terminal className="size-3" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'text-[#ef4444]';
      case 'warning':
        return 'text-[#f59e0b]';
      case 'success':
        return 'text-[#10b981]';
      default:
        return 'text-[#3b82f6]';
    }
  };

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Live Event Stream</h3>
          <p className="text-sm text-gray-400 mt-1">Recent backend log activity</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-gray-400 font-mono">STREAMING</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-[280px] bg-[#000000] border border-[#2a2a3a] p-3 overflow-y-auto font-mono text-xs"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#2a2a3a #000000',
        }}
      >
        {events.map((event) => (
          <div key={event.id} className="mb-1.5">
            <div className={`flex items-start gap-2 ${getEventColor(event.type)}`}>
              <span className="text-gray-500">[{formatTime(event.timestamp)}]</span>
              {getEventIcon(event.type)}
              <span className="flex-1">{event.message}</span>
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="text-gray-500">Streaming recent events from the backend...</div>
        ) : null}

        {!isLoading && !error && events.length === 0 ? (
          <div className="text-gray-500">No recent log events are available yet.</div>
        ) : null}

        {!isLoading && error ? (
          <div className="text-[#fca5a5]">{error}</div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <Terminal className="size-3" />
        <span>Events: {events.length} | Auto-scroll enabled</span>
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
