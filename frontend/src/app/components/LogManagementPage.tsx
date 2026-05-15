  import { useCallback, useEffect, useMemo, useRef, useState, useReducer } from 'react';
  import { Search, Filter, Download, ChevronDown, ChevronRight } from 'lucide-react';
  import { useVirtualizer } from '@tanstack/react-virtual';
  import { useQueryClient } from '@tanstack/react-query';

  import { useLogs } from '../../hooks/useLogs';
  import { useWS } from '../../hooks/useWS';
  import { usePagination } from '../../hooks/usePagination';
  import { PaginationBar } from '../../components/shared/PaginationBar';

  interface LogEntry {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    source: string;
    event_type: string;
    user_id: string;
    source_ip: string;
    category: 'Auth' | 'Access' | 'Error' | 'System';
    message: string;
    details: Record<string, unknown>;
  }

  interface FilterState {
    search: string;
    level: 'all' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    eventType: 'all' | 'AUTH_FAIL' | 'ACCESS_DENY' | 'APP_ERROR';
    timeRange: '1h' | '24h' | '7d' | 'custom';
    source: string;
    sortBy: 'newest' | 'oldest' | 'severity';
    sourceIP: string;
    userId: string;
  }

  type FilterAction =
    | { type: 'SET_FILTER'; key: keyof FilterState; value: string }
    | { type: 'RESET_FILTERS' };

  const defaultFilters: FilterState = {
    search: '',
    level: 'all',
    eventType: 'all',
    timeRange: '24h',
    source: 'all',
    sortBy: 'newest',
    sourceIP: '',
    userId: '',
  };

  const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
    switch (action.type) {
      case 'SET_FILTER':
        return { ...state, [action.key]: action.value } as FilterState;
      case 'RESET_FILTERS':
        return { ...defaultFilters };
      default:
        return state;
    }
  };

  const levelColorMap: Record<LogEntry['level'], string> = {
    ERROR: 'text-red-400',
    WARN: 'text-yellow-400',
    INFO: 'text-emerald-400',
    DEBUG: 'text-sky-400',
  };

  const categoryBadgeMap: Record<LogEntry['category'], { label: string; color: string }> = {
    Auth: { label: 'Auth', color: '#22c55e' },
    Access: { label: 'Access', color: '#38bdf8' },
    Error: { label: 'Error', color: '#f97316' },
    System: { label: 'System', color: '#a78bfa' },
  };

  const getLevelColor = (level: LogEntry['level']) => levelColorMap[level] || levelColorMap.INFO;

  const getCategoryBadge = (category: LogEntry['category']) =>
    categoryBadgeMap[category] || categoryBadgeMap.System;

  export function LogManagementPage() {
    const [selectedLog, setSelectedLog] = useState<string | null>(null);
    const [filters, dispatch] = useReducer(filterReducer, defaultFilters, (defaults) => {
      if (typeof window === 'undefined') return defaults;

      const params = new URLSearchParams(window.location.search);

      return {
        search: params.get('search') ?? defaults.search,
        level: (params.get('level') as any) ?? defaults.level,
        eventType: (params.get('eventType') as any) ?? defaults.eventType,
        timeRange: (params.get('timeRange') as any) ?? defaults.timeRange,
        source: params.get('source') ?? defaults.source,
        sortBy: (params.get('sortBy') as any) ?? defaults.sortBy,
        sourceIP: params.get('sourceIP') ?? defaults.sourceIP,
        userId: params.get('userId') ?? defaults.userId,
      };
    });

    const [debouncedText, setDebouncedText] = useState(() => ({
      search: filters.search,
      sourceIP: filters.sourceIP,
      userId: filters.userId,
    }));

    const [showLiveBadge, setShowLiveBadge] = useState(false);
    const liveBadgeTimeoutRef = useRef<number | null>(null);

    const queryClient = useQueryClient();
    const ws = useWS();
    const { page, limit, setPage } = usePagination(1, 50);

    const timeRangeDates = useMemo(() => {
      const now = new Date();
      const map = {
        '1h': new Date(now.getTime() - 1 * 60 * 60 * 1000),
        '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
        '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      };

      return filters.timeRange === 'custom'
        ? {}
        : { startDate: map[filters.timeRange as '1h' | '24h' | '7d'].toISOString() };
    }, [filters.timeRange]);

    const sortParams = useMemo(() => {
      switch (filters.sortBy) {
        case 'oldest':
          return { sort: 'timestamp', order: 'asc' as const };
        case 'severity':
          return { sort: 'severity', order: 'desc' as const };
        default:
          return { sort: 'timestamp', order: 'desc' as const };
      }
    }, [filters.sortBy]);

    const logsQuery = useLogs({
      page,
      limit,
      search: debouncedText.search || undefined,
      severity: filters.level === 'all' ? undefined : filters.level,
      source_ip: debouncedText.sourceIP || undefined,
      user_id: debouncedText.userId || undefined,
      source: filters.source === 'all' ? undefined : filters.source,
      sortBy: filters.sortBy,
      timeRange: filters.timeRange,
      ...timeRangeDates,
      ...sortParams,
    });

    // debounce text filters
    useEffect(() => {
      const timeout = window.setTimeout(() => {
        setDebouncedText({
          search: filters.search,
          sourceIP: filters.sourceIP,
          userId: filters.userId,
        });
      }, 500);

      return () => window.clearTimeout(timeout);
    }, [filters.search, filters.sourceIP, filters.userId]);

    // sync URL
    useEffect(() => {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        params.set(key, value as string);
      });

      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }, [filters]);

    // ✅ FIXED pagination reset (IMPORTANT)
    useEffect(() => {
      setPage(1);
    }, [
      debouncedText.search,
      debouncedText.sourceIP,
      debouncedText.userId,
      filters.level,
      filters.eventType,
      filters.source,
      filters.timeRange,
      filters.sortBy,
    ]);

    // websocket updates
    useEffect(() => {
      const unsubscribe = ws.subscribe('log.new', () => {
        queryClient.invalidateQueries({ queryKey: ['logs'] });

        setShowLiveBadge(true);
        if (liveBadgeTimeoutRef.current) {
          window.clearTimeout(liveBadgeTimeoutRef.current);
        }

        liveBadgeTimeoutRef.current = window.setTimeout(() => {
          setShowLiveBadge(false);
        }, 2000);
      });

      return () => unsubscribe();
    }, [queryClient, ws]);

    useEffect(() => {
      return () => {
        if (liveBadgeTimeoutRef.current) {
          window.clearTimeout(liveBadgeTimeoutRef.current);
        }
      };
    }, []);

    const logs = useMemo<LogEntry[]>(
      () =>
        (logsQuery.data?.data || []).map((log) => {
          const level = String(log.event?.severity || 'INFO').toUpperCase();
          const eventType = String(log.event?.type || 'unknown');
          const message = String(log.message || '');

          const category =
            eventType === 'AUTH_FAIL'
              ? 'Auth'
              : eventType === 'ACCESS_DENY'
                ? 'Access'
                : level === 'ERROR'
                  ? 'Error'
                  : 'System';

          return {
            id: String(log.id),
            timestamp: String(log.timestamp || ''),
            level: (['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(level)
              ? level
              : 'INFO') as LogEntry['level'],
            source: String(log.source?.host?.name || log.source?.ip || 'collector'),
            event_type: eventType,
            user_id: String(log.user?.id || ''),
            source_ip: String(log.source?.ip || ''),
            category,
            message,
            details: log as unknown as Record<string, unknown>,
          };
        }),
      [logsQuery.data?.data],
    );

    const sourceOptions = useMemo(() => {
      const sources = new Set<string>(['all']);

      logs.forEach((log) => {
        if (log.source) {
          sources.add(log.source);
        }
      });

      return Array.from(sources);
    }, [logs]);

    const isFiltered = useMemo(
      () =>
        Object.keys(defaultFilters).some(
          (key) => filters[key as keyof FilterState] !== defaultFilters[key as keyof FilterState],
        ),
      [filters],
    );

    const parentRef = useRef<HTMLDivElement | null>(null);

    const virtualizer = useVirtualizer({
      count: logs.length,
      getScrollElement: () => parentRef.current,
      estimateSize: (i) => (logs[i]?.id === selectedLog ? 320 : 74),
      overscan: 10,
    });

    const handleExport = useCallback(() => {
      if (!logs.length) return;

      const header = ['timestamp', 'level', 'source', 'event_type', 'user_id', 'source_ip', 'category', 'message'];

      const csv = [
        header.join(','),
        ...logs.map((l) =>
          [
            l.timestamp,
            l.level,
            l.source,
            l.event_type,
            l.user_id,
            l.source_ip,
            l.category,
            `"${l.message.replace(/"/g, '""')}"`,
          ].join(','),
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();

      URL.revokeObjectURL(url);
    }, [logs]);


  return (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-6">
        <h2 className="text-xl font-medium text-white mb-4">Log Management</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-2">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'search', value: e.target.value })}
                placeholder="source:firewall AND level:ERROR"
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
          </div>

          {/* Level Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Level</label>
            <select
              value={filters.level}
              onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'level', value: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
            >
              <option value="all">All Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Event Type</label>
            <select
              value={filters.eventType}
              onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'eventType', value: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4f46e5]"
            >
              <option value="all">All Types</option>
              <option value="AUTH_FAIL">Authentication Failure</option>
              <option value="ACCESS_DENY">Access Denied</option>
              <option value="APP_ERROR">Application Error</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
              <Filter className="size-4" />
              Filter
            </button>
            {isFiltered && (
              <button
                onClick={() => {
                  dispatch({ type: 'RESET_FILTERS' });
                  setPage(1);
                }}
                className="bg-[#1a1a24] border border-[#2a2a3a] text-white text-sm px-4 py-2"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm"
            >
              <Download className="size-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'timeRange', value: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
            >
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Source</label>
            <select
              value={filters.source}
              onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'source', value: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
            >
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All Sources' : source}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'sortBy', value: e.target.value })}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="severity">Severity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Source IP</label>
            <input
              type="text"
              value={filters.sourceIP}
              onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'sourceIP', value: e.target.value })}
              placeholder="192.168.1.10"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">User ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => dispatch({ type: 'SET_FILTER', key: 'userId', value: e.target.value })}
              placeholder="user-123"
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Log Results */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e]">
        <div className="border-b border-[#1f1f2e] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-white">
                Log Entries ({logs.length.toLocaleString()} results)
              </h3>
              {showLiveBadge && (
                <span className="text-xs text-[#22c55e] font-medium flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#22c55e] animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="text-sm text-gray-400">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, logsQuery.data?.total || logs.length)} of{' '}
              {(logsQuery.data?.total || logs.length).toLocaleString()}
            </div>
          </div>
        </div>

        <div ref={parentRef} className="h-[520px] overflow-auto">
          {logsQuery.isError ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-red-400">
              <div>Failed to load logs. Please try again.</div>
              <button
                onClick={() => logsQuery.refetch()}
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 text-sm"
              >
                Retry
              </button>
            </div>
          ) : logsQuery.isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-[74px] animate-pulse bg-[#1a1a24] border-b border-[#1f1f2e]"
                />
              ))}
            </div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const log = logs[virtualRow.index];
                const badge = getCategoryBadge(log.category);
                return (
                  <div
                    key={virtualRow.key}
                    ref={virtualizer.measureElement}
                    className="hover:bg-[#1a1a24] transition-colors border-b border-[#1f1f2e]"
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
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
                          <div className="flex items-start gap-4 mb-2">
                            <span className="font-mono text-xs text-gray-500 whitespace-nowrap">
                              {log.timestamp}
                            </span>
                            <span className={`font-mono text-xs font-medium ${getLevelColor(log.level)} whitespace-nowrap`}>
                              {log.level}
                            </span>
                            <span className="font-mono text-xs text-[#8b5cf6] whitespace-nowrap">{log.source}</span>
                            <span className="font-mono text-[11px] text-[#38bdf8] bg-[#0b1220] border border-[#1f1f2e] px-2 py-0.5 rounded whitespace-nowrap">
                              {log.event_type}
                            </span>
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ color: badge.color, backgroundColor: `${badge.color}33` }}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <div className="text-sm text-white">{log.message}</div>
                        </div>
                      </div>
                    </div>
                    {selectedLog === log.id && (
                      <div className="px-6 pb-4">
                        <div className="ml-8 bg-[#000000] border border-[#2a2a3a] p-4 overflow-x-auto">
                          <pre className="text-xs font-mono text-[#10b981]">{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="border-t border-[#1f1f2e] px-6 py-4">
          <PaginationBar
            page={page}
            limit={limit}
            total={logsQuery.data?.total || logs.length}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
