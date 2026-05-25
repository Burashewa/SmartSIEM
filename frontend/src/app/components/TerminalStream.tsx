import { useEffect, useRef } from 'react';
import { Terminal, AlertCircle, Shield, Activity } from 'lucide-react';
import type { StreamEvent } from '../lib/dashboardWidgets';
import { parseLogTimestamp } from '../lib/dashboardWidgets';

interface TerminalStreamProps {
  events: StreamEvent[];
  isLoading?: boolean;
  error?: string | null;
}

const STICK_TO_BOTTOM_THRESHOLD_PX = 48;

export function TerminalStream({
  events,
  isLoading = false,
  error = null,
}: TerminalStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [events]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= STICK_TO_BOTTOM_THRESHOLD_PX;
  };

  const isLive = !isLoading && !error && events.length > 0;
  const showInitialLoading = isLoading && events.length === 0;

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="size-3 shrink-0" />;
      case 'warning':
        return <Shield className="size-3 shrink-0" />;
      case 'success':
        return <Activity className="size-3 shrink-0" />;
      default:
        return <Terminal className="size-3 shrink-0" />;
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
          <p className="text-sm text-gray-400 mt-1">
            Recent logs and alerts, newest at the bottom
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full ${
              isLive ? 'bg-[#10b981] animate-pulse' : 'bg-gray-600'
            }`}
          />
          <span className="text-xs text-gray-400 font-mono">
            {showInitialLoading ? 'CONNECTING' : isLive ? 'LIVE' : error ? 'ERROR' : 'IDLE'}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-[280px] bg-[#000000] border border-[#2a2a3a] p-3 overflow-y-auto font-mono text-xs"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#2a2a3a #000000',
        }}
      >
        {showInitialLoading ? (
          <div className="text-gray-500">Connecting to event stream…</div>
        ) : null}

        {!showInitialLoading && !error && events.length === 0 ? (
          <div className="text-gray-500">
            No recent log or alert events yet. Ingest logs or trigger rules to populate the stream.
          </div>
        ) : null}

        {!showInitialLoading && error ? (
          <div className="text-[#fca5a5]">{error}</div>
        ) : null}

        {!showInitialLoading && !error
          ? events.map((event) => (
              <div key={event.id} className="mb-1.5">
                <div className={`flex items-start gap-2 ${getEventColor(event.type)}`}>
                  <span className="shrink-0 text-gray-500">
                    [{formatTime(event.timestamp)}]
                  </span>
                  {getEventIcon(event.type)}
                  <span className="min-w-0 flex-1 break-words">{event.message}</span>
                </div>
              </div>
            ))
          : null}

        {isLoading && events.length > 0 ? (
          <div className="mt-2 text-gray-600">Refreshing…</div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <Terminal className="size-3" />
        <span>
          Events: {events.length}
          {isLive ? ' · Auto-scroll follows newest' : ''}
        </span>
      </div>
    </div>
  );
}

function formatTime(timestamp: string): string {
  const ts = parseLogTimestamp(timestamp);
  if (ts === undefined) return '--:--:--';

  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
