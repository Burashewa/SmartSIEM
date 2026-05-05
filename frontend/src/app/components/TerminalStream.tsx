import { useState, useEffect, useRef } from 'react';
import { Terminal, AlertCircle, Shield, Activity } from 'lucide-react';

export interface LogEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  message: string;
}

const eventTemplates = [
  { type: 'info' as const, message: 'New connection established from IP 192.168.{x}.{y}' },
  { type: 'warning' as const, message: 'Failed login attempt detected - User: admin' },
  { type: 'critical' as const, message: 'Suspicious activity: SQL injection attempt blocked' },
  { type: 'success' as const, message: 'Firewall rule updated successfully' },
  { type: 'info' as const, message: 'Log rotation completed - 2.4GB archived' },
  { type: 'warning' as const, message: 'High CPU usage detected on node-{x}' },
  { type: 'critical' as const, message: 'DDoS attack detected from {x} sources' },
  { type: 'success' as const, message: 'Threat signature database updated' },
  { type: 'info' as const, message: 'TLS handshake completed with 10.{x}.{y}.{z}' },
  { type: 'warning' as const, message: 'Port scan detected from 203.{x}.{y}.{z}' },
];

interface TerminalStreamProps {
  /** Live lines from backends (e.g. collector + detection-worker); shown above simulated traffic. */
  priorityEvents?: LogEvent[];
}

export function TerminalStream({ priorityEvents = [] }: TerminalStreamProps) {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
      const message = template.message
        .replace('{x}', Math.floor(Math.random() * 256).toString())
        .replace('{y}', Math.floor(Math.random() * 256).toString())
        .replace('{z}', Math.floor(Math.random() * 256).toString());

      const newEvent: LogEvent = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        type: template.type,
        message: message,
      };

      setEvents(prev => {
        const updated = [newEvent, ...prev];
        return updated.slice(0, 50); // Keep last 50 events
      });
    }, priorityEvents.length > 0 ? 4500 : 2000);

    return () => clearInterval(interval);
  }, [priorityEvents.length]);

  const displayEvents = [...priorityEvents, ...events].slice(0, 50);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, priorityEvents]);

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
          <p className="text-sm text-gray-400 mt-1">
            {priorityEvents.length > 0
              ? 'Collector + detection-worker status (top); simulated SOC traffic below'
              : 'Simulated events — start backends and dev server to see live status'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full animate-pulse ${
              priorityEvents.length > 0 ? 'bg-[#10b981]' : 'bg-[#6b7280]'
            }`}
          />
          <span className="text-xs text-gray-400 font-mono">
            {priorityEvents.length > 0 ? 'LIVE+SIM' : 'DEMO'}
          </span>
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
        {displayEvents.map((event) => (
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
        <span>Events: {displayEvents.length} | Auto-scroll enabled</span>
      </div>
    </div>
  );
}
