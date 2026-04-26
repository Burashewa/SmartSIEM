import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchLogs, type BackendLogRecord } from '../api/dashboard';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  details: Record<string, unknown>;
}

const normalizeLog = (log: BackendLogRecord): LogEntry => {
  const messageParts = [log.event, log.action, log.status]
    .filter(Boolean)
    .map((part) => String(part).replace(/_/g, ' '));

  return {
    id: log._id ?? log.id ?? log.event_id ?? `${log.event}-${log.timestamp}`,
    timestamp: new Date(log.timestamp).toLocaleString(),
    level: String(log.severity).toUpperCase(),
    source: log.source ?? 'Unknown source',
    message: messageParts.length > 0 ? messageParts.join(' ') : log.event,
    details: {
      event: log.event,
      action: log.action,
      status: log.status,
      user: log.user,
      ip: log.ip,
      endpoint: log.endpoint,
      resource: log.resource,
      method: log.method,
      payload: log.payload,
      metadata: log.metadata,
      raw: log.raw,
    },
  };
};

export function LogManagementPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      setIsLoading(true);
      try {
        const response = await fetchLogs();
        if (!isMounted) return;
        setLogs(response.map(normalizeLog));
        setError(null);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load logs');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter.toUpperCase()) {
        return false;
      }
      if (!query) return true;
      return [
        log.timestamp,
        log.level,
        log.source,
        log.message,
        JSON.stringify(log.details),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [logs, levelFilter, searchQuery]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-[#ef4444]';
      case 'WARN': return 'text-[#f59e0b]';
      case 'INFO': return 'text-[#3b82f6]';
      case 'DEBUG': return 'text-[#6b7280]';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <h2 className="text-xl font-medium text-white mb-4">Log Management</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-2">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs by source, event, IP, user..."
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
            >
              <option value="all">All Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm flex items-center justify-center gap-2"
            >
              <Filter className="size-4" />
              Filter
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm"
            >
              <Download className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f17] border border-[#1f1f2e]">
        <div className="border-b border-[#1f1f2e] px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              Log Entries ({filteredLogs.length.toLocaleString()} results)
            </h3>
            <div className="text-sm text-gray-400">
              {isLoading ? 'Loading logs...' : `${filteredLogs.length} logs loaded`}
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-6 py-8 text-center text-sm text-[#fca5a5]">
            {error}
          </div>
        ) : null}

        <div className="divide-y divide-[#1f1f2e]">
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="px-6 py-6 animate-pulse">
                  <div className="h-4 bg-[#1a1a24] rounded w-2/3 mb-3" />
                  <div className="h-3 bg-[#1a1a24] rounded w-full" />
                </div>
              ))
            : filteredLogs.map((log) => (
                <div key={log.id} className="hover:bg-[#1a1a24] transition-colors">
                  <div
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 pt-1">
                        {selectedLog === log.id ? (
                          <ChevronDown className="size-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="size-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
                            {log.timestamp}
                          </span>
                          <span className={`font-mono text-xs font-medium ${getLevelColor(log.level)} whitespace-nowrap`}>
                            {log.level}
                          </span>
                          <span className="font-mono text-xs text-[#8b5cf6] whitespace-nowrap">
                            {log.source}
                          </span>
                        </div>
                        <div className="text-sm text-white">
                          {log.message}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedLog === log.id && (
                    <div className="px-6 pb-4">
                      <div className="ml-8 bg-[#000000] border border-[#2a2a3a] p-4 overflow-x-auto rounded-sm">
                        <pre className="text-xs font-mono text-[#10b981]">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
        </div>

        <div className="border-t border-[#1f1f2e] px-6 py-4">
          <div className="flex items-center justify-between">
            <button className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm">
              Previous
            </button>
            <div className="flex items-center gap-2">
              <button className="size-8 bg-[#4f46e5] text-white text-sm">1</button>
              <button className="size-8 hover:bg-[#1a1a24] text-white text-sm">2</button>
              <button className="size-8 hover:bg-[#1a1a24] text-white text-sm">3</button>
              <span className="text-gray-500 text-sm">...</span>
              <button className="size-8 hover:bg-[#1a1a24] text-white text-sm">124</button>
            </div>
            <button className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
