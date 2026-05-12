import { useState, useEffect, useRef } from 'react';
import { Terminal, AlertCircle, Shield, Activity } from 'lucide-react';
import { useWS } from '../../hooks/useWS';

interface LogEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  message: string;
}

export function TerminalStream() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ws = useWS();

  useEffect(() => {
    const unsubscribe = ws.subscribe('log.new', (event) => {
      const severity = String(event.data.event?.severity || '').toUpperCase();
      const type: LogEvent['type'] =
        severity === 'CRITICAL' || severity === 'ERROR'
          ? 'critical'
          : severity === 'WARNING' || severity === 'WARN'
            ? 'warning'
            : 'info';
      const newEvent: LogEvent = {
        id: event.data.id,
        timestamp: new Date(event.data.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false }),
        type,
        message: event.data.message || 'Incoming event',
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 50));
    });
    return () => unsubscribe();
  }, [ws]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertCircle className="size-3" />;
      case 'warning': return <Shield className="size-3" />;
      case 'success': return <Activity className="size-3" />;
      default: return <Terminal className="size-3" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'critical': return 'text-[#ef4444]';
      case 'warning': return 'text-[#f59e0b]';
      case 'success': return 'text-[#10b981]';
      default: return 'text-[#3b82f6]';
    }
  };

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Live Event Stream</h3>
          <p className="text-sm text-gray-400 mt-1">Real-time system events</p>
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
          <div key={event.id} className="mb-1.5 animate-fadeIn">
            <div className={`flex items-start gap-2 ${getEventColor(event.type)}`}>
              <span className="text-gray-500">[{event.timestamp}]</span>
              {getEventIcon(event.type)}
              <span className="flex-1">{event.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Terminal indicator */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <Terminal className="size-3" />
        <span>Events: {events.length} | Auto-scroll enabled</span>
      </div>
    </div>
  );
}
