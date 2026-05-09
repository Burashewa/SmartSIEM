import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter, Download, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import {
  fetchLogSources,
  fetchLogs,
  type LogEventDoc,
  type LogListParams,
} from '@/lib/smartsiemApi';

const PAGE_SIZE = 50;
const TIME_RANGES = [
  { value: '1h', label: 'Last 1 hour', ms: 60 * 60 * 1000 },
  { value: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'all', label: 'All time', ms: 0 },
] as const;

type TimeRangeValue = (typeof TIME_RANGES)[number]['value'];

function deriveLevel(doc: LogEventDoc): 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' {
  const direct = (doc as Record<string, unknown>).level;
  if (typeof direct === 'string') {
    const u = direct.toUpperCase();
    if (u === 'ERROR' || u === 'WARN' || u === 'INFO' || u === 'DEBUG') return u;
  }
  const sev = (doc as Record<string, unknown>).severity;
  if (typeof sev === 'string') {
    const u = sev.toUpperCase();
    if (u === 'CRITICAL' || u === 'HIGH' || u === 'ERROR') return 'ERROR';
    if (u === 'MEDIUM' || u === 'WARN' || u === 'WARNING') return 'WARN';
    if (u === 'DEBUG') return 'DEBUG';
  }
  const eventType = String(doc.event_type || '').toUpperCase();
  if (eventType.includes('FAIL') || eventType.includes('ERROR')) return 'ERROR';
  if (eventType.includes('ALERT') || eventType.includes('SUSPICIOUS')) return 'WARN';
  return 'INFO';
}

function deriveMessage(doc: LogEventDoc): string {
  const raw = (doc.raw_data || {}) as Record<string, unknown>;
  if (typeof raw.message === 'string') return raw.message;
  if (typeof (doc as Record<string, unknown>).message === 'string') {
    return String((doc as Record<string, unknown>).message);
  }
  if (doc.event_type) return `${doc.event_type}${doc.source_ip ? ` from ${doc.source_ip}` : ''}`;
  return JSON.stringify(doc).slice(0, 200);
}

function formatTimestamp(ts?: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

function levelColor(level: string) {
  switch (level) {
    case 'ERROR':
      return 'text-[#ef4444]';
    case 'WARN':
      return 'text-[#f59e0b]';
    case 'INFO':
      return 'text-[#3b82f6]';
    case 'DEBUG':
      return 'text-[#6b7280]';
    default:
      return 'text-gray-400';
  }
}

export function LogManagementPage() {
  const [logs, setLogs] = useState<LogEventDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCapped, setTotalCapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'>(
    'all'
  );
  const [timeRange, setTimeRange] = useState<TimeRangeValue>('24h');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [sources, setSources] = useState<Array<{ event_type: string; count: number }>>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    try {
      const res = await fetchLogSources();
      setSources(res.items);
    } catch {
      // Non-fatal.
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: LogListParams = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (eventTypeFilter !== 'all') params.event_type = [eventTypeFilter];
      const range = TIME_RANGES.find((r) => r.value === timeRange);
      if (range && range.ms > 0) params.since = new Date(Date.now() - range.ms).toISOString();

      const res = await fetchLogs(params);
      const filtered = levelFilter === 'all'
        ? res.items
        : res.items.filter((doc) => deriveLevel(doc) === levelFilter);

      setLogs(filtered);
      setTotal(res.total);
      setTotalCapped(res.total_capped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, eventTypeFilter, timeRange, levelFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min(total, page * PAGE_SIZE + logs.length);

  const handleApply = () => {
    setPage(0);
    setSearchQuery(searchInput);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartsiem-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium text-white">Log Management</h2>
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-1.5 border border-[#2a2a3a] hover:border-[#4f46e5]"
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-3 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/40 px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApply();
                }}
                placeholder="message, source IP, user, event_type…"
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Level</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
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
              onClick={handleApply}
              className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm flex items-center justify-center gap-2"
            >
              <Filter className="size-4" />
              Filter
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm"
              title="Download current page as JSON"
            >
              <Download className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value as TimeRangeValue);
                setPage(0);
              }}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Event Type</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(0);
              }}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
            >
              <option value="all">All Sources</option>
              {sources.map((s) => (
                <option key={s.event_type} value={s.event_type}>
                  {s.event_type} ({s.count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Sort</label>
            <select
              disabled
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-gray-400"
            >
              <option>Newest First</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f17] border border-[#1f1f2e]">
        <div className="border-b border-[#1f1f2e] px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              Log Entries ({logs.length.toLocaleString()} on this page)
            </h3>
            <div className="text-sm text-gray-400">
              Showing {showingFrom.toLocaleString()}-{showingTo.toLocaleString()} of{' '}
              {total.toLocaleString()}
              {totalCapped ? '+' : ''}
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#1f1f2e]">
          {logs.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-gray-400">
              No log events match the current filter.
            </div>
          )}

          {logs.map((log, idx) => {
            const id = `${log.event_id || ''}-${idx}`;
            const level = deriveLevel(log);
            const source = log.event_type || log.host || 'unknown';
            const message = deriveMessage(log);
            const expanded = selectedLog === id;
            return (
              <div key={id} className="hover:bg-[#1a1a24] transition-colors">
                <div
                  className="px-6 py-4 cursor-pointer"
                  onClick={() => setSelectedLog(expanded ? null : id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 pt-1">
                      {expanded ? (
                        <ChevronDown className="size-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="size-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-4 mb-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span
                          className={`font-mono text-xs font-medium ${levelColor(level)} whitespace-nowrap`}
                        >
                          {level}
                        </span>
                        <span className="font-mono text-xs text-[#8b5cf6] whitespace-nowrap">
                          {source}
                        </span>
                        {log.source_ip && (
                          <span className="font-mono text-xs text-gray-500">
                            {log.source_ip}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-white truncate">{message}</div>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="px-6 pb-4">
                    <div className="ml-8 bg-[#000000] border border-[#2a2a3a] p-4 overflow-x-auto">
                      <pre className="text-xs font-mono text-[#10b981] whitespace-pre-wrap break-words">
                        {JSON.stringify(log, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#1f1f2e] px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-50"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <div className="text-sm text-gray-400">
              Page {page + 1} of {totalPages}
              {totalCapped ? '+' : ''}
            </div>
            <button
              className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-50"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
